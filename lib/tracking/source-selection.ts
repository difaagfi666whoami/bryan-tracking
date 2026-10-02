import type { DriveSource } from "@/lib/google/drive";
import { resolveWorkbookWeek, workbookMonthKey } from "@/lib/parser/date-resolver";
import { dateWeekMonday } from "@/lib/tracking/dates";

export type RelevantDriveSource = { source: DriveSource; week: string[] };
export type SourceWarning = { name: string; reason: string };

const weeklyFilename = /^\d{1,2}-\d{1,2}(?:\.(?:xlsx?|xlsm))?$/i;

export function selectRelevantSources(
  sources: DriveSource[],
  trackingDates: string[],
  onWarning: (warning: SourceWarning) => void = ({ name, reason }) => console.warn("Skipping Drive workbook source", { name, reason }),
): RelevantDriveSource[] {
  const trackingDateSet = new Set(trackingDates);
  const trackingMonths = new Set(trackingDates.map((date) => dateWeekMonday(date).slice(0, 7)));
  const relevant: RelevantDriveSource[] = [];

  for (const source of sources) {
    if (!weeklyFilename.test(source.name)) continue;
    const monthKey = workbookMonthKey(source.path);
    if (!monthKey) {
      onWarning({ name: source.name, reason: "Missing numeric month/year folder context" });
      continue;
    }
    if (!trackingMonths.has(monthKey)) {
      try {
        resolveWorkbookWeek(source.path, source.name);
      } catch {
        onWarning({ name: source.name, reason: "Malformed weekly source outside tracking period" });
      }
      continue;
    }
    try {
      const week = resolveWorkbookWeek(source.path, source.name);
      if (week.some((date) => trackingDateSet.has(date))) relevant.push({ source, week });
    } catch (error) {
      onWarning({ name: source.name, reason: error instanceof Error ? error.message : "Unresolvable weekly source" });
    }
  }
  return relevant;
}

export function missingSourceCoverageDates(
  trackingDates: string[],
  coveredDates: Iterable<string>,
  throughDate: string,
): string[] {
  const covered = new Set(coveredDates);
  return trackingDates.filter((date) => date <= throughDate && !covered.has(date));
}
