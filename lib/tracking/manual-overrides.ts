import type { DailyEvaluation, Role } from "@/lib/types";
import { weekdayName } from "@/lib/tracking/dates";

type CompletedDayOverride = {
  role: Exclude<Role, "NOT_ASSIGNED">;
  totalTasks: number;
};

const completedDayOverrides = new Map<string, CompletedDayOverride>([
  ["2026-10-26", { role: "MAKER", totalTasks: 25 }],
  ["2026-10-27", { role: "MAKER", totalTasks: 25 }],
  ["2026-10-28", { role: "MAKER", totalTasks: 25 }],
  ["2026-10-29", { role: "MAKER", totalTasks: 25 }],
  ["2026-10-30", { role: "MAKER", totalTasks: 25 }],
]);

export function manualDailyEvaluation(date: string): DailyEvaluation | null {
  const override = completedDayOverrides.get(date);
  if (!override) return null;
  return {
    date,
    weekday: weekdayName(date),
    role: override.role,
    status: "COMPLETED",
    totalTasks: override.totalTasks,
    applicableTasks: override.totalTasks,
    completedTasks: override.totalTasks,
    missedTasks: 0,
    exemptTasks: 0,
    late: false,
    completionRate: 100,
    missedItems: [],
    exemptItems: [],
  };
}

export function allDatesManuallyOverridden(dates: string[]): boolean {
  return dates.length > 0 && dates.every((date) => completedDayOverrides.has(date));
}

export function manualOverrideDates(): string[] {
  return [...completedDayOverrides.keys()];
}
