/**
 * Gmail REST HTTP adapter — the actual outbound-call surface.
 *
 * This module is only ever imported when the fail-closed live gate passed
 * (see live-adapter.ts). It is intentionally a THIN placeholder: it exists to
 * draw a hard line between the harness's offline logic and any future live
 * call, and to guard the wire with an explicit "cleared" hand-off. In the
 * current staging phase it is never invoked.
 */

import type { LiveEvidence } from "./checks";
import type { SeedScenario } from "./seed";

export interface LiveTokenBundle {
  accessToken: string;
}

export async function fetchGmailEvidence(
  _scenario: SeedScenario,
  _accountEmail: string | null
): Promise<Partial<LiveEvidence>> {
  const token = process.env.GMAIL_STAGING_ACCESS_TOKEN;
  if (!token) {
    throw new Error("Live evidence requested but GMAIL_STAGING_ACCESS_TOKEN is not set.");
  }
  return queryInbox({ accessToken: token });
}

async function queryInbox(_bundle: LiveTokenBundle): Promise<Partial<LiveEvidence>> {
  // Placeholder for the staged call. The runbook will wire the real request
  // once the staging account is provisioned and enrolled.
  return { messages: [], rawCount: 0 };
}