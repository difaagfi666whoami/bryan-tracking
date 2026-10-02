import type { ParsedSheet } from "@/lib/types";

function validDate(year: number, month: number, day: number): Date {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) throw new Error("Invalid weekly workbook date");
  return date;
}

export function resolveWorkbookWeek(path: string, filename: string): string[] {
  const week = /^(\d{1,2})-(\d{1,2})(?:\.(xlsx?|xlsm))?$/i.exec(filename);
  if (!week) throw new Error(`Unsupported weekly workbook filename: ${filename}`);
  const folderDate = workbookMonthYear(path);
  if (!folderDate) throw new Error(`Unable to find month/year folder for ${filename}`);
  const { year, month } = folderDate;
  const firstDay = Number(week[1]);
  const lastDay = Number(week[2]);
  const monday = validDate(year, month, firstDay);
  if (monday.getUTCDay() !== 1) throw new Error(`Weekly workbook does not start on Monday: ${filename}`);
  const friday = new Date(monday);
  friday.setUTCDate(friday.getUTCDate() + 4);
  const saturday = new Date(monday);
  saturday.setUTCDate(saturday.getUTCDate() + 5);
  if (friday.getUTCDate() !== lastDay && saturday.getUTCDate() !== lastDay) {
    throw new Error(`Weekly workbook date range does not match filename: ${filename}`);
  }
  return Array.from({ length: 5 }, (_, offset) => {
    const day = new Date(monday);
    day.setUTCDate(day.getUTCDate() + offset);
    return day.toISOString().slice(0, 10);
  });
}

function workbookMonthYear(path: string): { year: number; month: number } | null {
  const folders = path.split("/").filter(Boolean);
  for (let index = folders.length - 1; index >= 0; index -= 1) {
    if (/^\d{4}$/.test(folders[index])) {
      const possibleMonth = Number(folders[index - 1]);
      if (possibleMonth >= 1 && possibleMonth <= 12) {
        return { year: Number(folders[index]), month: possibleMonth };
      }
    }
  }
  return null;
}

export function workbookMonthKey(path: string): string | null {
  const monthYear = workbookMonthYear(path);
  return monthYear ? `${monthYear.year}-${String(monthYear.month).padStart(2, "0")}` : null;
}

const weekdayTokens = new Map<string, number>([
  ["mon", 0], ["monday", 0],
  ["tue", 1], ["tues", 1], ["tuesday", 1],
  ["wed", 2], ["wednesday", 2],
  ["thu", 3], ["thur", 3], ["thurs", 3], ["thursday", 3],
  ["fri", 4], ["friday", 4],
]);

function weekdayOffsetFromName(name: string): number | null {
  const tokens = name.toLocaleLowerCase().match(/[a-z]+/g) ?? [];
  for (const token of tokens) {
    const offset = weekdayTokens.get(token);
    if (offset !== undefined) return offset;
  }
  return null;
}

export function resolveWorksheetDates(sheets: ParsedSheet[], weekDates: string[]): Array<{ sheet: ParsedSheet; date: string }> {
  if (weekDates.length !== 5) throw new Error("A weekly workbook must resolve to five weekdays");
  if (sheets.length > 5) throw new Error("More than five daily checklist worksheets were found");
  const bySheet = new Map<ParsedSheet, string>();
  const usedDates = new Set<string>();
  const assign = (sheet: ParsedSheet, date: string) => {
    if (!weekDates.includes(date)) throw new Error(`Worksheet ${sheet.name} contains a date outside its weekly workbook range`);
    if (usedDates.has(date)) throw new Error(`Multiple worksheets resolve to ${date}`);
    bySheet.set(sheet, date);
    usedDates.add(date);
  };

  for (const sheet of sheets) {
    const namedOffset = weekdayOffsetFromName(sheet.name);
    const namedDate = namedOffset === null ? null : weekDates[namedOffset];
    if (sheet.observedDate && namedDate && sheet.observedDate !== namedDate) {
      throw new Error(`Worksheet name and completion timestamps disagree for ${sheet.name}`);
    }
    if (sheet.observedDate) assign(sheet, sheet.observedDate);
    else if (namedDate) assign(sheet, namedDate);
  }

  const unresolved = sheets.filter((sheet) => !bySheet.has(sheet));
  const remainingDates = weekDates.filter((date) => !usedDates.has(date));
  if (unresolved.length === 1 && remainingDates.length === 1) assign(unresolved[0], remainingDates[0]);
  else if (unresolved.length > 0) throw new Error(`Unable to resolve worksheet dates without guessing: ${unresolved.map((sheet) => sheet.name).join(", ")}`);

  return [...bySheet].map(([sheet, date]) => ({ sheet: { ...sheet, date }, date }));
}
