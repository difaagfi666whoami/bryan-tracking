import { NextResponse } from "next/server";
import { getTrackingData } from "@/lib/tracking/source";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const tracking = await getTrackingData();
    return NextResponse.json(tracking, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Tracking request failed", error instanceof Error ? error.message : "Unknown error");
    const message = error instanceof Error && error.message.startsWith("Google Drive is not configured")
      ? "Google Drive access is not configured. Add the server environment variables and try again."
      : error instanceof Error && error.message.includes("No source workbooks found")
        ? "No source workbooks were found in the configured Drive folder. Check the folder ID and sharing access."
      : error instanceof Error && error.message.startsWith("Source coverage incomplete")
        ? "Source workbook coverage is incomplete for past tracking dates. Check the weekly workbooks in the configured Drive folder."
      : "Unable to read or evaluate the source workbooks. Check the server logs and workbook access.";
    return NextResponse.json({ error: message }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
