# Technical Specification — Bryan Morning Start 90-Day Tracker

## 1. Purpose

This document defines the technical implementation for the **Bryan Morning Start 90-Day Tracker**.

The PRD defines product behavior. This document defines how the application should be implemented.

The application is a read-only Next.js application deployed to Vercel.

Core pipeline:

```text
Google Drive / Google Sheets
        ↓
Source Adapter
        ↓
Workbook / Sheet Parser
        ↓
Date Resolver
        ↓
Role Detector
        ↓
Task Classifier
        ↓
Daily Evaluation Engine
        ↓
90-Day Aggregator
        ↓
API
        ↓
Minimalist React UI
```

---

# 2. Technology Stack

## Required

- Next.js
- React
- TypeScript
- Vercel
- Google Drive API
- Google Sheets API where required
- XLSX parser such as SheetJS (`xlsx`)
- CSS or Tailwind CSS

## V1 deliberately does not use

- n8n
- PostgreSQL / Neon
- Redis
- Firebase
- Supabase
- external workflow automation
- LLM/AI classification
- client-side Google Drive authentication

---

# 3. Repository Structure

Recommended structure:

```text
morning-start/
│
├── app/
│   ├── page.tsx
│   ├── layout.tsx
│   │
│   ├── api/
│   │   └── tracking/
│   │       └── route.ts
│   │
│   └── components/
│       ├── ProgressHeader.tsx
│       ├── SummaryMetrics.tsx
│       ├── WeeklyView.tsx
│       ├── HistoryView.tsx
│       ├── RoleSummary.tsx
│       ├── DayDetail.tsx
│       ├── StatusBadge.tsx
│       └── RefreshButton.tsx
│
├── lib/
│   ├── config.ts
│   │
│   ├── google/
│   │   ├── auth.ts
│   │   ├── drive.ts
│   │   └── sheets.ts
│   │
│   ├── parser/
│   │   ├── workbook.ts
│   │   ├── worksheet.ts
│   │   ├── headers.ts
│   │   └── rows.ts
│   │
│   ├── tracking/
│   │   ├── date-resolver.ts
│   │   ├── role-detector.ts
│   │   ├── task-classifier.ts
│   │   ├── exemption.ts
│   │   ├── daily-evaluator.ts
│   │   ├── streak.ts
│   │   └── aggregator.ts
│   │
│   ├── types/
│   │   ├── source.ts
│   │   ├── tracking.ts
│   │   └── dashboard.ts
│   │
│   └── utils/
│       ├── dates.ts
│       ├── strings.ts
│       └── time.ts
│
├── tests/
│   ├── parser/
│   ├── tracking/
│   ├── dates/
│   └── fixtures/
│
├── public/
│
├── .env.local
├── .env.example
├── package.json
├── tsconfig.json
└── README.md
```

The exact directory names may change if the implementation benefits from a different structure, but the logical separation must remain.

---

# 4. Configuration

Create one central configuration module.

Example:

```ts
export const config = {
  trackingPerson: "Bryan",
  trackingStartDate: "2026-09-22",
  trackingWorkingDays: 90,

  timezone: "Asia/Hong_Kong",

  startWindow: "07:30",
  cutoffTime: "08:00",

  driveRootFolderId: process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID,

  exemptionKeywords: [
    "holiday",
    "public holiday",
    "maintenance",
    "not required",
    "server offline",
    "market holiday",
  ],
};
```

Do not hardcode business rules in UI components.

---

# 5. Environment Variables

Required:

```env
GOOGLE_SERVICE_ACCOUNT_EMAIL=
GOOGLE_PRIVATE_KEY=
GOOGLE_DRIVE_ROOT_FOLDER_ID=
```

Optional if Google Sheets OAuth/service configuration requires additional values.

Never expose Google credentials through `NEXT_PUBLIC_*`.

---

# 6. Google Authentication

Use a server-side Google service account.

The Google Drive folder containing the operational files should be shared with the service account.

The browser must never authenticate directly against Google Drive.

Flow:

```text
Browser
   ↓
Next.js API
   ↓
Google service account
   ↓
Google Drive API
```

The private key must only exist in Vercel server-side environment variables.

---

# 7. Source Discovery

The application needs a source adapter abstraction.

```ts
interface SourceAdapter {
  listWeeklySources(): Promise<SourceFile[]>;
  readSource(source: SourceFile): Promise<RawWorkbook>;
}
```

This allows XLSX and Google Sheets to share the same downstream processing.

Example:

```ts
type SourceFile = {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  parentFolderId?: string;
  path?: string;
};
```

The first implementation should prioritize XLSX files.

---

# 8. Google Drive File Discovery

Search the configured root folder recursively.

Expected path:

```text
log/
└── Starting Server/
    └── 2026/
        └── MM/YYYY/
```

The implementation should discover monthly folders and weekly XLSX files.

Do not hardcode:

```text
09/2026
10/2026
```

Instead, discover folders dynamically.

Only source files relevant to the configured 90-day tracking period should be parsed.

---

# 9. File Date Resolution

Weekly filenames may look like:

```text
21-25.xlsx
28-02.xlsx
05-09.xlsx
```

The containing folder provides month context.

Example:

```text
09/2026/28-02.xlsx
```

means the week crosses from September into October.

The resolver must correctly calculate:

```text
Monday = 2026-09-28
Tuesday = 2026-09-29
Wednesday = 2026-09-30
Thursday = 2026-10-01
Friday = 2026-10-02
```

Do not assume both filename numbers belong to the same month.

The resolver should use:

1. containing folder month/year
2. filename first day
3. filename second day
4. weekday sequence
5. tracking period

The resulting dates must be explicit ISO dates:

```text
YYYY-MM-DD
```

---

# 10. Date Engine

Create:

```ts
getTrackingDates(
  startDate: string,
  numberOfWorkingDays: number
): Date[]
```

For:

```text
2026-09-22
90
```

return exactly 90 Monday–Friday dates.

Weekends must never appear in the resulting list.

Create:

```ts
isWorkingDay(date): boolean
```

and:

```ts
getPreviousWorkingDay(date)
getNextWorkingDay(date)
```

Use timezone-safe date handling.

Do not rely on the browser's local timezone for business calculations.

---

# 11. Workbook Parsing

Use SheetJS or equivalent.

The parser must convert raw spreadsheet cells into a normalized intermediate representation.

Example:

```ts
type RawWorksheet = {
  name: string;
  rows: RawCell[][];
};
```

Then:

```ts
type ParsedDailySheet = {
  sheetName: string;
  date: string;
  maker: string | null;
  checker: string | null;
  columns: ColumnMap;
  tasks: RawTask[];
};
```

---

# 12. Header Detection

Do not assume:

```text
Maker = fixed row
Checker = fixed row
Start = fixed column C
Check = fixed column F
```

Instead search worksheet content for labels.

Recognize:

```text
Maker:
Checker:
Start
Time
Remark from PIC
Check
```

Header matching should be normalized:

- trim whitespace
- lowercase
- normalize repeated spaces
- ignore harmless punctuation where possible

Example:

```ts
normalize("  Maker: Bryan ")
→ "maker: bryan"
```

---

# 13. Role Detection

Create:

```ts
detectRoles(sheet): {
  maker: string | null;
  checker: string | null;
}
```

Then:

```ts
detectBryanRole(
  maker: string | null,
  checker: string | null
): "MAKER" | "CHECKER" | "NOT_ASSIGNED"
```

Matching Bryan should be case-insensitive.

The initial requirement is simple name matching:

```text
Bryan
```

Do not implement fuzzy identity matching unless real source data requires it.

---

# 14. Task Row Detection

Create:

```ts
parseTasks(sheet, columnMap): RawTask[]
```

A task row should contain the operational checklist structure.

The parser must avoid counting visual group/header rows as separate tasks.

A task should have enough information to identify the server/checklist item.

Example:

```ts
type RawTask = {
  identifier: string;
  description?: string;

  start?: boolean | null;
  startTime?: string | null;

  check?: boolean | null;
  checkTime?: string | null;

  remark?: string | null;
};
```

All real checklist rows should be retained even if their action value is FALSE or blank.

---

# 15. Task Identifier

The dashboard should identify a missed/exempt task using the most useful available source information.

Preferred:

1. Server/IP/group identifier
2. Task description
3. Combined identifier if needed

Example:

```text
192.168.15.36
ICAMS Notification
```

The UI may display:

```text
ICAMS Notification
```

with server/IP as secondary information.

Do not invent identifiers.

---

# 16. Role Action Selection

Create:

```ts
getRelevantAction(
  task: RawTask,
  role: BryanRole
): ActionValue
```

Rules:

```text
MAKER
→ Start / Start Time

CHECKER
→ Check / Check Time
```

`NOT_ASSIGNED` has no role action.

---

# 17. Boolean Normalization

Source TRUE/FALSE values must be normalized.

Recognize common spreadsheet representations:

```text
TRUE
FALSE
true
false
1
0
```

Prefer native boolean values from XLSX where available.

Normalize to:

```ts
true
false
null
```

Blank cells become:

```ts
null
```

Do not treat arbitrary text as TRUE.

---

# 18. Remark Normalization

Create:

```ts
normalizeRemark(remark): string
```

Rules:

- trim
- lowercase
- collapse repeated whitespace

Example:

```text
" Mid Autumn Festival Holiday "
```

becomes:

```text
"mid autumn festival holiday"
```

---

# 19. Exemption Engine

Create:

```ts
isExemptRemark(remark: string | null): boolean
```

Initial keyword list:

```ts
[
  "holiday",
  "public holiday",
  "maintenance",
  "not required",
  "server offline",
  "market holiday",
]
```

Matching should be case-insensitive.

Prefer substring matching initially.

Example:

```text
"mid autumn festival holiday"
```

matches:

```text
"holiday"
```

→ exempt.

Do not classify:

```text
"server issue"
```

as exempt unless explicitly configured.

---

# 20. Task Classification

Create:

```ts
classifyTask(task, role, now): TaskEvaluation
```

Suggested result:

```ts
type TaskStatus =
  | "COMPLETED"
  | "MISSED"
  | "EXEMPT"
  | "LATE";
```

Task evaluation rules:

### Completed on time

Relevant action = TRUE and completion time <= 08:00 HK.

### Completed late

Relevant action = TRUE and completion time > 08:00 HK.

### Exempt

Relevant action is FALSE/blank and remark matches exemption rules.

### Missed

Relevant action is FALSE/blank and no valid exemption exists.

---

# 21. Time Parsing

Spreadsheet times may appear as:

```text
7:46:20 AM
7:59:42 AM
```

They may also be represented internally as Excel date/time serials.

The parser must normalize source time into a structured value.

Example:

```ts
type ParsedTime = {
  hour: number;
  minute: number;
  second: number;
};
```

The evaluation timezone is:

```text
Asia/Hong_Kong
```

The source format is assumed to represent Hong Kong operational time.

---

# 22. Late Calculation

Define:

```ts
isLate(completionTime): boolean
```

using:

```text
08:00:00 Asia/Hong_Kong
```

Rules:

```text
07:30:00–08:00:00
→ on time

>08:00:00
→ late
```

A task completed after cutoff remains completed but late.

---

# 23. Daily Evaluation

Create:

```ts
evaluateDay(
  parsedSheet: ParsedDailySheet,
  targetDate: string
): DailyEvaluation
```

Result:

```ts
type DailyEvaluation = {
  date: string;
  weekday: string;

  role: BryanRole;

  totalTasks: number;
  applicableTasks: number;
  completedTasks: number;
  missedTasks: number;
  exemptTasks: number;
  lateTasks: number;

  completionRate: number;

  status:
    | "COMPLETED"
    | "COMPLETED_WITH_EXCEPTION"
    | "MISSED"
    | "NOT_ASSIGNED"
    | "NO_DATA";

  missedItems: TaskEvaluation[];
  exemptItems: TaskEvaluation[];
};
```

---

# 24. Daily Status Rules

Recommended priority:

```text
1. NO_DATA
2. NOT_ASSIGNED
3. MISSED
4. COMPLETED_WITH_EXCEPTION
5. COMPLETED
```

But the final status must be based on task-level results.

### COMPLETED

All applicable tasks completed on time.

### COMPLETED_WITH_EXCEPTION

All remaining incomplete tasks are legitimate exemptions/accepted exceptions and no genuine missed task exists.

### MISSED

At least one genuine missed task exists.

### NOT_ASSIGNED

Bryan does not appear as Maker or Checker on an eligible working day.

### NO_DATA

Expected source data is missing or cannot be safely evaluated.

Do not silently convert NO_DATA to MISSED.

---

# 25. Partial Completion / Tolerance

The system must preserve the user's preferred interpretation:

```text
23 / 24
```

can be acceptable if the one missing item has a legitimate operational explanation.

Therefore:

```text
23 completed
1 exempt
```

should produce:

```text
COMPLETED_WITH_EXCEPTION
```

while:

```text
23 completed
1 missed
```

produces:

```text
MISSED
```

The number alone must never determine the result.

Remark classification determines whether the incomplete item is exempt or missed.

---

# 26. NOT_ASSIGNED Handling

If:

```text
Maker = Difa
Checker = Difa
```

and Bryan is absent from both roles:

```text
role = NOT_ASSIGNED
```

For an eligible working day, this is treated as a missed day for Bryan.

However, retain the underlying role state:

```text
NOT_ASSIGNED
```

so the UI can explain the result.

---

# 27. Holiday / Non-Working Day Handling

If a checklist is empty and the source contains a valid holiday/non-working remark, the date should not reduce the working-day performance calculation.

The system should classify it as:

```text
EXEMPT
```

or an equivalent non-working state internally.

This date should not:
- count as completed
- count as missed
- break a streak

If the 90-day period contains such a non-working day, the tracking engine should continue to the next eligible working day.

---

# 28. Late Day Status

If all applicable tasks eventually complete but one or more complete after cutoff:

```text
COMPLETED_LATE
```

may be represented internally as:

```ts
status: "COMPLETED"
late: true
```

This is preferable to making "late" a fundamentally failed status.

Suggested UI:

```text
COMPLETED · LATE
```

If the day has a genuine missed task:

```text
MISSED
```

even if other tasks were late.

---

# 29. 90-Day Aggregation

Create:

```ts
aggregateTracking(
  dailyEvaluations: DailyEvaluation[]
): TrackingSummary
```

Example:

```ts
type TrackingSummary = {
  totalWorkingDays: number;
  completedDays: number;
  missedDays: number;
  completedWithExceptionDays: number;
  exemptDays: number;

  completionRate: number;

  longestStreak: number;

  maker: RoleSummary;
  checker: RoleSummary;

  days: DailyEvaluation[];
};
```

The primary progress should count successful eligible working days.

Define clearly whether `COMPLETED_WITH_EXCEPTION` counts as a completed day. Recommended:

```text
YES
```

because the user considers legitimate exceptions acceptable.

---

# 30. Completion Rate

Primary 90-day completion:

```text
successful completed eligible days / eligible tracking days
```

A day with legitimate exceptions counts as successful.

A genuine missed day does not.

---

# 31. Longest Streak

Create:

```ts
calculateLongestStreak(days: DailyEvaluation[]): number
```

Rules:

- Monday–Friday only
- weekend does not break streak
- COMPLETED counts
- COMPLETED_WITH_EXCEPTION counts
- MISSED breaks streak
- NOT_ASSIGNED breaks streak
- valid non-working/exempt holiday does not break streak
- NO_DATA must not be silently interpreted as successful

Example:

```text
Fri  Completed
Sat  -
Sun  -
Mon  Completed
Tue  Completed
```

Longest streak = 3 working days.

---

# 32. Maker/Checker Summary

Create:

```ts
calculateRoleSummary(days, role): RoleSummary
```

Example:

```ts
type RoleSummary = {
  assignedDays: number;
  successfulDays: number;
  missedDays: number;
  lateDays: number;
  completionRate: number;
};
```

Example output:

```text
Maker
38 / 42
90.5%

Checker
41 / 43
95.3%
```

These are descriptive metrics only.

---

# 33. API

Primary endpoint:

```text
GET /api/tracking
```

Optional query:

```text
GET /api/tracking?refresh=true
```

The endpoint should return normalized dashboard data.

Example:

```json
{
  "person": "Bryan",
  "period": {
    "start": "2026-09-22",
    "workingDays": 90
  },
  "progress": {
    "completed": 32,
    "missed": 8,
    "completionRate": 35.6
  },
  "longestStreak": 14,
  "maker": {
    "assignedDays": 42,
    "successfulDays": 38,
    "completionRate": 90.5
  },
  "checker": {
    "assignedDays": 43,
    "successfulDays": 41,
    "completionRate": 95.3
  },
  "currentWeek": [],
  "history": []
}
```

Do not return raw Google credentials.

---

# 34. Caching

V1 should prioritize correctness.

Page load/manual refresh should retrieve current source data.

If Vercel runtime constraints make repeated Drive reads expensive, introduce a short server-side cache later.

Do not introduce a persistent database solely for caching in V1.

---

# 35. Error Model

Define typed errors:

```ts
type TrackingError =
  | "SOURCE_NOT_FOUND"
  | "SOURCE_READ_FAILED"
  | "INVALID_WORKBOOK"
  | "INVALID_WORKSHEET"
  | "DATE_RESOLUTION_FAILED"
  | "ROLE_DETECTION_FAILED"
  | "TASK_PARSE_FAILED";
```

The API should return a safe user-facing error message and log detailed diagnostic information server-side.

Never fabricate a tracking result.

---

# 36. Testing Strategy

The tracking engine should be testable without Google Drive.

Create fixture workbooks/data representing:

### Case 1 — Maker completed

```text
Maker: Bryan
all Start = TRUE
```

Expected:

```text
MAKER
COMPLETED
```

### Case 2 — Checker completed

```text
Checker: Bryan
all Check = TRUE
```

Expected:

```text
CHECKER
COMPLETED
```

### Case 3 — Genuine miss

```text
Start = FALSE
Remark = blank
```

Expected:

```text
MISSED
```

### Case 4 — Holiday

```text
Start = FALSE
Remark = holiday
```

Expected:

```text
EXEMPT
```

### Case 5 — Completed with exception

```text
24 applicable
23 completed
1 legitimate exemption
```

Expected:

```text
COMPLETED_WITH_EXCEPTION
```

### Case 6 — Late

```text
all completed
completion after 08:00
```

Expected:

```text
COMPLETED + late
```

### Case 7 — Bryan absent

```text
Maker: Difa
Checker: Difa
```

Expected:

```text
NOT_ASSIGNED
```

### Case 8 — Weekend

Expected:

```text
not included
```

### Case 9 — Cross-month week

```text
09/2026/28-02.xlsx
```

Expected:

```text
Mon 2026-09-28
Tue 2026-09-29
Wed 2026-09-30
Thu 2026-10-01
Fri 2026-10-02
```

### Case 10 — Renamed worksheet

Example:

```text
Wednesday
Thursday
```

instead of:

```text
Wed
Thu
```

Expected:

```text
correctly recognized by content/date context
```

---

# 37. Development Workflow

Build in this order:

## Phase 1 — Project setup

- initialize Next.js
- TypeScript
- styling
- environment variables
- linting
- testing

## Phase 2 — Source access

- Google service account
- Drive folder access
- recursive file discovery
- file download
- optional Google Sheets adapter

## Phase 3 — Parser

- workbook parser
- worksheet parser
- header detection
- role detection
- task row detection
- boolean normalization
- time parsing

## Phase 4 — Tracking engine

- exemption engine
- task classification
- daily evaluation
- late detection
- date engine
- 90-day aggregation
- streak
- Maker/Checker summary

## Phase 5 — API

- `/api/tracking`
- typed response
- error handling

## Phase 6 — UI

- 90-day progress
- weekly view
- history
- role summary
- missed/exempt detail
- refresh

## Phase 7 — Verification

Test against the real workbook.

Do not rely only on synthetic fixtures.

## Phase 8 — Vercel deployment

- environment variables
- production Google Drive access
- production test
- source refresh verification

---

# 38. UI Component Contract

## ProgressHeader

Input:

```ts
{
  completed: number;
  total: number;
  percentage: number;
}
```

Displays:

```text
32 / 90
35.6%
```

## SummaryMetrics

Displays:

- Completed
- Missed
- Longest Streak

## WeeklyView

Input:

```ts
DailyEvaluation[]
```

Displays Monday–Friday.

## HistoryView

Displays all eligible tracking days.

## RoleSummary

Displays Maker and Checker summaries.

## DayDetail

Displays only relevant missed/exempt tasks by default.

## StatusBadge

Must support:

```text
MAKER
CHECKER
MISSED
EXEMPT
COMPLETED
LATE
```

---

# 39. UI Data Rules

The UI must not independently calculate business logic.

Bad:

```ts
if (completed === total) ...
```

inside React components.

Good:

```text
tracking engine
      ↓
DailyEvaluation
      ↓
React
```

The frontend only renders calculated data.

---

# 40. Responsive Design

The dashboard should work on:

- desktop
- tablet
- mobile

Desktop is the primary target.

Mobile should remain usable without turning the dashboard into a separate app.

Avoid horizontal overflow for the primary progress view.

---

# 41. Visual Rules

The design should remain minimalist.

### Typography

Use one clean sans-serif family.

Hierarchy should come from:
- size
- weight
- spacing
- alignment

not excessive decorations.

### Color

Use neutral background and restrained role/status colors.

### Layout

Prefer:
- whitespace
- thin separators
- simple grids
- compact data rows
- subtle hover states

Avoid:
- giant cards
- gradients
- glassmorphism
- decorative icons
- excessive rounded corners
- emoji
- marketing-style hero sections

---

# 42. Security Checklist

Before deployment:

- [ ] Service account key only in Vercel environment
- [ ] No `NEXT_PUBLIC_GOOGLE_PRIVATE_KEY`
- [ ] `.env.local` in `.gitignore`
- [ ] No credentials committed
- [ ] API only exposes normalized data
- [ ] Raw Drive files are not served by the frontend
- [ ] Drive access limited to required folder
- [ ] No write permission required if read-only Drive access is possible

---

# 43. Deployment

Deploy to Vercel.

Production environment variables:

```text
GOOGLE_SERVICE_ACCOUNT_EMAIL
GOOGLE_PRIVATE_KEY
GOOGLE_DRIVE_ROOT_FOLDER_ID
```

After deployment:

1. Open production URL.
2. Confirm Drive access.
3. Confirm current week.
4. Confirm Bryan role.
5. Confirm task counts.
6. Confirm exemptions.
7. Confirm late detection.
8. Confirm 90-day aggregation.
9. Confirm manual refresh.
10. Confirm no source modification is possible.

---

# 44. Important Implementation Constraints

1. Do not hardcode worksheet names.
2. Do not hardcode role rotation.
3. Do not hardcode task count.
4. Do not assume every FALSE is missed.
5. Do not assume every blank is exempt.
6. Always inspect the remark.
7. Do not use browser timezone for HK cutoff.
8. Do not let UI calculate business status.
9. Do not expose raw Google credentials.
10. Do not add a database unless a real V1 requirement appears.
11. Do not add n8n.
12. Do not use an LLM for exemption classification in V1.
13. Do not modify the source spreadsheet.
14. Do not silently guess when source structure is ambiguous.

---

# 45. Definition of Done

The technical implementation is complete when:

- Google Drive files can be read securely.
- Weekly workbooks can be discovered automatically.
- Cross-month filenames resolve correctly.
- Daily worksheets can be identified despite naming variation.
- Maker and Checker are detected from source data.
- Bryan's role is detected per day.
- Correct Start/Check action is selected.
- Actual task rows are parsed.
- TRUE/FALSE/blank values are normalized.
- Exemption remarks are recognized.
- Missed tasks are correctly identified.
- Late completion is correctly identified.
- Daily status is correctly calculated.
- 90 working days are correctly generated.
- Weekend behavior is correct.
- Longest streak is correct.
- Maker/Checker summaries are correct.
- Current week is rendered.
- Full history is rendered.
- Missed/exempt details are rendered.
- Dashboard is read-only.
- Page reload/manual refresh reflects source changes.
- Production deployment works on Vercel.
- Real source data has been tested against the engine.

---

# 46. Guiding Principle

The most important implementation principle is:

> **Never make the dashboard smarter than the source data.**

The spreadsheet is the operational record.

The application should interpret it consistently, transparently, and conservatively.

When data is ambiguous:

```text
Do not guess.
```

When data changes:

```text
Recalculate.
```

When the source and dashboard disagree:

```text
Source wins.
```

The application is a visualization and calculation layer over the existing operational workflow, not a replacement for it.
