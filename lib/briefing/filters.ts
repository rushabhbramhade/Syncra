/**
 * Timezone-aware briefing item filters. Pure module — node-testable, no DOM,
 * no DB. Where the rules matter:
 *
 *  - Today      → source activity timestamp falls on the user's local calendar day.
 *  - This week  → falls inside the current local calendar week (Mon–Sun).
 *  - This month → inside the current local calendar month.
 *  - Next month → inside the following local calendar month (rolls over Dec→Jan).
 *
 * Month boundaries are always computed against `now`, never hardcoded, so when
 * the calendar flips every filter automatically refers to the new month.
 */

export type TimeFilterKey = "today" | "this_week" | "this_month" | "next_month";

export type PriorityFilterKey = "high" | "medium" | "low";

/** A date/timestamp that may be null, empty, or unparseable. */
export type MaybeTimestamp = string | number | Date | null | undefined;

export function parseTimestamp(value: MaybeTimestamp): Date | null {
  if (value === null || value === undefined || value === "") return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

/** Start of the local calendar day for `date`. */
export function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

export function isSameLocalDay(value: Date | null, now: Date = new Date()): boolean {
  if (!value) return false;
  const a = startOfLocalDay(value);
  const b = startOfLocalDay(now);
  return a.getTime() === b.getTime();
}

/** Start of the local calendar week (Monday 00:00:00) for `date`. */
export function startOfLocalWeek(date: Date): Date {
  const out = startOfLocalDay(date);
  const day = out.getDay(); // 0 = Sunday
  out.setDate(out.getDate() - ((day + 6) % 7));
  return out;
}

export function isInLocalWeek(value: Date | null, now: Date = new Date()): boolean {
  if (!value) return false;
  const weekStart = startOfLocalWeek(now);
  const weekEnd = new Date(weekStart.getTime() + 7 * 86400000);
  return value.getTime() >= weekStart.getTime() && value.getTime() < weekEnd.getTime();
}

/** First millisecond of the local month containing `date`. */
export function startOfLocalMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
}

export function isInLocalMonth(value: Date | null, now: Date = new Date()): boolean {
  if (!value) return false;
  const target = startOfLocalMonth(value);
  const current = startOfLocalMonth(now);
  return target.getTime() === current.getTime();
}

/** Start of the local month AFTER the month containing `date` (rolls Dec→Jan). */
export function startOfNextLocalMonth(date: Date): Date {
  const next = new Date(date.getFullYear(), date.getMonth() + 1, 1, 0, 0, 0, 0);
  return next;
}

export function isInNextLocalMonth(value: Date | null, now: Date = new Date()): boolean {
  if (!value) return false;
  const target = startOfLocalMonth(value);
  const next = startOfNextLocalMonth(now);
  return target.getTime() === next.getTime();
}

/**
 * Match a timestamp against a time filter. Returns `true` only when the
 * timestamp parses AND falls in the requested local calendar period.
 * Untraceable / invalid timestamps never match — callers that only render
 * items with a verified activity timestamp should also gate on that flag.
 */
export function matchesTimeFilter(
  timestamp: MaybeTimestamp,
  filter: TimeFilterKey,
  now: Date = new Date()
): boolean {
  const parsed = parseTimestamp(timestamp);
  if (!parsed) return false;
  switch (filter) {
    case "today":
      return isSameLocalDay(parsed, now);
    case "this_week":
      return isInLocalWeek(parsed, now);
    case "this_month":
      return isInLocalMonth(parsed, now);
    case "next_month":
      return isInNextLocalMonth(parsed, now);
  }
}