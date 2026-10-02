export type Role = "MAKER" | "CHECKER" | "NOT_ASSIGNED";
export type TaskStatus = "COMPLETED" | "MISSED" | "EXEMPT";
export type DayStatus =
  | "COMPLETED"
  | "COMPLETED_WITH_EXCEPTION"
  | "MISSED"
  | "NOT_ASSIGNED"
  | "NO_DATA";

export type RawTask = {
  identifier: string;
  description: string | null;
  server: string | null;
  start: boolean | null;
  startTime: string | null;
  check: boolean | null;
  checkTime: string | null;
  remark: string | null;
  raw?: unknown[];
};

export type ParsedSheet = {
  name: string;
  date: string;
  observedDate: string | null;
  maker: string | null;
  checker: string | null;
  tasks: RawTask[];
};

export type TaskEvaluation = {
  identifier: string;
  description: string | null;
  server: string | null;
  status: TaskStatus;
  time: string | null;
  remark: string | null;
  late: boolean;
};

export type DailyEvaluation = {
  date: string;
  weekday: string;
  role: Role;
  status: DayStatus;
  totalTasks: number;
  applicableTasks: number;
  completedTasks: number;
  missedTasks: number;
  exemptTasks: number;
  late: boolean;
  completionRate: number;
  missedItems: TaskEvaluation[];
  exemptItems: TaskEvaluation[];
};

export type RoleSummary = {
  assignedDays: number;
  successfulDays: number;
  missedDays: number;
  lateDays: number;
};

export type TrackingSummary = {
  person: string;
  period: { start: string; workingDays: number; end: string };
  completedDays: number;
  missedDays: number;
  remainingDays: number;
  completionRate: number;
  longestStreak: number;
  maker: RoleSummary;
  checker: RoleSummary;
  currentWeek: DailyEvaluation[];
  history: DailyEvaluation[];
};
