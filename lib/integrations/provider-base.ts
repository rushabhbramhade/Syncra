import { MCPTool } from "@/constants/mcp-tools";
import type {
  AuthTokens,
  IntegrationProfile,
  NormalizedEntity,
  Snapshot,
  SyncContext,
  SyncResult,
} from "./types";
import type { CapabilityId } from "./constants";

export type { AuthTokens, IntegrationProfile };

export interface IntegrationProvider {
  id: string;
  name: string;
  scopes: string[];

  // Whether this provider issues expiring access tokens that need refreshing.
  // Providers with non-expiring tokens (e.g. GitHub) are skipped by the
  // hourly token-expiry maintenance job instead of being marked "expired".
  tokensExpire?: boolean;

  // OAuth flow
  getAuthUrl(origin: string, state?: string): string;
  exchangeCode(code: string, origin: string): Promise<AuthTokens>;
  refreshAccess(refreshToken: string): Promise<{ accessToken: string; expiresIn: number }>;

  // Profile information
  getProfile(accessToken: string): Promise<IntegrationProfile>;

  // Tool execution
  getTools(): MCPTool[];
  executeTool(accessToken: string, toolName: string, args: Record<string, unknown>): Promise<unknown>;

  // ─── Optional: capability system (Phase 0+, architecture §9) ──────────────
  // Declared capabilities. Defaults to a registry lookup when absent; providers
  // can override to declare capabilities beyond the static catalog.
  capabilities?: CapabilityId[];

  // ─── Optional: sync pipeline hooks (Phase 5+, architecture §7) ────────────
  // Inline snapshot fetched right after OAuth exchange (≤1s budget). When
  // absent, metadata sync runs entirely in the background.
  snapshot?(ctx: SyncContext): Promise<Snapshot>;
  // Paginated delta syncs, cursor in/out. Orchestrated by the shared sync
  // engine — never call these directly from request handlers.
  syncMetadata?(ctx: SyncContext): Promise<SyncResult>;
  syncIncremental?(ctx: SyncContext): Promise<SyncResult>;

  // ─── Optional: normalization (Phase 6, architecture §8) ───────────────────
  // Provider payload → unified entity. Providers that don't implement these
  // rely on the default identity normalizer (raw payload passthrough).
  normalize?(raw: unknown): NormalizedEntity;

  // ─── Optional: webhook verification (Phase 8, architecture §14) ───────────
  verifyWebhook?(headers: Headers, rawBody: string): boolean;
  parseWebhookEvent?(raw: unknown): unknown;
}

class ProviderRegistry {
  private providers = new Map<string, IntegrationProvider>();

  register(provider: IntegrationProvider) {
    this.providers.set(provider.id, provider);
  }

  get(id: string): IntegrationProvider | null {
    return this.providers.get(id) || null;
  }

  list(): IntegrationProvider[] {
    return Array.from(this.providers.values());
  }
}

export const IntegrationRegistry = new ProviderRegistry();
