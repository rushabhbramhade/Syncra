import { MCPTool } from "@/constants/mcp-tools";

export interface IntegrationProfile {
  email: string;
  providerAccountId?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
}

export interface IntegrationProvider {
  id: string;
  name: string;
  scopes: string[];

  // OAuth flow
  getAuthUrl(origin: string, state?: string): string;
  exchangeCode(code: string, origin: string): Promise<AuthTokens>;
  refreshAccess(refreshToken: string): Promise<{ accessToken: string; expiresIn: number }>;
  
  // Profile information
  getProfile(accessToken: string): Promise<IntegrationProfile>;

  // Tool execution
  getTools(): MCPTool[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  executeTool(accessToken: string, toolName: string, args: Record<string, any>): Promise<any>;
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
