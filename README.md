# Morning Start — Bryan 90-Day Tracker

Read-only Next.js dashboard for the Bryan morning operations checklist. Google Drive remains the source of truth; the app only requests read access and recalculates on each load or refresh.

## Run locally

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env.local` and set `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY`, and `GOOGLE_DRIVE_ROOT_FOLDER_ID`.
3. Share the source folder with the service account as a viewer.
4. Run `npm run dev`.

Google variables are read only in server code. Never add them as `NEXT_PUBLIC_*`. For Vercel, configure the same values as server environment variables.

## Source layout expected

The configured Drive folder is recursively scanned for XLSX files and Google Sheets. Weekly files use names such as `28-02.xlsx` and a month/year path such as `09/2026`. A sheet is treated as a daily checklist only when its content contains the Start and Check headers; unrelated support tabs are ignored. Dates come first from dates embedded in Excel completion-time serials, then from weekday tokens in sheet names, and only use a unique remaining weekday when that assignment is unambiguous. The parser identifies Maker/Checker and the Start, Time, Remark, Check, and Time columns from worksheet content, including merged server cells.

The workbook used to validate this parser is represented by the anonymized structural fixture `tests/fixtures/28-02.structure.json`; raw task/server identifiers are intentionally not committed. Ambiguous date mappings, duplicate weekly files, and missing Maker/Checker labels fail rather than producing guessed results.

## Checks

- `npm test` runs tracking-engine unit tests.
- `npm run build` creates the production build.

The app has no write routes, database, authentication, background synchronization, or client-side Google access.
