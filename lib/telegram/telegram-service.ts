const TELEGRAM_API_BASE = "https://api.telegram.org";

export interface TelegramBotInfo {
  id: number;
  username: string;
  first_name: string;
}

export class TelegramService {
  static async validateToken(token: string): Promise<TelegramBotInfo> {
    const res = await fetch(`${TELEGRAM_API_BASE}/bot${token}/getMe`);
    const data = await res.json();
    if (!data.ok) {
      throw new Error(`Invalid Telegram bot token: ${data.description || "unknown error"}`);
    }
    return data.result as TelegramBotInfo;
  }

  static async sendMessage(token: string, chatId: string, text: string): Promise<unknown> {
    const res = await fetch(`${TELEGRAM_API_BASE}/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
    const data = await res.json();
    if (!data.ok) {
      throw new Error(`Telegram sendMessage failed: ${data.description || "unknown error"}`);
    }
    return data.result;
  }

  static async getUpdates(token: string, limit: number = 5, timeout: number = 0): Promise<unknown[]> {
    const params = new URLSearchParams({
      limit: String(limit),
      allowed_updates: JSON.stringify(["message"]),
    });
    if (timeout > 0) {
      params.set("timeout", String(timeout));
    }
    const res = await fetch(`${TELEGRAM_API_BASE}/bot${token}/getUpdates?${params}`);
    const data = await res.json();
    if (!data.ok) {
      throw new Error(`Telegram getUpdates failed: ${data.description || "unknown error"}`);
    }
    const updates = data.result || [];
    if (!updates.length) return [];

    const offset = Math.max(...updates.map((u: { update_id: number }) => u.update_id)) + 1;
    await fetch(`${TELEGRAM_API_BASE}/bot${token}/getUpdates?offset=${offset}`);
    return updates.map((u: Record<string, unknown>) => ({
      ...(u.message as Record<string, unknown>),
      update_id: u.update_id,
    }));
  }

  static async setWebhook(token: string, url: string): Promise<void> {
    const res = await fetch(`${TELEGRAM_API_BASE}/bot${token}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    const data = await res.json();
    if (!data.ok) {
      throw new Error(`Telegram setWebhook failed: ${data.description || "unknown error"}`);
    }
  }

  static async deleteWebhook(token: string): Promise<void> {
    const res = await fetch(`${TELEGRAM_API_BASE}/bot${token}/deleteWebhook`, {
      method: "POST",
    });
    const data = await res.json();
    if (!data.ok) {
      throw new Error(`Telegram deleteWebhook failed: ${data.description || "unknown error"}`);
    }
  }

  static async getWebhookInfo(token: string): Promise<{ url: string; has_custom_certificate: boolean; pending_update_count: number }> {
    const res = await fetch(`${TELEGRAM_API_BASE}/bot${token}/getWebhookInfo`);
    const data = await res.json();
    if (!data.ok) throw new Error(`Telegram getWebhookInfo failed: ${data.description || "unknown error"}`);
    return data.result;
  }
}
