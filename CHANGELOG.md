# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-08-04

### Security
- **Fixed systemic IDOR vulnerability** — All browser-facing server actions now guarded with `requireOwnership()` checks against the authenticated user. Previously, client-supplied `userId` parameters were passed unchecked to admin client calls, allowing cross-user data access.
- **Closed RLS public exposure** — Applied migration `20260804000001` removing all public/anon policies. All tables now enforce authenticated access only.
- **Rotated hardcoded API key** — Removed embedded `INSFORGE_API_KEY` from source; migrated to environment variable (key rotation still required in git history).

### Added
- **Forgot Password flow** (`/forgot-password`): Email-only form with enumeration-safe always-confirm screen, 60-second resend cooldown (sessionStorage), and back-to-sign-in link.
- **Reset Password flow** (`/reset-password`): Token-only page (no token → redirects to `/forgot-password`), validate-on-submit with error mapping (`AUTH_TOKEN_EXPIRED` → expired state, `AUTH_WEAK_PASSWORD` → inline guidance), password visibility toggle, strength checklist, and success state redirecting to sign-in.
- **Shared validation library** (`lib/validation/auth.ts`): `validateEmail()`, `validatePassword()`, `EMAIL_REGEX`, `PASSWORD_REQUIREMENTS` (8+ chars, uppercase, lowercase, number, special character). Adopted by sign-up (full policy) and sign-in (email validation).
- **E2E test coverage**: 13 unauthenticated Playwright tests covering auth smoke, forgot-password, and reset-password flows (2× stable runs).
- **CI pipeline** (`.github/workflows/ci.yml`): Lint + typecheck → build → unauthenticated e2e on every PR/push to main.

### Changed
- **Sign-up** now enforces full password policy (uppercase added).
- **Sign-in** uses shared email validation; password validation remains client-only required check.
- **Proxy middleware** (`proxy.ts`): matcher narrowed to `/dashboard/:path*` and `/app/:path*` — public auth routes (`/sign-in`, `/sign-up`, `/forgot-password`, `/reset-password`, `/verify-email`) no longer require middleware interception.
- **Deleted deprecated integrations**: Linear, Notion, Outlook providers + associated service files removed.
- **Deleted unused API routes**: `/api/rules` removed.

### Fixed
- **Reset password page**: Fixed invalid HTML (button inside Link) by using `router.push()` onClick.
- **Accessibility**: Added `aria-live="polite"` to all form error/success regions on both pages.
- **Playwright config**: Public specs now routed to `unauthenticated` project (no auth setup dependency).

### Removed
- Local `validateEmail`/`validatePassword` duplicates from sign-in and sign-up pages.
- `lib/integrations/linear-provider.ts`, `notion-provider.ts`, `outlook-provider.ts`, `lib/outlook/outlook-service.ts`.
- `app/api/rules/route.ts`.

---

## [0.1.0] - 2026-07-21

### Initial launch-ready baseline
- Core dashboard, integrations, briefings, AI chat, WhatsApp, Telegram, Discord, Slack, GitHub, LinkedIn, Gmail connectors
- Trigger.dev background tasks for integration maintenance
- InsForge auth (email/password, OAuth, email verification)
- Real-time notifications, briefing generation, MCP actions
- Database: users, integrations, conversations, briefings, AI memory, etc.

---