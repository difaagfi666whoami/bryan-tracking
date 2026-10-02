import { config } from "@/lib/config";
import type { DailyEvaluation, ParsedSheet, Role, TaskEvaluation } from "@/lib/types";
import { weekdayName } from "@/lib/tracking/dates";
import { isExemptRemark } from "@/lib/tracking/exemptions";
import { detectRole } from "@/lib/tracking/roles";
import { isLate, parseTime } from "@/lib/tracking/time";

function evaluateTask(task: ParsedSheet["tasks"][number], role: Role): TaskEvaluation {
  const value = role === "MAKER" ? task.start : task.check;
  const time = role === "MAKER" ? task.startTime : task.checkTime;
  if (time && parseTime(time) === null) throw new Error(`Invalid checklist completion time for ${task.identifier}`);
  const status = value === true && parseTime(time) !== null
    ? "COMPLETED"
    : isExemptRemark(task.remark) ? "EXEMPT" : "MISSED";
  return {
    identifier: task.identifier,
    description: task.description,
    server: task.server,
    status,
    time,
    remark: task.remark,
    late: status === "COMPLETED" && isLate(time, config.cutoffTime),
  };
}

export function evaluateDay(sheet: ParsedSheet | null, date: string, person = config.trackingPerson): DailyEvaluation {
  const blank: DailyEvaluation = {
    date,
    weekday: weekdayName(date),
    role: "NOT_ASSIGNED",
    status: "NO_DATA",
    totalTasks: 0,
    applicableTasks: 0,
    completedTasks: 0,
    missedTasks: 0,
    exemptTasks: 0,
    late: false,
    completionRate: 0,
    missedItems: [],
    exemptItems: [],
  };
  if (!sheet) return blank;
  const role = detectRole(sheet.maker, sheet.checker, person);
  if (role === "NOT_ASSIGNED") return { ...blank, role, status: "NOT_ASSIGNED", totalTasks: sheet.tasks.length };
  const evaluations = sheet.tasks.map((task) => evaluateTask(task, role));
  const completed = evaluations.filter((task) => task.status === "COMPLETED");
  const missedItems = evaluations.filter((task) => task.status === "MISSED");
  const exemptItems = evaluations.filter((task) => task.status === "EXEMPT");
  const status = missedItems.length > 0 || evaluations.length === 0
    ? "MISSED"
    : exemptItems.length > 0 ? "COMPLETED_WITH_EXCEPTION" : "COMPLETED";
  return {
    date,
    weekday: weekdayName(date),
    role,
    status,
    totalTasks: evaluations.length,
    applicableTasks: evaluations.length - exemptItems.length,
    completedTasks: completed.length,
    missedTasks: missedItems.length,
    exemptTasks: exemptItems.length,
    late: completed.some((task) => task.late),
    completionRate: evaluations.length === exemptItems.length ? (evaluations.length ? 100 : 0) : Math.round(completed.length / (evaluations.length - exemptItems.length) * 1000) / 10,
    missedItems,
    exemptItems,
  };
}
