import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const migrationPath = fileURLToPath(
  new URL("../migrations/20260807000000_security-and-queue-hardening.sql", import.meta.url),
);
const sql = readFileSync(migrationPath, "utf8");

test("WhatsApp session credentials have no client-facing RLS policy", () => {
  assert.match(sql, /tablename = 'whatsapp_sessions'/);
  assert.match(sql, /DROP POLICY IF EXISTS %I ON public\.whatsapp_sessions/);
  assert.doesNotMatch(
    sql,
    /CREATE POLICY[\s\S]*ON public\.whatsapp_sessions/,
    "whatsapp_sessions must remain admin-only behind RLS",
  );
});

test("briefing execution and delivery audits are read-only for their owners", () => {
  assert.match(sql, /'briefing_generation_runs'/);
  assert.match(sql, /'briefing_message_deliveries'/);
  assert.match(sql, /FOR SELECT TO authenticated USING \(public\.is_owner\(user_id\)\)/);
  assert.doesNotMatch(sql, /FOR (?:INSERT|UPDATE|DELETE) TO authenticated/);
});

test("notification queue status constraint permits atomic processing claims", () => {
  const statusConstraint = sql.match(
    /ADD CONSTRAINT notification_history_status_check[\s\S]*?\)\);/,
  );

  assert.ok(statusConstraint, "notification status constraint must be recreated");
  assert.match(statusConstraint[0], /'processing'/);
});

test("paid API rate limits are stored and consumed atomically", () => {
  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.rate_limits/);
  assert.match(sql, /PRIMARY KEY \(user_id, bucket\)/);
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.consume_rate_limit/);
  assert.match(sql, /ON CONFLICT \(user_id, bucket\) DO UPDATE/);
  assert.match(sql, /SECURITY DEFINER/);
  assert.match(
    sql,
    /REVOKE ALL ON FUNCTION public\.consume_rate_limit\(UUID, TEXT, INTEGER, INTEGER\) FROM PUBLIC/,
  );
  assert.match(
    sql,
    /GRANT EXECUTE ON FUNCTION public\.consume_rate_limit\(UUID, TEXT, INTEGER, INTEGER\) TO project_admin/,
  );
});
