# Syncra — Auth MVP Engineering Plan

**Role:** Principal Staff Engineer — analysis and plan only, no implementation.
**Stack:** Next.js 16.2.10 (App Router), React 19, `@insforge/sdk` ^1.4.3 (BaaS: auth + Postgres/PostgREST + storage), Tailwind 4.
**Branch:** `main`
**Auth MVP scope:** Email+Password + Google OAuth. No email verification, no OTP, no password reset, no MFA.

---

## 1. Current Architecture Analysis

InsForge is the auth provider. All credentials/session state lives in httpOnly cookies named `insforge_access_token` and `insforge_refresh_token`; the app never touches tokens in JS memory.

### Client session flow
- `lib/insforge.ts` creates a `createBrowserClient({ baseUrl, anonKey, refreshUrl: "/api/refresh" })` singleton.
- `app/api/refresh/route.ts` is `createRefreshAuthRouter()` — the SDK's httpOnly-refresh-cookie endpoint.
- `components/auth-provider.tsx` (`AuthProvider`, dashboard-only, mounted in `app/dashboard/layout.tsx`) runs `refreshSession()` on mount: server action `getCurrentUserAction()` → on definitive 401/403/AUTH_SESSION_MISSING it clears localStorage and hard-redirects to `/sign-in`.
- It also keeps two localStorage caches (`syncra-user-session`, `syncra-db-user-session`) mirroring auth + DB user, re-syncing DB row at most once per 60s.

### Server session flow
- `app/actions.ts` ("use server") wraps `@insforge/sdk/ssr`:
  - `signInAction` → `auth.signInWithPassword`
  - `signUpAction` → `auth.signUp`
  - `signInWithGoogleAction` → `auth.signInWithOAuth("google", { skipBrowserRedirect: true })`, stores `codeVerifier` in httpOnly cookie `insforge_code_verifier`, returns OAuth URL.
  - `getCurrentUserAction` → `client.auth.getCurrentUser()` (has an E2E test mock bypass gated on `NODE_ENV !== "production"`).
  - `syncUserToDatabase` → `UsersRepository` upsert/merge into `public.users`, retried 3x.
  - `verifyEmailAction` / `resendVerificationEmailAction` exist but are **out of MVP** (see §12).
- `app/api/callback/route.ts` (rewritten to `/api/auth/callback` in `next.config.ts`) handles Google OAuth: exchanges `insforge_code` + cookie verifier via `auth.exchangeOAuthCode`, calls `syncUserToDatabase`, deletes verifier cookie, redirects to `/dashboard`.
- `lib/auth-guard.ts`: `getAuthenticatedUser()` (server-side `getCurrentUser`), `requireOwnership(userId)` resolves auth id → DB `users.id` via `UsersRepository.findByAuthId` for ownership checks.

### Route protection
- `proxy.ts` is the Next 16 middleware (Next 16 renamed `middleware.ts` → `proxy.ts`). `matcher: ["/dashboard/:path*", "/app/:path*"]`. It only checks for the **presence** of `insforge_access_token`; no validation, no refresh, no redirect-to-`redirect` preservation beyond appending `?redirect=`.

### DB
- `migrations/20260709023825_create-users-table.sql` defines `public.users` (`id uuid PK, auth_user_id uuid UNIQUE, email, full_name, avatar_url, auth_provider, email_verified, last_login_at, created_at, updated_at`) + RLS with **`SELECT USING (true)`** public-read policy. App reads/writes via admin client (RLS-bypassing).

### Known gaps (before this plan)
1. `proxy.ts` does not validate/refresh tokens — an expired cookie passes the middleware and bounces on the client, and `/app/*` + `/dashboard/*` API access isn't truly guarded.
2. Public-read RLS on `users` exposes every user's email/name to any anon client.
3. `/reset-password` link in sign-in 404s (no page/actions).
4. Sign-up page still branches on `requireEmailVerification` + OTP flow, which MVP removes from the active path.

---

## 2. Auth Architecture Review

**Verdict: sound foundation, thin seams.** The cookie-based InsForge session, server-action auth mutations, and client `AuthProvider` reconciliation are the correct BaaS pattern. No rewrite needed.

What holds up well:
- All auth mutations run server-side through `createAuthActions({ cookies })` — tokens never exposed to client JS.
- OAuth PKCE handled by SDK; verifier in httpOnly cookie.
- `syncUserToDatabase` is idempotent (find → update/upsert by `auth_user_id` / email) and retried — survives transient RLS/admin failures.
- `requireOwnership` correctly bridges auth id → DB id.

Structural weaknesses to fix in this plan:
- **Middleware trusts cookie existence, not validity.** This is the single biggest auth gap: the gate is cosmetic. `updateSession()` from `@insforge/sdk/ssr/middleware` refreshes + sets fresh cookies + clears on failure — the intended tool.
- **Guard is duplicated in two places** (`proxy.ts` cookie check + `AuthProvider` server verification). After middleware hardening they agree: middleware is the coarse gate, AuthProvider is the authoritative client-state source. Keep the redundancy but align semantics.
- **`users` RLS read policy is public.** Acceptable only if you treat `users` as a fully public directory — not the case here (private workspace product). Fix in migration.

---

## 3. Existing Components (reuse as-is)

| Component | File | Role |
|---|---|---|
| Server auth actions | `app/actions.ts` | signIn, signUp, signInWithGoogle, getCurrentUser, syncUserToDatabase |
| Browser client | `lib/insforge.ts` | client SDK singleton |
| Refresh route | `app/api/refresh/route.ts` | SDK refresh router |
| OAuth callback | `app/api/callback/route.ts` | PKCE exchange → sync → `/dashboard` |
| Auth guard helpers | `lib/auth-guard.ts` | `getAuthenticatedUser`, `requireOwnership` |
| Client session provider | `components/auth-provider.tsx` | `useAuth()`, refreshSession, localStorage cache, 60s DB re-sync |
| User repo | `lib/repositories/users-repository.ts` | findByAuthId/findByEmail/create/update/upsert |
| Admin DB client | `lib/db.ts` | `createAdminDb()` |
| Sign-in page | `app/sign-in/page.tsx` | credentials + Google, error/verification handling |
| Sign-up page | `app/sign-up/page.tsx` | name/email/password + Google, success → `/dashboard` |
| Proxy (middleware) | `proxy.ts` | route gate — **modify** (§6) |

Nothing here needs rewriting for the MVP; `proxy.ts` is the only functional change.

---

## 4. Missing Components

1. **Real middleware guard** — `updateSession()`-based validation/refresh in `proxy.ts` (§8).
2. **Verification of InsForge email-verification setting** — confirm the project has email verification **OFF** so `signUp()` returns a live session directly (§12).
3. **RLS fix migration** for `users` (self-row read, §7).
4. **Removal of dead `/reset-password` link** (§6).
5. **Sign-up page cleanup** — drop the OTP/`requireEmailVerification` branch from the active flow (keep file for future, §6).

**Deliberately NOT built (out of MVP):** email verification page flow (exists, dormant), password reset (remove link), MFA, refresh-token rotation on the client, multi-tenant RBAC, workspace membership.

---

## 5. Files To Create

1. `migrations/20260804XXXXXX_restrict-users-rls.sql` — replace public-read RLS on `users` with self-row policy (content in §7).

That's the only new file. Everything else is modify-in-place.

---

## 6. Files To Modify

1. **`proxy.ts`** — use `updateSession()` from `@insforge/sdk/ssr/middleware`:
   - `updateSession({ request, baseUrl, anonKey, responseCookies })` returns `{ accessToken, refreshToken, error }`.
   - No/expired refresh → `clearAuthCookies(responseCookies)` + redirect `/sign-in?redirect=<pathname>`.
   - Success → keep `NextResponse.next()`, `responseCookies` writes fresh cookies.
   - Keep matcher `["/dashboard/:path*", "/app/:path*"]`.
   - Edge-runtime safe: reads cookies from `request`, writes via `NextResponse` `cookies`.
2. **`app/sign-in/page.tsx`** — remove the dead `Forgot?` link (l.233-238); keep the rest.
3. **`app/sign-up/page.tsx`** — simplify the submit success path: drop `requireEmailVerification`/OTP branching; on `data.user` store `syncra-user-session` and redirect `/dashboard`. Keep Google button.
4. **`app/actions.ts`** — no functional change. Optionally add a `refreshSessionAction` that shells out to `updateSession` server-side if middleware can't reach edge (not required — middleware path is primary). **Keep `verifyEmailAction`/`resendVerificationEmailAction`/`syncUserToDatabase` as-is** (dormant + used by callback/provider).
5. **`.env.local`** — no new vars needed; reuse `NEXT_PUBLIC_INSFORGE_BASE_URL` / `NEXT_PUBLIC_INSFORGE_ANON_KEY` / `INSFORGE_API_KEY`. Confirm present.

---

## 7. Database Impact

**No schema change.** One policy migration.

```sql
-- migrations/20260804XXXXXX_restrict-users-rls.sql
DROP POLICY IF EXISTS "Allow public read access to users table" ON users;

CREATE POLICY "Users can read their own profile" ON users
  FOR SELECT USING (auth.uid() = auth_user_id);

-- INSERT/UPDATE self policies already exist and stay unchanged.
```

Notes:
- App reads via admin client (bypasses RLS), so nothing in-app breaks.
- Anon/external PostgREST clients now can only read their own row.
- **Ordering:** this migration is independent; apply with other migrations. Run `insforge` CLI migration apply per `insforge-cli` skill. Do not pair with the middleware change in the same deploy if you want a clean rollback story (it's a one-way policy change, reversible by re-adding the public policy).

---

## 8. Middleware Impact

**Before:** `proxy.ts` = cookie-presence check only. Expired token passes; `/dashboard` renders then client redirects back; `/app/*` is unguarded at the edge.

**After:** `proxy.ts` becomes a real gate:

```
Request /dashboard/* or /app/*
  └─ updateSession({ request, baseUrl, anonKey, responseCookies })
       ├─ success → fresh cookies written, NextResponse.next()
       ├─ refresh failed (expired/invalid refresh token)
       │    └─ clearAuthCookies() + redirect /sign-in?redirect=<path>
       └─ no token at all
            └─ redirect /sign-in?redirect=<path>
```

Concrete effects:
- **One less round-trip** for expired sessions (no bounce to dashboard → provider → sign-in).
- **`/app/*` API surface** now guarded at the edge instead of being wide open.
- **Redirect preservation** (`?redirect=` already wired) lets `/sign-in` bounce users back to their original page after login.

Migration concerns:
- `updateSession()` makes an outbound HTTP call to InsForge per matching request. Cache-ability: Next 16 caches `proxy` only if it exports `proxy` and no dynamic calls — adding network I/O disables edge caching for these routes. For a dashboard app this is acceptable (per-request auth is the norm). **Watch cold-start latency on first navigation.**
- **Do NOT call `updateSession` on the OAuth callback path** (`/api/auth/callback`) — the verifier/code exchange owns that flow; keep it out of the matcher (it is already: matcher only covers `/dashboard` + `/app`).

---

## 9. Session Flow

### Sign-up (Email+Password) — new user
```
sign-up page → signUpAction({ email, password, name })
  └─ auth.signUp() with email verification OFF
       └─ returns { user, accessToken } → InsForge sets httpOnly cookies via cookie store
  └─ client stores syncra-user-session, redirects /dashboard
/dashboard → AuthProvider.refreshSession() → getCurrentUserAction() (validates)
  └─ syncUserToDatabase(auth_user_id, email, name, providers[0]) → users row (upsert/merge)
  └─ dbUser cached to syncra-db-user-session; dashboard renders
```

### Sign-in — existing user
```
sign-in page → signInAction(email, password)
  └─ auth.signInWithPassword() → sets cookies → client stores user → /dashboard
  └─ provider re-validates + re-syncs last_login_at (60s throttle)
```

### Expired session (any page)
```
middleware updateSession() → refresh fails → clearAuthCookies → /sign-in?redirect=<path>
  (fallback: provider getCurrentUserAction 401 → localStorage clear → /sign-in)
```

**Key invariant:** httpOnly cookies are the source of truth; localStorage is a mirror for render speed only.

---

## 10. Google OAuth Flow

```
sign-in/sign-up page → signInWithGoogleAction(redirectUrl = origin + "/api/auth/callback")
  └─ auth.signInWithOAuth("google", { skipBrowserRedirect: true })
       └─ data.url + data.codeVerifier
  └─ server stores codeVerifier in httpOnly cookie insforge_code_verifier (10 min, httpOnly, lax, secure in prod)
  └─ client window.location = data.url → Google consent
Google → redirect to /api/auth/callback?insforge_code=...
  └─ (rewrite from /api/auth/callback in next.config.ts)
  └─ reads code + verifier cookie → auth.exchangeOAuthCode(code, verifier)
       ├─ errorParam/missing code → /sign-in?error=...
  └─ syncUserToDatabase({ auth_user_id, email, name from profile, providers=["google"], email_verified })
  └─ delete insforge_code_verifier cookie → redirect /dashboard
```

**Handled already, no changes:** PKCE, verifier lifecycle, callback rewrite, DB sync, error redirects. Verify `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` are configured on the InsForge project (not the app; app only needs anon key) and that the callback URL `https://<host>/api/auth/callback` is allow-listed in Google + InsForge.

---

## 11. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| InsForge project has email verification still ON | `signUp()` returns no session; new users can't get past sign-up | **Verify first** (dependency §12). If ON, keep current OTP branch until flipped off. |
| Middleware `updateSession()` adds latency to first dashboard nav | Slower perceived load | Monitor; acceptable for authed app. Cache `/dashboard` static shell, keep auth call per-request. |
| Middleware + provider double-verify | Duplicate HTTP call per nav | By design (coarse edge gate + authoritative client check). Cheap; do not remove provider check — it protects RSC/data fetches that bypass middleware. |
| RLS migration is one-way-ish | If app later needs public user directory, re-add policy | Reversible by migration; low risk. |
| Dead OTP code remains in `app/actions.ts` / sign-up page paths | Confusion later | Add `// OTP flow disabled in MVP` comments; revisit in post-MVP auth ticket. |
| E2E mock bypass in `getCurrentUserAction` (dev-only) shipped to prod surface | Unauthorized user creation in dev | Already gated `NODE_ENV !== "production"`; keep gated, never remove. |
| Callback URL not allow-listed in Google/InsForge | Google OAuth fails in prod | Pre-deploy checklist item (§12). |

---

## 12. Dependencies

1. **InsForge project email-verification setting must be OFF** — verify via `insforge` CLI (settings/config) before sign-up rework. **Blocks the sign-up simplification.**
2. **Google OAuth configured on the InsForge project** — `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` live in `.env.local` but must be set on the InsForge dashboard too; callback URL `/api/auth/callback` allow-listed.
3. `@insforge/sdk` ^1.4.3 already provides `updateSession` (via `@insforge/sdk/ssr/middleware`) — no new dependency.
4. Env vars already present: `NEXT_PUBLIC_INSFORGE_BASE_URL`, `NEXT_PUBLIC_INSFORGE_ANON_KEY`, `INSFORGE_API_KEY`.

---

## 13. Recommended Development Order

**Phase 0 — Preflight (5 min):** confirm email-verification OFF + Google OAuth config on InsForge project. If email verification is ON, stop and flip it.

**Phase 1 — Edge gate (independent, low risk):**
1. Rework `proxy.ts` to `updateSession()` + `clearAuthCookies` on failure.
2. Test: expired cookie → redirect `/sign-in`; valid cookie → pass; fresh login → `/dashboard`.

**Phase 2 — DB hardening (independent):**
3. Add `migrations/20260804XXXXXX_restrict-users-rls.sql`; apply via `insforge` CLI.
4. Verify anon read of another user's row is denied.

**Phase 3 — UI cleanup (dependent on Phase 0):**
5. Remove `Forgot?` link from sign-in.
6. Simplify sign-up success path (drop OTP branch) once verification OFF is confirmed.
7. Add `// OTP flow disabled in MVP` comments on dormant verification actions.

**Phase 4 — Verify:**
8. `npx tsc --noEmit` clean.
9. Manual: sign-up (email+password) → auto-session → dashboard; sign-in; Google OAuth round-trip; expired-session redirect.
10. `npm run build` clean (remember: `rm -rf .next` if stale build artifacts reference deleted routes).

**Out of scope, capture as follow-up:** password reset flow, email verification UX, refresh-token rotation observability, workspace/RBAC.
