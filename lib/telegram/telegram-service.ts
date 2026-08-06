import { createHmac } from "crypto";
import { fetchWithRetry } from "@/lib/api-retry";

const TELEGRAM_API_BASE = "https://api.telegram.org";

/**
 * Derive the per-connection webhook secret sent to Telegram as secret_token.
 * Deterministic: the route recomputes it from the stored bot token + userId.
 */
export function telegramWebhookSecret(botToken: string, userId: string): string {
  return createHmac("sha256", botToken).update(`syncra-telegram-webhook:${userId}`).digest("hex");
}

export interface TelegramBotInfo {
  id: number;
  username: string;
  first_name: string;
}

export class TelegramService {
  static async validateToken(token: string): Promise<TelegramBotInfo> {
    const res = await fetchWithRetry(`${TELEGRAM_API_BASE}/bot${token}/getMe`);
    const data = await res.json();
    if (!data.ok) {
      throw new Error(`Invalid Telegram bot token: ${data.description || "unknown error"}`);
    }
    return data.result as TelegramBotInfo;
  }

  static async sendMessage(token: string, chatId: string, text: string): Promise<unknown> {
    const res = await fetchWithRetry(`${TELEGRAM_API_BASE}/bot${token}/sendMessage`, {
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
    const res = await fetchWithRetry(`${TELEGRAM_API_BASE}/bot${token}/getUpdates?${params}`);
    const data = await res.json();
    // getUpdates conflicts with an active webhook (Telegram returns 409
    // "Conflict: terminated by other getUpdates request"). In that mode the
    // webhook route already persists messages to unified_messages — treat it
    // as "no pending updates" instead of an error.
    if (!data.ok && /conflict|terminated by other getUpdates/i.test(data.description || "")) {
      return [];
    }
    if (!data.ok) {
      throw new Error(`Telegram getUpdates failed: ${data.description || "unknown error"}`);
    }
    const updates = data.result || [];
    if (!updates.length) return [];

    const offset = Math.max(...updates.map((u: { update_id: number }) => u.update_id)) + 1;
    await fetchWithRetry(`${TELEGRAM_API_BASE}/bot${token}/getUpdates?offset=${offset}`);
    return updates.map((u: Record<string, unknown>) => ({
      ...(u.message as Record<string, unknown>),
      update_id: u.update_id,
    }));
  }

  static async setWebhook(token: string, url: string, secretToken?: string): Promise<void> {
    const res = await fetchWithRetry(`${TELEGRAM_API_BASE}/bot${token}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, ...(secretToken ? { secret_token: secretToken } : {}) }),
    });
    const data = await res.json();
    if (!data.ok) {
      throw new Error(`Telegram setWebhook failed: ${data.description || "unknown error"}`);
    }
  }

  static async deleteWebhook(token: string): Promise<void> {
    const res = await fetchWithRetry(`${TELEGRAM_API_BASE}/bot${token}/deleteWebhook`, {
      method: "POST",
    });
    const data = await res.json();
    if (!data.ok) {
      throw new Error(`Telegram deleteWebhook failed: ${data.description || "unknown error"}`);
    }
  }

  static async getWebhookInfo(token: string): Promise<{ url: string; has_custom_certificate: boolean; pending_update_count: number }> {
    const res = await fetchWithRetry(`${TELEGRAM_API_BASE}/bot${token}/getWebhookInfo`);
    const data = await res.json();
    if (!data.ok) throw new Error(`Telegram getWebhookInfo failed: ${data.description || "unknown error"}`);
    return data.result;
  }
}
