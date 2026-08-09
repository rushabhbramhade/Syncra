export const BRIEFING_CATEGORIES = [
  "email",
  "messages",
  "tasks",
  "followUps",
  "activity",
  "meetings",
] as const;

export type BriefingCategory = (typeof BRIEFING_CATEGORIES)[number];