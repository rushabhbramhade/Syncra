# Graph Report - .  (2026-08-07)

## Corpus Check
- 340 files · ~204,705 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1830 nodes · 3869 edges · 153 communities (102 shown, 51 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 46 edges (avg confidence: 0.76)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Gmail Connection
- Dashboard Pages
- Notification Event Handler
- Briefing Actions
- Notifications UI
- Dependencies
- Logging
- Integrations Actions
- WhatsApp QR Login
- Landing Page
- MCP Tools
- AI Chat
- API Retry
- Data Export/Health
- TS Config
- Briefing Pipeline
- Capability Registry
- Briefings Repository
- Realtime Client
- Integrations Center
- Dashboard Briefs
- Briefing Inbox UI
- GitHub Service
- Integration Modals
- AI Chat Repository
- Correlation Link UI
- Notification Service
- Integration Settings
- Briefing Intelligence
- Priority Feed
- Event Contracts
- Rule Engine
- Tool Permissions
- Priority Scorer
- LinkedIn Provider
- WhatsApp Client
- Credentials Crypto
- Discord Service
- Correlator
- Sync Engine
- Community 40
- Community 41
- Community 42
- Community 43
- Community 44
- Community 45
- Community 46
- Community 47
- Community 48
- Community 49
- Community 50
- Community 51
- Community 52
- Community 53
- Community 54
- Community 55
- Community 56
- Community 57
- Community 58
- Community 59
- Community 60
- Community 61
- Community 62
- Community 63
- Community 64
- Community 65
- Community 66
- Community 67
- Community 68
- Community 69
- Community 70
- Community 71
- Community 72
- Community 73
- Community 74
- Community 75
- Community 76
- Community 77
- Community 78
- Community 79
- Community 80
- Community 81
- Community 82
- Community 83
- Community 84
- Community 85
- Community 86
- Community 87
- Community 88
- Community 89
- Community 90
- Community 91
- Community 92
- Community 93
- Community 94
- Community 95
- Community 96
- Community 97
- Community 98
- Community 99
- Community 100
- Community 101
- Community 102
- Community 103
- Community 104
- Community 105
- Community 106
- Community 107
- Community 109
- Community 118
- Community 119
- Community 120
- Community 121
- Community 122
- Community 123
- Community 125
- Community 127
- Community 128
- Community 129
- Community 136
- Community 137
- Community 138
- Community 139
- Community 140
- Community 141
- Community 142
- Community 143
- Community 144
- Community 145
- Community 146
- Community 147
- Community 149
- Community 151

## God Nodes (most connected - your core abstractions)
1. `createAdminDb()` - 79 edges
2. `requireOwnership()` - 65 edges
3. `fetchWithRetry()` - 43 edges
4. `Card` - 35 edges
5. `BriefingsRepository` - 32 edges
6. `IntegrationProvider` - 31 edges
7. `cn()` - 30 edges
8. `IntegrationRegistry` - 29 edges
9. `NormalizedEvent` - 26 edges
10. `useAuth()` - 25 edges

## Surprising Connections (you probably didn't know these)
- `IntegrationCardProps` --references--> `WorkspaceIntegration`  [EXTRACTED]
  features/integrations/components/integration-card.tsx → app/actions/integrations.ts
- `BriefingDetailsModalProps` --references--> `BriefingItemRecord`  [EXTRACTED]
  components/dashboard/briefing-details-modal.tsx → lib/repositories/briefings-repository.ts
- `UnifiedItemListProps` --references--> `BriefingItemRecord`  [EXTRACTED]
  components/dashboard/briefing/unified-item-list.tsx → lib/repositories/briefings-repository.ts
- `MCPSettingsModalProps` --references--> `MCPTool`  [EXTRACTED]
  components/dashboard/integrations/mcp-settings-modal.tsx → constants/mcp-tools.ts
- `syncUserToDatabase()` --calls--> `createAdminDb()`  [EXTRACTED]
  app/actions.ts → lib/db.ts

## Import Cycles
- 3-file cycle: `app/actions/integrations.ts -> features/integrations/schemas/index.ts -> features/integrations/types/index.ts -> app/actions/integrations.ts`
- 4-file cycle: `app/actions/integrations.ts -> lib/integrations/index.ts -> lib/integrations/whatsapp-provider.ts -> lib/whatsapp/client.ts -> app/actions/integrations.ts`

## Hyperedges (group relationships)
- **Edge Middleware Auth Guard** — plans_auth_architecture_proxy, plans_auth_architecture_updatesession, plans_auth_mvp_engineering_plan_middleware_hardening [EXTRACTED 1.00]
- **Provider Health Status Classification** — opencode_work_summary_classifyproviderstatus, opencode_work_summary_provider_health, opencode_work_summary_filtergroundeditems, opencode_work_summary_buildcoverageitems [EXTRACTED 1.00]
- **Social Auth Providers** — public_discord_discordicon, public_github_githubicon, public_gmail_gmailicon, public_slack_slackicon, public_linkedin_linkedinicon, public_telegram_telegramicon, public_whatsapp_whatsappicon [INFERRED 0.85]

## Communities (153 total, 51 thin omitted)

### Community 0 - "Gmail Connection"
Cohesion: 0.07
Nodes (36): saveConnection(), saveGmailConnection(), dynamic, GET(), runtime, GET(), OAUTH_ERROR_MESSAGES, GET() (+28 more)

### Community 1 - "Dashboard Pages"
Cohesion: 0.06
Nodes (27): ComingSoon(), ComingSoonProps, DashboardSidebar(), DashboardSidebarProps, NavItem, PRIMARY_NAV, SECONDARY_NAV, NavItemProps (+19 more)

### Community 2 - "Notification Event Handler"
Cohesion: 0.07
Nodes (25): NotificationEventHandler, EventEmitter, EventSubscription, NotificationEvent, NotificationEventType, publishNotificationEvent, eventLogger, notificationLogger (+17 more)

### Community 3 - "Briefing Actions"
Cohesion: 0.09
Nodes (42): checkPlatformsConnectionAction(), createScheduleAction(), deleteScheduleAction(), generateBriefingAction(), generateDraftAction(), getBriefingDetailsAction(), getBriefingHistoryAction(), getBriefingItemsAction() (+34 more)

### Community 4 - "Notifications UI"
Cohesion: 0.09
Nodes (32): formatDate(), NotificationItem, NotificationsPage(), TYPE_ICONS, BriefItem, impactColors, Recommendation, RecommendationCard() (+24 more)

### Community 5 - "Dependencies"
Cohesion: 0.04
Nodes (48): cross-env, eslint, eslint-config-next, @next/bundle-analyzer, devDependencies, cross-env, eslint, eslint-config-next (+40 more)

### Community 6 - "Logging"
Cohesion: 0.10
Nodes (22): providerLogger, queueLogger, serviceLogger, templateLogger, FormattedNotification, NotificationProvider, NotificationProviderRegistry, DiscordProvider (+14 more)

### Community 7 - "Integrations Actions"
Cohesion: 0.12
Nodes (34): connectDiscordAction(), ConnectionStatus, connectTelegramAction(), DEFAULT_SYNC_ARGS, DEFAULT_SYNC_TOOL, deleteIntegration(), disconnectConnection(), disconnectGithubAction() (+26 more)

### Community 8 - "WhatsApp QR Login"
Cohesion: 0.05
Nodes (37): clsx, QrDisplay(), AuthMethod, QrCodeDisplay(), validatePhone(), WhatsAppConnectionModal(), WhatsAppConnectionModalProps, framer-motion (+29 more)

### Community 9 - "Landing Page"
Cohesion: 0.08
Nodes (18): Footer(), AICapabilities(), FAQ(), FeaturesBento(), FinalCTA(), Hero(), Integrations(), Navigation() (+10 more)

### Community 10 - "MCP Tools"
Cohesion: 0.17
Nodes (8): MCPTool, PLATFORM_MCP_TOOLS, ToolArgument, GoogleProvider, IntegrationProvider, AuthTokens, IntegrationProfile, WhatsAppProvider

### Community 11 - "AI Chat"
Cohesion: 0.14
Nodes (26): addMemoryAction(), createConversationAction(), deleteConversationAction(), deleteMemoryAction(), duplicateConversationAction(), getArchivedConversationsAction(), getConversationDetailsAction(), getConversationsAction() (+18 more)

### Community 12 - "API Retry"
Cohesion: 0.11
Nodes (10): fetchWithRetry(), HTTP_RETRYABLE_STATUSES, RetryOptions, withRetry(), DiscordBotInfo, CalendarEvent, SlackApiService, LinkedInProfile (+2 more)

### Community 13 - "Data Export/Health"
Cohesion: 0.11
Nodes (18): disconnectAndDeleteAction(), exportUserDataAction(), getIntegrationHealthAction(), HealthActivity, ToolCallRecord, createAdminDb(), FeedbackSignal, recordFeedback() (+10 more)

### Community 14 - "TS Config"
Cohesion: 0.07
Nodes (29): dom, dom.iterable, esnext, .next/dev/types/**/*.ts, next-env.d.ts, .next/types/**/*.ts, node_modules, trigger.config.ts (+21 more)

### Community 15 - "Briefing Pipeline"
Cohesion: 0.12
Nodes (23): aiShapeForProvider(), buildCoverageItems(), buildManifest(), classifyProviderStatus(), computeQuality(), countItems(), coverageCategory(), CoverageItem (+15 more)

### Community 16 - "Capability Registry"
Cohesion: 0.12
Nodes (19): CapabilityRegistry, ProviderGetter, providersFor(), CAPABILITY_CATALOG, CapabilityId, INTEGRATION_LIFECYCLE_STATES, IntegrationLifecycleState, isCapabilityId() (+11 more)

### Community 17 - "Briefings Repository"
Cohesion: 0.08
Nodes (3): BriefingsRepository, detectCorrelations(), hasRealData()

### Community 18 - "Realtime Client"
Cohesion: 0.10
Nodes (25): activeSockets, attachClientHandlers(), cacheMessage(), chatIds, computeSyncStats(), contactIds, ensureStore(), flushCache() (+17 more)

### Community 19 - "Integrations Center"
Cohesion: 0.17
Nodes (23): checkGoogleApiConfig(), connectIntegration(), executeMCPActionGuarded(), deleteNotificationsAction(), getCenterRepo(), getHistoryRepo(), getNotificationsAction(), getNotificationStatsAction() (+15 more)

### Community 20 - "Dashboard Briefs"
Cohesion: 0.11
Nodes (18): DashboardBriefData, ExtendedBriefData, mapBriefingToCard(), ConnectedApp, ConnectedAppsGrid(), ConnectedAppsGridProps, DashboardBriefSection(), DashboardHeader() (+10 more)

### Community 21 - "Briefing Inbox UI"
Cohesion: 0.14
Nodes (18): BriefingExecutiveCardProps, BriefingInbox(), BriefingInboxProps, getAppIcon(), getPlatformClass(), TABS, TodayHeroCard, TodayHeroCardProps (+10 more)

### Community 22 - "GitHub Service"
Cohesion: 0.15
Nodes (7): apiHeaders(), fetchAllPages(), GitHubService, parseLinkHeader(), RateLimitState, searchRateLimit, GitHubProvider

### Community 23 - "Integration Modals"
Cohesion: 0.13
Nodes (13): WorkspaceIntegration, DiscordConnectionModal, MCPSettingsModal, TelegramConnectionModal, WhatsAppConnectionModal, IntegrationCardSkeleton(), IntegrationSummarySkeleton(), formatRelative() (+5 more)

### Community 25 - "Correlation Link UI"
Cohesion: 0.10
Nodes (13): CorrelationLink(), CorrelationLinkProps, getPlatformColor(), BriefingItemMeta, ItemRow, PRIORITY_RANK, SMART_FILTERS, SmartFilter (+5 more)

### Community 26 - "Notification Service"
Cohesion: 0.19
Nodes (11): generateAndSendBriefAction(), sendTestNotificationAction(), getAdmin(), getNotificationService(), getRepos(), NotificationService, notify(), sendDailyBrief() (+3 more)

### Community 27 - "Integration Settings"
Cohesion: 0.15
Nodes (14): IntegrationSettingsRow(), formatDate(), IntegrationCard(), IntegrationCardProps, ProviderIcon(), StatusBadge(), ACTIVE_PROVIDERS, getProviderMeta() (+6 more)

### Community 28 - "Briefing Intelligence"
Cohesion: 0.11
Nodes (14): BriefingIntelligence, ProviderHealthLine, DashboardBriefSectionProps, BriefingIntelligence, BriefingIntelligenceContent, IntelligenceConfidence, IntelligenceGoal, IntelligenceHealth (+6 more)

### Community 29 - "Priority Feed"
Cohesion: 0.14
Nodes (16): ExplanationPanel(), ExplanationPanelProps, platformIcons, priorityColors, PriorityFeed(), PriorityFeedProps, actions, QuickActions() (+8 more)

### Community 30 - "Event Contracts"
Cohesion: 0.12
Nodes (14): AiTaskEventPayload, ApprovalRequestedPayload, EntityIngestedPayload, EVENT_TYPES, EventEnvelope, EventHandler, EventPublisher, EventSubscriber (+6 more)

### Community 31 - "Rule Engine"
Cohesion: 0.25
Nodes (14): RuleEditorProps, buildBuiltinRules(), VIP_DOMAINS, applyAction(), evaluateCondition(), evaluateRule(), getFieldValue(), ActionType (+6 more)

### Community 32 - "Tool Permissions"
Cohesion: 0.23
Nodes (6): getToolPermissionsAction(), initializeToolPermissionsAction(), repo, setToolEnabledAction(), ToolPermission, ToolPermissionsRepository

### Community 33 - "Priority Scorer"
Cohesion: 0.24
Nodes (14): PriorityLevel, calculateScore(), extractFactors(), getPriorityFromScore(), PRIORITY_THRESHOLDS, scoreEvent(), scoreEvents(), ScoringFactors (+6 more)

### Community 35 - "WhatsApp Client"
Cohesion: 0.21
Nodes (5): CACHE_BACKED_TOOLS, useDBAuthState(), waSocketConfig(), waTrace(), WhatsAppClientManager

### Community 36 - "Credentials Crypto"
Cohesion: 0.22
Nodes (5): decrypt(), encrypt(), getEncryptionKey(), CredentialRecord, CredentialsRepository

### Community 38 - "Correlator"
Cohesion: 0.23
Nodes (12): correlateEvents(), extractPRNumber(), extractRepoName(), findCorrelation(), normalizeText(), deduplicate(), mergeDedupedEvents(), Contact (+4 more)

### Community 39 - "Sync Engine"
Cohesion: 0.20
Nodes (11): SyncDepth, advanceWatermark(), emptyResult(), pickHook(), runSync(), Snapshot, SyncContext, SyncResult (+3 more)

### Community 40 - "Community 40"
Cohesion: 0.27
Nodes (12): ALL_PROVIDERS, buildBriefFromData(), categorizePlatform(), extractText(), fetchPlatformData(), generateDashboardBrief(), getIntelligenceData(), applyCorrelations() (+4 more)

### Community 41 - "Community 41"
Cohesion: 0.14
Nodes (8): executeGmailMCPAction(), executeMCPAction(), defaultLogger, getCorrelationId(), LogFn, Logger, SearchResult, unifiedSearchAction()

### Community 42 - "Community 42"
Cohesion: 0.13
Nodes (15): IDOR Vulnerability Fix, requireOwnership Check, Account Confusion Vector, Server Actions, auth-guard, AuthProvider, createAdminDb, getAuthenticatedUser (+7 more)

### Community 43 - "Community 43"
Cohesion: 0.29
Nodes (12): AIEnrichment, AIRecommendation, classifyPlatform(), generateEnhancedBriefing(), generateExplanations(), generateRecommendations(), generateSummary(), AIResponseBriefing (+4 more)

### Community 44 - "Community 44"
Cohesion: 0.17
Nodes (11): ProviderHealth, ProviderHealthReport, BRIEFING_CATEGORIES, BriefingCategory, publishEvent(), AIResponseBriefing, BriefingService, calculateNextRun() (+3 more)

### Community 45 - "Community 45"
Cohesion: 0.28
Nodes (13): PlatformType, normalizeEvent(), NormalizerFn, normalizerRegistry, wrapUnknown(), createContact(), extractEmailDomain(), normalizeCalendarEvent() (+5 more)

### Community 46 - "Community 46"
Cohesion: 0.22
Nodes (14): DEFAULT_INTEGRATION_SETTINGS, entityKind, IntegrationSettings, OAuthConfig, UnifiedAttachment, UnifiedBase, UnifiedContact, UnifiedConversation (+6 more)

### Community 48 - "Community 48"
Cohesion: 0.22
Nodes (10): adaptMaxTokens(), createClient(), FALLBACK_MODELS, generateJsonResponse(), generateStreamingCompletion(), StreamChunk, wrapDataContext(), DigestData (+2 more)

### Community 49 - "Community 49"
Cohesion: 0.22
Nodes (4): retry(), syncUserToDatabase(), GET(), UsersRepository

### Community 50 - "Community 50"
Cohesion: 0.19
Nodes (10): maxDuration, checkRateLimit(), createDb(), DEFAULT_CONFIGS, getRateLimitHeaders(), RateLimitConfig, RateLimitResult, TIER_MULTIPLIERS (+2 more)

### Community 51 - "Community 51"
Cohesion: 0.32
Nodes (10): getPref(), NOTIFICATION_CONFIG, NotificationPreferencesPanel(), PrefPanelProps, TIMEZONES, NOTIFICATION_SCHEDULES, NOTIFICATION_TYPES, NotificationPreference (+2 more)

### Community 52 - "Community 52"
Cohesion: 0.26
Nodes (10): ALL_APPS, ALL_CATS, NewScheduleDialog(), NewScheduleDialogProps, getPlatformClass(), ScheduleList(), ScheduleListProps, SchedulesTab() (+2 more)

### Community 53 - "Community 53"
Cohesion: 0.15
Nodes (12): connectIntegrationSchema, deleteIntegrationSchema, disconnectIntegrationSchema, getIntegrationLogsSchema, getIntegrationSchema, integrationSettingsSchema, providerIdSchema, reconnectIntegrationSchema (+4 more)

### Community 54 - "Community 54"
Cohesion: 0.18
Nodes (11): AllProviderId, CONNECTION_STATUSES, ConnectionStatus, IntegrationRow, ProviderId, SYNC_STATUSES, SyncStatus, IntegrationRecord (+3 more)

### Community 55 - "Community 55"
Cohesion: 0.26
Nodes (8): AUTH_CONFIG, getCurrentUserAction(), resendVerificationEmailAction(), sendResetPasswordEmailAction(), verifyEmailAction(), POST(), ForgotPasswordPage(), VerifyEmailForm()

### Community 56 - "Community 56"
Cohesion: 0.36
Nodes (9): signInAction(), signInWithGoogleAction(), signUpAction(), SignIn(), SignUp(), EMAIL_REGEX, PasswordRequirement, validateEmail() (+1 more)

### Community 57 - "Community 57"
Cohesion: 0.25
Nodes (7): exchangeResetPasswordTokenAction(), resetPasswordAction(), ResetPasswordCodeForm(), ResetState, ResetPasswordForm(), ResetState, PASSWORD_REQUIREMENTS

### Community 58 - "Community 58"
Cohesion: 0.31
Nodes (5): POST(), NormalizedEntity, getUnifiedStoreRepo(), UnifiedStoreRepository, telegramWebhookSecret()

### Community 60 - "Community 60"
Cohesion: 0.18
Nodes (4): getKgRepo(), KgEdgeInput, KgNodeInput, KgRepository

### Community 63 - "Community 63"
Cohesion: 0.38
Nodes (9): disconnectTelegramAction(), getHistoryRepo(), getNotificationHistoryAction(), getNotificationPreferencesAction(), getPrefsRepo(), getTelegramConnectionAction(), getTelegramRepo(), updateNotificationPreferenceAction() (+1 more)

### Community 64 - "Community 64"
Cohesion: 0.36
Nodes (9): escapeHtml(), renderDailyBrief(), renderEmailAlert(), renderFollowUp(), renderIntegrationAlert(), renderMeetingReminder(), renderPriorityItems(), renderSystemNotification() (+1 more)

### Community 65 - "Community 65"
Cohesion: 0.33
Nodes (8): formatConnectedDate(), formatLastSyncTime(), PlatformCard(), PlatformCardConnectionDetails, PlatformCardPlatform, PlatformCardProps, renderGitHubIcon(), renderLinkedInIcon()

### Community 68 - "Community 68"
Cohesion: 0.28
Nodes (5): defaultPreferences, getUserPreferences(), store, updateFromFeedback(), UserPreferences

### Community 69 - "Community 69"
Cohesion: 0.22
Nodes (8): background_color, description, display, icons, name, short_name, start_url, theme_color

### Community 70 - "Community 70"
Cohesion: 0.39
Nodes (6): getIntegrationLogs(), formatFull(), IntegrationDrawer(), IntegrationDrawerProps, logDot(), IntegrationSettingsPatch

### Community 71 - "Community 71"
Cohesion: 0.25
Nodes (5): STYLES, ToastContext, ToastContextValue, ToastItem, ToastType

### Community 75 - "Community 75"
Cohesion: 0.79
Nodes (8): Discord Icon, GitHub Icon, GitHub Icon, Gmail Icon, LinkedIn Icon, Slack Icon, Telegram Icon, WhatsApp Icon

### Community 76 - "Community 76"
Cohesion: 0.29
Nodes (7): InsForge Backend, Syncra Project, RLS Public Exposure Fix, Authentication Architecture, AI Agent, Sent.dm Messaging API, Syncra (README)

### Community 77 - "Community 77"
Cohesion: 0.33
Nodes (5): TasksPage(), ExtractedTask, getTasks(), saveTasks(), updateTaskStatus()

### Community 78 - "Community 78"
Cohesion: 0.33
Nodes (4): geistMono, geistSans, metadata, ClientWrapper()

### Community 79 - "Community 79"
Cohesion: 0.29
Nodes (7): Forgot Password Flow, Reset Password Flow, Shared Validation Library, Enumeration Leak, Unified Password Policy, Shared Validation Module, Password Policy Mismatch

### Community 80 - "Community 80"
Cohesion: 0.29
Nodes (4): Listener, listeners, StreamEvent, StreamEventType

### Community 85 - "Community 85"
Cohesion: 0.47
Nodes (3): ProductivityDashboard(), ProductivityDashboardProps, ProductivityMetrics

### Community 86 - "Community 86"
Cohesion: 0.53
Nodes (5): getToolIcon(), MCPSettingsModal(), MCPSettingsModalProps, renderGitHubIcon(), renderLinkedInIcon()

### Community 87 - "Community 87"
Cohesion: 0.33
Nodes (3): BOTTOM_ITEMS, NAV_ITEMS, SidebarProps

### Community 88 - "Community 88"
Cohesion: 0.40
Nodes (5): DrawerProps, formatTime(), NotificationCenterDrawer(), NotificationItem, TYPE_ICONS

### Community 89 - "Community 89"
Cohesion: 0.53
Nodes (4): decideWaCloseAction(), WA_LOGGED_OUT_STATUS, WaCloseAction, cases

### Community 90 - "Community 90"
Cohesion: 0.33
Nodes (6): Bug C - WhatsApp Not-Ready Demotion, Bug D - Slack Scope Surfacing, buildCoverageItems, classifyProviderStatus, filterGroundedItems, Provider Health

### Community 91 - "Community 91"
Cohesion: 0.40
Nodes (4): HealthData, IntegrationHealthCard(), Props, ToolCallRecord

### Community 92 - "Community 92"
Cohesion: 0.50
Nodes (3): ScrollVelocityProps, useElementWidth(), VelocityText()

### Community 94 - "Community 94"
Cohesion: 0.40
Nodes (5): Bug A - GitHub Errors Swallowed, Bug B - LinkedIn Single-Object Count, Briefing Ingest, Ingest Normalization, sync-engine.ts Orchestrator

### Community 95 - "Community 95"
Cohesion: 0.50
Nodes (3): STATUS_CONFIG, StatusConfig, SYNC_STATUS_LABEL

### Community 96 - "Community 96"
Cohesion: 0.50
Nodes (4): Build Job, E2E Auth Smoke Job, Existing Lint Debt, Lint + Typecheck Job

### Community 98 - "Community 98"
Cohesion: 0.50
Nodes (3): csp, nextConfig, withBundleAnalyzer

### Community 106 - "Community 106"
Cohesion: 1.00
Nodes (3): proxy.ts Edge Middleware, updateSession, Middleware Gate Hardening

## Knowledge Gaps
- **394 isolated node(s):** `AUTH_CONFIG`, `ToolCallRecord`, `HealthActivity`, `ConnectionStatus`, `DEFAULT_SYNC_TOOL` (+389 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **51 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `createAdminDb()` connect `Data Export/Health` to `Gmail Connection`, `Briefing Actions`, `Integrations Actions`, `MCP Tools`, `AI Chat`, `Briefings Repository`, `Realtime Client`, `Integrations Center`, `AI Chat Repository`, `Tool Permissions`, `WhatsApp Client`, `Credentials Crypto`, `Sync Engine`, `Community 44`, `Community 48`, `Community 49`, `Community 50`, `Community 55`, `Community 58`, `Community 60`, `Community 63`, `Community 67`, `Community 74`, `Community 77`, `Community 82`, `Community 84`?**
  _High betweenness centrality (0.143) - this node is a cross-community bridge._
- **Why does `react` connect `Notifications UI` to `WhatsApp QR Login`, `Dashboard Pages`?**
  _High betweenness centrality (0.069) - this node is a cross-community bridge._
- **Why does `dependencies` connect `WhatsApp QR Login` to `Notifications UI`, `Dependencies`?**
  _High betweenness centrality (0.065) - this node is a cross-community bridge._
- **What connects `AUTH_CONFIG`, `ToolCallRecord`, `HealthActivity` to the rest of the system?**
  _394 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Gmail Connection` be split into smaller, more focused modules?**
  _Cohesion score 0.0673903211216644 - nodes in this community are weakly interconnected._
- **Should `Dashboard Pages` be split into smaller, more focused modules?**
  _Cohesion score 0.06077694235588972 - nodes in this community are weakly interconnected._
- **Should `Notification Event Handler` be split into smaller, more focused modules?**
  _Cohesion score 0.07205513784461152 - nodes in this community are weakly interconnected._