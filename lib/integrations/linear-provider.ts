import { IntegrationProvider, AuthTokens, IntegrationProfile, IntegrationRegistry } from "./provider-base";
import { PLATFORM_MCP_TOOLS, MCPTool } from "@/constants/mcp-tools";
import { fetchWithRetry } from "@/lib/api-retry";

const LINEAR_API = "https://api.linear.app/graphql";

async function linearQuery(token: string, query: string, variables?: Record<string, unknown>) {
  const res = await fetchWithRetry(LINEAR_API, {
    method: "POST",
    headers: { Authorization: token, "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  return res.json();
}

export class LinearProvider implements IntegrationProvider {
  id = "linear";
  name = "Linear";
  scopes: string[] = [];

  getAuthUrl(origin: string, state?: string): string {
    const clientId = process.env.LINEAR_CLIENT_ID || "";
    const redirectUri = `${origin}/api/linear-callback`;
    return `https://linear.app/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state || ""}&scope=read`;
  }

  async exchangeCode(code: string, origin: string): Promise<AuthTokens> {
    const redirectUri = `${origin}/api/linear-callback`;
    const res = await fetchWithRetry("https://api.linear.app/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ code, client_id: process.env.LINEAR_CLIENT_ID!, client_secret: process.env.LINEAR_CLIENT_SECRET!, redirect_uri: redirectUri, grant_type: "authorization_code" }),
    });
    const data = await res.json();
    return { accessToken: data.access_token, expiresIn: data.expires_in || 86400 * 365 };
  }

  async refreshAccess(_refreshToken: string): Promise<{ accessToken: string; expiresIn: number }> {
    throw new Error("Linear OAuth tokens require re-authorization.");
  }

  async getProfile(accessToken: string): Promise<IntegrationProfile> {
    const data = await linearQuery(accessToken, `{ viewer { id name email } }`);
    return { email: data.data?.viewer?.email || data.data?.viewer?.id, providerAccountId: data.data?.viewer?.id };
  }

  getTools(): MCPTool[] { return PLATFORM_MCP_TOOLS[this.id] || []; }

  async executeTool(accessToken: string, toolName: string, args: Record<string, unknown>): Promise<unknown> {
    switch (toolName) {
      case "linear_list_issues": {
        const data = await linearQuery(accessToken, `{ issues(first: ${(args.limit as number) || 20}) { nodes { id title description priority state { name } createdAt } } }`);
        return data.data?.issues?.nodes || [];
      }
      case "linear_get_issue": {
        const data = await linearQuery(accessToken, `{ issue(id: "${args.issueId}") { id title description priority state { name } assignee { name } createdAt } }`);
        return data.data?.issue || null;
      }
      default:
        throw new Error(`Tool not supported: ${toolName}`);
    }
  }
}

IntegrationRegistry.register(new LinearProvider());
