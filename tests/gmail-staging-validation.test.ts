import { test } from "node:test";
import assert from "node:assert/strict";
import { guardStaging, isDenylisted, DENYLIST } from "../scripts/gmail-staging-validation/guard";
import { evaluatePreflight } from "../scripts/gmail-staging-validation/preflight";

/**
 * Gmail staging validation harness — fail-closed guards.
 *
 * The harness must never point at a personal/business account and must refuse
 * to plan/run until a staging identity is proven. These tests pin those
 * offline guards (no DB, no network).
 */

test("guard: denylisted real accounts are locked forever", () => {
  for (const email of DENYLIST) {
    assert.equal(isDenylisted(email), true, `${email} must be denylisted`);
  }
  assert.equal(
    guardStaging({ env: DENYLIST[0] ?? "", accountEmail: DENYLIST[0] ?? "", hasControlledRows: true }).allow,
    false
  );
});

test("guard: empty env fails closed (never guesses a target)", () => {
  const v = guardStaging({ env: "", accountEmail: "al@b.c", hasControlledRows: true });
  assert.equal(v.allow, false);
  assert.match(v.reason, /Empty identity/i);
});

test("guard: env/account mismatch fails closed", () => {
  const v = guardStaging({ env: "staging@syncra.dev", accountEmail: "other@b.y", hasControlledRows: true });
  assert.equal(v.allow, false);
  assert.match(v.reason, /mismatch/i);
});

test("guard: uncontrolled mailbox fails closed (rows not proven)", () => {
  const v = guardStaging({ env: "staging@syncra.dev", accountEmail: "staging@syncra.dev", hasControlledRows: false });
  assert.equal(v.allow, false);
  assert.match(v.reason, /not proven/i);
});

test("guard: matching declared env + controlled mailbox passes", () => {
  const v = guardStaging({ env: "staging@syncra.dev", accountEmail: "staging@syncra.dev", hasControlledRows: true });
  assert.equal(v.allow, true);
});

test("guard: matching is case-insensitive", () => {
  const v = guardStaging({ env: "STAGING@Syncra.dev", accountEmail: "staging@syncra.dev", hasControlledRows: true });
  assert.equal(v.allow, true);
});

test("preflight: real account present in the DB blocks the run", () => {
  const r = evaluatePreflight({
    env: { stagingAccount: DENYLIST[0] ?? "", oauthClientId: "id", oauthClientSecret: "set" },
    accountEmail: DENYLIST[0] ?? "",
    expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    hasControlledRows: true,
    denylistProblems: [`Deny entry locked: connected to real account ${DENYLIST[0]}.`],
    hasIntegration: true,
    oauthConfigured: true,
  });
  assert.equal(r.ok, false);
  assert.equal(r.stagingStatus, "denylisted");
});

test("preflight: healthy declared staging + proven mailbox passes", () => {
  const r = evaluatePreflight({
    env: { stagingAccount: "staging@syncra.dev", oauthClientId: "id", oauthClientSecret: "set" },
    accountEmail: "staging@syncra.dev",
    expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    hasControlledRows: true,
    denylistProblems: [],
    hasIntegration: true,
    oauthConfigured: true,
  });
  assert.equal(r.ok, true);
  assert.equal(r.stagingStatus, "declared");
});

test("preflight: stale token fails closed", () => {
  const r = evaluatePreflight({
    env: { stagingAccount: "staging@syncra.dev", oauthClientId: "id", oauthClientSecret: "set" },
    accountEmail: "staging@syncra.dev",
    expiresAt: new Date(Date.now() - 3_600_000).toISOString(),
    hasControlledRows: true,
    denylistProblems: [],
    hasIntegration: true,
    oauthConfigured: true,
  });
  assert.equal(r.ok, false);
  assert.equal(r.oauthFresh, false);
  assert.match(r.problems.join(" "), /token not fresh/i);
});

test("preflight: missing OAuth client fails closed", () => {
  const r = evaluatePreflight({
    env: { stagingAccount: "staging@syncra.dev" },
    accountEmail: "staging@syncra.dev",
    expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    hasControlledRows: true,
    denylistProblems: [],
    hasIntegration: true,
    oauthConfigured: false,
  });
  assert.equal(r.ok, false);
  assert.match(r.problems.join(" "), /OAuth client missing/i);
});