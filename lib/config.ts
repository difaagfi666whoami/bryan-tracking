export const config = {
  trackingPerson: "Bryan",
  trackingStartDate: "2026-09-22",
  trackingWorkingDays: 90,
  timezone: "Asia/Hong_Kong",
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
} as const;
