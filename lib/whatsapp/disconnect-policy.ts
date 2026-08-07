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
