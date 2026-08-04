# Syncra — Auth Architecture Security Posture Report

**Scope:** `/cso --scope auth` — daily gate (8/10 confidence). Pre-implementation review of `PLANS/auth-mvp-engineering-plan.md` against the actual codebase.
**Targets reviewed:** `app/actions.ts`, `app/api/callback/route.ts`, `app/api/refresh/route.ts`, `proxy.ts`, `lib/auth-guard.ts`, `lib/insforge.ts`, `components/auth-provider.tsx`, `lib/db.ts`, `lib/repositories/users-repository.ts`, `migrations/20260709023825_create-users-table.sql`, `next.config.ts` (CSP), `scripts/check-items.mjs`, `.gitignore`, `@insforge/sdk` v1.4.3 dist, git history.
**Result: NOT READY. 1 critical, 2 high, 5 medium findings.** Fix before implementation.

---

## CRITICAL

### C1. Live InsForge admin API key committed to git
`scripts/check-items.mjs:5` hardcodes `apiKey: "ik_7d1b58067449560d15c4c04e74deab23"` — and `git log -S` confirms it entered history in commit `c49c5ae`. The key **matches the active `INSFORGE_API_KEY` in `.env.local`**.

The admin key (via `createAdminClient`) **bypasses RLS entirely** and has full CRUD over every table (users, briefings, integrations, AI agents). Anyone who has ever had repo access — or finds it via a public fork, a leaked `.git` bundle, or history mining — can read every user's email/name and every workspace's data. Also in `.insforge/project.json` (gitignored, so lower risk, but same value).

Remediation (pre-implementation, non-negotiable):
1. **Rotate the key** on the InsForge project now — the committed one is burned.
2. Remove it from `scripts/check-items.mjs`; read from env like everything else.
3. Purge from history: `git filter-repo` + force-push, or at minimum `git rm` + history rewrite if repo is private/small. Treat as fully compromised regardless — rotation is the actual fix.
4. Confirm `scripts/check-items.mjs` isn't referenced by CI or deploy scripts (it runs admin queries — if wired into a build step, it's also a deployment footgun).

---

## HIGH

### H1. Duplicate-account / account-confusion on email link
`syncUserToDatabase` (`app/actions.ts:33-58`) merges by `auth_user_id` first, then falls back to `findByEmail` → `updateByEmail`, which **overwrites `auth_user_id` with the new identity**. InsForge treats email+password and Google as *separate auth identities*. A user who signs up with email+password, then signs in with Google on the same email, gets a second `auth_user_id`; the DB row silently re-links to the Google identity, orphaning the password identity's session and hijacking the DB row.

Not in the plan. The plan says "reuse as-is" — this path is unsafe as-is.

Remediation: decide a canonical identity policy before implementation:
- Link identities (same email ⇒ same DB row, and bind Google OAuth to the existing auth identity) — requires InsForge-side account linking; verify SDK support.
- OR reject one: if a user exists by email with a different provider, refuse sign-up (return "account exists, sign in") instead of re-writing `auth_user_id`.
- Minimum safe version: `updateByEmail` must NOT change `auth_user_id` when a row already exists. Add a uniqueness invariant check.

### H2. `users` table is publicly readable (RLS bypass)
`migrations/20260709023825_create-users-table.sql:16` sets `SELECT USING (true)` on `users`. Any anon client with the public anon key can dump every user's email, full_name, avatar. The plan's fix (self-row policy) is correct — but it must land as a **pre-deploy migration**, not Phase 2. The app reads via admin client so nothing in-app breaks, but the exposed surface is live today.

---

## MEDIUM

### M1. Access token cookie is NOT httpOnly + localStorage session mirror
Confirmed in SDK source: `accessTokenCookieOptions()` sets `httpOnly: false` (access token readable by JS), `httpOnly: true` only for the refresh token. Combined with `components/auth-provider.tsx` mirroring the full user object to `localStorage["syncra-user-session"]`, **any XSS yields a live access token and profile**. This is the SDK's default design (refresh-token-in-httpOnly is the real gate), so it's acceptable *if* two things hold:
- The access token stays short-lived (verify InsForge access-token TTL; if it's hours, demand `refreshLeewaySeconds` + aggressive refresh).
- XSS surface is minimized. **`next.config.ts` CSP is `script-src 'self' 'unsafe-eval' 'unsafe-inline'` — both unsafe flags.** That negates most XSS defenses. Tighten CSP (drop `unsafe-inline`/`unsafe-eval` where the app allows) and/or move the session cache to sessionStorage. Not blocking auth launch, but the combination is the single likeliest real-world breach vector.

### M2. No origin/referer validation on the token refresh path
`refreshAuth()` (SDK) POSTs the refresh token to the InsForge backend with no Origin/Referer check, and `createRefreshAuthRouter` / `updateSession` add none. Mitigated today only by `sameSite: "lax"` (blocks cross-site POST). This holds **only if** the app never downgrades the cookie to `sameSite: none`, never serves over plain HTTP, and never embeds a form-driven cross-origin POST that can carry the cookie. Verify InsForge's backend enforces an allowed-origins list for `/api/auth/refresh`; if it's open, the refresh cookie is one `SameSite=none` misconfig away from being a CSRF login vector. Document the assumption; add Origin validation in `app/api/refresh/route.ts` if the SDK doesn't.

### M3. E2E auth bypass is reachable in any non-prod deploy
`getCurrentUserAction` (`app/actions.ts:156-185`) short-circuits auth when a JWT with `email: testuser@example.com` is present, gated only on `NODE_ENV !== "production"`. Any staging/preview/preprod instance (Vercel preview, local tunnel, CI artifact) running with `NODE_ENV=development` accepts a hand-crafted `insforge_access_token` with that claim and grants full app access. Gate on a stricter signal (e.g. `E2E_AUTH_BYPASS=true` env explicitly set), not on NODE_ENV.

### M4. OAuth callback lacks state binding beyond PKCE
`app/api/callback/route.ts` trusts the PKCE verifier cookie (`insforge_code_verifier`) as the only binding. PKCE does prevent verifier-less login CSRF, but there is no check that the exchanged user's email matches any session, and errors round-trip through URL query params (`/sign-in?error=...`), which leaks error detail to logs/history. Acceptable for MVP; harden later with an explicit `state` param if the SDK exposes it, and never place PII in error query strings.

### M5. Proxy matcher references a nonexistent route + gitignore hides an auth route dir
`proxy.ts:19` matches `/app/:path*`, but no `/app` route exists (only `/dashboard`). Harmless dead config, but signals the matcher should be an explicit allowlist (`/dashboard/:path*` only). Separately, `.gitignore:68` ignores `/app/api/auth/` — a whole route namespace is silently excluded from version control. If a future auth route is placed there it will never be committed or deployed, and the inconsistency between "gitignored `/app/api/auth/`" and "live rewrite `/api/auth/callback → /api/callback`" invites confusion. Remove the ignore rule.

---

## REVIEWED & CONFIRMED ADEQUATE (for MVP)

- **Session cookie flags** (refresh): httpOnly=true, SameSite=Lax, Secure in prod, Path=/ — SDK defaults are correct.
- **Sign-out**: `signOutAction` clears both cookies (maxAge -1) server-side; `clearSession()` also clears localStorage. No stale-token reuse after signout (refresh token still valid server-side until expiry — rotation on logout isn't enforced; accept for MVP, note for later).
- **User enumeration on sign-in**: generic "Invalid login credentials" — good. **On sign-up** the InsForge backend may still leak "already registered" — verify the SDK surfaces a generic error; if not, map it in the sign-up page.
- **CSRF on server actions**: Next.js Server Actions have built-in Origin/SameSite enforcement — signUp/signIn/signOut actions are protected by the framework.
- **PKCE OAuth flow**: code verifier stored httpOnly + short TTL (10 min), deleted after exchange — solid.
- **Trust boundaries**: admin client (`INSFORGE_API_KEY`) only in server contexts (`lib/db.ts`), never in `lib/insforge.ts` (browser uses anon key). Correct split. *Except* C1 leaking the admin key.
- **Password handling**: delegated to InsForge backend (not in app code); client enforces length 8 + number + special on sign-up. Adequate; server-side policy is the real gate.
- **Route protection in the plan** (`updateSession` in proxy.ts): correct approach. Note it requires passing both `requestCookies` and `responseCookies` (the SDK's `updateSession` reads request and writes to both) — the plan must call this out explicitly or the refresh writes will be lost.
- **Session fixation**: each `signInWithPassword`/`exchangeOAuthCode` issues fresh tokens; no pre-auth session ID to fixate. Not a concern.

---

## Plan Amendments Required (before implementation)

1. **Add a Phase 0 hardening task: rotate the admin API key** (C1) — blocks everything else.
2. **Change `syncUserToDatabase` merge semantics** (H1): never overwrite an existing row's `auth_user_id`; define the email-link policy explicitly. Do NOT ship the plan's "reuse as-is."
3. **Move the `users` RLS fix to a pre-deploy migration** (H2), not Phase 2.
4. **Explicitly require `requestCookies` + `responseCookies` in the `updateSession` middleware call** and an allowlist-only matcher (M5).
5. **Gate the E2E bypass on an explicit env flag, not NODE_ENV** (M3).
6. **Remove `/app/api/auth/` from .gitignore** (M5).
7. **Note the access-token cookie / CSP / localStorage tradeoff in Risks** (M1) and schedule a CSP tightening pass post-MVP.

## Ship-readiness: BLOCKED
C1 alone blocks ship (burned admin key = full data compromise). H1 is a user-facing correctness+security bug in the exact code the plan marks "reuse." Everything else is fixable in the implementation pass.

**STATUS: DONE_WITH_CONCERNS. REASON: 3 must-fix findings (C1, H1, H2) precede any implementation. ATTEMPTED: full auth-surface review against plan + SDK source + git history. RECOMMENDATION: rotate key, patch merge semantics + RLS migration order, then proceed with the plan.**
