import * as XLSX from "xlsx";
import type { ParsedSheet, RawTask } from "@/lib/types";

type Cell = string | number | boolean | null;
type Row = Cell[];
export type CellMerge = { startRow: number; endRow: number; startColumn: number; endColumn: number };
export type WorkbookSheet = { name: string; rows: Row[]; merges: CellMerge[] };
type Header = {
  row: number;
  task: number;
  explicitTask: boolean;
  start: number;
  startTime: number;
  remark: number;
  check: number;
  checkTime: number;
  server: number;
};

function text(value: Cell): string {
  return value === null || value === undefined ? "" : String(value).trim();
}

function normalized(value: Cell): string {
  return text(value).toLocaleLowerCase().replace(/[\s:_/]+/g, " ").replace(/[^a-z0-9 ]/g, "").trim();
}

export function normalizeBoolean(value: Cell): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1 ? true : value === 0 ? false : null;
  const candidate = text(value).toLocaleLowerCase();
  if (["true", "yes", "1"].includes(candidate)) return true;
  if (["false", "no", "0"].includes(candidate)) return false;
  if (candidate === "") return null;
  throw new Error(`Unexpected checklist boolean value: ${candidate}`);
}

function normalizeTime(value: Cell): string | null {
  if (value === null || value === "") return null;
  if (typeof value === "number") {
    const fraction = value - Math.floor(value);
    const totalSeconds = Math.round(fraction * 86400) % 86400;
    const hour = Math.floor(totalSeconds / 3600);
    const minute = Math.floor((totalSeconds % 3600) / 60);
    const second = totalSeconds % 60;
    const meridiem = hour < 12 ? "AM" : "PM";
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${String(minute).padStart(2, "0")}:${String(second).padStart(2, "0")} ${meridiem}`;
  }
  return text(value) || null;
}

function dateFromSerial(value: Cell): string | null {
  if (typeof value !== "number" || value < 1) return null;
  const parts = XLSX.SSF.parse_date_code(value);
  if (!parts) return null;
  return `${String(parts.y).padStart(4, "0")}-${String(parts.m).padStart(2, "0")}-${String(parts.d).padStart(2, "0")}`;
}

function roleName(rows: Row[], label: "maker" | "checker"): string | null {
  for (const row of rows) {
    for (let index = 0; index < row.length; index += 1) {
      const current = text(row[index]);
      const match = new RegExp(`^${label}\\s*:\\s*(.*)$`, "i").exec(current);
      if (match) return match[1].trim() || text(row[index + 1]) || null;
      if (normalized(row[index]) === label) return text(row[index + 1]) || null;
    }
  }
  return null;
}

function findHeader(rows: Row[]): Header | null {
  for (let rowIndex = 0; rowIndex < Math.min(rows.length, 80); rowIndex += 1) {
    const row = rows[rowIndex] ?? [];
    const labels = row.map(normalized);
    const start = labels.findIndex((label) => label === "start");
    const check = labels.findIndex((label) => label === "check");
    const remark = labels.findIndex((label) => label.includes("remark") || label.includes("comment"));
    if (start < 0 || check < 0) continue;
    const explicitTask = labels.findIndex((label) => /^(task|server|task server)$/.test(label));
    const startTime = labels.findIndex((label, index) => label === "time" && index > start && index < check);
    const checkTime = labels.findIndex((label, index) => label === "time" && index > check);
    return {
      row: rowIndex,
      task: explicitTask,
      explicitTask: explicitTask >= 0,
      start,
      startTime: startTime < 0 ? start + 1 : startTime,
      remark,
      check,
      checkTime: checkTime < 0 ? check + 1 : checkTime,
      server: -1,
    };
  }
  return null;
}

function inferTaskColumns(rows: Row[], header: Header): Header {
  const counts = new Map<number, number>();
  for (const row of rows.slice(header.row + 1)) {
    const hasAction = [header.start, header.startTime, header.check, header.checkTime, header.remark]
      .some((column) => column >= 0 && row[column] !== null && row[column] !== "");
    if (!hasAction) continue;
    for (let column = 0; column < header.start; column += 1) {
      if (typeof row[column] === "string" && text(row[column])) counts.set(column, (counts.get(column) ?? 0) + 1);
    }
  }
  if (!header.explicitTask) {
    const candidateColumns = [...counts.keys()].sort((left, right) => (counts.get(right)! - counts.get(left)!) || (right - left));
    if (candidateColumns.length === 0) return { ...header, task: -1 };
    header = { ...header, task: candidateColumns[0] };
  }
  const serverCandidates = [...counts.keys()].filter((column) => column < header.task).sort((left, right) => (counts.get(right)! - counts.get(left)!) || (right - left));
  return { ...header, server: serverCandidates[0] ?? -1 };
}

function mergedText(rows: Row[], merges: CellMerge[], column: number, rowIndex: number): string {
  const merge = merges.find((item) => item.startColumn === column && item.startRow <= rowIndex && item.endRow >= rowIndex);
  const value = merge ? rows[merge.startRow]?.[column] : rows[rowIndex]?.[column];
  return text(value ?? null);
}

export function parseWorksheet(name: string, rows: Row[], date: string, merges: CellMerge[] = []): ParsedSheet | null {
  const found = findHeader(rows);
  if (!found) return null;
  const header = inferTaskColumns(rows, found);
  if (header.task < 0) return null;
  const maker = roleName(rows, "maker");
  const checker = roleName(rows, "checker");
  const tasks: RawTask[] = [];
  const observedDates = new Set<string>();
  for (let rowIndex = header.row + 1; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex] ?? [];
    const identifier = text(row[header.task]);
    if (!identifier) continue;
    const start = normalizeBoolean(row[header.start] ?? null);
    const check = normalizeBoolean(row[header.check] ?? null);
    const startRawTime = row[header.startTime] ?? null;
    const checkRawTime = row[header.checkTime] ?? null;
    const startTime = normalizeTime(startRawTime);
    const checkTime = normalizeTime(checkRawTime);
    const remark = header.remark < 0 ? null : text(row[header.remark]) || null;
    const hasOperationalData = start !== null || check !== null || startTime !== null || checkTime !== null || remark !== null;
    if (!hasOperationalData) continue;
    for (const rawTime of [startRawTime, checkRawTime]) {
      const observedDate = dateFromSerial(rawTime);
      if (observedDate) observedDates.add(observedDate);
    }
    const server = header.server < 0 ? null : mergedText(rows, merges, header.server, rowIndex) || null;
    const description = header.explicitTask && header.task + 1 < header.start ? text(row[header.task + 1]) || null : null;
    tasks.push({ identifier, description, server, start, startTime, check, checkTime, remark, raw: row });
  }
  if (observedDates.size > 1) throw new Error(`Conflicting completion dates in worksheet ${name}`);
  return { name, date, observedDate: [...observedDates][0] ?? null, maker, checker, tasks };
}

export function parseWorkbook(buffer: Buffer): WorkbookSheet[] {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: false, cellFormula: false, cellHTML: false, bookVBA: false });
  return workbook.SheetNames.map((name) => ({
    name,
    rows: XLSX.utils.sheet_to_json<Row>(workbook.Sheets[name], { header: 1, raw: true, defval: null }),
    merges: (workbook.Sheets[name]["!merges"] ?? []).map((merge) => ({
      startRow: merge.s.r,
      endRow: merge.e.r,
      startColumn: merge.s.c,
      endColumn: merge.e.c,
    })),
  }));
}
