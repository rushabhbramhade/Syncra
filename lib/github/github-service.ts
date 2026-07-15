const GITHUB_API_BASE = "https://api.github.com";
const GITHUB_OAUTH_BASE = "https://github.com/login/oauth";
const API_VERSION = "2022-11-28";

interface RateLimitState {
  remaining: number;
  resetAt: number;
}

let searchRateLimit: RateLimitState = { remaining: 30, resetAt: 0 };

function apiHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": API_VERSION,
  };
}

async function parseLinkHeader(res: Response): Promise<{ next?: string; last?: string }> {
  const link = res.headers.get("link");
  if (!link) return {};
  const links: Record<string, string> = {};
  for (const part of link.split(",")) {
    const match = part.match(/<([^>]+)>;\s*rel="([^"]+)"/);
    if (match) links[match[2]] = match[1];
  }
  return links;
}

async function fetchAllPages(url: string, token: string, perPage: number = 100): Promise<unknown[]> {
  const separator = url.includes("?") ? "&" : "?";
  let currentUrl = `${url}${separator}per_page=${perPage}`;
  const allResults: unknown[] = [];

  while (currentUrl) {
    const res = await fetch(currentUrl, { headers: apiHeaders(token) });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`GitHub API error: ${err.message || res.statusText}`);
    }
    const data = await res.json();
    if (Array.isArray(data)) allResults.push(...data);

    const links = await parseLinkHeader(res);
    currentUrl = links.next || "";
  }

  return allResults;
}

export class GitHubService {
  static async getProfile(token: string): Promise<Record<string, unknown>> {
    const res = await fetch(`${GITHUB_API_BASE}/user`, { headers: apiHeaders(token) });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`GitHub profile fetch failed: ${err.message || res.statusText}`);
    }
    return res.json();
  }

  static async listRepos(token: string): Promise<unknown[]> {
    return fetchAllPages(`${GITHUB_API_BASE}/user/repos?sort=updated`, token, 100);
  }

  static async listIssues(token: string): Promise<unknown[]> {
    return fetchAllPages(`${GITHUB_API_BASE}/issues?filter=all&state=open`, token, 100);
  }

  static async searchIssues(token: string, query: string): Promise<{ items: unknown[]; total_count: number }> {
    // Search API has its own rate limit (~30 req/min). Space requests.
    const now = Date.now();
    if (searchRateLimit.remaining <= 1 && now < searchRateLimit.resetAt) {
      const waitMs = searchRateLimit.resetAt - now + 500;
      await new Promise(r => setTimeout(r, waitMs));
    }

    const res = await fetch(
      `${GITHUB_API_BASE}/search/issues?q=${encodeURIComponent(query)}&per_page=30`,
      { headers: apiHeaders(token) }
    );

    // Track search rate limit
    const remaining = res.headers.get("x-ratelimit-remaining");
    const resetAt = res.headers.get("x-ratelimit-reset");
    if (remaining) searchRateLimit.remaining = parseInt(remaining, 10);
    if (resetAt) searchRateLimit.resetAt = parseInt(resetAt, 10) * 1000;

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`GitHub search failed: ${err.message || res.statusText}`);
    }
    const data = await res.json();
    return { items: data.items || [], total_count: data.total_count || 0 };
  }

  static async getNotifications(token: string): Promise<unknown[]> {
    return fetchAllPages(`${GITHUB_API_BASE}/notifications`, token, 100);
  }

  static async commentOnIssue(token: string, repo: string, issueNumber: number, body: string): Promise<unknown> {
    const res = await fetch(`${GITHUB_API_BASE}/repos/${repo}/issues/${issueNumber}/comments`, {
      method: "POST",
      headers: { ...apiHeaders(token), "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`GitHub comment failed: ${err.message || res.statusText}`);
    }
    return res.json();
  }

  static async exchangeCode(code: string, clientId: string, clientSecret: string): Promise<{
    accessToken: string;
    scope: string;
  }> {
    const res = await fetch(`${GITHUB_OAUTH_BASE}/access_token`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
      }),
    });
    if (!res.ok) throw new Error(`GitHub token exchange failed: ${res.statusText}`);
    const data = await res.json();
    if (data.error) throw new Error(`GitHub OAuth error: ${data.error_description || data.error}`);
    return { accessToken: data.access_token, scope: data.scope };
  }

  static async revokeToken(clientId: string, token: string): Promise<void> {
    await fetch(`${GITHUB_API_BASE}/applications/${clientId}/token`, {
      method: "DELETE",
      headers: {
        Authorization: `Basic ${Buffer.from(`${clientId}:`).toString("base64")}`,
        Accept: "application/vnd.github+json",
      },
      body: JSON.stringify({ access_token: token }),
    });
  }
}
