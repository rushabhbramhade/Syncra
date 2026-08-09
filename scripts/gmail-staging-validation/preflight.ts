/**
 * Preflight for the Gmail staging validation harness.
 *
 * Runs before any live work. Everything here is database/env introspection —
 * NO Gmail API calls. It answers three gates:
 *   A. A staging inbox is declared and matches the connected account.
 *   B. OAuth config exists and the integration row is fresh/connected.
 *   C. No denylisted (real) account is present in the connected integration.
 */

import { guardStaging, isDenylisted } from "./guard";

export interface EnvSnapshot {
  stagingAccount?: string;
  oauthClientId?: string;
  oauthClientSecret?: string;
  appUrl?: string;
}

export interface IntegrationRow {
  id: string;
  user_id: string;
  provider: string;
  provider_account_id: string | null;
  email: string | null;
  status: string | null;
  connected: boolean | null;
  expires_at: string | null;
  capabilities?: string[] | null;
  encRefreshToken?: string | null;
  encAccessToken?: string | null;
  hasControlledRows: boolean;
}

export interface DbAdapter {
  findGmailIntegrations(): Promise<IntegrationRow[]>;
  hasControlledRows(email: string): Promise<boolean>;
}

export interface PreflightResult {
  ok: boolean;
  accountEmail: string | null;
  stagingStatus: "declared" | "denylisted" | "unproven";
  oauthConfigured: boolean;
  oauthFresh: boolean;
  trainedIntegration: boolean;
  connected: boolean;
  problems: string[];
}

/** Fail-closed: any real (denylisted) account present => refuse everything. */
export function assertNoDenylistedRows(rows: IntegrationRow[]): string[] {
  const problems: string[] = [];
  for (const r of rows) {
    if (r.email && isDenylisted(r.email)) {
      problems.push(`Deny entry locked: connected to real account ${r.email}. Refusing to run.`);
    }
    if (r.provider_account_id && isDenylisted(r.provider_account_id)) {
      problems.push(`Deny entry locked: provider_account_id ${r.provider_account_id}. Refusing to run.`);
    }
  }
  return problems;
}

export function isTokenFresh(expiresAt: string | null): boolean {
  if (!expiresAt) return false;
  const t = Date.parse(expiresAt);
  if (Number.isNaN(t)) return false;
  return t > Date.now() + 60_000; // 60s margin
}

/** The single place preflight status is decided; pure & testable. */
export function evaluatePreflight(input: {
  env: EnvSnapshot;
  accountEmail: string | null;
  expiresAt: string | null;
  hasControlledRows: boolean;
  denylistProblems: string[];
  hasIntegration: boolean;
  oauthConfigured: boolean;
}): PreflightResult {
  const account = (input.accountEmail ?? "").trim();
  const guard = guardStaging({
    env: input.env.stagingAccount,
    accountEmail: account,
    hasControlledRows: input.hasControlledRows,
  });

  const problems = [...input.denylistProblems];
  if (!input.oauthConfigured) problems.push("OAuth client missing (GOOGLE_CLIENT_ID/SECRET).");
  const oauthFresh = isTokenFresh(input.expiresAt);
  if (!oauthFresh) problems.push("Access token not fresh in the integration row.");
  if (!input.hasIntegration) problems.push("No connected Gmail integration row found.");
  if (!guard.allow) problems.push(`Staging gate: ${guard.reason}`);

  const stagingStatus: PreflightResult["stagingStatus"] = problems.some((p) =>
    p.startsWith("Deny entry locked")
  )
    ? "denylisted"
    : guard.allow
      ? "declared"
      : "unproven";

  return {
    ok:
      problems.length === 0 &&
      input.hasIntegration &&
      input.hasControlledRows &&
      oauthFresh &&
      guard.allow,
    accountEmail: account || null,
    stagingStatus,
    oauthConfigured: input.oauthConfigured,
    oauthFresh,
    trainedIntegration: input.hasIntegration,
    connected: input.hasIntegration,
    problems,
  };
}