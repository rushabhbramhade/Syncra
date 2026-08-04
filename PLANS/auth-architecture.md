# Syncra Authentication Architecture

**Phase 0 deliverable** — documented for the production-readiness effort.
Status: authoritative snapshot of the auth system as implemented on `main` (pre-blocker-fix).

---

## 1. Overview

Syncra authenticates users against **InsForge** (Postgres-based BaaS). Auth is cookie-based; InsForge issues an access token (short-lived JWT) and a refresh token, stored in `insforge_access_token` / `insforge_refresh_token` cookies. The app does not implement its own password storage, JWT signing, or session store — it delegates to the InsForge SDK and wraps it in server actions + middleware.

Three SDK entry points are used:
- `@insforge/sdk/ssr` — `createAuthActions`, `createServerClient`, `createRefreshAuthRouter` (server)
- `@insforge/sdk/ssr/middleware` — `updateSession`, `clearAuthCookies`, `setAuthCookies` (edge middleware)
- `@insforge/sdk/ssr` — `createBrowserClient` (client)

---

## 2. Components

### 2.1 `proxy.ts` — Edge Middleware (Next 16)

Path: `proxy.ts`. Matcher: `["/dashboard/:path*", "/app/:path*"]` (note: `/app/*` does not exist — dead matcher, see §10).

Responsibility: **validate + refresh the session at the edge** for protected routes, and redirect unauthenticated users to `/sign-in?redirect=<pathname>`.

Flow:
1. `NextResponse.next({ request })` → response object.
2. `updateSession({ requestCookies, responseCookies, baseUrl, anonKey })`:
   - Valid non-expiring access token → returns `{ accessToken }` immediately (local JWT exp check, no network).
   - No refresh token + access token present → clears both cookies (request + response).
   - Expired access token → calls `POST {base}/api/auth/refresh?client_type=mobile` with the refresh token; on success `setAuthCookies` (rotation) on both request + response; on failure clears both.
3. `!accessToken` → build `/sign-in?redirect=<pathname>` redirect, forward any cleared-cookie Set-Cookie headers onto the redirect response.
4. Else return `response` (carries refreshed cookies).

Type note: `request.cookies as unknown as CookieStore` — Next 16 `RequestCookies.set/delete` are typed narrower than the SDK's `CookieStore`; runtime-compatible.

### 2.2 `components/auth-provider.tsx` — Client Session Provider

Path: `app/dashboard/layout.tsx` (wraps dashboard subtree) and mounted once per dashboard shell.

State: `user` (InsForge user), `dbUser` (users table row), `isLoading`, `errorMsg`. Persists both to `localStorage` (`syncra-user-session`, `syncra-db-user-session`) as a fast-restore cache.

Lifecycle:
- On mount → `refreshSession()` (guarded by `hasFetched` ref).
- `refreshSession()` calls `getCurrentUserAction()` (server action) with a 5s timeout race.
  - Definitive unauthenticated (401/403/UNAUTHORIZED/AUTH_SESSION_MISSING) → `clearSession()`, `signOutAction()`, hard redirect `/sign-in`.
  - Non-definitive error → clear session, show error, stay.
  - Success → set `user`, persist, then `syncUserToDatabase()` (≤ once per 60s via `lastSyncRef`).
- `clearSession()` removes state + localStorage mirrors.

### 2.3 Server Actions — `app/actions.ts`

All use `AUTH_CONFIG = { baseUrl: NEXT_PUBLIC_INSFORGE_BASE_URL, anonKey: NEXT_PUBLIC_INSFORGE_ANON_KEY, timeout: 10000 }`.

| Action | SDK call | Notes |
|---|---|---|
| `signInAction(email, password)` | `auth.signInWithPassword` | Sets auth cookies via SDK |
| `signUpAction({email,password,name,redirectTo})` | `auth.signUp` | May set `requireEmailVerification` |
| `signOutAction()` | manual cookie clear + `auth.signOut` | Clears both cookies (`maxAge:-1`) |
| `verifyEmailAction(email, otp)` | `auth.verifyEmail` | OTP path |
| `resendVerificationEmailAction(email, redirectTo)` | `client.auth.resendVerificationEmail` | |
| `signInWithGoogleAction(redirectTo)` | `auth.signInWithOAuth("google", {skipBrowserRedirect:true})` | Stores `insforge_code_verifier` cookie (httpOnly, 10 min) |
| `getCurrentUserAction()` | `client.auth.getCurrentUser` | Contains `NODE_ENV !== "production"` test-user bypass (see §10) |
| `syncUserToDatabase(userData)` | admin client + `UsersRepository` | See §2.6 |

### 2.4 Google OAuth

- **Initiation**: `sign-in/page.tsx:135` → `signInWithGoogleAction` → `signInWithOAuth` returns OAuth URL + code verifier (verifier stored httpOnly). Client redirects to Google.
- **Callback**: Google → `/api/auth/callback` → rewritten (`next.config.ts`) → `app/api/callback/route.ts`.
  - Reads `insforge_code` + `insforge_error`, reads `insforge_code_verifier` cookie.
  - `auth.exchangeOAuthCode(code, codeVerifier)`.
  - Success → `syncUserToDatabase(provider="google")` → delete verifier cookie → redirect `/dashboard`.
  - Errors → redirect `/sign-in?error=…`.

### 2.5 Session Management / Refresh

- **Client**: browser client (`lib/insforge.ts`) has `refreshUrl: "/api/refresh"`.
- **Server refresh route**: `app/api/refresh/route.ts` → `createRefreshAuthRouter({ baseUrl, anonKey })` — SDK-managed; validates refresh token from cookies, rotates tokens.
- **Middleware refresh**: `updateSession` performs the same refresh at the edge (see §2.1). Two refresh paths coexist: middleware (page loads) and `/api/refresh` (client SDK calls).

### 2.6 Database Synchronization — `users` table

InsForge auth users are mirrored into the app's `users` table (id, auth_user_id, email, full_name, avatar_url, auth_provider, email_verified, created_at, updated_at, last_login_at, deleted_at).

- **Repository**: `lib/repositories/users-repository.ts` (`UsersRepository`) — `findByAuthId`, `findByEmail`, `create`, `updateByAuthId`, `updateByEmail`, `upsertByAuthId`.
- **Sync logic** (`syncUserToDatabase`, `app/actions.ts:21-69`):
  1. `findByAuthId(auth_user_id)` — exists → update.
  2. Not found → `findByEmail(email)` — exists → `updateByEmail` **overwrites `auth_user_id`** (account-confusion vector, see §10).
  3. Neither → `upsertByAuthId` (onConflict `auth_user_id`).
- **DB access**: `createAdminDb()` (`lib/db.ts`) uses the admin client (`INSFORGE_API_KEY`) — **bypasses RLS**.
- **Authorization helper**: `lib/auth-guard.ts` — `getAuthenticatedUser()` (server client `getCurrentUser`) + `requireOwnership(userId)` (resolves auth id → DB `users.id`, accepts either; used by 16 server-action call sites, 0 API routes).

### 2.7 Repository Layer

Repositories (all admin-client, RLS-bypass):
- `users-repository.ts` — user CRUD (auth sync).
- `integration-scopes-repository.ts`, `whatsapp-sessions-repository.ts`, `pending-confirmations-repository.ts`, `tool-permissions-repository.ts` — feature tables.

---

## 3. Dependency Graph

```mermaid
graph TD
    subgraph Edge
        P[proxy.ts (Next 16 middleware)]
    end

    subgraph Client
        SP[sign-in page]
        SU[sign-up page]
        VE[verify-email page]
        AP[AuthProvider]
        DASH[Dashboard shell layout]
        BI[lib/insforge.ts browser client]
    end

    subgraph Server Actions
        ACT[app/actions.ts]
        ACTI[app/actions/integrations.ts]
    end

    subgraph API Routes
        CB[api/callback/route.ts]
        RF[api/refresh/route.ts]
        OA[api/google|linkedin|github|slack]
        CBK[api/*-callback/route.ts]
    end

    subgraph InsForge SDK
        SDK_AUTH[createAuthActions]
        SDK_SRV[createServerClient]
        SDK_ADM[createAdminClient]
        SDK_MW[updateSession / middleware]
        SDK_RF[createRefreshAuthRouter]
    end

    subgraph Data
        USERS[(users table)]
        FEAT[(feature tables)]
        REPO[UsersRepository]
        GUARD[lib/auth-guard.ts]
        DB[lib/db.ts createAdminDb]
    end

    P -->|updateSession| SDK_MW
    P -->|redirect ?redirect=| SP

    SP -->|signInAction / signInWithGoogleAction| ACT
    SU -->|signUpAction| ACT
    VE -->|verifyEmailAction| ACT

    AP -->|getCurrentUserAction / syncUserToDatabase / signOutAction| ACT
    AP -->|restore from| LS[(localStorage)]
    DASH --> AP

    ACT --> SDK_AUTH
    ACT --> SDK_SRV
    ACT -->|syncUserToDatabase| REPO
    REPO --> USERS

    BI -->|refreshUrl| RF
    RF --> SDK_RF

    CB -->|exchangeOAuthCode| SDK_AUTH
    CB -->|syncUserToDatabase| ACT

    OA -->|signState| OS[lib/oauth-state.ts]
    OA -->|no auth guard today| XX[IDOR - Phase 2]
    CBK -->|verifyState/consumeState| OS
    CBK -->|saveConnection| ACTI

    GUARD --> SDK_SRV
    GUARD --> REPO
    DB --> SDK_ADM
    REPO --> DB
    ACTI --> DB
```

---

## 4. Session Lifecycle

### Sign-up (email+password)
1. `sign-up/page.tsx` validates (min 8), calls `signUpAction`.
2. If `requireEmailVerification` → redirect `/verify-email?email=` → OTP page (`verifyEmailAction`).
3. Else auto-session: store user in localStorage, redirect `/dashboard` (middleware passes via cookie).

### Sign-in (existing user)
1. `sign-in/page.tsx` validates (min 6 — mismatch, see §10), calls `signInAction`.
2. SDK sets auth cookies → client stores user in localStorage → `router.push("/dashboard")`.
3. `/dashboard` load → middleware validates/refreshes → `AuthProvider.refreshSession()` re-verifies + syncs DB.

### Expired session (any protected page)
1. Edge: `updateSession` sees expired access token → refreshes via `/api/auth/refresh` (mobile endpoint) → rotates cookies in-place, page renders.
2. Refresh fails → middleware clears cookies → redirect `/sign-in?redirect=…`.

### Logout
1. `app/dashboard/page.tsx` `handleSignOut` → `signOutAction()` (clear cookies + SDK signOut) → `clearSession()` → hard redirect `/sign-in`.

---

## 5. Cookies

| Cookie | httpOnly | Secure | SameSite | Path | Set by |
|---|---|---|---|---|---|
| `insforge_access_token` | **false** | prod | lax | `/` | SDK (setAuthCookies / signIn) |
| `insforge_refresh_token` | **true** | prod | lax | `/` | SDK |
| `insforge_code_verifier` | true | prod | lax | `/` | `signInWithGoogleAction` (10 min) |

`secure` = `NODE_ENV === "production"` (SDK default). Access token non-httpOnly → JS-readable; app also mirrors user JSON in localStorage (accepted risk, see §10).

---

## 6. Middleware Impact

- Runs for `/dashboard/**` only (plus dead `/app/**`).
- **Not** run for `/api/*`, `/sign-in`, `/sign-up`, `/verify-email`, `/settings`.
- API routes carry their own (mostly missing — see §10) auth; `/settings/integrations` is a static redirect to `/dashboard/integrations`.

---

## 7. Environment Variables

| Var | Used by | Public? |
|---|---|---|
| `NEXT_PUBLIC_INSFORGE_BASE_URL` | all SDK clients, proxy | yes (client) |
| `NEXT_PUBLIC_INSFORGE_ANON_KEY` | all SDK clients, proxy | yes (client) |
| `INSFORGE_API_KEY` | admin client (`lib/db.ts`, actions, scripts) | **no** |
| `NEXT_PUBLIC_APP_URL` | OAuth redirect URIs (`lib/oauth.ts`) | yes |
| `TOKEN_ENCRYPTION_KEY` | OAuth state HMAC fallback (`getHmacSecret`) | no |
| `OAUTH_STATE_SECRET` | OAuth state HMAC (preferred) | no |
| `OPENROUTER_API_KEY`, `OPENROUTER_MODEL` | AI services | no |
| `TRIGGER_SECRET_KEY` | trigger.dev | no |
| `GOOGLE_CLIENT_ID/SECRET`, `GITHUB_*`, `SLACK_*`, `LINKEDIN_*`, `DISCORD_*`, `TELEGRAM_BOT_TOKEN`, `SLACK_SIGNING_SECRET` | OAuth providers | no |

No `.env.example` exists today.

---

## 8. Key Findings (from engineering/security/release reviews, for subsequent phases)

| # | Finding | Phase |
|---|---|---|
| F1 | Secrets committed: `scripts/check-items.mjs` (admin key), `run-migrations.mjs`, `check-db.mjs` (Postgres creds) | 1 — Secrets |
| F2 | OAuth init routes (`/api/google|linkedin|github|slack`) trust client `userId` — IDOR integration hijack | 2 — IDOR |
| F3 | `users` RLS public-read fixed on live DB; original migration file still vulnerable; child-table RLS compares `auth.uid() = user_id` (never equal — no-op deny) | 3 — RLS |
| F4 | Docker `output: "standalone"` missing | 4 — Docker |
| F5 | `?redirect=` set by proxy, ignored by sign-in (hardcodes `/dashboard`) | 5 — Auth UX |
| F6 | `/reset-password` 404 (link live in UI); full SDK reset flow available | 5 — Auth UX |
| F7 | Password validation duplicated: sign-in min 6 vs sign-up min 8 | 5 — Auth UX |
| F8 | `updateSession` unguarded — env miss → 500 all protected routes | 5 — Auth UX |
| F9 | `syncUserToDatabase` email-match overwrites `auth_user_id` (account confusion) | 5 — Auth UX |
| F10 | Test-user bypass in `getCurrentUserAction` (NODE_ENV-gated) | 6 — cleanup |
| F11 | `/app/*` dead matcher; `/api/rules` dead code; CSP `unsafe-inline`/`unsafe-eval` | 6 — cleanup |
| F12 | Telegram webhook no signature check | Security phase (deferred) |

---

## 9. Security Review Baseline (current state)

- **Session fixation**: refresh-token rotation on refresh; cookies SameSite=Lax. No explicit fixation defense observed (access token re-issued, user id in JWT). Acceptable given SDK-managed.
- **CSRF**: SameSite=Lax + `form-action 'self'` CSP; state-changing server actions rely on cookie auth. Adequate for current shape.
- **OAuth callback validation**: HMAC state (`lib/oauth-state.ts`) + replay `consumeState` + redirect-uri binding — solid. Initiation routes are the gap (F2).
- **User enumeration**: sign-in error messages echo InsForge errors (may distinguish unknown email). Rate limiter exists (`lib/rate-limiter.ts`, auth tier 5/min) but is not wired to auth actions.
- **Cookie flags**: access token non-httpOnly + localStorage mirrors (accepted; monitor).
- **Duplicate accounts**: `syncUserToDatabase` email-match re-binds `auth_user_id` (F9).
