import assert from "node:assert/strict";
import test from "node:test";
import * as XLSX from "xlsx";
import actualWorkbook from "@/tests/fixtures/28-02.structure.json";
import { generateTrackingDates } from "@/lib/tracking/dates";
import { aggregateTracking, calculateLongestStreak } from "@/lib/tracking/aggregate";
import { evaluateDay } from "@/lib/tracking/evaluate";
import { isExemptRemark } from "@/lib/tracking/exemptions";
import { detectRole } from "@/lib/tracking/roles";
import { parseTime, isLate } from "@/lib/tracking/time";
import { normalizeBoolean, parseWorkbook, parseWorksheet } from "@/lib/parser/worksheet";
import { resolveWorkbookWeek, resolveWorksheetDates } from "@/lib/parser/date-resolver";
import type { DailyEvaluation, ParsedSheet } from "@/lib/types";

const fixture: ParsedSheet = {
  name: "Wed",
  date: "2026-09-23",
  observedDate: null,
  maker: "Bryan",
  checker: "Difa Agfi",
  tasks: [
    { identifier: "Server A", description: null, server: null, start: true, startTime: "7:46:20 AM", check: false, checkTime: null, remark: "ok" },
    { identifier: "Server B", description: null, server: null, start: false, startTime: null, check: false, checkTime: null, remark: "mid autumn festival holiday" },
  ],
};

function excelSerial(date: string, hour = 7, minute = 45): number {
  const [year, month, day] = date.split("-").map(Number);
  return (Date.UTC(year, month - 1, day, hour, minute) - Date.UTC(1899, 11, 30)) / 86_400_000;
}

function actualLayoutWorkbook(): Buffer {
  const workbook = XLSX.utils.book_new();
  const profiles = actualWorkbook.dailySheets;
  const sheetOrder = ["PATCH", "Friday", "Wed", "Monday", "Thu", "Tuesday"];
  for (const name of sheetOrder) {
    if (name === "PATCH") {
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([["Patch announcement"], ["Maintenance notice"]]), name);
      continue;
    }
    const profile = profiles.find((item) => item.name === name)!;
    const rows: (string | number | boolean | null)[][] = [
      [null, null, null, `Maker: ${profile.maker}`, null, null, `Checker: ${profile.checker}`],
      [null, null, "Start", "Time", "Remark from PIC", "Check", "Time"],
    ];
    for (let index = 0; index < profile.tasks; index += 1) {
      const date = profile.timestampDate ?? actualWorkbook.weekDates[profile.name === "Thu" ? 3 : 4];
      const server = index === 0 ? "Server group one" : index > 0 && index < 11 ? null
        : index === 11 ? "Server group two" : index === 12 ? null
          : index === 13 ? "Server group three" : index === 14 ? null : `Server ${index + 1}`;
      rows.push([
        server,
        `Task ${String(index + 1).padStart(2, "0")}`,
        index < profile.startTrue,
        index < profile.startTimes ? excelSerial(date) : null,
        index < profile.okRemarks ? "ok" : null,
        index < profile.checkTrue,
        index < profile.checkTimes ? excelSerial(date, 7, 55) : null,
      ]);
    }
    const sheet = XLSX.utils.aoa_to_sheet(rows);
    sheet["!merges"] = [
      { s: { r: 2, c: 0 }, e: { r: 12, c: 0 } },
      { s: { r: 13, c: 0 }, e: { r: 14, c: 0 } },
      { s: { r: 15, c: 0 }, e: { r: 16, c: 0 } },
    ];
    XLSX.utils.book_append_sheet(workbook, sheet, name);
  }
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

test("generates exactly 90 Monday-Friday dates from the configured start", () => {
  const dates = generateTrackingDates("2026-09-22", 90);
  assert.equal(dates.length, 90);
  assert.equal(dates[0], "2026-09-22");
  assert.equal(dates[4], "2026-09-28");
  assert.equal(dates.at(-1), "2027-01-25");
  assert.ok(dates.every((date) => ![0, 6].includes(new Date(`${date}T00:00:00Z`).getUTCDay())));
});

test("resolves a weekly workbook that crosses into a new month", () => {
  assert.deepEqual(resolveWorkbookWeek("log/Starting Server/2026/09/2026/28-02.xlsx", "28-02.xlsx"), [
    "2026-09-28", "2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02",
  ]);
  assert.deepEqual(resolveWorkbookWeek("log/Starting Server/2026/12/2026", "28-01"), [
    "2026-12-28", "2026-12-29", "2026-12-30", "2026-12-31", "2027-01-01",
  ]);
});

test("maps the actual checklist layout by timestamp and weekday, not tab order", () => {
  const workbook = parseWorkbook(actualLayoutWorkbook());
  assert.deepEqual(workbook.map((sheet) => sheet.name), ["PATCH", "Friday", "Wed", "Monday", "Thu", "Tuesday"]);
  const dailySheets = workbook.flatMap((worksheet) => {
    const sheet = parseWorksheet(worksheet.name, worksheet.rows, "", worksheet.merges);
    return sheet ? [sheet] : [];
  });
  assert.deepEqual(dailySheets.map((sheet) => sheet.name), ["Friday", "Wed", "Monday", "Thu", "Tuesday"]);
  const resolved = resolveWorksheetDates(dailySheets, actualWorkbook.weekDates);
  assert.deepEqual(Object.fromEntries(resolved.map(({ sheet, date }) => [sheet.name, date])), {
    Friday: "2026-10-02",
    Wed: "2026-09-30",
    Monday: "2026-09-28",
    Thu: "2026-10-01",
    Tuesday: "2026-09-29",
  });
  for (const profile of actualWorkbook.dailySheets) {
    const sheet = resolved.find(({ sheet: parsed }) => parsed.name === profile.name)!.sheet;
    assert.equal(sheet.maker, profile.maker);
    assert.equal(sheet.checker, profile.checker);
    assert.equal(sheet.observedDate, profile.timestampDate);
    assert.equal(sheet.tasks.length, profile.tasks);
    assert.equal(sheet.tasks.filter((task) => task.start === true).length, profile.startTrue);
    assert.equal(sheet.tasks.filter((task) => task.start === false).length, profile.startFalse);
    assert.equal(sheet.tasks.filter((task) => task.check === true).length, profile.checkTrue);
    assert.equal(sheet.tasks.filter((task) => task.check === false).length, profile.checkFalse);
    assert.equal(sheet.tasks.filter((task) => task.startTime !== null).length, profile.startTimes);
    assert.equal(sheet.tasks.filter((task) => task.checkTime !== null).length, profile.checkTimes);
    assert.equal(sheet.tasks.filter((task) => task.remark === "ok").length, profile.okRemarks);
    assert.equal(sheet.tasks.filter((task) => task.remark === null).length, profile.blankRemarks);
    assert.equal(sheet.tasks.some((task) => isExemptRemark(task.remark)), false);
  }
  const monday = resolved.find(({ sheet }) => sheet.name === "Monday")!.sheet;
  assert.equal(monday.maker, "Other");
  assert.equal(monday.checker, "Bryan");
  assert.equal(monday.observedDate, "2026-09-28");
  assert.equal(monday.tasks.length, 26);
  assert.equal(monday.tasks.filter((task) => task.start === true).length, 25);
  assert.equal(monday.tasks.filter((task) => task.start === false).length, 1);
  assert.equal(monday.tasks.filter((task) => task.startTime !== null).length, 25);
  assert.equal(monday.tasks.filter((task) => task.check === true).length, 25);
  assert.equal(monday.tasks.filter((task) => task.checkTime !== null).length, 25);
  assert.equal(monday.tasks[0].server, "Server group one");
  assert.equal(monday.tasks[10].server, "Server group one");
  assert.equal(monday.tasks[11].server, "Server group two");
  assert.equal(monday.tasks[13].server, "Server group three");
  assert.equal(monday.tasks.every((task) => task.remark === "ok"), true);
  const thursday = resolved.find(({ sheet }) => sheet.name === "Thu")!.sheet;
  assert.equal(thursday.observedDate, null);
  assert.equal(thursday.tasks.length, 26);
  assert.equal(thursday.tasks.every((task) => task.start === false && task.check === false), true);
  assert.equal(thursday.tasks.every((task) => task.startTime === null && task.checkTime === null), true);
  assert.equal(thursday.tasks.filter((task) => task.remark === null).length, 1);
  assert.equal(thursday.tasks.filter((task) => task.remark === "ok").length, 25);
  assert.equal(dailySheets.some((sheet) => sheet.name === "PATCH"), false);
});

test("refuses positional guesses when worksheet dates cannot be resolved", () => {
  const unknownSheets: ParsedSheet[] = ["Ops A", "Ops B"].map((name) => ({ ...fixture, name, observedDate: null }));
  assert.throws(() => resolveWorksheetDates(unknownSheets, actualWorkbook.weekDates), /Unable to resolve worksheet dates without guessing/);
});

test("detects Bryan's role case-insensitively", () => {
  assert.equal(detectRole("bRyAn", "Difa"), "MAKER");
  assert.equal(detectRole("Difa", "BRYAN"), "CHECKER");
  assert.equal(detectRole("Difa", "Difa"), "NOT_ASSIGNED");
});

test("normalizes booleans and rejects unexpected values", () => {
  assert.equal(normalizeBoolean(true), true);
  assert.equal(normalizeBoolean("FALSE"), false);
  assert.equal(normalizeBoolean(null), null);
  assert.throws(() => normalizeBoolean("maybe"), /Unexpected checklist boolean/);
});

test("parses operational rows and ignores an empty visual group row", () => {
  const parsed = parseWorksheet("Wed", [
    ["Maker: Bryan"],
    ["Checker:", "Difa Agfi"],
    ["Task / Server", "Start", "Time", "Remark from PIC", "Check", "Time"],
    ["Production Servers"],
    ["Server A", true, "7:46:20 AM", "ok", false, null],
    ["Server B", false, null, "holiday", false, null],
  ], "2026-09-23");
  assert.ok(parsed);
  assert.equal(parsed.maker, "Bryan");
  assert.equal(parsed.checker, "Difa Agfi");
  assert.equal(parsed.tasks.length, 2);
  assert.equal(parsed.tasks[0].start, true);
  const checklistRows = Array.from({ length: 25 }, (_, index) => [`Server ${index + 1}`, true, "7:50 AM", "ok", false, null]);
  const completeChecklist = parseWorksheet("Renamed sheet", [
    ["Maker: Bryan"],
    ["Checker:", "Difa Agfi"],
    ["Task / Server", "Start", "Time", "Remark from PIC", "Check", "Time"],
    ...checklistRows,
  ], "2026-09-23");
  assert.equal(completeChecklist?.tasks.length, 25);
});

test("reads an XLSX workbook buffer into normalized worksheet rows", () => {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
    ["Maker: Bryan"],
    ["Checker: Difa"],
    ["Task / Server", "Start", "Time", "Remark from PIC", "Check", "Time"],
    ["Server A", true, "7:55 AM", "ok", false, null],
  ]), "Renamed day");
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
  const sheets = parseWorkbook(buffer);
  assert.equal(sheets.length, 1);
  assert.equal(sheets[0].name, "Renamed day");
  assert.equal(parseWorksheet(sheets[0].name, sheets[0].rows, "2026-09-23")?.tasks.length, 1);
});

test("exemptions use explicit normalized keywords only", () => {
  assert.equal(isExemptRemark(" Mid   Autumn Festival HOLIDAY "), true);
  for (const remark of ["public holiday", "maintenance", "not required", "server offline", "market holiday"]) assert.equal(isExemptRemark(remark), true);
  assert.equal(isExemptRemark("server issue"), false);
  assert.equal(isExemptRemark(""), false);
});

test("evaluates completed, missed, exempt, late, absent, and no-data days", () => {
  const exception = evaluateDay(fixture, fixture.date);
  assert.equal(exception.status, "COMPLETED_WITH_EXCEPTION");
  assert.equal(exception.completedTasks, 1);
  assert.equal(exception.exemptTasks, 1);
  assert.equal(exception.missedTasks, 0);
  const missed = evaluateDay({ ...fixture, tasks: [{ ...fixture.tasks[0], start: false, remark: "server issue" }] }, fixture.date);
  assert.equal(missed.status, "MISSED");
  assert.equal(missed.missedTasks, 1);
  const late = evaluateDay({ ...fixture, tasks: [{ ...fixture.tasks[0], startTime: "8:01 AM" }] }, fixture.date);
  assert.equal(late.status, "COMPLETED");
  assert.equal(late.late, true);
  assert.equal(evaluateDay({ ...fixture, maker: "Difa", checker: "Difa" }, fixture.date).status, "NOT_ASSIGNED");
  assert.equal(evaluateDay(null, fixture.date).status, "NO_DATA");
  const complete = evaluateDay({ ...fixture, tasks: [fixture.tasks[0]] }, fixture.date);
  assert.equal(complete.status, "COMPLETED");
  const allExempt = evaluateDay({ ...fixture, tasks: [{ ...fixture.tasks[1] }] }, fixture.date);
  assert.equal(allExempt.status, "COMPLETED_WITH_EXCEPTION");
  const checker = evaluateDay({ ...fixture, maker: "Difa", checker: "Bryan" }, fixture.date);
  assert.equal(checker.role, "CHECKER");
  assert.equal(checker.status, "MISSED");
  const multipleMisses = evaluateDay({ ...fixture, tasks: fixture.tasks.map((task) => ({ ...task, start: false, remark: "" })) }, fixture.date);
  assert.equal(multipleMisses.missedTasks, 2);
});

test("parses cutoff times using Hong Kong wall-clock source values", () => {
  assert.equal(parseTime("12:00:01 AM"), 1);
  assert.equal(parseTime("8:00:00 AM"), 28800);
  assert.equal(isLate("8:00 AM"), false);
  assert.equal(isLate("8:00:01 AM"), true);
  assert.equal(parseTime("bad time"), null);
  assert.throws(() => evaluateDay({ ...fixture, tasks: [{ ...fixture.tasks[0], startTime: "not a time" }] }, fixture.date), /Invalid checklist completion time/);
});

test("successful streaks skip weekends but break on missed and no-data days", () => {
  const records = [
    ["2026-09-25", "COMPLETED"],
    ["2026-09-28", "COMPLETED_WITH_EXCEPTION"],
    ["2026-09-29", "MISSED"],
    ["2026-09-30", "COMPLETED"],
    ["2026-10-01", "NO_DATA"],
    ["2026-10-02", "COMPLETED"],
  ] as const;
  const history = records.map(([date, status]) => ({
    ...evaluateDay(null, date),
    status,
  } as DailyEvaluation));
  assert.equal(calculateLongestStreak(history), 2);
});

test("aggregates successful progress and factual Maker/Checker summaries", () => {
  const dates = ["2026-09-22", "2026-09-23", "2026-09-24"];
  const days = [
    evaluateDay(fixture, dates[0]),
    evaluateDay({ ...fixture, maker: "Difa", checker: "Bryan" }, dates[1]),
    evaluateDay({ ...fixture, tasks: [{ ...fixture.tasks[0], start: false, remark: "" }] }, dates[2]),
  ];
  const summary = aggregateTracking("Bryan", dates, days, "2026-09-24");
  assert.equal(summary.completedDays, 1);
  assert.equal(summary.missedDays, 2);
  assert.equal(summary.completionRate, 33.3);
  assert.equal(summary.maker.assignedDays, 2);
  assert.equal(summary.checker.assignedDays, 1);
  assert.equal(summary.currentWeek.length, 3);
});
