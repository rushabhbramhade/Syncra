# Syncra — Auth UI Design Review (Sign In / Sign Up)

**Scope:** `/plan-design-review` — pre-implementation designer review of `app/sign-in/page.tsx` and `app/sign-up/page.tsx`. No code changes.
**Baseline compared against:** Linear / Notion / Stripe / Vercel auth patterns.
**Pages reviewed:** Sign In (340 lines), Sign Up (425 lines), cross-checked against `app/verify-email/page.tsx` (the one auth page that uses the shared design system).

---

## Scorecard

| Dimension | Score | Verdict |
|---|---|---|
| Layout | 6/10 | Solid card structure, wasted left panel, logo duplicated |
| Accessibility | 4/10 | Labels ok, but no aria-invalid/aria-live/aria-describedby, raw `<img>` no alt |
| Mobile responsiveness | 5/10 | Stacks ok, but 380px image hero eats viewport on phones |
| Keyboard navigation | 5/10 | Tab order fine; no focus mgmt on error, weak focus-visible |
| Loading states | 7/10 | Spinners + disable done; no aria-busy |
| Error states | 6/10 | Good banners; no alert role, no field-level aria wiring |
| Success states | 6/10 | Sign-up banner + redirect good; no role="status" |
| Password toggle | 8/10 | Works, has aria-label; missing aria-pressed + autocomplete |
| Form validation UX | 7/10 | Blur+change validate good; policy mismatch sign-in vs sign-up |
| Disabled buttons | 7/10 | Disabled during load; no invalid-state gating (fine) |
| Focus management | 4/10 | No move-to-first-error, no focus trap, autofocus missing |
| Empty states | 5/10 | Left panel is dead space on both pages |

**Overall: 5.8/10. Not Linear/Stripe-grade yet. Every issue below is fixable in the implementation pass.**

---

## Blocking issues (fix before implementation)

### 1. Design tokens ignored — pages use raw hex, bypass the theme
`sign-in/page.tsx` + `sign-up/page.tsx` hardcode `bg-[#4f46e5]`, `bg-[#f3f3fd]`, `border-[#4f46e5]`, `text-[#4f46e5]`, `bg-[#4338ca]`. The design system already defines these as tokens (`--color-primary`, `--color-background-mist` in `app/globals.css:5-36`), and `verify-email` already uses them (`text-primary`, `bg-surface-white`, `bg-accent-purple`).

Why it matters: hardcoded hex does not respond to `.dark`. The app ships a dark theme (`app/layout.tsx` script + `.dark` variant), but `ClientWrapper` force-removes `.dark` only because auth pages break otherwise. Result: auth pages are permanently light-mode, and the moment someone turns on system dark mode the whole app flips except the two auth screens — a jarring, broken state.

Fix: swap every raw hex for tokens (`bg-primary`, `bg-background-mist`, `border-primary`, `text-primary`). Then support dark mode on these pages instead of force-clearing it in `ClientWrapper`.

### 2. Left panel is a wasted 42% on desktop, dead 380px on mobile
Both pages render a decorative image panel (`md:w-[42%]`, `min-h-[380px]` mobile, `min-h-[520px]` desktop) that shows only a logo and a background photo. On mobile it pushes the form entirely below the fold — user sees a logo over a photo before any input.

Linear/Stripe/Vercel use this panel for **value** (product screenshot, testimonial, feature bullets), or shrink it on mobile. On sign-up the panel has a literal empty `<div className="space-y-3"></div>` (`sign-up/page.tsx:222`) — dead markup.

Fix: on mobile, make the hero a compact brand header (logo + one tagline, ~160px). On desktop, fill the panel with a product value prop or screenshot. Remove the empty div.

### 3. Logo rendered twice
Logo appears in the left panel AND in the form header on both pages. Redundant on desktop, stacked on mobile. One logo, top of form.

### 4. Accessibility plumbing missing on form controls
- No `aria-invalid` on inputs when `emailError`/`passwordError` set — screen readers don't know the field is errored.
- No `aria-describedby` linking input → its error `<p>` (error text has no id, input no aria-describedby).
- Error/success banners (`formError`, `formSuccess`) have no `role="alert"` / `aria-live="polite"` — SR users never hear submission failures.
- Raw `<img src="/logo.png">` / `<img src="/auth-bg.png">` — no `alt` (logo should be `alt="Syncra"`, background `alt=""`). `next/image` preferred.

Fix: `aria-invalid={!!emailError}`, `aria-describedby={emailError ? "email-error" : undefined}`, `<p id="email-error" ...>`, `role="alert"` on banners, proper `alt`s.

### 5. autocomplete attributes missing — password managers defeated
No `autoComplete` anywhere. Sign-in: `autoComplete="email"` on email, `autoComplete="current-password"` on password. Sign-up: `autoComplete="name"`, `"email"`, `"new-password"`. Without these, browsers offer no credential save/fill — a hard regression vs every modern SaaS.

### 6. Password policy mismatch between pages
Sign-up requires **min 8 + number + special** (`sign-up/page.tsx:58-71`). Sign-in requires only **min 6** (`sign-in/page.tsx:41-49`). A user who typo's a password with 6 chars on sign-in gets a *client-side* error before the server is even consulted. The client should never block on password *strength* during sign-in — only on *presence*. Server is the authority. Align: sign-in validates "non-empty" only.

---

## Non-blocking improvements

### 7. Focus management
- No focus moved to the first invalid field on submit. After a failed submit, `formError` banner appears but focus stays on the submit button. Move focus to the first invalid input (or the banner) on submit error.
- No `autoFocus` on first field (email). Linear/Stripe focus email immediately.
- Focus-visible rings: most interactive elements rely on browser default. Verify `:focus-visible` styling consistent with design system (verify-email has `focus-visible:ring-2`; sign-in/up don't).

### 8. Button a11y
- Submit button is a bare `<button>` with inline classes — no shared `Button` component (`components/ui/button` exists, verify-email uses it). Adopt it for consistent disabled/spinner/focus states.
- Disabled state = `opacity-50 pointer-events-none` only; add `aria-disabled` or rely on native `disabled` (it is native `disabled` — good). Add `aria-busy={isLoading}` on the form.

### 9. Password toggle a11y
- Toggle has good dynamic `aria-label` (Show/Hide). Missing `aria-pressed={showPassword}` so SR users know current state.
- Password input `type` flip is correct. Consider `inputMode`/`autocapitalize="none"` not needed here.

### 10. Loading states
- Submit spinner + `disabled` is correct. Sign-in does not show the spinner label swap; sign-up does. Unify: disable both buttons + show inline spinner in the clicked one.
- Google button has its own loading state (good), but both spinners are inline SVGs, not the shared pattern.

### 11. Empty/degenerate states
- Email empty + blur → "Email is required" (good). Password empty on sign-in → "Password is required" (good).
- No "caps lock on" detection/warning on password inputs. Linear/Vercel show a "Caps Lock is on" hint. Cheap win.

### 12. Mobile refinements
- Form column padding is `p-4` outer / `px-2 md:px-8` inner — tight. Add `px-4` on the form column at base.
- `max-w-[1000px]` card is fine; consider `max-w-md` single-column treatment on mobile so the card doesn't span full width with a 380px hero above.

### 13. Error copy consistency
- Sign-in: "Invalid login credentials. Please try again." (good, no enumeration).
- Sign-up: error surface is the banner + field errors. Sign-up's password error string is long ("Include at least one number and one special character") — fine as a hint, but the helper should live under the field as persistent hint text, not only as an error after blur.

### 14. Success state polish
- Sign-up success banner + 1.5s delay redirect is fine. Add `role="status"`. Consider an immediate redirect with a success toast on the dashboard instead of a blocking wait.

---

## What's already good (keep)
- Labels tied to inputs via `htmlFor`/`id`. 
- Blur-validate + re-validate-on-change is the right UX.
- Generic server error copy (no user enumeration).
- Separate OAuth vs credentials loading states.
- Dynamic `aria-label` on the eye toggle.
- `noValidate` on form + custom validation (consistent control).
- Card-based centered layout matches modern SaaS shells.

---

## Recommended implementation order (fold into auth plan, Phase 3)
1. Swap raw hex → design tokens; enable dark mode on auth pages; remove force-light in `ClientWrapper`.
2. Add `autocomplete`, `aria-invalid`/`aria-describedby`, `role="alert"`/`role="status"`, alt text.
3. Align sign-in password validation (non-empty only).
4. Compact mobile hero; fill desktop left panel with value prop; single logo.
5. Focus management (first-invalid-field, autoFocus email) + shared `Button`.
6. Password toggle `aria-pressed` + caps-lock hint.

No code changed. This is the design pass; apply with the auth MVP implementation.

**STATUS: DONE_WITH_CONCERNS. REASON: 6 blocking + 8 non-blocking findings, all concrete and fixable in implementation. ATTEMPTED: full UI review of both auth pages against design system + modern SaaS baselines. RECOMMENDATION: adopt tokens, fix a11y plumbing + autocomplete + password-policy mismatch before ship.**
