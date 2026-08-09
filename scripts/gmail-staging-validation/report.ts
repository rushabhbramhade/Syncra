/**
 * Machine-readable wire report for the Gmail staging validation harness.
 *
 * Strict delimiter block so ops can parse it (and a CI gate could assert on
 * it) without JSON tooling:
 *
 *   GMAIL_STAGING_VALIDATION:START
 *   account=<staging-account>
 *   ts=<epoch-ms>
 *   status=<pass|fail|deferred|gated>
 *   check.<id>=<status>|<detail>
 *   ...
 *   GMAIL_STAGING_VALIDATION:END
 */

import type { CheckResult } from "./checks";

export interface ReportInput {
  env: string;
  accountEmail: string;
  ts: number;
  preflightOk: boolean;
  checkResults: CheckResult[];
  gatingBlocked?: boolean;
}

export type OverallStatus = "pass" | "fail" | "deferred" | "gated";

export function overallStatus(input: {
  checkResults: CheckResult[];
  preflightOk: boolean;
  gatingBlocked?: boolean;
}): OverallStatus {
  if (input.gatingBlocked) return "gated";
  if (!input.preflightOk) return "fail";
  if (input.checkResults.some((r) => r.status === "fail")) return "fail";
  if (input.checkResults.some((r) => r.status === "deferred")) return "deferred";
  return "pass";
}

export function renderWireReport(input: ReportInput): string {
  const status = overallStatus(input);
  const lines: string[] = [
    "GMAIL_STAGING_VALIDATION:START",
    `env=${input.env}`,
    `account=${input.accountEmail}`,
    `ts=${input.ts}`,
    `status=${status}`,
  ];
  for (const r of input.checkResults) {
    lines.push(`check.${r.id}=${r.status}|${r.detail.replace(/\n/g, " ")}`);
  }
  lines.push("GMAIL_STAGING_VALIDATION:END");
  return lines.join("\n") + "\n";
}

/** Human summary for a terminal run. */
export function renderHumanSummary(results: CheckResult[], status: OverallStatus): string {
  const pass = results.filter((r) => r.status === "pass").length;
  const fail = results.filter((r) => r.status === "fail").length;
  const deferred = results.filter((r) => r.status === "deferred").length;
  const lines = [
    `GMAIL STAGING VALIDATION — ${status.toUpperCase()}`,
    `  pass: ${pass}  fail: ${fail}  deferred: ${deferred}`,
  ];
  for (const r of results) {
    lines.push(`  [${r.status.toUpperCase().padEnd(8)}] ${r.id} — ${r.detail}`);
  }
  return lines.join("\n") + "\n";
}