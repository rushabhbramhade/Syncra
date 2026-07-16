import { IntegrationProvider, AuthTokens, IntegrationProfile, IntegrationRegistry } from "./provider-base";
import { PLATFORM_MCP_TOOLS, MCPTool } from "@/constants/mcp-tools";

const NOTION_API = "https://api.notion.com/v1";

async function notionFetch(path: string, token: string, init?: RequestInit) {
  const { fetchWithRetry } = await import("@/lib/api-retry");
  return fetchWithRetry(`${NOTION_API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Notion-Version": "2022-06-28", "Content-Type": "application/json", ...init?.headers },
  });
}

export class NotionProvider implements IntegrationProvider {
  id = "notion";
  name = "Notion";
  scopes: string[] = [];

  getAuthUrl(_origin: string, _state?: string): string {
    const clientId = process.env.NOTION_CLIENT_ID || "";
    return `https://api.notion.com/v1/oauth/authorize?client_id=${clientId}&response_type=code&owner=user`;
  }

  async exchangeCode(code: string, _origin: string): Promise<AuthTokens> {
    const res = await fetch("https://api.notion.com/v1/oauth/token", {
      method: "POST",
      headers: { Authorization: `Basic ${Buffer.from(`${process.env.NOTION_CLIENT_ID}:${process.env.NOTION_CLIENT_SECRET}`).toString("base64")}`, "Content-Type": "application/json" },
      body: JSON.stringify({ code, grant_type: "authorization_code" }),
    });
    const data = await res.json();
    return { accessToken: data.access_token, expiresIn: 86400 * 365 };
  }

  async refreshAccess(_refreshToken: string): Promise<{ accessToken: string; expiresIn: number }> {
    throw new Error("Notion tokens do not expire and cannot be refreshed via OAuth.");
  }

  async getProfile(accessToken: string): Promise<IntegrationProfile> {
    const res = await notionFetch("/users/me", accessToken);
    const data = await res.json();
    return { email: data.id, providerAccountId: data.id };
  }

  getTools(): MCPTool[] { return PLATFORM_MCP_TOOLS[this.id] || []; }

  async executeTool(accessToken: string, toolName: string, args: Record<string, unknown>): Promise<unknown> {
    switch (toolName) {
      case "notion_search": {
        const res = await notionFetch("/search", accessToken, {
          method: "POST",
          body: JSON.stringify({ query: args.query as string }),
        });
        return res.json();
      }
      case "notion_get_page": {
        const res = await notionFetch(`/pages/${args.pageId}`, accessToken);
        const page = await res.json();
        const blocksRes = await notionFetch(`/blocks/${args.pageId}/children`, accessToken);
        const blocks = await blocksRes.json();
        return { page, blocks };
      }
      default:
        throw new Error(`Tool not supported: ${toolName}`);
    }
  }
}

IntegrationRegistry.register(new NotionProvider());
