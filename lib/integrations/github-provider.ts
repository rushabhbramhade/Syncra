import { IntegrationProvider, AuthTokens, IntegrationProfile, IntegrationRegistry } from "./provider-base";
import { PLATFORM_MCP_TOOLS, MCPTool } from "@/constants/mcp-tools";
import { GitHubService } from "@/lib/github/github-service";

export class GitHubProvider implements IntegrationProvider {
  id = "github";
  name = "GitHub";
  scopes = ["public_repo", "read:user", "notifications"];

  private getClientId(): string {
    const id = process.env.GITHUB_CLIENT_ID;
    if (!id) throw new Error("GITHUB_CLIENT_ID environment variable is not set.");
    return id;
  }

  private getClientSecret(): string {
    const secret = process.env.GITHUB_CLIENT_SECRET;
    if (!secret) throw new Error("GITHUB_CLIENT_SECRET environment variable is not set.");
    return secret;
  }

  getAuthUrl(origin: string, state?: string): string {
    const params = new URLSearchParams({
      client_id: this.getClientId(),
      redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/github-callback`,
      state: state || "",
      scope: "public_repo read:user notifications",
    });
    return `https://github.com/login/oauth/authorize?${params.toString()}`;
  }

  async exchangeCode(code: string, _origin: string): Promise<AuthTokens> {
    const result = await GitHubService.exchangeCode(code, this.getClientId(), this.getClientSecret());
    return {
      accessToken: result.accessToken,
      expiresIn: 86400 * 365,
    };
  }

  async refreshAccess(_refreshToken: string): Promise<{ accessToken: string; expiresIn: number }> {
    throw new Error("GitHub OAuth tokens do not expire and cannot be refreshed.");
  }

  async getProfile(accessToken: string): Promise<IntegrationProfile> {
    const profile = await GitHubService.getProfile(accessToken);
    return {
      email: (profile.email as string) || (profile.login as string),
      providerAccountId: String(profile.id),
    };
  }

  async revokeAccess(token: string): Promise<void> {
    await GitHubService.revokeToken(this.getClientId(), this.getClientSecret(), token);
  }

  getTools(): MCPTool[] {
    return PLATFORM_MCP_TOOLS[this.id] || [];
  }

  async executeTool(accessToken: string, toolName: string, args: Record<string, unknown>): Promise<unknown> {
    switch (toolName) {
      case "github_get_profile":
        return GitHubService.getProfile(accessToken);
      case "github_list_repos":
        return GitHubService.listRepos(accessToken);
      case "github_list_issues":
        return GitHubService.listIssues(accessToken);
      case "github_search_issues":
        return GitHubService.searchIssues(accessToken, args.query as string);
      case "github_get_notifications":
        return GitHubService.getNotifications(accessToken);
      default:
        throw new Error(`Tool not supported: ${toolName}`);
    }
  }
}

IntegrationRegistry.register(new GitHubProvider());
