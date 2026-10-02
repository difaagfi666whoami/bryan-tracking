import { config } from "@/lib/config";
import { downloadSource, discoverSources } from "@/lib/google/drive";
import { parseWorkbook, parseWorksheet } from "@/lib/parser/worksheet";
import { resolveWorksheetDates } from "@/lib/parser/date-resolver";
import type { DailyEvaluation, ParsedSheet } from "@/lib/types";
import { generateTrackingDates } from "@/lib/tracking/dates";
import { missingSourceCoverageDates, selectRelevantSources } from "@/lib/tracking/source-selection";
import { aggregateTracking } from "@/lib/tracking/aggregate";
import { evaluateDay } from "@/lib/tracking/evaluate";

export async function getTrackingData() {
  const dates = generateTrackingDates(config.trackingStartDate, config.trackingWorkingDays);
  const sources = await discoverSources();
  if (sources.length === 0) throw new Error("No source workbooks found in the configured Google Drive folder");
  const dateSheets = new Map<string, ParsedSheet>();
  const relevant = selectRelevantSources(sources, dates);
  const owners = new Map<string, string>();
  for (const { source, week } of relevant) {
    const overlapping = week.filter((date) => dates.includes(date));
    for (const date of overlapping) {
      const previous = owners.get(date);
      if (previous) throw new Error(`Multiple weekly workbooks cover ${date}: ${previous} and ${source.path}`);
      owners.set(date, source.path);
    }
    const workbook = parseWorkbook(await downloadSource(source));
    const dailySheets = workbook.flatMap((worksheet) => {
      const parsed = parseWorksheet(worksheet.name, worksheet.rows, "", worksheet.merges);
      return parsed ? [parsed] : [];
    });
    if (dailySheets.length === 0) throw new Error(`No daily checklist worksheet was recognized in ${source.path}`);
    const resolvedSheets = resolveWorksheetDates(dailySheets, week);
    for (const { sheet, date } of resolvedSheets) {
      if (!dates.includes(date)) continue;
      const assigned = { ...sheet, date };
      if (!assigned.maker || !assigned.checker) throw new Error(`Maker/Checker header missing in ${source.name}, worksheet ${sheet.name}`);
      dateSheets.set(date, assigned);
    }
  }
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: config.timezone }).format(new Date());
  const missingCoverage = missingSourceCoverageDates(dates, dateSheets.keys(), today);
  if (missingCoverage.length > 0) {
    throw new Error(`Source coverage incomplete for tracked dates: ${missingCoverage.join(", ")}`);
  }
  const days: DailyEvaluation[] = dates.map((date) => {
    return evaluateDay(dateSheets.get(date) ?? null, date);
  });
  return aggregateTracking(config.trackingPerson, dates, days);
}
