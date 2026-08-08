import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isSyncEvidenceAction,
  countResultItems,
  buildSyncEvidenceEntry,
  syncEvidenceMessage,
} from "../lib/integrations/sync-evidence";

/**
 * Regression: briefing-originated provider fetches must write accurate
 * integration_sync_logs evidence. The sync-engine (syncIntegration/metrics
 * auto-sync) already writes logs; the briefing path goes through
 * executeMCPAction, which previously stamped last_sync_at only and left the
 * Integration Health card without any evidence ("No Recent Activity" despite
 * a real fetch). These tests pin the log-entry contract that fixes the gap.
 */

test("SYNC_EVIDENCE_ACTIONS covers every briefing/sync fetch tool", () => {
  const required = [
    "gmail_search_emails",
    "slack_fetch_messages",
    "whatsapp_fetch_messages",
    "telegram_fetch_messages",
    "discord_fetch_recent_messages",
    "github_list_issues",
    "github_get_notifications",
    "github_get_recent_activity",
    "linkedin_get_profile",
  ];
  for (const action of required) {
    assert.equal(isSyncEvidenceAction(action), true, `${action} must be sync evidence`);
  }
});

test("transitive MCP actions are NOT sync evidence (never 'recent activity')", () => {
  for (const action of ["slack_send_message", "github_create_issue", "whatsapp_send_message", "gmail_send_email", "discord_send_message", "telegram_send_message"]) {
    assert.equal(isSyncEvidenceAction(action), false, `${action} must NOT be sync evidence`);
  }
});

test("countResultItems counts arrays (flat) and nested array fields", () => {
  assert.equal(countResultItems(["a", "b"]), 2);
  assert.equal(countResultItems({ issues: [1, 2, 3], notifications: ["x"], activity: [] }), 4);
  assert.equal(countResultItems({ profile: {} }), 0);
  assert.equal(countResultItems(null), 0);
  assert.equal(countResultItems("text"), 0);
});

test("buildSyncEvidenceEntry: success entry carries canonical auth id, provider, action, count, duration", () => {
  const entry = buildSyncEvidenceEntry({
    userId: "auth-1234",
    providerId: "github",
    actionName: "github_list_issues",
    status: "success",
    message: "Fetch completed via github_list_issues (3 items).",
    itemCount: 3,
    durationMs: 456,
  });
  assert.equal(entry.user_id, "auth-1234");
  assert.equal(entry.provider, "github");
  assert.equal(entry.status, "success");
  assert.deepEqual(entry.metadata, { action: "github_list_issues", source: "briefing", itemCount: 3 });
  assert.equal(entry.duration_ms, 456);
});

test("buildSyncEvidenceEntry: failure is a failure, never healthy", () => {
  const entry = buildSyncEvidenceEntry({
    userId: "auth-1234",
    providerId: "slack",
    actionName: "slack_fetch_messages",
    status: "error",
    message: "Fetch failed via slack_fetch_messages: missing_scope",
    error: "missing_scope",
    durationMs: 12,
  });
  assert.equal(entry.status, "error");
  assert.equal((entry.metadata as Record<string, unknown>).error, "missing_scope");
});

test("syncEvidenceMessage: names the action, count on success, cause on failure", () => {
  assert.equal(
    syncEvidenceMessage({ actionName: "gmail_search_emails", status: "success", itemCount: 5 }),
    "Fetch completed via gmail_search_emails (5 items).",
  );
  assert.equal(
    syncEvidenceMessage({ actionName: "slack_fetch_messages", status: "error", error: "401" }),
    "Fetch failed via slack_fetch_messages: 401",
  );
});