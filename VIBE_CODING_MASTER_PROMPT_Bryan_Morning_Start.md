# 03 — Vibe Coding Master Prompt
## Bryan Morning Start — 90 Working Day Tracker

You are the coding agent responsible for building this project from the PRD and Technical Specification already provided in this repository.

Your job is to **implement the product, not redesign the requirements**.

The project is an internal, read-only dashboard for tracking Bryan's morning operational checklist over 90 eligible working days. The source of truth is Google Drive / Google Sheets/XLSX data. The app will run on Vercel.

---

# 1. Your Role

Act as a pragmatic senior full-stack engineer.

Priorities, in order:

1. Correctness of source-data parsing.
2. Correctness of date/working-day logic.
3. Correctness of Maker/Checker detection.
4. Correctness of task-level evaluation.
5. Correctness of 90-day aggregation and streak calculation.
6. Security of Google credentials.
7. Simple, maintainable architecture.
8. Minimalist UI.

Do not optimize for impressive-looking code or UI.

Do not add features that are not required.

Do not replace deterministic business rules with AI/LLM logic.

---

# 2. Source Documents

Before writing implementation code, read:

- `PRD_Bryan_Morning_Start_90_Day_Tracker.md`
- `TECHNICAL_SPEC_Bryan_Morning_Start_90_Day_Tracker.md`

Treat those documents as the product contract.

If this prompt conflicts with those documents, use the following priority:

1. Explicit requirements in this prompt.
2. Technical Specification.
3. PRD.

If something is genuinely ambiguous, inspect the existing source workbook/data before making an assumption.

---

# 3. Product Goal

Build a dashboard that answers, at a glance:

- How far Bryan has progressed through 90 working days.
- How many eligible days have been completed.
- How many days were missed.
- What his longest successful streak is.
- Whether Bryan was Maker or Checker on a given day.
- What happened during the current week.
- Which tasks were missed.
- Which tasks were exempt and why.

The dashboard is **read-only**.

Bryan does not enter or edit data in the dashboard.

Google Drive / source spreadsheets remain the single source of truth.

---

# 4. Hard Constraints

Do NOT introduce:

- n8n
- Neon/PostgreSQL
- Prisma
- a database
- authentication/login
- admin panels
- CMS
- AI/LLM classification
- notification systems
- email integrations
- user editing
- manual status overrides
- unnecessary state-management libraries
- unnecessary UI component libraries
- generic SaaS dashboard templates

Use:

- Next.js
- React
- TypeScript
- Vercel
- Google Drive API
- Google Sheets API where appropriate
- SheetJS/XLSX for XLSX parsing
- server-side Google service account authentication

Google credentials must never reach the browser.

---

# 5. Before Coding: Inspect First

Do not immediately start building the UI.

First inspect the repository and source structure.

Then inspect the actual spreadsheet structure if a source workbook is available.

You need to understand:

- actual worksheet names
- header positions
- Maker / Checker format
- task row structure
- Start / Check columns
- time formatting
- TRUE/FALSE representation
- remarks
- holiday/exception wording
- whether there are visual grouping rows
- whether column positions vary
- whether worksheet names change
- how weekly files are named

Do not assume worksheet names are Monday/Tuesday/etc.

Do not assume column positions are permanently fixed.

Do not assume Maker is always Bryan.

Do not assume Checker is always Bryan.

Do not assume the weekly filename alone is sufficient to identify dates without applying the documented date-resolution rules.

If source data reveals an edge case not covered by the current implementation, stop and resolve the parsing rule before continuing.

---

# 6. Implementation Strategy

Build in phases.

## Phase 0 — Repository Inspection

Inspect:

- existing files
- package.json
- tsconfig
- Next.js configuration
- environment configuration
- source documents
- available fixtures

Do not delete useful existing work without understanding it.

At the end of this phase, briefly summarize:

- current state
- files that matter
- implementation plan
- any ambiguities discovered

Then continue unless a requirement genuinely cannot be resolved.

---

# 7. Phase 1 — Domain Types

Create strong TypeScript types for:

- source files
- worksheets
- raw tasks
- roles
- task status
- daily status
- daily evaluation
- streaks
- dashboard metrics

Use explicit enums/unions where useful.

Important role values:

- `MAKER`
- `CHECKER`
- `NOT_ASSIGNED`

Important daily statuses:

- `COMPLETED`
- `COMPLETED_WITH_EXCEPTION`
- `MISSED`
- `NOT_ASSIGNED`
- `NO_DATA`

Do not represent business state using arbitrary strings scattered throughout the code.

---

# 8. Phase 2 — Date Engine

Implement the 90-working-day engine first.

Configuration:

- Start date: `2026-09-22`
- Duration: `90` eligible working days
- Weekends: Monday-Friday only
- Timezone: `Asia/Hong_Kong`

Generate exactly 90 eligible weekdays beginning on 22 September 2026.

Do not hardcode the resulting list.

The date engine must be deterministic and testable.

Important behavior:

- Saturday and Sunday do not count.
- Weekends do not break streaks.
- Valid source-defined non-working days / holidays do not count.
- Valid non-working days do not break streaks.

Cross-month weekly files must be supported.

Example:

`09/2026/28-02.xlsx`

must resolve to:

- Mon 28 Sep 2026
- Tue 29 Sep 2026
- Wed 30 Sep 2026
- Thu 1 Oct 2026
- Fri 2 Oct 2026

Do not incorrectly assign 1–2 October to September.

---

# 9. Phase 3 — Google Drive Source Discovery

Implement server-side source discovery.

Expected Drive structure:

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

Weekly XLSX files exist inside month folders.

Example:

```text
09/2026/
├── 21-25.xlsx
├── 28-02.xlsx
└── ...
```

The app must:

1. Locate the configured root folder.
2. Traverse the required year/month folders.
3. Find relevant weekly files.
4. Download/read them server-side.
5. Parse them.
6. Map worksheets to actual dates.

Do not create, rename, modify, or delete Drive files.

Do not expose Google credentials.

Keep Drive access isolated inside `lib/google`.

---

# 10. Phase 4 — Workbook Parser

Build a resilient parser.

The workbook parser must not depend blindly on fixed column indexes.

Semantically identify:

```text
Task / Server
Start
Time
Remark from PIC
Check
Time
```

The actual workbook may contain:

- title rows
- maker/checker information
- blank rows
- visual grouping rows
- formatting-only rows
- merged cells

Do not interpret formatting-only/group rows as separate tasks.

A real task row is an operational checklist row containing the relevant task/action structure, especially the Start/Time or Check/Time fields.

The parser should produce normalized task objects containing at minimum:

- identifier
- description
- start value
- start time
- check value
- check time
- remark

Preserve useful raw information when practical for debugging.

---

# 11. Phase 5 — Role Detection

Read the worksheet header:

```text
Maker: ...
Checker: ...
```

Detect Bryan's role for each worksheet/day.

Rules:

- Bryan as Maker → `MAKER`
- Bryan as Checker → `CHECKER`
- Bryan in neither → `NOT_ASSIGNED`

Do not hardcode weekly alternation.

Do not infer role from previous/next day.

Do not assume the role from the current week.

The worksheet itself is authoritative.

Matching can initially be case-insensitive.

Keep role detection isolated in its own module.

---

# 12. Phase 6 — Task Evaluation

Role determines which boolean/time fields are evaluated.

If Bryan is Maker:

```text
start / start time
```

If Bryan is Checker:

```text
check / check time
```

Normalize source values:

- TRUE → completed
- FALSE → not completed
- blank → not completed

A completed task must have the appropriate time where the source structure requires it.

Do not silently treat an invalid or malformed value as successful.

---

# 13. Phase 7 — Exemption Rules

Use deterministic rules only.

Known exemption keywords include:

```text
holiday
public holiday
maintenance
not required
server offline
market holiday
```

Matching should be:

- case-insensitive
- whitespace-tolerant
- deterministic

Example:

```text
FALSE + "mid autumn festival holiday"
```

→ `EXEMPT`

But:

```text
FALSE + "server issue"
```

must NOT automatically become exempt unless `server issue` is explicitly configured as an exemption rule.

Do not use an LLM to decide whether something is an exemption.

Keep exemption logic isolated and easy to modify.

---

# 14. Phase 8 — Daily Evaluation

For each eligible working day calculate:

- date
- weekday
- role
- total tasks
- applicable tasks
- completed tasks
- missed tasks
- exempt tasks
- late status
- completion rate
- daily status
- missed task details
- exempt task details

Rules:

### Completed

All applicable tasks are completed by cutoff.

### Completed With Exception

All required work is effectively completed except legitimate source-defined exceptions.

Example:

- 24 tasks
- 23 completed
- 1 exempt because of a valid holiday/non-required condition

→ `COMPLETED_WITH_EXCEPTION`

### Completed · Late

All applicable tasks eventually completed, but completion occurred after 08:00 HK.

Represent this as a completed day with a late flag.

UI label:

`COMPLETED · LATE`

### Missed

At least one required task remains incomplete after cutoff.

### Not Assigned

Bryan is neither Maker nor Checker on an eligible working day.

### No Data

The expected source data for that day cannot be found/read.

Do not treat `NO_DATA` as successful.

---

# 15. Cutoff Logic

Operational timezone:

```text
Asia/Hong_Kong
```

Target window:

```text
07:30–08:00
```

Cutoff:

```text
08:00
```

Interpretation:

- completed by 08:00 → normal completion
- completed after 08:00 → completed late
- incomplete after cutoff → missed

Do not use the server's local timezone implicitly.

Use an explicit timezone-aware implementation.

---

# 16. Streak Calculation

Implement longest successful streak.

Successful days:

- `COMPLETED`
- `COMPLETED_WITH_EXCEPTION`

Not successful:

- `MISSED`
- `NOT_ASSIGNED`
- `NO_DATA`

Weekends do not break the streak.

Valid non-working holidays do not break the streak.

A missed eligible working day breaks the streak.

Do not calculate streak based on calendar-day adjacency alone.

Calculate streak against the ordered eligible working-day sequence.

---

# 17. Aggregation

Produce:

- total eligible days = 90
- completed days
- missed days
- longest streak
- progress percentage
- Maker successful / assigned days
- Checker successful / assigned days
- full daily history

`COMPLETED_WITH_EXCEPTION` counts as successful for progress and streak.

Do not rank Maker vs Checker.

The role summary is descriptive only.

---

# 18. API Layer

Expose a simple read-only endpoint:

```text
GET /api/tracking
```

Optional:

```text
GET /api/tracking?refresh=true
```

The API should return normalized dashboard data.

The browser should not know how Google Drive is structured internally.

The browser should not contain Google credentials.

Business logic should stay server-side.

The UI should consume normalized results instead of reimplementing tracking logic.

---

# 19. Caching

Do not introduce complicated infrastructure.

For V1:

- fetch current source data on page load/API request
- support manual refresh
- allow reasonable server-side caching only if it does not make source freshness confusing

The user explicitly expects the dashboard to reflect the latest source after refresh.

Do not build a background synchronization system.

---

# 20. UI Implementation

Only start UI work after the tracking engine is producing correct normalized data.

Design philosophy:

**minimalist, data-first, typography-first.**

Avoid:

- gradients
- glassmorphism
- giant rounded cards
- excessive shadows
- decorative illustrations
- emoji
- motivational quotes
- gamification
- excessive badges
- fake AI aesthetics
- generic SaaS dashboard styling

Prefer:

- whitespace
- thin dividers
- restrained colors
- readable typography
- compact information hierarchy
- subtle status indicators
- simple tables/lists
- clear alignment

The UI should feel like a clean internal operations tool.

---

# 21. Dashboard Information Hierarchy

Within approximately five seconds, the user should understand:

1. Progress through 90 days.
2. Completed / missed.
3. Longest streak.
4. Current week.
5. Bryan's role.
6. Missed tasks.
7. Exempt tasks.

Default view should emphasize:

- 90-day progress
- current week
- recent/current task details
- history

Do not make the user click through multiple pages to understand the current state.

---

# 22. Color Semantics

Use colors consistently:

- Maker → blue
- Checker → yellow
- Missed → red
- Exempt → black/dark neutral

Status color takes precedence over role color.

Example:

If Bryan is Maker but missed:

- overall day status → red
- role label → smaller blue Maker indicator

Do not make the entire UI colorful.

---

# 23. Task Detail UX

Do not flood the interface with successful tasks.

By default, emphasize:

- missed tasks
- exempt tasks
- late information where relevant

Successful task details may be available when useful, but they should not dominate the dashboard.

For a missed task, show enough information to understand the issue:

- task/server
- relevant action
- time if present
- remark if present

For an exempt task, show:

- task/server
- exemption remark/reason

---

# 24. Current Week View

Show the current week's five working-day structure.

Each day should clearly communicate:

- date
- weekday
- Maker/Checker role
- daily status
- late indicator if applicable
- missed/exempt count if relevant

Weekends do not need to appear as tracking days.

Do not create a calendar UI unless it materially improves readability.

---

# 25. 90-Day History

Show all eligible working days.

A compact table/list is preferred.

Suggested fields:

```text
Date
Day
Role
Status
Completed
Missed
Exempt
```

Keep it readable.

Do not create an enormous card grid.

---

# 26. Error Handling

The dashboard must fail clearly.

Examples:

- Google credentials invalid
- Drive folder inaccessible
- weekly file missing
- workbook unreadable
- worksheet missing
- malformed header
- invalid time
- unexpected boolean value

Do not silently mark missing source data as `COMPLETED`.

If source data cannot be read:

- return a clear technical error state
- log enough information server-side for debugging
- avoid exposing credentials or sensitive internals to the browser

---

# 27. Testing

Testing is mandatory.

Build unit tests for:

### Date engine

- 90 weekdays
- weekends excluded
- start date correct
- cross-month dates
- cross-year behavior if applicable

### Role detection

- Bryan Maker
- Bryan Checker
- Bryan absent
- casing differences

### Task parser

- normal task row
- blank task row
- visual/group row
- TRUE/FALSE
- blank value
- malformed value

### Exemptions

- holiday
- public holiday
- maintenance
- not required
- server offline
- market holiday
- non-exemption remark

### Daily evaluation

- all completed
- one missed
- multiple missed
- all exempt
- completed with exception
- completed late
- not assigned
- no data

### Streak

- normal consecutive completion
- weekend between successful days
- holiday between successful days
- missed day breaks streak
- not assigned breaks streak
- no data does not create a success streak

### Cross-month workbook

Test:

```text
09/2026/28-02.xlsx
```

against:

```text
2026-09-28
2026-09-29
2026-09-30
2026-10-01
2026-10-02
```

---

# 28. Use Realistic Fixtures

Create small fixture workbooks/data representing actual spreadsheet behavior.

Do not create 950-row fake datasets.

Approximately 25–30 task rows per worksheet is sufficient.

Include cases such as:

- Maker day
- Checker day
- holiday exemption
- genuine missed task
- late completion
- Bryan absent
- cross-month week
- renamed worksheet

The fixtures should resemble the actual source format.

---

# 29. Development Workflow

Work incrementally.

Preferred order:

```text
Repository inspection
        ↓
Domain types
        ↓
Date engine
        ↓
Source discovery
        ↓
Workbook parser
        ↓
Role detector
        ↓
Task evaluator
        ↓
Daily evaluator
        ↓
Streak / aggregation
        ↓
API
        ↓
Minimal UI
        ↓
Tests
        ↓
Deployment preparation
```

After each major phase:

1. run tests
2. inspect output
3. fix issues
4. only then continue

Do not build the entire application in one giant change.

---

# 30. Important Anti-Patterns

Never do these:

### Hardcode weekly role rotation

Wrong:

```text
Week 1 = Maker
Week 2 = Checker
```

Correct:

Read Maker/Checker from every worksheet.

### Hardcode worksheet names

Wrong:

```text
Monday
Tuesday
Wednesday
...
```

Correct:

Inspect worksheet structure and map dates appropriately.

### Hardcode dates

Wrong:

```text
September 22, September 23, ...
```

Correct:

Generate the 90-day sequence dynamically.

### Treat every spreadsheet row as a task

Wrong.

Correct:

Identify actual operational checklist rows.

### Treat every FALSE as missed

Wrong.

Correct:

Check the remark and exemption rules.

### Treat every remark as an exemption

Wrong.

Correct:

Use explicit deterministic exemption keywords.

### Put Google credentials in React

Never.

### Use a database because it feels more professional

Do not.

### Add AI because the project is about automation

Do not.

---

# 31. Code Quality

Keep modules small and single-purpose.

Prefer functions such as:

```ts
generateTrackingDates()
resolveWorkbookDates()
detectRole()
parseTaskRows()
normalizeBoolean()
isExempt()
evaluateTask()
evaluateDay()
calculateLongestStreak()
aggregateTracking()
```

Functions should be deterministic where possible.

Avoid giant functions.

Avoid hidden global state.

Avoid unnecessary abstractions.

Use clear names over clever names.

---

# 32. Observability / Debugging

During development, provide enough structured server-side logging to answer:

- which Drive file was selected
- which worksheet was parsed
- which date it mapped to
- detected Maker/Checker
- number of parsed tasks
- number completed/missed/exempt
- daily status

Do not log:

- service account private key
- access tokens
- sensitive credentials

Keep production logging concise.

---

# 33. Deployment

Target:

```text
Vercel
```

Before deployment:

- verify environment variables
- verify Google service account access
- verify Drive folder permissions
- verify server-only credential usage
- run tests
- run production build
- test `/api/tracking`
- test dashboard rendering
- test manual refresh

Document required environment variables in `.env.example`.

Never commit secrets.

---

# 34. Security Checklist

Before considering the project complete:

- [ ] No Google private key in source code.
- [ ] No service account credentials sent to browser.
- [ ] No `.env.local` committed.
- [ ] Drive access happens server-side.
- [ ] API exposes only normalized tracking information.
- [ ] Errors do not leak credentials.
- [ ] No unnecessary write permission to Google Drive.
- [ ] Service account has only required source access.

---

# 35. Definition of Done

The project is complete only when:

- [ ] 90 eligible working days are generated correctly.
- [ ] Cross-month weekly files resolve correctly.
- [ ] Worksheet names are not hardcoded.
- [ ] Maker/Checker is detected from each worksheet.
- [ ] Bryan's role can vary by day.
- [ ] Actual checklist rows are parsed correctly.
- [ ] TRUE/FALSE/blank values are normalized.
- [ ] Exemption rules work deterministically.
- [ ] Completed, missed, exempt, late, not-assigned and no-data states are distinguished.
- [ ] Completed-with-exception works.
- [ ] Longest streak is correct.
- [ ] Weekends/valid non-working days do not break streak.
- [ ] Missed days break streak.
- [ ] Progress is based on successful eligible days / 90.
- [ ] Maker/Checker summary is descriptive.
- [ ] Current week is visible.
- [ ] 90-day history is visible.
- [ ] Missed/exempt task details are visible.
- [ ] UI is minimalist and data-first.
- [ ] Google credentials stay server-side.
- [ ] Unit tests cover core business logic.
- [ ] Production build succeeds.
- [ ] Vercel deployment configuration is documented.

---

# 36. Final Agent Behavior

Do not ask unnecessary questions.

Do not invent requirements.

Do not over-engineer.

When uncertain about spreadsheet behavior, inspect the real source first.

When uncertain about business logic, prefer the explicit rules in the PRD and Technical Specification.

When a technical assumption affects correctness, stop and validate it before proceeding.

Do not spend most of the effort polishing UI before the tracking engine is proven correct.

The most important outcome is:

> If Bryan looks at the dashboard, the status shown must match what is actually present in the operational spreadsheet.

Build that first.

Then make it clean.
