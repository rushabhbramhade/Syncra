# Forgot Password Redesign — Engineering Review

Branch: `release/launch-ready`
Reviewer: plan-eng-review
Date: 2026-08-04

---

## 1. Current Flow Analysis

Two responsibilities are fused into one client page `app/reset-password/page.tsx`:

**Mode A (no `?token`)** — email form → `sendResetPasswordEmailAction(email, redirectTo)` where `redirectTo = ${origin}/reset-password` → InsForge `POST /api/auth/email/send-reset-password` → inline success/error banner.

**Mode B (`?token` present)** — new password + confirm form → `resetPasswordAction(newPassword, otp)` where `otp = token` → InsForge `POST /api/auth/email/reset-password` → success → `router.push("/sign-in")` after 1.5s.

### InsForge SDK facts (verified in `node_modules/@insforge/sdk`)

- **Link flow**: email link redirects to `redirectTo` with `token`, `insforge_status`, `insforge_type` query params appended by the backend.
- **`exchangeResetPasswordToken({email, code})`** exists but is **code-flow only** (two-step OTP flow). Not usable for link tokens. There is **no pre-validation endpoint for link tokens** — a token can only be validated by attempting the reset.
- **`resetPassword({newPassword, otp})` returns only `{message}`** — no access/refresh tokens. InsForge does **not** create a session after password reset. Redirect-to-sign-in is the correct behavior; do not auto-login.
- Error codes surfaced by InsForge: `AUTH_TOKEN_EXPIRED`, `AUTH_INVALID_EMAIL`, `AUTH_INVALID_CREDENTIALS`, `AUTH_WEAK_PASSWORD`, `AUTH_USER_NOT_FOUND`, `RATE_LIMITED`/`TOO_MANY_REQUESTS`.
- `sendResetPasswordEmail` returns the raw endpoint response; the current page tests `data?.success` which is **not a documented field** — the new flow must not depend on it.

### Current validation (all inline, no shared module)

| Page | `validateEmail` | `validatePassword` |
|---|---|---|
| `app/reset-password/page.tsx` | regex | 8+ chars only |
| `app/sign-up/page.tsx` | regex | 8+, number, special |
| `app/sign-in/page.tsx` | regex | (sign-in only checks non-empty) |

Three copies of the email regex, two divergent password policies.

## 2. Problems in Current Architecture

1. **Dual-purpose page.** One URL serves two unrelated journeys (request vs. reset). Hard to maintain, test, and extend. `hasToken` branching doubles the component surface.
2. **Enumeration leak.** `reset-password/page.tsx:68` renders InsForge's raw `error.message` to the client. For an unknown email, InsForge may return `AUTH_USER_NOT_FOUND`, revealing whether an account exists.
3. **Weaker password policy on reset.** Reset accepts 8+ chars while sign-up requires 8+ number+special. A user can reset to a weaker password than sign-up permits. Policy divergence.
4. **Triplicated validation logic.** Email regex ×3, password ×3. Drift already happened (the divergence above). Sign-up lacks the uppercase rule the brief wants.
5. **`insforge_status`/`insforge_error` trust.** The page trusts query params InsForge appends on redirect. Direct URL paste or a tampered link may not carry them; the error path is unreliable.
6. **`data?.success` check** against an undocumented response field — the "Reset link sent" success branch is unreliable.
7. **No resend, no cooldown, no confirmation screen.** UX ends at an inline banner.
8. **E2E coupling**: `e2e/auth-smoke.spec.ts:34` asserts `/reset-password` renders the email form — breaks on the split.

## 3. Recommended Architecture

Two independent pages, one shared validation module. No changes to `app/actions.ts` — the two server actions already work and are the InsForge boundary; don't touch working logic.

```
/sign-in  --"Forgot?"-->  /forgot-password  --send reset email-->  confirmation screen
                                                                      (resend + cooldown, back to sign-in)
email link (redirectTo=/reset-password) -->  /reset-password?token=...  -->  new password form
                                                                      -->  submit -> /sign-in
```

- **`/forgot-password`** — collect email, client-validate (shared `validateEmail`), call `sendResetPasswordEmailAction`, render confirmation **unconditionally** (D3), log real server errors server-side. Resend with client-side cooldown (60s). Nothing else.
- **`/reset-password`** — token-only. No token → `redirect("/forgot-password")`. Token present → render new password form. Validate on submit (D1): call `resetPasswordAction`; map `AUTH_TOKEN_EXPIRED`/`AUTH_INVALID_CREDENTIALS`/`AUTH_INVALID_EMAIL` → "link expired or invalid" state with link back to `/forgot-password`. No token pre-validation (impossible for link flow). Success → redirect `/sign-in`.
- **Shared validation** — `lib/validation/auth.ts` exporting `validateEmail` and `validatePassword` per D2 policy: 8+, uppercase, lowercase, number, special. Used by sign-up, forgot-password, reset-password. Deletes the three inline copies.

## 4. Files to Create

- `app/forgot-password/page.tsx` — email form + confirmation screen + resend cooldown (client component, `Suspense` not needed — no `useSearchParams`).
- `lib/validation/auth.ts` — shared `validateEmail` + `validatePassword` + `PASSWORD_REQUIREMENTS` checklist data for the strength UI.
- `e2e/forgot-password.spec.ts` — renders email form, client validation blocks empty/bad email, valid email → confirmation screen with resend + back-to-sign-in, resend disabled during cooldown.
- `e2e/reset-password.spec.ts` — no token → redirects to `/forgot-password`; token present → renders new password form; weak password blocked client-side; mismatched confirm blocked.

## 5. Files to Modify

- `app/reset-password/page.tsx` — strip Mode A; token-only; redirect when no token; map InsForge errors to expired/invalid state; use shared validation.
- `app/sign-in/page.tsx` — "Forgot?" link `:245` → `/forgot-password`.
- `app/sign-up/page.tsx` — delete inline `validateEmail`/`validatePassword`; import shared (adds uppercase rule — D2 confirmed).
- `e2e/auth-smoke.spec.ts:34` — replace "reset-password page renders email form" with a forgot-password redirect assertion, or move the email-form assertion to the new spec.
- `lib/whatsapp/...` — not touched. Out of scope.

## 6. Security Impact

| Control | Decision | Rationale |
|---|---|---|
| Token handling | Unchanged — pass `?token` straight to `resetPassword` | InsForge verifies expiry + single-use server-side. No client parsing. |
| Replay attacks | Unchanged | Token consumed by InsForge on successful reset. One-time by design. |
| Enumeration | **Fixed** — always show confirmation (D3) | Raw `error.message` no longer reaches the client. Server errors → `console.error` only. |
| Rate limiting | Unchanged server-side (InsForge `RATE_LIMITED`), add client resend cooldown | Cooldown is UX, not a security control. Never invent server rate limits. |
| Password policy | **Strengthened + unified** (D2) | One shared schema (8+, upper, lower, number, special) across sign-up and reset. |
| Session after reset | Redirect to `/sign-in` | InsForge returns no session from `resetPassword` — verified in response schema. No auto-login. |
| Query-param trust | **Removed** | Page no longer depends on `insforge_status`/`insforge_error` for the invalid/expired state; submit errors drive it. |

No security weakening anywhere.

## 7. UX Improvements

Scoped to what moves the needle (skip the full wishlist):

1. **Confirmation screen** — post-submit swap to a "Check your inbox" state (icon, email shown, "didn't get it?" resend, back to sign-in). Replaces the inline banner.
2. **Resend cooldown** — 60s client timer, button shows countdown, disabled meanwhile. SessionStorage-backed so a refresh doesn't reset it.
3. **Loading states** — button spinner + disabled inputs during submit (already partial; keep).
4. **Password visibility toggle** — already on reset (lines 166-173); carry to forgot-password and keep on reset.
5. **Password strength indicator** — checklist of the 4 shared requirements (uppercase, lowercase, number, special, 8+). Renders live from `PASSWORD_REQUIREMENTS`; drives the same data the validator uses — no second source of truth.
6. **Error states** — expired/invalid link → dedicated state (icon + "link expired" + request-new-link button → `/forgot-password`), not a red banner.
7. **Accessibility** — labels already present; add `aria-live` on error/success regions, `autoComplete` attributes (`email`, `new-password`), keep the existing `aria-label` on the eye toggle.
8. **Mobile** — existing `min-h-screen flex items-center` pattern already safe; keep card `max-w-md`.

Password strength meter as a visual bar — skip (marginal value; checklist is more honest).

## 8. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| `redirectTo` allowlist rejects new flow | Low | Reset email link 404s | Keep `redirectTo=/reset-password` (already allowlisted & working). Verify after deploy. |
| Uppercase rule blocks a legit sign-up mid-flow | Low | Friction | Client + InsForge `AUTH_WEAK_PASSWORD` both gate; message is explicit. No login impact. |
| E2E regression on auth-smoke | Certain if not updated | CI red | Update spec in same change (item 5). |
| `data?.success` unknown-field reliance disappears | n/a | n/a | New flow checks `error == null`, not the undocumented field. |
| Resend cooldown is client-only | Low | Spam-ish resends | Acceptable — InsForge rate-limits server-side. |
| `/reset-password` without token is a dead 404-ish route | Low | Confusion | Redirect to `/forgot-password`. |

## 9. Implementation Order

Per the phase gate in the brief — stop after each phase, no code until approved.

- **Phase 1** — Create `lib/validation/auth.ts` (shared email + password per D2) and `app/forgot-password/page.tsx` (form → confirmation + resend cooldown per D3). Wire `/sign-in` "Forgot?" link. Update `e2e/auth-smoke.spec.ts:34`; add `e2e/forgot-password.spec.ts`. → `/review`
- **Phase 2** — Refactor `app/reset-password/page.tsx` to token-only: redirect no-token → `/forgot-password`; validate on submit per D1; map InsForge errors to expired/invalid state; success → `/sign-in`. Add `e2e/reset-password.spec.ts`. → `/review`
- **Phase 3** — Refactor `app/sign-up/page.tsx` to import shared validation (adopts uppercase rule). → `/review`
- **Phase 4** — UX polish pass (confirmation screen final, resend cooldown edge cases, `aria-live`, autocomplete). → `/plan-design-review` → `/review`
- **Phase 5** — Security review. → `/cso` → fix findings → `/review`
- **Phase 6** — End-to-end test: forgot, reset, expired, invalid, weak password, sign-in, Google OAuth, session restore. → `/qa` → `/ship`

## Decisions locked (D1-D3)

- **D1** — Token validation happens on submit. No pre-validation (impossible for link flow).
- **D2** — Shared password policy: 8+, uppercase, lowercase, number, special. Sign-up adopts uppercase.
- **D3** — Enumeration-safe: always show confirmation; real errors to server logs only.

## GSTACK REVIEW REPORT

STATUS: **DONE** — plan reviewed against the actual implementation and the InsForge SDK. Three decisions confirmed by the user. Report written to `PLANS/auth-forgot-password-eng-review.md`.
REASON: Review complete; no blockers.
RECOMMENDATION: Approve Phase 1 (shared validation + `/forgot-password`) to begin implementation.
