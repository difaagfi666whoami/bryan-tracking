export function parseTime(value: string | null): number | null {
  if (!value?.trim()) return null;
  const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i.exec(value.trim());
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const second = Number(match[3] ?? 0);
  const meridiem = match[4]?.toUpperCase();
  if (minute > 59 || second > 59 || hour > (meridiem ? 12 : 23) || (meridiem && hour < 1)) return null;
  if (meridiem === "AM" && hour === 12) hour = 0;
  if (meridiem === "PM" && hour !== 12) hour += 12;
  return hour * 3600 + minute * 60 + second;
}

export function isLate(value: string | null, cutoff = "08:00"): boolean {
  const seconds = parseTime(value);
  if (seconds === null) return false;
  const [hour, minute] = cutoff.split(":").map(Number);
  return seconds > hour * 3600 + minute * 60;
}
