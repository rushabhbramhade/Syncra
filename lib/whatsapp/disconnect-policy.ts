/**
 * WhatsApp socket-close decision policy — the ONLY place that decides whether a
 * closed Baileys socket tears down persisted state or just reconnects.
 *
 * Pure module (no Baileys import) so the decision is unit-testable and the
 * socket handler can never accidentally destroy a user's connection.
 *
 * The rule is deliberately conservative:
 *  - `loggedOut` (401) is the ONLY reason a persisted session is truly dead —
 *    the phone revoked it. Teardown the session + integration row.
 *  - Any other close (network drop, timeout, server restart, transient 408/515,
 *    connection replaced) is a RECONNECT, not a disconnect. The persisted
 *    session in whatsapp_sessions and the active row in user_integrations are
 *    the durable source of truth and MUST survive — otherwise WhatsApp silently
 *    "disappears" after logout/login or a server restart.
 *  - No session creds yet (pre-pairing, pairing aborted) → ignore. Never delete
 *    an existing active integration row because a pairing socket failed.
 */

export const WA_LOGGED_OUT_STATUS = 401;

export type WaCloseAction = "reconnect" | "teardown_session" | "ignore";

export function decideWaCloseAction(statusCode: number | undefined, hasSession: boolean): WaCloseAction {
  if (statusCode === WA_LOGGED_OUT_STATUS) return "teardown_session";
  if (hasSession) return "reconnect";
  return "ignore";
}

/**
 * QR / pairing-code socket close decision. QR expiry is handled by Baileys
 * re-emitting a fresh `qr` on the SAME socket — it never closes. So this only
 * runs on a genuine socket close, and the core invariant holds:
 *
 *  - `paired` (phone authorized, but the session isn't verified yet) → RECONNECT:
 *    the server closes after pair-success (515); reopen a verified socket that
 *    reaches `open` before the integration is marked Connected.
 *  - not paired + 401 → TEARDOWN: only genuine logout destroys the session.
 *  - not paired + anything else (transient) → KEEP: preserve pairing + DB session
 *    so a non-destructive renewal can pick up where the user left off.
 */
export type PairingCloseAction = "reconnect" | "teardown_session" | "keep";

export function decidePairingClose(statusCode: number | undefined, paired: boolean): PairingCloseAction {
  if (paired) return "reconnect";
  if (statusCode === WA_LOGGED_OUT_STATUS) return "teardown_session";
  return "keep";
}

/**
 * QR renewal decision — the ONLY place that decides whether a countdown-zero /
 * manual refresh rebuilds anything.
 *
 * The non-destructive invariant: renewal may replace a socket ONLY when the
 * pairing socket is truly dead AND the phone has not yet authorized (paired).
 * A live socket re-emits fresh QRs by itself (Baileys qrTimeout), so renewal
 * just hands back the current QR/expiry — never tears down. A paired session is
 * mid-authorization and must be left untouched for the verified reconnect.
 */
export type PairingRenewalAction = "start_fresh" | "keep_current" | "rebuild_socket";

export function decidePairingRenewal(hasPairing: boolean, isQrMethod: boolean, paired: boolean, connected: boolean, sockAlive: boolean): PairingRenewalAction {
  if (!hasPairing || !isQrMethod) return "start_fresh";
  if (paired || connected) return "keep_current";
  if (sockAlive) return "keep_current";
  return "rebuild_socket";
}
