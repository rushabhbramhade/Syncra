import { fetchWithRetry } from "@/lib/api-retry";

const GITHUB_API_BASE = "https://api.github.com";
const GITHUB_OAUTH_BASE = "https://github.com/login/oauth";
const API_VERSION = "2022-11-28";

interface RateLimitState {
  remaining: number;
  resetAt: number;
}

const searchRateLimit: RateLimitState = { remaining: 30, resetAt: 0 };

// Minimal shapes for the recent-activity fetch (fields we actually read).
interface GitHubUser {
  login?: string;
}
interface GitHubRepo {
  full_name?: string;
  name?: string;
  pushed_at?: string | null;
}
interface GitHubCommit {
  sha?: string;
  html_url?: string | null;
  commit?: {
    message?: string;
    author?: { name?: string; date?: string };
    committer?: { date?: string };
  };
}

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
    const res = await fetchWithRetry(currentUrl, { headers: apiHeaders(token) });
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
    const res = await fetchWithRetry(`${GITHUB_API_BASE}/user`, { headers: apiHeaders(token) });
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

    const res = await fetchWithRetry(
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

  /**
   * Recent REAL activity for the authenticated user, sourced from the actual
   * repositories they own: latest commits (and their push context) on the most
   * recently-pushed repos. This is the fix for GitHub reporting "no recent
   * activity" while the user actively pushes code: issues + notifications can
   * both legitimately be empty, but commits are the user's ground truth.
   *
   * Returns a flat list of commit-shaped records ({ sha, repo, message, date,
   * url, author }) newest-first, capped at `limit`. Uses `public_repo` scope, no
   * extra OAuth consent needed.
   */
  static async getRecentActivity(token: string, limit = 24): Promise<unknown[]> {
    const profile = (await this.getProfile(token)) as GitHubUser;
    const login = String(profile.login || "");
    if (!login) return [];

    const repos = (await this.listRepos(token)) as GitHubRepo[];
    const recentRepos = [...repos]
      .sort((a, b) => new Date(b.pushed_at || 0).getTime() - new Date(a.pushed_at || 0).getTime())
      .slice(0, 8);

    const out: Array<Record<string, unknown>> = [];
    await Promise.all(
      recentRepos.map(async (repo) => {
        const name = repo.full_name || repo.name;
        if (!name) return;
        try {
          const commits = await fetchAllPages(
            `${GITHUB_API_BASE}/repos/${encodeURIComponent(name)}/commits?author=${login}`,
            token,
            10,
          );
          for (const c of commits as GitHubCommit[]) {
            out.push({
              sha: c.sha,
              repo: name,
              message: c.commit?.message || "",
              author: c.commit?.author?.name || login,
              date: c.commit?.author?.date || c.commit?.committer?.date || null,
              url: c.html_url || null,
            });
          }
        } catch {
          // A single inaccessible repo must never fail the whole activity
          // fetch — skip it and keep the rest.
        }
      }),
    );

    out.sort((a, b) => new Date(String(b.date || 0)).getTime() - new Date(String(a.date || 0)).getTime());
    return out.slice(0, limit);
  }

  static async commentOnIssue(token: string, repo: string, issueNumber: number, body: string): Promise<unknown> {
    const res = await fetchWithRetry(`${GITHUB_API_BASE}/repos/${repo}/issues/${issueNumber}/comments`, {
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
    const res = await fetchWithRetry(`${GITHUB_OAUTH_BASE}/access_token`, {
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

  static async revokeToken(clientId: string, clientSecret: string, token: string): Promise<void> {
    await fetchWithRetry(`${GITHUB_API_BASE}/applications/${clientId}/token`, {
      method: "DELETE",
      headers: {
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
        Accept: "application/vnd.github+json",
      },
      body: JSON.stringify({ access_token: token }),
    });
  }
}
