"use server";

import { executeMCPAction } from "@/lib/integrations/actions-core";
import { requireOwnership } from "@/lib/auth-guard";

export interface SearchResult {
  id: string;
  platform: string;
  title: string;
  snippet: string;
  url?: string;
  date?: string;
  score: number;
}

type RawItem = Record<string, unknown>;

function s(v: unknown): string {
  return typeof v === "string" ? v : v != null ? String(v) : "";
}

export async function unifiedSearchAction(userId: string, query: string, platforms?: string[]): Promise<SearchResult[]> {
  const guard = await requireOwnership(userId);
  if ("error" in guard) throw new Error("Unauthorized");

  const allPlatforms = platforms || ["gmail", "whatsapp", "github"];
  const results: SearchResult[] = [];

  const searches = allPlatforms.map(async (platform) => {
    try {
      switch (platform) {
        case "gmail": {
          const res = await executeMCPAction(guard.authUserId, "gmail", "gmail_search_emails", { query, limit: 10 });
          if (res.status === "success" && Array.isArray(res.result)) {
            for (const item of res.result as RawItem[]) {
              results.push({
                id: `gmail_${item.id}`,
                platform: "gmail",
                title: s(item.subject) || "(No subject)",
                snippet: s(item.snippet),
                date: s(item.date) || undefined,
                score: 1,
              });
            }
          }
          break;
        }
        case "whatsapp": {
          const res = await executeMCPAction(guard.authUserId, "whatsapp", "whatsapp_search_chats", { query });
          if (res.status === "success" && Array.isArray(res.result)) {
            for (const item of res.result as RawItem[]) {
              results.push({
                id: `whatsapp_${item.id}`,
                platform: "whatsapp",
                title: s(item.fromName) || "Unknown",
                snippet: s(item.message),
                date: s(item.timestamp) || undefined,
                score: 1,
              });
            }
          }
          break;
        }
        case "github": {
          const res = await executeMCPAction(guard.authUserId, "github", "github_search_issues", { query });
          if (res.status === "success" && Array.isArray(res.result)) {
            for (const item of res.result as RawItem[]) {
              results.push({
                id: `github_${item.id}`,
                platform: "github",
                title: s(item.title) || `Issue #${item.number}`,
                snippet: s(item.body).slice(0, 200),
                date: s(item.created_at) || undefined,
                score: 1,
              });
            }
          }
          break;
        }
      }
    } catch (err) { console.error("[search]", platform, err); }
  });

  await Promise.allSettled(searches);

  return results.sort((a, b) => b.score - a.score).slice(0, 20);
}
