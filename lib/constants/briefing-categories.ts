export const BRIEFING_CATEGORIES = [
  "email",
  "messages",
  "mentions",
  "tasks",
  "followUps",
  "activity",
  "meetings",
] as const;

export type BriefingCategory = (typeof BRIEFING_CATEGORIES)[number];
