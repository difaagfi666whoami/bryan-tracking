const DAY_MS = 86_400_000;

function parseIsoDate(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new Error(`Invalid ISO date: ${value}`);
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  if (date.toISOString().slice(0, 10) !== value) throw new Error(`Invalid ISO date: ${value}`);
  return date;
}

function iso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function isWorkingDay(value: string | Date): boolean {
  const date = typeof value === "string" ? parseIsoDate(value) : value;
  const day = date.getUTCDay();
  return day !== 0 && day !== 6;
}

export function generateTrackingDates(startDate: string, count: number): string[] {
  if (!Number.isInteger(count) || count < 0) throw new Error("Working day count must be a non-negative integer");
  const cursor = parseIsoDate(startDate);
  const result: string[] = [];
  while (result.length < count) {
    if (isWorkingDay(cursor)) result.push(iso(cursor));
    cursor.setTime(cursor.getTime() + DAY_MS);
  }
  return result;
}

export function weekdayName(date: string): string {
  return new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: "UTC" }).format(parseIsoDate(date));
}

export function dateWeekMonday(date: string): string {
  const value = parseIsoDate(date);
  const offset = (value.getUTCDay() + 6) % 7;
  value.setUTCDate(value.getUTCDate() - offset);
  return iso(value);
}
