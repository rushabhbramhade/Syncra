import { fetchWithRetry } from "@/lib/api-retry";

const LINKEDIN_API_BASE = "https://api.linkedin.com";
const LINKEDIN_OAUTH_BASE = "https://www.linkedin.com/oauth/v2";

export interface LinkedInProfile {
  sub: string;
  name: string;
  given_name: string;
  family_name: string;
  picture: string;
  email: string;
}

export class LinkedInService {
  static async getProfile(accessToken: string): Promise<LinkedInProfile> {
    const res = await fetchWithRetry(`${LINKEDIN_API_BASE}/v2/userinfo`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`LinkedIn profile fetch failed: ${err.error_description || err.message || res.statusText}`);
    }
    return res.json();
  }

  static async getPersonUrn(accessToken: string): Promise<string> {
    const profile = await this.getProfile(accessToken);
    return `urn:li:person:${profile.sub}`;
  }

  static async postUpdate(accessToken: string, text: string, visibility: "PUBLIC" | "CONNECTIONS" = "PUBLIC"): Promise<unknown> {
    const author = await this.getPersonUrn(accessToken);
    const res = await fetchWithRetry(`${LINKEDIN_API_BASE}/rest/posts`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "LinkedIn-Version": "202304",
        "X-Restli-Protocol-Version": "2.0.0",
      },
      body: JSON.stringify({
        author,
        commentary: text,
        visibility,
        distribution: {
          feedDistribution: "MAIN_FEED",
          targetEntities: [],
          thirdPartyDistributionChannels: [],
        },
        lifecycleState: "PUBLISHED",
        isReshareDisabledByAuthor: false,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`LinkedIn post failed: ${err.message || res.statusText}`);
    }
    return res.json();
  }

  static async exchangeCode(code: string, clientId: string, clientSecret: string, redirectUri: string): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
    refreshTokenExpiresIn: number;
    scope: string;
  }> {
    const params = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
    });
    const res = await fetchWithRetry(`${LINKEDIN_OAUTH_BASE}/accessToken`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`LinkedIn token exchange failed: ${err.error_description || err.error || res.statusText}`);
    }
    const data = await res.json();
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
      refreshTokenExpiresIn: data.refresh_token_expires_in,
      scope: data.scope,
    };
  }

  static async refreshToken(refreshToken: string, clientId: string, clientSecret: string): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  }> {
    const params = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    });
    const res = await fetchWithRetry(`${LINKEDIN_OAUTH_BASE}/accessToken`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`LinkedIn token refresh failed: ${err.error_description || err.error || res.statusText}`);
    }
    const data = await res.json();
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
    };
  }

  static async revokeToken(token: string, clientId: string, clientSecret: string): Promise<void> {
    const params = new URLSearchParams({ token, client_id: clientId, client_secret: clientSecret });
    await fetchWithRetry(`${LINKEDIN_OAUTH_BASE}/revoke`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
  }
}
