const DISCORD_API_BASE = "https://discord.com/api/v10";

export interface DiscordBotInfo {
  id: string;
  username: string;
  discriminator: string;
  avatar: string | null;
}

export class DiscordService {
  static async validateToken(token: string): Promise<DiscordBotInfo> {
    const res = await fetch(`${DISCORD_API_BASE}/users/@me`, {
      headers: { Authorization: `Bot ${token}` },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`Invalid Discord bot token: ${err.message || res.statusText}`);
    }
    const data = await res.json();
    return {
      id: data.id,
      username: data.username,
      discriminator: data.discriminator || "0",
      avatar: data.avatar,
    };
  }

  static async getGuilds(token: string): Promise<unknown[]> {
    const res = await fetch(`${DISCORD_API_BASE}/users/@me/guilds`, {
      headers: { Authorization: `Bot ${token}` },
    });
    if (!res.ok) throw new Error(`Failed to fetch guilds: ${res.statusText}`);
    return res.json();
  }

  static async listChannels(token: string, guildId: string): Promise<unknown[]> {
    const res = await fetch(`${DISCORD_API_BASE}/guilds/${guildId}/channels`, {
      headers: { Authorization: `Bot ${token}` },
    });
    if (!res.ok) throw new Error(`Failed to fetch channels: ${res.statusText}`);
    const channels = await res.json();
    return channels.filter((c: { type: number }) => c.type === 0);
  }

  static async sendMessage(token: string, channelId: string, content: string): Promise<unknown> {
    const res = await fetch(`${DISCORD_API_BASE}/channels/${channelId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bot ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ content }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`Discord sendMessage failed: ${err.message || res.statusText}`);
    }
    return res.json();
  }

  static async fetchMessages(token: string, channelId: string, limit: number = 5): Promise<unknown[]> {
    const res = await fetch(
      `${DISCORD_API_BASE}/channels/${channelId}/messages?limit=${Math.min(limit, 100)}`,
      { headers: { Authorization: `Bot ${token}` } }
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`Discord fetchMessages failed: ${err.message || res.statusText}`);
    }
    return res.json();
  }

  static async fetchRecentMessages(token: string, limitPerChannel: number = 3): Promise<unknown[]> {
    const guilds = await this.getGuilds(token) as Array<{ id: string; name: string }>;
    const results: unknown[] = [];

    for (const guild of guilds) {
      const channels = await this.listChannels(token, guild.id) as Array<{ id: string; name: string }>;
      for (const channel of channels.slice(0, 5)) {
        const messages = await this.fetchMessages(token, channel.id, limitPerChannel);
        for (const msg of messages as Array<{ content: string; author: { username: string }; id: string; timestamp: string }>) {
          results.push({
            guildName: guild.name,
            channelName: channel.name,
            channelId: channel.id,
            author: msg.author?.username || "unknown",
            content: msg.content,
            id: msg.id,
            timestamp: msg.timestamp,
          });
        }
      }
    }

    return results;
  }
}
