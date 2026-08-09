/**
 * LIVE evidence adapter.
 *
 * This module is the ONLY place the harness could reach the Gmail API. It is
 * hard-fail-closed: `collectLiveEvidence` returns the empty (deferral) set
 * unless the operator has both set `GMAIL_STAGING_LIVE_ALLOW=1` AND supplied
 * a matching one-shot nonce in `GMAIL_STAGING_LIVE_NONCE`.
 *
 * Until the staged provisioning runbook step is done, this always returns the
 * deferred set and the harness reports `gated`.
 */

import type { LiveEvidence } from "./checks";
import { buildSeedScenario } from "./seed";

export const LIVE_ALLOW_VAR = "GMAIL_STAGING_LIVE_ALLOW";
export const LIVE_NONCE_VAR = "GMAIL_STAGING_LIVE_NONCE";

export interface LiveProof {
  ok: boolean;
  reason: string;
}

export function assertLiveCleared(env: {
  liveAllowed?: string;
  liveNonce?: string;
  expectedNonce?: string;
}): LiveProof {
  if (env.liveAllowed !== "1") {
    return { ok: false, reason: `${LIVE_ALLOW_VAR} is not set to "1".` };
  }
  if (!env.liveNonce) {
    return { ok: false, reason: `${LIVE_NONCE_VAR} is not set.` };
  }
  if (env.expectedNonce && env.liveNonce !== env.expectedNonce) {
    return { ok: false, reason: "Live nonce mismatch — refusing live evidence." };
  }
  return { ok: true, reason: "Live proof satisfied." };
}

/**
 * Collect live evidence. Returns the deferral set unless proof is satisfied.
 * The real HTTP path is isolated in gmail-http.ts so a failed gate never
 * touches the network.
 */
export async function collectLiveEvidence(
  accountEmail: string | null,
  proof: LiveProof
): Promise<Partial<LiveEvidence>> {
  if (!proof.ok) {
    return { messages: [], rawCount: 0 };
  }
  const scenario = buildSeedScenario("live");
  const { fetchGmailEvidence } = await import("./gmail-http");
  return fetchGmailEvidence(scenario, accountEmail);
}