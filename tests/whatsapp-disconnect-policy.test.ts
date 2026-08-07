import { test } from "node:test";
import assert from "node:assert/strict";
import {
  decideWaCloseAction,
  decidePairingClose,
  decidePairingRenewal,
  WA_LOGGED_OUT_STATUS,
  type WaCloseAction,
  type PairingCloseAction,
  type PairingRenewalAction,
} from "../lib/whatsapp/disconnect-policy.ts";

const cases: Array<{ code: number | undefined; hasSession: boolean; expect: WaCloseAction; why: string }> = [
  // Phone revoked — the only reason to tear the session + integration row down.
  { code: WA_LOGGED_OUT_STATUS, hasSession: true, expect: "teardown_session", why: "logged out must teardown" },
  { code: WA_LOGGED_OUT_STATUS, hasSession: false, expect: "teardown_session", why: "logged out with no session still teardown" },

  // Transient close (network drop, timeout, server restart, connection replaced).
  // Persisted session + active row MUST survive — this is the logout/login and
  // cold-restart persistence bug.
  { code: 403, hasSession: true, expect: "reconnect", why: "timeout/restart with session = reconnect, never teardown" },
  { code: 408, hasSession: true, expect: "reconnect", why: "connection lost = reconnect" },
  { code: 428, hasSession: true, expect: "reconnect", why: "connection replaced = reconnect" },
  { code: 515, hasSession: true, expect: "reconnect", why: "server close after pair = reconnect" },
  { code: undefined, hasSession: true, expect: "reconnect", why: "unknown/undefined code with session = reconnect" },

  // No session creds yet (pre-pair / aborted pairing) — never delete an
  // existing active integration row because a pairing socket closed.
  { code: 403, hasSession: false, expect: "ignore", why: "no session, transient close = ignore" },
  { code: undefined, hasSession: false, expect: "ignore", why: "no session, unknown close = ignore" },
];

for (const c of cases) {
  test(`decideWaCloseAction(${c.code}, ${c.hasSession}) → ${c.expect} (${c.why})`, () => {
    assert.equal(decideWaCloseAction(c.code, c.hasSession), c.expect);
  });
}

// ── decidePairingClose: the QR/pairing-code socket close policy ─────────────
// Core invariant: QR EXPIRY never closes the socket (Baileys re-emits a fresh
// QR on the same socket), and a pre-auth transient close must NEVER destroy the
// session. Only genuine logout (401) or an authorized-and-failed pairing tears
// down / reconnects respectively.
const pairingCases: Array<{ code: number | undefined; paired: boolean; expect: PairingCloseAction; why: string }> = [
  // Phone authorized but session not verified yet → reopen a verified socket.
  { code: 515, paired: true, expect: "reconnect", why: "post-pair server close = reconnect to verified socket" },
  { code: undefined, paired: true, expect: "reconnect", why: "paired, unknown code = reconnect" },

  // Genuine logout (401) — the ONLY legit destroyer, paired or not.
  { code: WA_LOGGED_OUT_STATUS, paired: false, expect: "teardown_session", why: "401 pre-auth = teardown" },

  // Transient pre-auth close (network drop, restart, timeout) → KEEP pairing
  // + DB session so a non-destructive renewal resumes without re-linking.
  { code: 403, paired: false, expect: "keep", why: "transient pre-auth close must keep the session" },
  { code: 408, paired: false, expect: "keep", why: "connection lost pre-auth = keep" },
  { code: 428, paired: false, expect: "keep", why: "connection replaced pre-auth = keep" },
  { code: 515, paired: false, expect: "keep", why: "pre-auth server close = keep" },
  { code: undefined, paired: false, expect: "keep", why: "unknown pre-auth close = keep" },
];

for (const c of pairingCases) {
  test(`decidePairingClose(${c.code}, paired=${c.paired}) → ${c.expect} (${c.why})`, () => {
    assert.equal(decidePairingClose(c.code, c.paired), c.expect);
  });
}

// ── decidePairingRenewal: the countdown-zero / manual-refresh decision ──────
// Core invariant: renewal NEVER tears down a session. A live socket (or a
// verified/paired session) keeps the current QR; only a dead pre-auth socket is
// rebuilt — and even then the DB session + pairing state survive.
const renewalCases: Array<{ hasPairing: boolean; isQr: boolean; paired: boolean; connected: boolean; alive: boolean; expect: PairingRenewalAction; why: string }> = [
  { hasPairing: false, isQr: false, paired: false, connected: false, alive: false, expect: "start_fresh", why: "no pairing = fresh link" },
  { hasPairing: true, isQr: false, paired: false, connected: false, alive: true, expect: "start_fresh", why: "non-QR method = fresh" },
  { hasPairing: true, isQr: true, paired: true, connected: false, alive: true, expect: "keep_current", why: "phone authorized mid-flight — never touch" },
  { hasPairing: true, isQr: true, paired: false, connected: true, alive: true, expect: "keep_current", why: "already verified — nothing to renew" },
  { hasPairing: true, isQr: true, paired: false, connected: false, alive: true, expect: "keep_current", why: "live socket re-emits its own QRs" },
  { hasPairing: true, isQr: true, paired: false, connected: false, alive: false, expect: "rebuild_socket", why: "dead pre-auth socket — rebuild only, session survives" },
];

for (const c of renewalCases) {
  test(`decidePairingRenewal(has=${c.hasPairing}, qr=${c.isQr}, paired=${c.paired}, connected=${c.connected}, alive=${c.alive}) → ${c.expect} (${c.why})`, () => {
    assert.equal(
      decidePairingRenewal(c.hasPairing, c.isQr, c.paired, c.connected, c.alive),
      c.expect,
    );
  });
}