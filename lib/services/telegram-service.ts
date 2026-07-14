const TELEGRAM_API_BASE = "https://api.telegram.org/bot";

interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

interface TelegramChat {
  id: number;
  type: string;
  first_name?: string;
  last_name?: string;
  username?: string;
}

interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from: TelegramUser;
    chat: TelegramChat;
    date: number;
    text?: string;
  };
  my_chat_member?: {
    chat: TelegramChat;
    from: TelegramUser;
    new_chat_member: {
      status: string;
      user: TelegramUser;
    };
  };
}

interface TelegramApiResponse<T> {
  ok: boolean;
  result?: T;
  description?: string;
  error_code?: number;
}

function getBotToken(): string {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN environment variable is not set.");
  }
  return token;
}

async function apiCall<T>(method: string, payload?: Record<string, unknown>): Promise<T> {
  const token = getBotToken();
  const url = `${TELEGRAM_API_BASE}${token}/${method}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload ? JSON.stringify(payload) : undefined,
  });

  const json: TelegramApiResponse<T> = await response.json();

  if (!json.ok) {
    throw new Error(json.description || `Telegram API error (${json.error_code || "unknown"})`);
  }

  return json.result as T;
}

export class TelegramService {
  /**
   * Verify that the user has started the bot by checking for updates.
   * Returns the user's chat info if found, or null if they haven't started the bot yet.
   */
  static async verifyUserStartedBot(userId: string): Promise<{
    verified: boolean;
    chat_id?: number;
    username?: string;
    first_name?: string;
    last_name?: string;
  }> {
    try {
      const updates = await apiCall<TelegramUpdate[]>("getUpdates", {
        timeout: 10,
        allowed_updates: ["message", "my_chat_member"],
      });

      if (!updates || updates.length === 0) {
        return { verified: false };
      }

      for (const update of updates) {
        const chat = update.message?.chat || update.my_chat_member?.chat;
        if (!chat) continue;

        const from = update.message?.from || update.my_chat_member?.from;
        if (!from) continue;

        // Check if the user sent /start
        if (update.message?.text === "/start") {
          return {
            verified: true,
            chat_id: chat.id,
            username: from.username,
            first_name: from.first_name,
            last_name: from.last_name,
          };
        }
      }

      return { verified: false };
    } catch (error) {
      console.error("Telegram verifyUserStartedBot error:", error);
      return { verified: false };
    }
  }

  /**
   * Check if a specific chat ID exists in the user's updates (already started the bot).
   */
  static async checkChatActive(chatId: number): Promise<boolean> {
    try {
      const updates = await apiCall<TelegramUpdate[]>("getUpdates", {
        timeout: 5,
        allowed_updates: ["message"],
      });

      if (!updates) return false;

      return updates.some(
        (u) => u.message?.chat.id === chatId || u.my_chat_member?.chat.id === chatId
      );
    } catch {
      return false;
    }
  }

  /**
   * Send a text message to a Telegram chat.
   */
  static async sendMessage(
    chatId: number | string,
    text: string,
    options?: {
      parse_mode?: "HTML" | "Markdown" | "MarkdownV2";
      disable_notification?: boolean;
      reply_markup?: Record<string, unknown>;
    }
  ): Promise<{ message_id: number }> {
    return apiCall<{ message_id: number }>("sendMessage", {
      chat_id: chatId,
      text,
      parse_mode: options?.parse_mode || "HTML",
      disable_notification: options?.disable_notification ?? false,
      reply_markup: options?.reply_markup,
    });
  }

  /**
   * Send a notification with formatted content. Handles long messages by truncating.
   */
  static async sendNotification(
    chatId: number | string,
    title: string,
    body: string,
    type?: string
  ): Promise<{ message_id: number }> {
    const icon = getNotificationIcon(type || "general");
    const maxLen = 4000;
    const truncated = body.length > maxLen ? body.substring(0, maxLen - 3) + "..." : body;

    const html = [
      `${icon} <b>${escapeHtml(title)}</b>`,
      "",
      truncated,
      "",
      `<i>Syncra Notification</i>`,
    ].join("\n");

    return this.sendMessage(chatId, html, { parse_mode: "HTML" });
  }

  /**
   * Verify a pairing code was set by Telegram and get the Chat ID.
   * This checks if the user sent /start after pressing the bot's "Start" button.
   */
  static async getChatIdAfterStart(expectedUserId: string): Promise<{
    success: boolean;
    chat_id?: number;
    username?: string;
    first_name?: string;
    last_name?: string;
    error?: string;
  }> {
    try {
      // Try up to 3 times with increasing delays
      for (let attempt = 1; attempt <= 3; attempt++) {
        const result = await this.verifyUserStartedBot(expectedUserId);

        if (result.verified && result.chat_id) {
          return {
            success: true,
            chat_id: result.chat_id,
            username: result.username,
            first_name: result.first_name,
            last_name: result.last_name,
          };
        }

        if (attempt < 3) {
          await new Promise((r) => setTimeout(r, attempt * 2000));
        }
      }

      return {
        success: false,
        error: "User has not started the bot yet. Please open Telegram and press 'Start'.",
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return { success: false, error: message };
    }
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function getNotificationIcon(type: string): string {
  const icons: Record<string, string> = {
    daily_ai_brief: "📋",
    priority_items: "⭐",
    important_emails: "📧",
    gmail_summaries: "📨",
    meeting_reminders: "📅",
    follow_ups: "🔄",
    telegram_alerts: "🔔",
    ai_workspace: "🤖",
    dashboard_alerts: "📊",
    system_notifications: "⚙️",
    general: "🔔",
  };
  return icons[type] || icons.general;
}
