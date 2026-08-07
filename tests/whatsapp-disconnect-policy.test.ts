import { test } from "node:test";
import assert from "node:assert/strict";
import {
  decideWaCloseAction,
  WA_LOGGED_OUT_STATUS,
  type WaCloseAction,
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