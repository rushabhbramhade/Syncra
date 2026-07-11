export interface GmailProfile {
  emailAddress: string;
  messagesTotal: number;
  threadsTotal: number;
  historyId: string;
}

export interface GmailEmailSummary {
  id: string;
  threadId: string;
  from: string;
  to: string;
  subject: string;
  date: string;
  snippet: string;
  unread: boolean;
}

export interface GmailEmailDetail {
  id: string;
  threadId: string;
  from: string;
  to: string;
  subject: string;
  date: string;
  body: string;
}

// Convert a base64url string to utf-8 string
function decodeBase64Url(str: string): string {
  if (!str) return "";
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) {
    base64 += "=";
  }
  try {
    return Buffer.from(base64, "base64").toString("utf-8");
  } catch (e) {
    console.error("Failed to decode base64 string:", e);
    return "";
  }
}

// Helper to recursively parse email body from Gmail payload parts
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getEmailBody(part: any): string {
  if (!part) return "";
  
  // If it has plain text body directly
  if (part.mimeType === "text/plain" && part.body && part.body.data) {
    return decodeBase64Url(part.body.data);
  }
  
  // If it has HTML body directly (fallback if no plain text)
  if (part.mimeType === "text/html" && part.body && part.body.data) {
    // Strip basic HTML tags for plain text rendering
    const html = decodeBase64Url(part.body.data);
    return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  }
  
  // Recurse down parts
  if (part.parts && part.parts.length > 0) {
    // Try to find plain text first
    for (const subPart of part.parts) {
      if (subPart.mimeType === "text/plain") {
        const body = getEmailBody(subPart);
        if (body) return body;
      }
    }
    // Fallback to any part
    for (const subPart of part.parts) {
      const body = getEmailBody(subPart);
      if (body) return body;
    }
  }

  // If top-level body has data
  if (part.body && part.body.data) {
    return decodeBase64Url(part.body.data);
  }

  return "";
}

// Extract specific header value
function getHeader(headers: Array<{ name: string; value: string }>, name: string): string {
  if (!headers) return "";
  const header = headers.find(h => h.name.toLowerCase() === name.toLowerCase());
  return header ? header.value : "";
}

export class GmailService {
  private static clientId = process.env.GOOGLE_CLIENT_ID;
  private static clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  public static isConfigured(): boolean {
    return !!(this.clientId && this.clientSecret);
  }

  // Generate Google OAuth authorization URL
  public static getAuthUrl(origin: string, state?: string): string {
    if (!this.isConfigured()) {
      throw new Error("Google OAuth credentials are not configured in environment variables.");
    }
    const redirectUri = `${origin}/api/auth/callback/google`;
    const scopes = [
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/gmail.send",
      "https://www.googleapis.com/auth/gmail.modify",
    ];

    const params: Record<string, string> = {
      client_id: this.clientId!,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: scopes.join(" "),
      access_type: "offline",
      prompt: "consent",
    };

    if (state) {
      params.state = state;
    }

    const searchParams = new URLSearchParams(params);
    return `https://accounts.google.com/o/oauth2/v2/auth?${searchParams.toString()}`;
  }

  // Exchange auth code for tokens
  public static async exchangeCode(code: string, origin: string): Promise<{
    access_token: string;
    refresh_token: string;
    expires_in: number;
  }> {
    if (!this.isConfigured()) {
      throw new Error("Google OAuth credentials are not configured.");
    }
    const redirectUri = `${origin}/api/auth/callback/google`;

    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: this.clientId!,
        client_secret: this.clientSecret!,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Failed to exchange authorization code: ${errText}`);
    }

    return response.json();
  }

  // Refresh access token
  public static async refreshAccessToken(refreshToken: string): Promise<{
    access_token: string;
    expires_in: number;
  }> {
    if (!this.isConfigured()) {
      throw new Error("Google OAuth credentials are not configured.");
    }

    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: this.clientId!,
        client_secret: this.clientSecret!,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Failed to refresh Google access token: ${errText}`);
    }

    return response.json();
  }

  // Fetch connected user profile to get email address
  public static async getProfile(accessToken: string): Promise<GmailProfile> {
    const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/profile", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch Gmail profile: ${response.statusText}`);
    }

    return response.json();
  }

  // Revoke refresh token when disconnecting
  public static async revokeToken(token: string): Promise<void> {
    try {
      await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });
    } catch (e) {
      console.error("Token revocation error:", e);
    }
  }

  // MCP actions: Search/List Emails
  public static async searchEmails(
    accessToken: string,
    query = "is:unread",
    limit = 10
  ): Promise<GmailEmailSummary[]> {
    const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=${limit}`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      throw new Error(`Failed to list messages from Gmail: ${response.statusText}`);
    }

    const data = await response.json();
    if (!data.messages || data.messages.length === 0) {
      return [];
    }

    const emailSummaries: GmailEmailSummary[] = [];

    // Fetch individual email details concurrently
    await Promise.all(
      data.messages.map(async (msg: { id: string; threadId: string }) => {
        try {
          const detailUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date`;
          const detailRes = await fetch(detailUrl, {
            headers: { Authorization: `Bearer ${accessToken}` },
          });

          if (detailRes.ok) {
            const detail = await detailRes.json();
            const headers = detail.payload?.headers || [];
            
            const from = getHeader(headers, "From") || "Unknown Sender";
            const to = getHeader(headers, "To") || "me";
            const subject = getHeader(headers, "Subject") || "(No Subject)";
            const dateStr = getHeader(headers, "Date") || "";
            
            let formattedDate = dateStr;
            try {
              const d = new Date(dateStr);
              if (!isNaN(d.getTime())) {
                const now = new Date();
                if (d.toDateString() === now.toDateString()) {
                  formattedDate = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                } else {
                  formattedDate = d.toLocaleDateString([], { month: 'short', day: 'numeric' });
                }
              }
            } catch {}

            emailSummaries.push({
              id: detail.id,
              threadId: detail.threadId,
              from,
              to,
              subject,
              date: formattedDate,
              snippet: detail.snippet || "",
              unread: detail.labelIds?.includes("UNREAD") || false,
            });
          }
        } catch (e) {
          console.error(`Failed to fetch headers for message ${msg.id}:`, e);
        }
      })
    );

    // Sort by date/id descending (real inbox order)
    return emailSummaries.sort((a, b) => b.id.localeCompare(a.id));
  }

  // MCP actions: Get Email details
  public static async getEmail(accessToken: string, messageId: string): Promise<GmailEmailDetail> {
    const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch message details: ${response.statusText}`);
    }

    const data = await response.json();
    const headers = data.payload?.headers || [];
    
    const from = getHeader(headers, "From") || "Unknown Sender";
    const to = getHeader(headers, "To") || "me";
    const subject = getHeader(headers, "Subject") || "(No Subject)";
    const date = getHeader(headers, "Date") || "";

    const body = getEmailBody(data.payload);

    return {
      id: data.id,
      threadId: data.threadId,
      from,
      to,
      subject,
      date: new Date(date).toLocaleString(),
      body: body || data.snippet || "(No Body Content)",
    };
  }

  // MCP actions: Send / Reply to Email
  public static async sendEmail(
    accessToken: string,
    to: string,
    subject: string,
    body: string,
    threadId?: string
  ): Promise<{ status: string; messageId: string }> {
    const emailLines = [
      `To: ${to}`,
      `Subject: ${subject}`,
      "Content-Type: text/plain; charset=utf-8",
      "MIME-Version: 1.0",
    ];

    if (threadId) {
      emailLines.push(`In-Reply-To: ${threadId}`);
      emailLines.push(`References: ${threadId}`);
    }

    emailLines.push("");
    emailLines.push(body);

    const emailMime = emailLines.join("\r\n");
    const raw = Buffer.from(emailMime).toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    const url = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        raw,
        threadId,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Failed to send email via Gmail API: ${errText}`);
    }

    const data = await response.json();
    return {
      status: "success",
      messageId: data.id,
    };
  }

  // MCP actions: Modify Labels (Archive, Mark Read, Mark Unread)
  public static async modifyLabels(
    accessToken: string,
    messageId: string,
    addLabelIds: string[],
    removeLabelIds: string[]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): Promise<any> {
    const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/modify`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        addLabelIds,
        removeLabelIds,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to modify labels: ${response.statusText}`);
    }

    return response.json();
  }

  // MCP actions: List Labels
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public static async getLabels(accessToken: string): Promise<any> {
    const url = "https://gmail.googleapis.com/gmail/v1/users/me/labels";
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch labels: ${response.statusText}`);
    }

    return response.json();
  }

  // MCP actions: Delete message
  public static async deleteMessage(accessToken: string, messageId: string): Promise<void> {
    const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/trash`;
    const response = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      throw new Error(`Failed to trash message: ${response.statusText}`);
    }
  }
}
