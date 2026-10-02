import { google } from "googleapis";
import { config } from "@/lib/config";

export type DriveSource = { id: string; name: string; path: string; mimeType: string };

const excelMimeTypes = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "application/vnd.ms-excel.sheet.macroEnabled.12",
]);

export function isWorkbookSource(name: string, mimeType: string): boolean {
  return mimeType === "application/vnd.google-apps.spreadsheet"
    || excelMimeTypes.has(mimeType)
    || /\.(xlsx?|xlsm)$/i.test(name);
}

function driveClient() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!email || !privateKey || !config.driveRootFolderId) {
    throw new Error("Google Drive is not configured. Set the three Google variables in the server environment.");
  }
  const auth = new google.auth.JWT({ email, key: privateKey, scopes: ["https://www.googleapis.com/auth/drive.readonly"] });
  return google.drive({ version: "v3", auth });
}

export async function discoverSources(): Promise<DriveSource[]> {
  const drive = driveClient();
  const found: DriveSource[] = [];
  const visited = new Set<string>();
  async function walk(folderId: string, parentPath: string): Promise<void> {
    if (visited.has(folderId)) return;
    visited.add(folderId);
    let pageToken: string | undefined;
    do {
      const response = await drive.files.list({
        q: `'${folderId}' in parents and trashed = false`,
        pageSize: 1000,
        pageToken,
        fields: "nextPageToken,files(id,name,mimeType)",
        orderBy: "name",
      });
      for (const item of response.data.files ?? []) {
        if (!item.id || !item.name || !item.mimeType) continue;
        const path = `${parentPath}/${item.name}`;
        if (item.mimeType === "application/vnd.google-apps.folder") {
          await walk(item.id, path);
        } else if (isWorkbookSource(item.name, item.mimeType)) {
          found.push({ id: item.id, name: item.name, path, mimeType: item.mimeType });
        }
      }
      pageToken = response.data.nextPageToken ?? undefined;
    } while (pageToken);
  }
  await walk(config.driveRootFolderId!, "");
  return found;
}

export async function downloadSource(source: DriveSource): Promise<Buffer> {
  const drive = driveClient();
  const response = source.mimeType === "application/vnd.google-apps.spreadsheet"
    ? await drive.files.export({ fileId: source.id, mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }, { responseType: "arraybuffer" })
    : await drive.files.get({ fileId: source.id, alt: "media" }, { responseType: "arraybuffer" });
  return Buffer.from(response.data as ArrayBuffer);
}
