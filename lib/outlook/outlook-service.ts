import { fetchWithRetry } from "@/lib/api-retry";

const GRAPH_BASE = "https://graph.microsoft.com/v1.0";

export class OutlookService {
  static async getAuthUrl(clientId: string, redirectUri: string, state: string): Promise<string> {
    const params = new URLSearchParams({
      client_id: clientId,
      response_type: "code",
      redirect_uri: redirectUri,
      state,
      scope: "Mail.Read Mail.Send User.Read",
    });
    return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params}`;
  }

  static async exchangeCode(code: string, clientId: string, clientSecret: string, redirectUri: string) {
    const res = await fetchWithRetry("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, code, redirect_uri: redirectUri, grant_type: "authorization_code" }),
    });
    return res.json();
  }

  static async refreshAccessToken(refreshToken: string, clientId: string, clientSecret: string) {
    const res = await fetchWithRetry("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: "refresh_token" }),
    });
    return res.json();
  }

  static async getProfile(accessToken: string) {
    const res = await fetchWithRetry(`${GRAPH_BASE}/me`, { headers: { Authorization: `Bearer ${accessToken}` } });
    return res.json();
  }

  static async searchEmails(accessToken: string, query: string, limit: number = 10) {
    const res = await fetchWithRetry(`${GRAPH_BASE}/me/messages?$search="${encodeURIComponent(query)}"&$top=${limit}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return res.json();
  }

  static async sendEmail(accessToken: string, to: string, subject: string, body: string) {
    const res = await fetchWithRetry(`${GRAPH_BASE}/me/sendMail`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        message: {
          subject,
          body: { contentType: "Text", content: body },
          toRecipients: [{ emailAddress: { address: to } }],
        },
      }),
    });
    return res.json();
  }
}
