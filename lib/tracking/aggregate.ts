import type { DailyEvaluation, RoleSummary, TrackingSummary } from "@/lib/types";
import { dateWeekMonday } from "@/lib/tracking/dates";
import { config } from "@/lib/config";

const successful = (status: DailyEvaluation["status"]) => status === "COMPLETED" || status === "COMPLETED_WITH_EXCEPTION";

export function calculateLongestStreak(days: DailyEvaluation[]): number {
  let longest = 0;
  let current = 0;
  for (const day of days) {
    if (successful(day.status)) {
      current += 1;
      longest = Math.max(longest, current);
    } else {
      current = 0;
    }
  }
  return longest;
}

function summarizeRole(days: DailyEvaluation[], role: "MAKER" | "CHECKER"): RoleSummary {
  const assigned = days.filter((day) => day.role === role);
  return {
    assignedDays: assigned.length,
    successfulDays: assigned.filter((day) => successful(day.status)).length,
    missedDays: assigned.filter((day) => day.status === "MISSED").length,
    lateDays: assigned.filter((day) => day.late).length,
  };
}

export function aggregateTracking(person: string, dates: string[], days: DailyEvaluation[], today = new Intl.DateTimeFormat("en-CA", { timeZone: config.timezone }).format(new Date())): TrackingSummary {
  const completedDays = days.filter((day) => successful(day.status)).length;
  const missedDays = days.filter((day) => day.status === "MISSED" || day.status === "NOT_ASSIGNED").length;
  const currentMonday = dateWeekMonday(today);
  const end = dates.at(-1) ?? dates[0] ?? "";
  return {
    person,
    period: { start: dates[0] ?? "", workingDays: dates.length, end },
    completedDays,
    missedDays,
    remainingDays: Math.max(0, dates.length - completedDays - missedDays),
    completionRate: dates.length ? Math.round(completedDays / dates.length * 1000) / 10 : 0,
    longestStreak: calculateLongestStreak(days),
    maker: summarizeRole(days, "MAKER"),
    checker: summarizeRole(days, "CHECKER"),
    currentWeek: days.filter((day) => dateWeekMonday(day.date) === currentMonday),
    history: days,
  };
}
