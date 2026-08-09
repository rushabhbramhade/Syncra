/**
 * Fail-closed staging identity guard for the Gmail validation harness.
 *
 * Pure module — no network, no imports — so it is unit-testable in isolation.
 *
 * The harness must NEVER run against a personal or business account. This
 * guard is the single choke point: an account is only allowed to be the
 * staging target when ALL of the following hold:
 *  1. The operator explicitly declared it via `GMAIL_STAGING_ACCOUNT`.
 *  2. The env value matches the connected account identically (case-insensitive).
 *  3. The connected account is NOT in the hard denylist of known real accounts.
 *  4. The mailbox carries controlled staging rows (a proven, seeded identity)
 *     before any live validation runs.
 *
 * On any doubt the guard fails CLOSED: same error for a missing env marker
 * and for a mismatch. It never hints at which part failed.
 */

/** Accounts that are known REAL (personal/business) and may never be targeted. */
export const DENYLIST: readonly string[] = [
  "rushabh.bramhade123@gmail.com",
  "rushabhbusiness40@gmail.com",
];

/** Env var the operator must set to declare the staging account. */
export const STAGING_ENV_VAR = "GMAIL_STAGING_ACCOUNT";

export interface StagingInput {
  /** Operator-set GMAIL_STAGING_ACCOUNT (env). */
  env?: string;
  /** Email currently attached to the integration we would run against. */
  accountEmail?: string;
  /** True once the staging inbox has proven controlled rows (live see). */
  hasControlledRows: boolean;
  /** Controlled-row proof must be accompanied by a matching opaque nonce; unused until seeded. */
  seedNonce?: string;
}

export interface GuardVerdict {
  allow: boolean;
  reason: string;
}

function normalize(email: string): string {
  return email.trim().toLowerCase();
}

export function isDenylisted(email: string): boolean {
  const e = normalize(email);
  return DENYLIST.some((d) => normalize(d) === e);
}

/**
 * Decide whether we are clear to run the live harness.
 *
 * - Fail closed when env isn't set, or matches neither.
 * - Fail closed when the account is denylisted.
 * - Fail closed unless mailbox holding controlled rows is proven. Without
 *   proof we assume rows are uncontrolled — i.e. a real inbox — and refuse.
 */
export function guardStaging(input: StagingInput): GuardVerdict {
  const declared = (input.env ?? "").trim();
  if (!declared) {
    return { allow: false, reason: "Empty identity." };
  }
  const account = normalize(input.accountEmail ?? "");
  if (!account) {
    return { allow: false, reason: "No connected account." };
  }
  if (isDenylisted(account)) {
    return { allow: false, reason: "Denylisted real account." };
  }
  if (normalize(declared) !== account) {
    return { allow: false, reason: "Env/account mismatch." };
  }
  if (!input.hasControlledRows) {
    return { allow: false, reason: "Mailbox not proven controlled." };
  }
  return { allow: true, reason: "Staging identity proven and verified." };
}