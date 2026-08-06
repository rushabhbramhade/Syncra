## Objective
- Cross-Platform Briefing hardening: one verified pipeline (connection → auth → fetch → normalize → unified store → provider health → AI context → items → frontend) where no provider silently returns zero, every failure is evidence-derived and visible, and every briefing item traces to a real synchronized entity.
- This pass fixed the three root causes behind the live symptoms (GitHub/LinkedIn "No Recent Activity" despite connection, WhatsApp vanishing) plus Slack scope surfacing.

## Important Details
- Ponytail (full) + caveman mode. Repo `/Users/rushabhbramhade/Projects/Syncar/Syncra`. Node v24.18.1; `test:pipeline` = `node --test tests/briefing-pipeline.test.ts` (19 tests). `tsconfig` has `allowImportingTsExtensions`.
- Migration `20260806140000_briefing-provider-health.sql` applied (provider_health JSONB + provider_id/entity_kind cols + indexes).
- Briefing uses `executeMCPAction` per provider; `lib/integrations/sync-engine.ts` is a separate un-hooked orchestrator (no provider implements snapshot/incremental) — not the briefing data path.
- Registered providers: gmail, slack, whatsapp, telegram, discord, github, linkedin, calendar. outlook/notion/linear unregistered → cannot connect.
- Frontend is DB-driven; Integration Health renders every `provider_health` key.

## Work State
### Completed (this pass)
- **BUG A — GitHub errors were swallowed → "No Recent Activity".** The github block used `Promise.allSettled`; when both `github_list_issues` + `github_get_notifications` failed, `combined` was empty and `ingest` was NEVER called → health seat stayed `fetched:0` with no error. Fixed: `ingest` is always called — on both-fail it records the real reason; on partial success it carries the error alongside the data (ingest captures `result.error` before the normalization gate so it's never overwritten).
- **BUG B — LinkedIn single-object payload counted as 0.** `h.fetched = countItems(result.result)`; a LinkedIn profile is a plain object → `countItems` = 0 → ingest bailed out BEFORE normalization → profile never counted → "No Recent Activity" forever. Fixed: ingest normalizes FIRST and keys the data gate off `normalized` count (`fetched = max(rawCount, entities.length)`). LinkedIn now yields its 1 profile entity and flows to AI context + briefing.
- **BUG C — WhatsApp not-ready silently demoted.** When `whatsappReady` is false, WhatsApp is excluded from fetch but kept a bare health seat → "No Recent Activity". Fixed: explicit health override for connected-but-not-ready WhatsApp → error "WhatsApp is not fully in sync — reconnect to complete" → classifies Authentication Failed + reconnect flag → amber "Reconnect required" card.
- **BUG D — Slack scope surfacing.** `SlackApiService.listChannels` now throws the required scopes on `missing_scope`: "Slack missing OAuth scopes — reconnect to grant: channels:read,channels:history,groups:read,groups:history,im:read,im:history,mpim:read,mpim:history". Classifier maps it → Permission Missing + Reconnect Required (never "No Recent Activity").
- ingest normalization logging now distinguishes raw-empty ("no recent activity") from data-dropped ("normalization returned 0 items" → sync_failed).

### Completed (earlier passes)
- Provenance gate `filterGroundedItems` (drops fabricated-platform items + per-provider budget clamp). Zero-data briefings store health-only row. Coverage backfill `buildCoverageItems`. Provider report log (status, statusLabel, reconnectRequired, lastSync, referencedByAI vs rendered).
- `classifyProviderStatus`: healthy / partial / no_recent_activity / authentication_failed / permission_missing / rate_limited / sync_failed + reconnect flag. Telegram getUpdates webhook-conflict → []. WhatsApp DB-backed readiness + lazy restore. Slack slice 3→5. Discord embeds/mentions/replyTo. Migration applied.

### Blocked / genuine limitations
- LinkedIn contributes only a profile entity (no feed/notifications/messages tools wired) — "Healthy: profile synchronized" is the truthful ceiling without new LinkedIn endpoints.
- Calendar `exchangeCode`/`refreshAccess` return sentinel `"calendar_paired"` — real Google token must be stored for provider "calendar" to actually fetch events.
- outlook/notion/linear: providers not registered.

## Next Move
1. (Optional) Surface the missing-scope list in the health card's reconnect note (currently in the error line + "Reconnect required" note).
2. Re-run `node --test tests/briefing-pipeline.test.ts` + `tsc --noEmit` + eslint on any new change.

## Relevant Files
- `lib/services/briefing-service.ts`: ingest reordered (normalize-first gate), github always-ingest w/ error surfacing, whatsapp not-ready health override, partial-failure capture.
- `lib/integrations/slack-provider.ts`: missing_scope error enriched with required scopes.
- `lib/briefing/pipeline.ts`: `classifyProviderStatus`, `filterGroundedItems`, `buildCoverageItems`, `ProviderHealth` (status/statusLabel/reconnect), normalizers.
- `components/dashboard/briefing/briefing-intelligence.tsx`: statusLabel pill + reconnect note.
- `tests/briefing-pipeline.test.ts`: 19 tests.
