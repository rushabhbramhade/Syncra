# Runbook — Gmail Staging Validation Harness

Fail-closed operator runbook for validating the Gmail → briefing pipeline
against a **dedicated staging inbox** before it ever sees a real mailbox.

The harness lives in `scripts/gmail-staging-validation/`. It is deliberately
small, dependency-light, and refuses to touch Gmail unless the account is
explicitly proven to be staging.

---

## Safety contract (read first)

1. **Never** run against a personal/business account. The guardlayer in
   `guard.ts` carries a fixed denylist — the two accounts observed connected
   in the current env worktree are `rushabh.bramhade123@gmail.com` and
   `rushabhbusiness40@gmail.com` — and the harness **fails closed** if any
   denylisted row is present.
2. **No mail is ever read or sent without an explicit, one-shot live proof:**
   `GMAIL_STAGING_ACCOUNT` + `GMAIL_STAGING_LIVE_ALLOW=1` +
   `GMAIL_STAGING_LIVE_NONCE`. Without all three, `run` exits `3` (gated).
3. `preflight` and `plan` are **read-only** on env/DB and make **zero** Gmail
   calls.
4. The only outbound surface is `gmail-http.ts`. It stays dry until the proof
   in `live-adapter.ts` passes. You wire the actual `queryInbox` call in exactly
   one place, and only after the staging account is provisioned and enrolled.

---

## Phases

### 1. Provision the staging inbox

1. Create a new Gmail account **exclusively for staging** (never an existing
   personal/business mailbox), e.g. `syncra.staging.<suffix>@gmail.com`.
2. Enable 2FA and create an App Password **only if** the project cannot use
   OAuth here. Prefer OAuth (the app already supports it via
   `api/gmail-callback`).
3. Record the address — you will place it in `.env.local`:
   ```
   GMAIL_STAGING_ACCOUNT=syncra.staging-xxxx@gmail.com
   ```

### 2. Authorize & connect the staging account

1. Set the OAuth vars if not already present (`GOOGLE_CLIENT_ID`,
   `GOOGLE_CLIENT_SECRET`, `NEXT_PUBLIC_APP_URL`).
2. Start the dev server and connect the staging account through the normal
   Gmail connect flow.
3. Confirm a `provider=gmail` row now exists with `email`/`provider_account_id`
   equal to the staging address.

### 3. Authenticate the harness

Whether running locally or against a remote DB, point the harness at the exact
project env it will inspect. The harness reads `.env.local` by default; pass
an env file explicitly in CI via `dotenv` precedence:

```
GMAIL_STAGING_ACCOUNT=syncra.staging-xxxx@gmail.com
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
NEXT_PUBLIC_INSFORGE_BASE_URL=...
INSFORGE_API_KEY=...
```

Run preflight — it must be clean before anything else:
```
npx tsx scripts/gmail-staging-validation/run.ts preflight
```
Exit `0` = staging identity declared, mailbox proven, OAuth fresh.

### 4. Seed the controlled scenario

Produce the seed plan and follow it to drop the exact six messages + one
thread into the staging inbox (subjects carry a unique `[SYNCRA-STAGING] <seed>`
prefix so the checks can isolate them):
```
npx tsx scripts/gmail-staging-validation/run.ts plan
```
The plan prints message kinds: `normal`, `high_priority`, `unread`,
`needs_reply`, `empty_content`, and a 2-message thread (`thread_root` + reply).

**Do this in the staging inbox, with the staging sender, at the timestamps the
plan shows.**

### 5. Run the 13 acceptance checks

Now you gain live access — the only moment the harness may call Gmail. Set the
one-shot proof, run, and inspect:
```
GMAIL_STAGING_LIVE_ALLOW=1 \
GMAIL_STAGING_LIVE_NONCE=<random-one-shot> \
GMAIL_STAGING_ACCESS_TOKEN=<token> \
npx tsx scripts/gmail-staging-validation/run.ts run
```

Exit codes: `0` all pass, `1` a check failed, `3` gated (refused — fix the
preflight/proof problems), `4` usage.

Checks covered (in `checks.ts`):

| id | name            | what it proves                                            |
|----|-----------------|-----------------------------------------------------------|
| A  | live-connect    | real Gmail fetch happened (no mock)                      |
| B  | no-mock         | > seed count of real rows; nothing synthetic             |
| C  | rate-limit      | no spurious rate-limit failures (deferred to live run)  |
| D  | single-flight   | no duplicate message ids surfaced                        |
| E  | folder-filtered | every surfaced row is Inbox / INBOX label               |
| F  | dedup-content   | same email+thread+hash yields one row, no duplicates     |
| G  | dedup-thread    | multi-message thread collapses to one conversation       |
| H  | conversation-linked | needs-reply resolves to real threadId + recipient        |
| I  | priority-primed | high-priority distinguishable from normal                |
| J  | crm-account     | no fabricated/placeholder contact names                  |
| K  | zero-parse      | every row parses; static zero unparseable               |
| L  | empty-content   | empty-body email still recognized with neutral title      |
| M  | attachments-images | only real message/thread identifiers → source links    |

### 6. Inspect + assert

- Read the wire block (`GMAIL_STAGING_VALIDATION:START … END`). Capture it
  into a report file for the run history.
- Any `fail` = stop → trace back to the corresponding pipeline/send path
  (normalization in `lib/briefing/pipeline.ts`, dedup in `lib/single-flight`,
  reply resolution in `resolveGmailReplyContext`, rate buckets from
  `lib/rate-limit-config.ts`).

### 7. Revoke access & clean up

1. Disconnect the integration row for the staging mailbox.
2. Revoke the Google OAuth grant / delete the App Password.
3. Remove the temporary `.env` values (`GMAIL_STAGING_*`).
4. Delete the seeded messages from the staging inbox (its content is
   throw-away; the account is disposable).
5. Optionally delete the staging account altogether when the project no
   longer needs a staging mailbox.

---

## Offline unit tests

The fail-closed guards are unit-tested without any DB/Gmail:

```
npx tsx --test tests/gmail-staging-validation.test.ts
```

Covered: denylist enforcement, empty-env refusal, env/account mismatch,
uncontrolled mailbox, case-insensitive matching, denylisted DB row blocking,
healthy staging pass, stale-token and missing-OAuth failure.

## Boundary notes for the next engineer

- `guard.ts` has no imports — keep it that way so tests stay offline.
- `gmail-http.ts` is the **only** place to add an outbound request; keep it
  thin, and make it require `GMAIL_STAGING_ACCESS_TOKEN`.
- `live-adapter.ts` is the only gate that calls it. If it isn't cleared, it
  returns an empty dataset; the harness reports `gated`, never `fail`.