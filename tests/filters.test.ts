import { test } from "node:test";
import assert from "node:assert/strict";
import {
  matchesTimeFilter,
  startOfLocalDay,
  startOfLocalMonth,
  isSameLocalDay,
  parseTimestamp,
} from "../lib/briefing/filters.ts";

/**
 * Date filters must be computed against a fixed reference spot exactly as the
 * UI does — relative to the user's local calendar. Month/next-month roll over
 * with the calendar and are never hardcoded, and untraceable/invalid
 * timestamps never match a date filter.
 */
const NOW = new Date(2026, 7, 9, 14, 30, 0); // Sunday, 2026-08-09 local

test("today: matches only the same local calendar day", () => {
  const today = new Date(2026, 7, 9, 8, 0, 0).toISOString();
  const yesterday = new Date(2026, 7, 8, 23, 59, 59).toISOString();
  const tomorrow = new Date(2026, 7, 10, 0, 0, 0).toISOString();
  assert.equal(matchesTimeFilter(today, "today", NOW), true);
  assert.equal(matchesTimeFilter(yesterday, "today", NOW), false);
  assert.equal(matchesTimeFilter(tomorrow, "today", NOW), false);
});

test("this_week: Monday-Sunday range centered on the reference week", () => {
  const monday = new Date(2026, 7, 3, 9, 0, 0).toISOString(); // Mon
  const sunday = new Date(2026, 7, 9, 9, 0, 0).toISOString(); // Sun
  const lastMonday = new Date(2026, 7, 2, 9, 0, 0).toISOString(); // Sun before
  const nextMonday = new Date(2026, 7, 10, 9, 0, 0).toISOString();
  assert.equal(matchesTimeFilter(monday, "this_week", NOW), true);
  assert.equal(matchesTimeFilter(sunday, "this_week", NOW), true);
  assert.equal(matchesTimeFilter(lastMonday, "this_week", NOW), false);
  assert.equal(matchesTimeFilter(nextMonday, "this_week", NOW), false);
});

test("this_month: same local calendar month", () => {
  const inMonth = new Date(2026, 7, 1, 0, 0, 0).toISOString();
  const priorMonth = new Date(2026, 6, 31, 23, 59, 59).toISOString();
  assert.equal(matchesTimeFilter(inMonth, "this_month", NOW), true);
  assert.equal(matchesTimeFilter(priorMonth, "this_month", NOW), false);
});

test("next_month: the following local calendar month (rolls over December→January)", () => {
  const janNext = new Date(2027, 0, 1, 0, 0, 0).toISOString();
  const decAnchor = new Date(2026, 11, 15, 12, 0, 0);
  assert.equal(matchesTimeFilter(janNext, "next_month", decAnchor), true, "Dec 2026 + next_month must reach Jan 2027");
  const dec = new Date(2026, 11, 31, 23, 0, 0).toISOString();
  assert.equal(matchesTimeFilter(dec, "next_month", decAnchor), false);
});

test("month filters are dynamic — the reference clock is what matters", () => {
  // No hardcoded "August 2026": move the reference to November and filters follow.
  const novAnchor = new Date(2026, 10, 5, 12, 0, 0);
  const oct = new Date(2026, 9, 20, 12, 0, 0).toISOString();
  const nov = new Date(2026, 10, 20, 12, 0, 0).toISOString();
  const dec = new Date(2026, 11, 20, 12, 0, 0).toISOString();
  assert.equal(matchesTimeFilter(oct, "this_month", novAnchor), false);
  assert.equal(matchesTimeFilter(nov, "this_month", novAnchor), true);
  assert.equal(matchesTimeFilter(dec, "next_month", novAnchor), true);
});

test("invalid / empty timestamps never match a date filter", () => {
  assert.equal(matchesTimeFilter(null, "today", NOW), false);
  assert.equal(matchesTimeFilter("", "this_week", NOW), false);
  assert.equal(matchesTimeFilter("not-a-date", "this_month", NOW), false);
  assert.equal(matchesTimeFilter(undefined, "next_month", NOW), false);
});

test("parseTimestamp and day helpers follow local timezone", () => {
  const parsed = parseTimestamp("2026-08-09T00:00:00");
  assert.ok(parsed instanceof Date);
  assert.equal(isSameLocalDay(startOfLocalDay(new Date(2026, 7, 9, 23, 0, 0)), new Date(2026, 7, 9, 1, 0, 0)), true);
  assert.equal(
    startOfLocalMonth(new Date(2026, 7, 9)).toISOString().slice(0, 7),
    startOfLocalMonth(new Date(2026, 7, 30)).toISOString().slice(0, 7)
  );
});