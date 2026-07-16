import { createAdminDb } from "@/lib/db";

export class IntegrationScopesRepository {
  private db() { return createAdminDb(); }

  async setSlackChannels(userId: string, channelIds: string[]): Promise<void> {
    await this.db().database.from("integration_scopes").delete().eq("user_id", userId).eq("provider", "slack");
    for (const channelId of channelIds) {
      await this.db().database.from("integration_scopes").insert({
        user_id: userId,
        provider: "slack",
        scope_type: "channel",
        scope_value: channelId,
      });
    }
  }

  async getSlackChannels(userId: string): Promise<string[]> {
    const { data } = await this.db().database
      .from("integration_scopes")
      .select("scope_value")
      .eq("user_id", userId)
      .eq("provider", "slack")
      .eq("scope_type", "channel");
    return (data || []).map((r: any) => r.scope_value);
  }

  async setGitHubRepos(userId: string, repos: string[]): Promise<void> {
    await this.db().database.from("integration_scopes").delete().eq("user_id", userId).eq("provider", "github");
    for (const repo of repos) {
      await this.db().database.from("integration_scopes").insert({
        user_id: userId,
        provider: "github",
        scope_type: "repo",
        scope_value: repo,
      });
    }
  }

  async getGitHubRepos(userId: string): Promise<string[]> {
    const { data } = await this.db().database
      .from("integration_scopes")
      .select("scope_value")
      .eq("user_id", userId)
      .eq("provider", "github")
      .eq("scope_type", "repo");
    return (data || []).map((r: any) => r.scope_value);
  }
}
