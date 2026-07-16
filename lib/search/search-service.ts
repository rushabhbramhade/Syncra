"use server";

import { executeMCPAction } from "@/app/actions/integrations";

export interface SearchResult {
  id: string;
  platform: string;
  title: string;
  snippet: string;
  url?: string;
  date?: string;
  score: number;
}

export async function unifiedSearchAction(userId: string, query: string, platforms?: string[]): Promise<SearchResult[]> {
  const allPlatforms = platforms || ["gmail", "whatsapp", "github"];
  const results: SearchResult[] = [];

  const searches = allPlatforms.map(async (platform) => {
    try {
      switch (platform) {
        case "gmail": {
          const res = await executeMCPAction(userId, "gmail", "gmail_search_emails", { query, limit: 10 });
          if (res.status === "success" && Array.isArray(res.result)) {
            for (const item of res.result as any[]) {
              results.push({
                id: `gmail_${item.id}`,
                platform: "gmail",
                title: item.subject || "(No subject)",
                snippet: item.snippet || "",
                date: item.date,
                score: 1,
              });
            }
          }
          break;
        }
        case "whatsapp": {
          const res = await executeMCPAction(userId, "whatsapp", "whatsapp_search_chats", { query });
          if (res.status === "success" && Array.isArray(res.result)) {
            for (const item of res.result as any[]) {
              results.push({
                id: `whatsapp_${item.id}`,
                platform: "whatsapp",
                title: item.fromName || "Unknown",
                snippet: item.message || "",
                date: item.timestamp,
                score: 1,
              });
            }
          }
          break;
        }
        case "github": {
          const res = await executeMCPAction(userId, "github", "github_search_issues", { query });
          if (res.status === "success" && Array.isArray(res.result)) {
            for (const item of res.result as any[]) {
              results.push({
                id: `github_${item.id}`,
                platform: "github",
                title: item.title || `Issue #${item.number}`,
                snippet: item.body?.slice(0, 200) || "",
                date: item.created_at,
                score: 1,
              });
            }
          }
          break;
        }
      }
    } catch {}
  });

  await Promise.allSettled(searches);

  return results.sort((a, b) => b.score - a.score).slice(0, 20);
}
