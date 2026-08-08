import { IntegrationProvider, AuthTokens, IntegrationProfile, IntegrationRegistry } from "./provider-base";
import { PLATFORM_MCP_TOOLS, MCPTool } from "@/constants/mcp-tools";
import { randomBytes, createHash } from "crypto";
import { fetchWithRetry } from "@/lib/api-retry";

export class SlackApiService {
  private static baseUrl = "https://slack.com/api";

  static generateCodeVerifier(): string {
    return randomBytes(32).toString("base64url");
  }

  static computeCodeChallenge(verifier: string): string {
    const hash = createHash("sha256").update(verifier).digest();
    return hash.toString("base64url");
  }

  static getAuthUrl(clientId: string, redirectUri: string | null, state: string, codeChallenge?: string): string {
    const params = new URLSearchParams({
      client_id: clientId,
      scope: "channels:read,channels:history,chat:write,users:read,team:read,im:read,im:history,groups:read,groups:history,mpim:read,mpim:history",
      state,
    });
    if (redirectUri) {
      params.set("redirect_uri", redirectUri);
    }
    if (codeChallenge) {
      params.set("code_challenge", codeChallenge);
      params.set("code_challenge_method", "S256");
    }
    return `https://slack.com/oauth/v2/authorize?${params.toString()}`;
  }

  static async exchangeCode(code: string, clientId: string, clientSecret: string, redirectUri: string | null, codeVerifier?: string) {
    const params = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
    });
    if (redirectUri) {
      params.set("redirect_uri", redirectUri);
    }
    if (codeVerifier) {
      params.set("code_verifier", codeVerifier);
    }
    const res = await fetchWithRetry(`${this.baseUrl}/oauth.v2.access`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
    if (!res.ok) {
      throw new Error(`Slack OAuth token exchange failed: ${res.statusText}`);
    }
    const data = await res.json();
    if (!data.ok) {
      throw new Error(`Slack OAuth error: ${data.error}`);
    }
    return {
      accessToken: data.access_token as string,
      botUserId: data.bot_user_id as string,
      teamId: (data.team as { id: string })?.id,
      teamName: (data.team as { name: string })?.name,
      authedUserId: (data.authed_user as { id: string })?.id,
      scope: data.scope as string,
    };
  }

  static async getProfile(accessToken: string): Promise<IntegrationProfile> {
    const res = await fetchWithRetry(`${this.baseUrl}/auth.test`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) throw new Error(`Slack auth.test failed: ${res.statusText}`);
    const data = await res.json();
    if (!data.ok) throw new Error(`Slack auth.test error: ${data.error}`);
    return {
      email: data.user_id,
      providerAccountId: data.user_id,
    };
  }

  static async getTeamInfo(accessToken: string): Promise<{ id: string; name: string }> {
    const res = await fetchWithRetry(`${this.baseUrl}/team.info`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) throw new Error(`Slack team.info failed: ${res.statusText}`);
    const data = await res.json();
    if (!data.ok) throw new Error(`Slack team.info error: ${data.error}`);
    return { id: data.team.id, name: data.team.name };
  }

  static async postMessage(accessToken: string, channel: string, text: string): Promise<unknown> {
    const res = await fetchWithRetry(`${this.baseUrl}/chat.postMessage`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ channel, text }),
    });
    if (!res.ok) throw new Error(`Slack chat.postMessage failed: ${res.statusText}`);
    const data = await res.json();
    if (!data.ok) throw new Error(`Slack API error: ${data.error}`);
    return data;
  }

  static async listChannels(accessToken: string): Promise<unknown[]> {
    const res = await fetchWithRetry(`${this.baseUrl}/conversations.list?types=public_channel,private_channel,mpim,im&limit=100`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) throw new Error(`Slack conversations.list failed: ${res.statusText}`);
    const data = await res.json();
    if (!data.ok) {
      const required = "channels:read,channels:history,groups:read,groups:history,im:read,im:history,mpim:read,mpim:history";
      throw new Error(data.error === "missing_scope"
        ? `Slack missing OAuth scopes — reconnect to grant: ${required}`
        : `Slack API error: ${data.error}`);
    }
    return data.channels || [];
  }

  static async fetchMessages(accessToken: string, limit: number = 5): Promise<unknown[]> {
    const channels = await this.listChannels(accessToken);
    if (!channels.length) return [];
    const channelIds = (channels as Array<{ id: string; name: string }>)
      .slice(0, 5)
      .map(c => c.id);
    const allMessages: unknown[] = [];
    const failures: string[] = [];
    for (const channelId of channelIds) {
      try {
        const res = await fetchWithRetry(
          `${this.baseUrl}/conversations.history?channel=${channelId}&limit=${Math.ceil(limit / channelIds.length)}`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        if (!res.ok) {
          failures.push(`${channelId}: HTTP ${res.status}`);
          continue;
        }
        const data = await res.json();
        if (!data.ok) {
          // NEVER swallow a real Slack error. `not_in_channel` means the bot
          // is not a member and must be invited; `missing_scope` means the
          // token lacks history scopes and must be re-authorized. Both are
          // logged so the briefing surfaces the cause instead of a fake
          // "no recent activity".
          failures.push(`${channelId}: ${data.error}`);
          continue;
        }
        if (Array.isArray(data.messages)) {
          allMessages.push(...data.messages.map((m: Record<string, unknown>) => ({
            ...m,
            channel: channelId,
          })));
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        failures.push(`${channelId}: ${msg}`);
      }
    }

    // Every channel failed → this is a real connectivity/permission problem,
    // not "no activity". Surface the first concise cause so the health seat and
    // doctor the diagnosis; the two common ones are the only ones given special
    // human wording. Thrown (not returned empty) so executeMCPAction marks the
    // provider status accordingly (permission_missing → reconnect).
    if (allMessages.length === 0 && failures.length > 0) {
      if (failures.some(f => f.includes("not_in_channel"))) {
        throw new Error(
          `Slack: the Syncra bot is not a member of any channel it can read (not_in_channel). ` +
          `Invite the bot to a channel (e.g. #general) to capture messages.`
        );
      }
      if (failures.some(f => f.includes("missing_scope"))) {
        throw new Error(
          `Slack: token is missing channel history scopes (missing_scope). ` +
          `Reconnect Slack to grant channels:history, im:history, groups:history, mpim:history.`
        );
      }
      throw new Error(`Slack: could not read any message from the connected channels — ${failures[0]}`);
    }

    return allMessages.slice(0, limit);
  }
}

export class SlackProvider implements IntegrationProvider {
  id = "slack";
  name = "Slack";
  tokensExpire = false;
  scopes = [
    "channels:read",
    "channels:history",
    "chat:write",
    "users:read",
    "team:read",
    "im:read",
    "im:history",
    "mpim:read",
    "mpim:history",
    "groups:read",
    "groups:history",
  ];

  private getClientId(): string {
    const id = process.env.SLACK_CLIENT_ID;
    if (!id) throw new Error("SLACK_CLIENT_ID environment variable is not set.");
    return id;
  }

  private getClientSecret(): string {
    const secret = process.env.SLACK_CLIENT_SECRET;
    if (!secret) throw new Error("SLACK_CLIENT_SECRET environment variable is not set.");
    return secret;
  }

  getAuthUrl(origin: string, state?: string): string {
    const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const redirectUri = `${base}/api/slack-callback`;
    return SlackApiService.getAuthUrl(this.getClientId(), redirectUri, state || "");
  }

  async exchangeCode(code: string, _origin: string): Promise<AuthTokens> {
    const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const redirectUri = `${base}/api/slack-callback`;
    const result = await SlackApiService.exchangeCode(code, this.getClientId(), this.getClientSecret(), redirectUri);
    return {
      accessToken: result.accessToken,
      refreshToken: undefined,
      expiresIn: 86400 * 365,
    };
  }

  async refreshAccess(_refreshToken: string): Promise<{ accessToken: string; expiresIn: number }> {
    throw new Error("Slack bot tokens do not expire and cannot be refreshed via OAuth.");
  }

  async getProfile(accessToken: string): Promise<IntegrationProfile> {
    return SlackApiService.getProfile(accessToken);
  }

  async revokeAccess(token: string): Promise<void> {
    const params = new URLSearchParams({ token });
    const res = await fetchWithRetry("https://slack.com/api/auth.revoke", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
    const data = await res.json();
    if (!data.ok) console.warn(`Slack token revocation warning: ${data.error}`);
  }

  getTools(): MCPTool[] {
    return PLATFORM_MCP_TOOLS[this.id] || [];
  }

  async executeTool(accessToken: string, toolName: string, args: Record<string, unknown>): Promise<unknown> {
    switch (toolName) {
      case "slack_post_message":
        return SlackApiService.postMessage(accessToken, args.channel as string, args.text as string);
      case "slack_list_channels":
        return SlackApiService.listChannels(accessToken);
      case "slack_fetch_messages":
        return SlackApiService.fetchMessages(accessToken, (args.limit as number) || 5);
      default:
        throw new Error(`Tool not supported: ${toolName}`);
    }
  }
}

IntegrationRegistry.register(new SlackProvider());
