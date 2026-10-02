# PRD — Bryan Morning Start 90-Day Tracker

## 1. Product Overview

**Product:** Morning Start — Bryan 90-Day Tracker

A read-only internal web dashboard that gives Bryan visibility into his progress during a 90-working-day morning operational training period.

The dashboard reads the existing operational checklist from Google Drive / Google Sheets and derives Bryan's role, daily completion, exemptions, missed tasks, late completion, weekly progress, 90-day progress, longest streak, and Maker/Checker performance.

**Google Drive / Google Sheets is the single source of truth.**

Bryan does not enter data into the dashboard. The dashboard must never edit, override, delete, or manually mark operational records.

---

## 2. Scope

This product is specifically for Bryan.

### Included
- 90 working-day tracking
- Maker/Checker role detection
- Daily task evaluation
- Exemption detection from remarks
- Missed-task detection
- Late completion detection
- Weekly view
- Full 90-day history
- Longest streak
- Maker vs Checker summary
- Minimalist read-only dashboard
- Google Drive XLSX/Google Sheets source

### Excluded
- Login/authentication
- Multi-user platform
- Admin dashboard
- Manual editing
- Manual status override
- Notifications
- n8n
- Database for V1
- AI/LLM remark classification
- Automatic file creation/renaming
- Generic habit-tracker functionality
- Gamification
- Native mobile app

---

## 3. Tracking Period

**Day 1:** 22 September 2026

**Duration:** 90 working days.

Only Monday–Friday count.

Saturday and Sunday:
- are not tracked
- do not count toward 90 days
- do not break a streak

The system must calculate 90 eligible working days dynamically from the configured start date.

---

## 4. Google Drive Source

Expected structure:

```text
My Drive/
└── log/
    └── Starting Server/
        └── 2026/
            ├── 07/2026/
            ├── 08/2026/
            ├── 09/2026/
            ├── 10/2026/
            └── ...
```

Example:

```text
09/2026/
├── 21-25.xlsx
├── 28-02.xlsx
└── ...
```

Each weekly workbook normally contains five daily worksheets.

Example:

```text
28-02.xlsx
├── Monday
├── Tuesday
├── Wed
├── Thu
└── Friday
```

Worksheet names may change. Do not hardcode exact sheet names.

The workbook represents a Monday–Friday operational period.

The application only reads these files. It does not create, rename, or modify them.

---

## 5. Source Format

The source may be:
- XLSX files stored in Google Drive
- Google Sheets

The implementation should normalize both into the same internal data structure.

Representative daily structure:

```text
Daily Morning Operations Checklist

Maker: Bryan
Checker: Difa Agfi

Task / Server
Start
Time
Remark from PIC
Check
Time
```

Example:

```text
Maker: Bryan
Checker: Difa Agfi

Server A
Start = TRUE
Time = 7:46:20 AM
Remark = ok
Check = TRUE
Time = 7:56:26 AM
```

Another example:

```text
Server B
Start = FALSE
Time = blank
Remark = mid autumn festival holiday
Check = FALSE
Time = blank
```

Column positions may change. Detect columns semantically from headers rather than relying only on fixed indexes.

---

## 6. Role Detection

Bryan's role must be detected separately for every daily worksheet.

Do NOT assume roles alternate weekly.

Possible assignments:

```text
Maker: Bryan
Checker: Difa Agfi
```

→ Bryan = MAKER

```text
Maker: Difa Agfi
Checker: Bryan
```

→ Bryan = CHECKER

```text
Maker: Difa
Checker: Difa
```

→ Bryan = NOT ASSIGNED / ABSENT

The role must come from the spreadsheet header.

If Bryan is not Maker or Checker on an otherwise eligible working day, treat that day as a missed day for Bryan.

---

## 7. Role-Specific Action

If Bryan is Maker:

```text
Evaluate Start
```

If Bryan is Checker:

```text
Evaluate Check
```

Do not evaluate the other role's action as Bryan's responsibility.

---

## 8. Task Row Detection

Approximately 25–30 actual checklist/server rows exist per day.

All actual checklist rows must be counted.

A row is considered a task when it contains the operational action structure relevant to the checklist, such as Start/Time or Check/Time.

Rows that are only visual section/group headers must not become duplicate tasks.

Expected output should represent the actual number of servers/checklist items being checked.

---

## 9. Task States

Each applicable task can become:

### COMPLETED
Relevant action is TRUE and/or valid completion information exists.

### MISSED
Relevant action is FALSE or blank and there is no valid exemption.

### EXEMPT
Relevant action is FALSE/blank but the remark clearly indicates the task should not be counted.

### LATE
Task eventually becomes completed after the 08:00 HK cutoff.

Late is still completed, but must be visually distinguishable.

---

## 10. Exemption Logic

Remark must be checked before classifying FALSE/blank as missed.

Initial exemption keywords:

```text
holiday
public holiday
maintenance
not required
server offline
market holiday
```

Matching is case-insensitive and should support longer remarks.

Example:

```text
Start = FALSE
Remark = mid autumn festival holiday
```

→ EXEMPT

Example:

```text
Start = FALSE
Remark = blank
```

→ MISSED

Example:

```text
Start = FALSE
Remark = server issue
```

→ Not automatically exempt unless the configured exemption rules recognize it.

Use deterministic keyword/rule-based classification for V1. Do not use an LLM.

---

## 11. Daily Completion

The system must distinguish task status from day status.

Normal rule:

```text
all applicable tasks completed
→ COMPLETED
```

However, a day can be considered acceptable when incomplete tasks have legitimate operational explanations.

Example:

```text
24 applicable
23 completed
1 legitimate exception
```

Display:

```text
23 / 24
COMPLETED WITH EXCEPTION
```

The incomplete task must remain visible as an exempt/exception detail.

Do not silently convert it into a perfect score.

For an unexplained incomplete task:

```text
23 / 24
MISSED
```

---

## 12. Cutoff and Time

Operational target window:

**07:30–08:00 Hong Kong Time**

Daily cutoff:

**08:00 Hong Kong Time**

The source spreadsheet time must be interpreted in `Asia/Hong_Kong`.

Do not evaluate cutoff using the browser's local timezone.

### Rules

```text
Completed by 08:00
→ COMPLETED

Completed after 08:00
→ COMPLETED · LATE

Still incomplete after cutoff
→ MISSED
```

Example:

```text
07:58 → 25/25 → COMPLETED
08:12 → 25/25 → COMPLETED · LATE
08:12 → 23/25 → MISSED
```

A task/day completed after cutoff remains late even if it eventually becomes complete.

---

## 13. Daily Refresh

No real-time streaming is required.

On page load:
1. Read latest source.
2. Parse the source.
3. Recalculate statuses.
4. Render current results.

Manual browser refresh must do the same.

The dashboard does not maintain an independent editable copy.

If source changes:

```text
FALSE → TRUE
```

the next page load/manual refresh must reflect the new result.

No historical snapshot/versioning is required for V1.

---

## 14. 90-Day Metrics

Primary metric:

```text
Completed working days / 90
```

Example:

```text
32 / 90
35.6%
```

Show:
- Completed days
- Missed days
- Exempt/exception information where relevant
- Remaining eligible working days
- Longest streak

Do not count weekends.

---

## 15. Longest Streak

Do not show Current Streak.

Show:

```text
Longest Streak
14 working days
```

Description:

> Longest consecutive run of working days where Bryan completed his assigned morning tasks.

Weekends do not break a streak.

A genuine missed eligible working day breaks a streak.

A weekend does not.

---

## 16. Maker vs Checker Analytics

Provide a factual role breakdown:

```text
Maker
38 / 42 working days

Checker
41 / 43 working days
```

The purpose is to show Bryan's adaptability across the two roles.

Do not rank the roles or label one as better.

---

## 17. Weekly Dashboard

Default dashboard should show 90-day progress plus current week.

Example:

```text
THIS WEEK

Mon   MAKER      25/25
Tue   MAKER      24/24
Wed   CHECKER    25/25
Thu   MISSED     21/25
Fri   CHECKER    25/25
```

Role and outcome must be visually distinct.

---

## 18. Color System

Use a restrained minimalist palette.

- Maker = Blue
- Checker = Yellow
- Missed = Red
- Exempt = Black/dark neutral

Status takes visual precedence over role.

Example:

```text
BLUE
MAKER
25 / 25
COMPLETED
```

```text
YELLOW
CHECKER
25 / 25
COMPLETED
```

```text
RED
MAKER
23 / 25
MISSED
```

```text
BLACK / NEUTRAL
EXEMPT
Holiday
```

If Bryan is Maker but missed tasks exist, red is dominant and Maker remains a smaller blue role label.

---

## 19. 90-Day History

Show the entire 90-working-day history.

The visualization must make it possible to distinguish:
- Maker days
- Checker days
- Missed days
- Exempt days

Avoid generic habit-tracker aesthetics.

Avoid:
- gradients
- excessive cards
- excessive rounded containers
- glassmorphism
- decorative illustrations
- emojis
- motivational quotes
- badges
- points
- leaderboards
- excessive shadows

Prefer:
- whitespace
- typography
- subtle borders
- restrained colors
- compact status indicators
- clean timeline/calendar
- professional internal-tool appearance

---

## 20. Task Details

Do not flood the user with successful task rows.

For a fully successful day:

```text
25 / 25
COMPLETED
```

For a problematic day, show:

### Missed Tasks

```text
• Server A
• Server B
```

### Exempt Tasks

```text
• Server C
  mid autumn festival holiday
```

The dashboard may allow viewing successful task details if useful, but successful rows should not dominate the interface.

---

## 21. Access

No login for V1.

The dashboard is accessible via URL.

Example:

```text
https://morning-start.vercel.app
```

It is intended for internal sharing.

The raw Google Drive files must not be exposed directly through the browser.

---

## 22. Security

Google Drive credentials must remain server-side.

The browser must receive only normalized dashboard data.

Never expose:
- service-account private key
- access tokens
- raw credentials
- unnecessary Google Drive metadata

---

## 23. Recommended Technology

Frontend:
- Next.js
- React
- TypeScript

Hosting:
- Vercel

Spreadsheet:
- SheetJS / `xlsx` or equivalent

Source:
- Google Drive API
- Google Sheets API where applicable

Styling:
- Tailwind CSS or clean CSS

Persistence:
- None required for V1

Automation platform:
- None

Database:
- None for V1

The system should be built as a single focused application.

---

## 24. Central Configuration

Keep important business values in one configuration module:

```ts
TRACKING_PERSON = "Bryan"

START_DATE = "2026-09-22"

TRACKING_WORKING_DAYS = 90

TIMEZONE = "Asia/Hong_Kong"

START_WINDOW = "07:30"

CUTOFF_TIME = "08:00"

GOOGLE_DRIVE_ROOT_FOLDER_ID = "..."

EXEMPTION_KEYWORDS = [
  "holiday",
  "public holiday",
  "maintenance",
  "not required",
  "server offline",
  "market holiday"
]
```

Do not scatter these values throughout the codebase.

---

## 25. Functional Requirements

### FR-01 — Find source files
Locate relevant XLSX/Google Sheet sources in the configured Drive hierarchy.

### FR-02 — Resolve date
Determine workbook/week/day dates from filename, folder context, and worksheet context.

### FR-03 — Identify daily worksheets
Identify relevant weekday worksheets without hardcoding exact names.

### FR-04 — Detect Maker
Read Maker identity from the worksheet header.

### FR-05 — Detect Checker
Read Checker identity from the worksheet header.

### FR-06 — Detect Bryan role
Return Maker, Checker, or Not Assigned.

### FR-07 — Select role action
Maker → Start.
Checker → Check.

### FR-08 — Identify tasks
Parse actual operational checklist rows.

### FR-09 — Classify tasks
Completed / Missed / Exempt / Late.

### FR-10 — Evaluate day
Calculate daily outcome.

### FR-11 — Calculate weekly progress
Aggregate current week's working days.

### FR-12 — Calculate 90-day progress
Aggregate the configured 90 eligible working days.

### FR-13 — Calculate longest streak
Calculate the longest consecutive sequence of completed eligible working days.

### FR-14 — Calculate role summary
Separate Maker and Checker factual performance.

### FR-15 — Render dashboard
Render the minimalist read-only interface.

### FR-16 — Refresh
Re-read source on page load/manual refresh.

---

## 26. Error Handling

Do not guess when source data is ambiguous.

If workbook cannot be read:

```text
Unable to read source file.
```

If worksheet structure is unexpected:

```text
Unable to evaluate this day's checklist.
```

If Maker/Checker header cannot be detected:

```text
Role information unavailable.
```

If date cannot be resolved:

```text
Unable to determine worksheet date.
```

Errors should be logged server-side.

Incorrect data is worse than incomplete data.

---

## 27. UX Requirements

The first five seconds should answer:

1. How far am I?
2. How am I doing this week?
3. What role am I performing?
4. Did I miss anything?
5. What is my longest streak?

Preferred hierarchy:

```text
Morning Start
Bryan

32 / 90
35.6%

Completed     Missed     Longest Streak

THIS WEEK
Mon  MAKER      25/25
Tue  MAKER      25/25
Wed  CHECKER    24/24
Thu  MISSED     22/25
Fri  CHECKER    25/25

90-DAY HISTORY

ROLE SUMMARY
Maker
Checker
```

The UI should be minimalist and data-first.

---

## 28. Success Criteria

The product is successful when:

1. Bryan can open one URL and immediately understand his 90-day progress.
2. The dashboard reflects the latest source data.
3. Bryan's Maker/Checker role is detected automatically.
4. The correct Start or Check column is evaluated.
5. Holiday and configured exemptions are not incorrectly counted as missed.
6. Genuine incomplete tasks are shown as missed.
7. Late completion is distinguishable from normal completion.
8. Weekends never count or break streaks.
9. Bryan never needs to enter data into the dashboard.
10. Source spreadsheet changes appear after reload/manual refresh.
11. Full 90-working-day history is visible.
12. Maker vs Checker behavior can be viewed separately.
13. The interface remains minimalist.
14. The dashboard cannot modify the source data.

---

## 29. Example End-to-End Case

Input:

```text
Maker: Bryan
Checker: Difa Agfi

25 checklist tasks

23 Start = TRUE
1 Start = FALSE
1 Start = FALSE

Remark #1:
mid autumn festival holiday

Remark #2:
blank
```

Evaluation:

```text
Role: MAKER

Total: 25
Completed: 23
Exempt: 1
Missed: 1
Applicable: 24

23 / 24
MISSED
```

Dashboard detail:

```text
MISSED
• Server X

EXEMPT
• Server Y
  mid autumn festival holiday
```

If the only incomplete task has a valid exemption:

```text
24 / 24
COMPLETED WITH EXCEPTION
```

---

## 30. Implementation Order

Do not start with visual polish.

Build in this order:

```text
1. Google Drive access
2. Source file discovery
3. Workbook / Google Sheet parsing
4. Date resolution
5. Maker/Checker detection
6. Bryan role detection
7. Task-row detection
8. Start/Check evaluation
9. Remark/exemption classification
10. Daily status engine
11. Late detection
12. 90-day date engine
13. Longest-streak calculation
14. Maker/Checker analytics
15. API response
16. Minimal UI
17. Visual refinement
18. Deployment
```

The tracking engine is the most important component.

Before polishing the UI, verify that the engine produces correct results from the real spreadsheet.

---

## 31. Architecture Principle

Keep the application separated into logical layers:

```text
Google Drive / Sheets
        ↓
Source Access
        ↓
File Discovery
        ↓
Workbook Parsing
        ↓
Date Resolution
        ↓
Role Detection
        ↓
Task Classification
        ↓
Daily Evaluation
        ↓
90-Day Aggregation
        ↓
API
        ↓
UI
```

Each layer should be independently testable.

Do not build a generic habit-tracker framework.

Build specifically for:

**Bryan — Morning Start — 90 Working Days — starting 22 September 2026.**
