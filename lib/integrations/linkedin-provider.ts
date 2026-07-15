import { IntegrationProvider, AuthTokens, IntegrationProfile, IntegrationRegistry } from "./provider-base";
import { PLATFORM_MCP_TOOLS, MCPTool } from "@/constants/mcp-tools";
import { LinkedInService } from "@/lib/linkedin/linkedin-service";

export class LinkedInProvider implements IntegrationProvider {
  id = "linkedin";
  name = "LinkedIn";
  scopes = ["openid", "profile", "email", "w_member_social"];

  private getClientId(): string {
    const id = process.env.LINKEDIN_CLIENT_ID;
    if (!id) throw new Error("LINKEDIN_CLIENT_ID environment variable is not set.");
    return id;
  }

  private getClientSecret(): string {
    const secret = process.env.LINKEDIN_CLIENT_SECRET;
    if (!secret) throw new Error("LINKEDIN_CLIENT_SECRET environment variable is not set.");
    return secret;
  }

  getAuthUrl(origin: string, state?: string): string {
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/linkedin-callback`;
    const params = new URLSearchParams({
      response_type: "code",
      client_id: this.getClientId(),
      redirect_uri: redirectUri,
      state: state || "",
      scope: "openid profile email w_member_social",
    });
    return `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`;
  }

  async exchangeCode(code: string, origin: string): Promise<AuthTokens> {
    const redirectUri = `${origin}/api/linkedin-callback`;
    const result = await LinkedInService.exchangeCode(code, this.getClientId(), this.getClientSecret(), redirectUri);
    return {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      expiresIn: result.expiresIn,
    };
  }

  async refreshAccess(refreshToken: string): Promise<{ accessToken: string; expiresIn: number }> {
    const result = await LinkedInService.refreshToken(refreshToken, this.getClientId(), this.getClientSecret());
    return {
      accessToken: result.accessToken,
      expiresIn: result.expiresIn,
    };
  }

  async getProfile(accessToken: string): Promise<IntegrationProfile> {
    const profile = await LinkedInService.getProfile(accessToken);
    return {
      email: profile.email || `${profile.sub}@linkedin.com`,
      providerAccountId: profile.sub,
    };
  }

  async revokeAccess(token: string): Promise<void> {
    await LinkedInService.revokeToken(token);
  }

  getTools(): MCPTool[] {
    return PLATFORM_MCP_TOOLS[this.id] || [];
  }

  async executeTool(accessToken: string, toolName: string, args: Record<string, unknown>): Promise<unknown> {
    switch (toolName) {
      case "linkedin_get_profile":
        return LinkedInService.getProfile(accessToken);
      case "linkedin_post_update":
        return LinkedInService.postUpdate(
          accessToken,
          args.text as string,
          (args.visibility as "PUBLIC" | "CONNECTIONS") || "PUBLIC"
        );
      default:
        throw new Error(`Tool not supported: ${toolName}`);
    }
  }
}

IntegrationRegistry.register(new LinkedInProvider());
