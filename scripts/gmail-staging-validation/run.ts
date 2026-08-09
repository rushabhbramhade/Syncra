/**
 * Gmail staging validation harness — entrypoint.
 *
 *   npx tsx scripts/gmail-staging-validation/run.ts <cmd>
 *
 * Commands:
 *   preflight  Run DB/env introspection. NEVER makes Gmail calls.
 *   plan       Print the seed scenario that a future live run will validate.
 *   run        Execute the 13 acceptance checks. GATED: fails closed unless
 *              GMAIL_STAGING_ACCOUNT is set AND the mailbox has proven
 *              controlled rows. This is the only path that touches Gmail.
 *
 * Exit codes: 0 = all pass, 1 = check failures, 2 = preflight/env failure,
 * 3 = gated (refused to touch live), 4 = usage error.
 *
 * IMPORTANT (fail-closed): this harness never contacts Gmail during
 * `preflight` or `plan`. Only `run` may, and only after guardStaging passes.
 */

import * as dotenv from "dotenv";
import * as fs from "node:fs";
import * as path from "node:path";

import { CHECKS } from "./checks";
import { buildSeedScenario } from "./seed";
import {
  assertNoDenylistedRows,
  evaluatePreflight,
  type IntegrationRow,
} from "./preflight";
import {
  renderHumanSummary,
  renderWireReport,
  overallStatus,
} from "./report";

function loadEnvFile(): void {
  const candidates = [".env.local", ".env"];
  for (const c of candidates) {
    const p = path.resolve(process.cwd(), c);
    if (fs.existsSync(p)) {
      dotenv.config({ path: p });
      return;
    }
  }
}

interface AdapterResult {
  integrations: IntegrationRow[];
  controlled: boolean;
  accountEmail: string | null;
  expiresAt: string | null;
}

/** Minimal admin-DB adapter (project env). No Gmail API usage here. */
async function introspectDb(): Promise<AdapterResult> {
  const { createAdminClient } = await import("@insforge/sdk");
  const baseUrl = process.env.NEXT_PUBLIC_INSFORGE_BASE_URL;
  const apiKey = process.env.INSFORGE_API_KEY;
  if (!baseUrl || !apiKey) {
    return { integrations: [], controlled: false, accountEmail: null, expiresAt: null };
  }
  const db = createAdminClient({ baseUrl, apiKey, timeout: 10_000 });

  let gmail: unknown[] = [];
  try {
    const { data, error } = await db.database
      .from("user_integrations")
      .select("id,user_id,provider,provider_account_id,email,status,connected,expires_at,capabilities")
      .eq("provider", "gmail");
    if (!error && Array.isArray(data)) gmail = data as unknown[];
  } catch {
    gmail = [];
  }

  const integrations = (gmail as Array<Record<string, unknown>>).map((r) => ({
    id: String(r.id ?? ""),
    user_id: String(r.user_id ?? ""),
    provider: String(r.provider ?? "gmail"),
    provider_account_id: r.provider_account_id == null ? null : String(r.provider_account_id),
    email: r.email == null ? null : String(r.email),
    status: r.status == null ? null : String(r.status),
    connected: r.connected == null ? null : Boolean(r.connected),
    expires_at: r.expires_at == null ? null : String(r.expires_at),
    hasControlledRows: false,
  }));

  const accountEmail = integrations[0]?.email ?? integrations[0]?.provider_account_id ?? null;
  const expiresAt = integrations[0]?.expires_at ?? null;

  let controlled = false;
  if (accountEmail) {
    try {
      const { count, error } = await db.database
        .from("unified_messages")
        .select("provider_message_id", { count: "exact", head: true })
        .eq("provider_id", "gmail")
        .limit(1);
      controlled = !error && typeof count === "number" && count > 0;
    } catch {
      controlled = false;
    }
  }
  return { integrations, controlled, accountEmail, expiresAt };
}

function envSnapshot() {
  return {
    stagingAccount: process.env.GMAIL_STAGING_ACCOUNT?.trim() || undefined,
    oauthClientId: process.env.GOOGLE_CLIENT_ID?.trim() || undefined,
    oauthClientSecret: process.env.GOOGLE_CLIENT_SECRET?.trim() ? "set" : undefined,
    appUrl: process.env.NEXT_PUBLIC_APP_URL?.trim() || process.env.VERCEL_URL,
  };
}

async function runPreflight(): Promise<number> {
  const env = envSnapshot();
  const { integrations, controlled, accountEmail, expiresAt } = await introspectDb();
  const denylistProblems = assertNoDenylistedRows(integrations);

  const result = evaluatePreflight({
    env,
    accountEmail,
    expiresAt,
    hasControlledRows: controlled,
    denylistProblems,
    hasIntegration: integrations.length > 0,
    oauthConfigured: Boolean(env.oauthClientId && env.oauthClientSecret),
  });

  const status = overallStatus({ checkResults: [], preflightOk: result.ok });
  const report = renderWireReport({
    env: env.appUrl ?? "unknown",
    accountEmail: result.accountEmail ?? "",
    ts: Date.now(),
    preflightOk: result.ok,
    checkResults: [],
    gatingBlocked: false,
  });
  process.stdout.write(report);

  console.log("\nPreflight problems:");
  for (const p of result.problems) console.log(`  - ${p}`);
  if (result.problems.length === 0) console.log("  (none)");
  console.log(`\nStaging status: ${result.stagingStatus}`);
  return status === "pass" ? 0 : 2;
}

async function runPlan(): Promise<number> {
  const nonce = `seed-${Date.now().toString(36)}`;
  const scenario = buildSeedScenario(nonce);
  console.log(`GMAIL STAGING SEED PLAN (nonce=${nonce})`);
  console.log(`Subject prefix: ${scenario.subjectPrefix}`);
  console.log(`Messages to create in the staging inbox:`);
  for (const m of scenario.messages) {
    console.log(`  - [${m.kind.padEnd(14)}] ${m.subject}  unread=${m.unread}`);
  }
  for (const t of scenario.threads) {
    console.log(`  - [THREAD]         ${t.root.subject}`);
    for (const r of t.replies) {
      console.log(`      ↳ reply        ${r.subject}`);
    }
  }
  console.log("\nRun `npx tsx scripts/gmail-staging-validation/run.ts run` after seeding to validate.");
  return 0;
}

async function runChecks(): Promise<number> {
  const env = envSnapshot();
  const { integrations, controlled, accountEmail, expiresAt } = await introspectDb();
  const denylistProblems = assertNoDenylistedRows(integrations);

  const preflight = evaluatePreflight({
    env,
    accountEmail,
    expiresAt,
    hasControlledRows: controlled,
    denylistProblems,
    hasIntegration: integrations.length > 0,
    oauthConfigured: Boolean(env.oauthClientId && env.oauthClientSecret),
  });

  // GATE: refuse to touch live Gmail unless the fail-closed preflight passed.
  if (!preflight.ok) {
    const report = renderWireReport({
      env: env.appUrl ?? "unknown",
      accountEmail: preflight.accountEmail ?? "",
      ts: Date.now(),
      preflightOk: false,
      checkResults: [],
      gatingBlocked: true,
    });
    process.stdout.write(report);
    console.log("\nGATED — refused to contact Gmail. Fix preflight problems above.");
    for (const p of preflight.problems) console.log(`  - ${p}`);
    return 3;
  }

  // Controlled seed. The LIVE adapter produces evidence; this harness keeps the
  // adapter boundary explicit so the 13 checks are evaluated over fetched
  // results. The gate covers proof; a missing proof yields empty evidence.
  const scenario = buildSeedScenario("live-run");
  const { collectLiveEvidence, assertLiveCleared } = await import("./live-adapter");
  const proof = assertLiveCleared({
    liveAllowed: process.env.GMAIL_STAGING_LIVE_ALLOW,
    liveNonce: process.env.GMAIL_STAGING_LIVE_NONCE,
    expectedNonce: undefined,
  });
  const evidence = await collectLiveEvidence(accountEmail, proof);
  const results = CHECKS.map((c) => c.run(scenario, evidence));
  const gatingBlocked = !proof.ok;

  process.stdout.write(
    renderWireReport({
      env: env.appUrl ?? "unknown",
      accountEmail: preflight.accountEmail ?? "",
      ts: Date.now(),
      preflightOk: true,
      checkResults: results,
      gatingBlocked,
    })
  );
  const status = overallStatus({
    checkResults: results,
    preflightOk: true,
    gatingBlocked,
  });
  process.stdout.write("\n" + renderHumanSummary(results, status));
  if (gatingBlocked) {
    console.log("\nNOTE: live-evidence gate not satisfied; checks are deferred, not failed.");
    return 3;
  }
  return status === "pass" ? 0 : 1;
}

const USAGE = `Usage: npx tsx scripts/gmail-staging-validation/run.ts <preflight|plan|run>

Commands:
  preflight  Introspect env + DB only. NEVER touches Gmail.
  plan       Print the controlled seed scenario (nonce-scoped).
  run        Run the 13 acceptance checks against the live staging inbox
             (GATED: only proceeds when staging identity is proven).
`;

async function main(argv: string[]): Promise<number> {
  loadEnvFile();
  const cmd = argv[0] ?? "";
  switch (cmd) {
    case "preflight":
      return runPreflight();
    case "plan":
      return runPlan();
    case "run":
      return runChecks();
    default:
      process.stderr.write(USAGE);
      return 4;
  }
}

main(process.argv.slice(2))
  .then((code) => {
    process.exitCode = code;
  })
  .catch((err: unknown) => {
    console.error("Harness error:", err);
    process.exitCode = 1;
  });