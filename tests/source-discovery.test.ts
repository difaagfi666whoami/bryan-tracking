import assert from "node:assert/strict";
import test from "node:test";
import { isWorkbookSource, type DriveSource } from "@/lib/google/drive";
import { resolveWorkbookWeek } from "@/lib/parser/date-resolver";
import { missingSourceCoverageDates, selectRelevantSources } from "@/lib/tracking/source-selection";

const xlsxMime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const googleSheetsMime = "application/vnd.google-apps.spreadsheet";

function source(name: string, path: string, mimeType = xlsxMime): DriveSource {
  return { id: `test-${name}`, name, path, mimeType };
}

test("recognizes Excel workbooks by Drive MIME type with extension fallback", () => {
  assert.equal(isWorkbookSource("28-02", xlsxMime), true);
  assert.equal(isWorkbookSource("weekly-file", "application/vnd.ms-excel"), true);
  assert.equal(isWorkbookSource("macro-file", "application/vnd.ms-excel.sheet.macroEnabled.12"), true);
  assert.equal(isWorkbookSource("31-05.xlsx", "application/octet-stream"), true);
  assert.equal(isWorkbookSource("legacy.xlsm", "application/octet-stream"), true);
  assert.equal(isWorkbookSource("sheet-without-extension", googleSheetsMime), true);
  assert.equal(isWorkbookSource("notes.pdf", "application/pdf"), false);
});

test("selects extensionless MIME-identified weekly files from dynamic year/month paths", () => {
  const trackingDates = ["2026-09-28", "2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02"];
  const target = source("28-02", "Starting Server/2026/09/2026/28-02");
  const selected = selectRelevantSources([target], trackingDates, () => assert.fail("Unexpected source warning"));
  assert.equal(selected.length, 1);
  assert.equal(selected[0].source, target);
  assert.deepEqual(selected[0].week, trackingDates);
  assert.deepEqual(resolveWorkbookWeek(target.path, target.name), trackingDates);
});

test("keeps ordinary weekly filenames and discovers a later year dynamically", () => {
  const trackingDates = ["2027-05-31", "2027-06-01", "2027-06-02", "2027-06-03", "2027-06-04"];
  const laterWorkbook = source("31-05.xlsx", "Starting Server/2027/05/2027/31-05.xlsx");
  const selected = selectRelevantSources([laterWorkbook], trackingDates, () => assert.fail("Unexpected source warning"));
  assert.equal(selected.length, 1);
  assert.deepEqual(selected[0].week, trackingDates);
});

test("skips unrelated malformed weekly files with a warning instead of aborting", () => {
  const warnings: Array<{ name: string; reason: string }> = [];
  const unrelated = source("31-35.xlsx", "Starting Server/2026/01/2026/31-35.xlsx");
  const selected = selectRelevantSources([unrelated], ["2026-09-28", "2026-09-29"], (warning) => warnings.push(warning));
  assert.deepEqual(selected, []);
  assert.equal(warnings.length, 1);
  assert.equal(warnings[0].name, "31-35.xlsx");
  assert.match(warnings[0].reason, /outside tracking period/);
});

test("reports past tracking dates without workbook coverage", () => {
  assert.deepEqual(
    missingSourceCoverageDates(
      ["2026-09-28", "2026-09-29", "2026-09-30", "2026-10-01"],
      ["2026-09-28", "2026-09-29"],
      "2026-09-30",
    ),
    ["2026-09-30"],
  );
  assert.deepEqual(
    missingSourceCoverageDates(["2026-10-01", "2026-10-02"], [], "2026-09-30"),
    [],
  );
});
