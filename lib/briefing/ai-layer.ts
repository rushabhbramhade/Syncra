import { NormalizedEvent } from "../events/normalized-event";
import { AIResponseBriefing, ItemExplanation } from "./types";
import { generateJsonResponse } from "../ai-service";

export type AIExplanation = ItemExplanation;

export interface AIEnrichment {
  executiveSummary: string;
  itemSummaries: Record<string, string>;
  recommendations: AIRecommendation[];
  explanations: Record<string, ItemExplanation>;
  confidenceScores: Record<string, number>;
}

export interface AIRecommendation {
  text: string;
  type: "reply" | "schedule" | "complete" | "review" | "follow_up" | "escalate";
  relatedEventIds: string[];
  estimatedEffortMinutes: number;
  businessImpact: "high" | "medium" | "low";
}

export function generateSummary(scoredEvents: NormalizedEvent[]): string {
  const total = scoredEvents.length;
  const platforms = [...new Set(scoredEvents.map(e => e.platform))];
  const critical = scoredEvents.filter(e => e.priority === "critical").length;
  const high = scoredEvents.filter(e => e.priority === "high").length;
  const followUps = scoredEvents.filter(e => e.labels?.includes("follow-up")).length;
  const risks = scoredEvents.filter(e => e.labels?.includes("risk")).length;
  const unread = scoredEvents.filter(e => e.isUnread).length;

  const parts: string[] = [];
  if (total > 0) {
    parts.push(`You have ${total} event${total !== 1 ? "s" : ""} across ${platforms.length} platform${platforms.length !== 1 ? "s" : ""}${platforms.length > 0 ? ` (${platforms.join(", ")}).` : "."}`);
  }
  if (critical > 0) parts.push(`${critical} critical item${critical !== 1 ? "s" : ""} require${critical === 1 ? "s" : ""} immediate attention.`);
  if (high > 0) parts.push(`${high} high-priority item${high !== 1 ? "s" : ""} need${high === 1 ? "s" : ""} review.`);
  if (unread > 0) parts.push(`${unread} unread message${unread !== 1 ? "s" : ""} pending.`);
  if (followUps > 0) parts.push(`${followUps} follow-up${followUps !== 1 ? "s" : ""} flagged.`);
  if (risks > 0) parts.push(`${risks} risk${risks !== 1 ? "s" : ""} detected.`);

  return parts.length > 0 ? parts.join(" ") : "No events to summarize.";
}

export async function generateRecommendations(scoredEvents: NormalizedEvent[]): Promise<AIRecommendation[]> {
  const systemPrompt = `You are Syncra's recommendation engine. Given scored events, generate actionable recommendations.
Output JSON array only:
[{"text": "Action description", "type": "reply|schedule|complete|review|follow_up|escalate", "relatedEventIds": ["eventId"], "estimatedEffortMinutes": 15, "businessImpact": "high|medium|low"}]`;

  const topEvents = scoredEvents.filter(e => e.priority === "critical" || e.priority === "high").slice(0, 10);

  try {
    const result = await generateJsonResponse<AIRecommendation[]>(systemPrompt, { events: topEvents } as any);
    if (result && Array.isArray(result)) return result.slice(0, 5);
  } catch {}

  return topEvents.slice(0, 3).map(e => ({
    text: `Review ${e.title} from ${e.sender.name}`,
    type: "review" as const,
    relatedEventIds: [e.id],
    estimatedEffortMinutes: 10,
    businessImpact: e.priority === "critical" ? "high" as const : "medium" as const,
  }));
}

function classifyPlatform(platform: string): string {
  const p = platform.toLowerCase();
  if (p === "github") return "activity";
  if (p === "linkedin") return "activity";
  if (p === "gmail") return "email";
  if (p === "slack" || p === "whatsapp" || p === "telegram" || p === "discord") return "messages";
  return "messages";
}

export function generateExplanations(scoredEvents: NormalizedEvent[]): Record<string, ItemExplanation> {
  const explanations: Record<string, ItemExplanation> = {};

  for (const event of scoredEvents) {
    const signals: string[] = [];
    if (event.sender.isVIP) signals.push("VIP sender");
    if (event.isStarred) signals.push("Starred message");
    if (event.isUnread) signals.push("Unread");
    if (event.metadata?.gmail?.hasAttachments) signals.push("Has attachment");
    if (event.metadata?.slack?.isMention) signals.push("You were mentioned");
    if (event.metadata?.github?.isReviewRequested) signals.push("Review requested");
    if (event.metadata?.github?.status === "open" && event.metadata?.github?.issueNumber) signals.push("Open issue requiring attention");
    if (event.metadata?.github?.isReviewRequested) signals.push("Review requested on PR");
    if (event.labels?.includes("follow-up")) signals.push("Flagged as follow-up");
    if (event.labels?.includes("risk")) signals.push("Potential risk detected");
    if (event.labels?.includes("financial")) signals.push("Financial document");
    if (event.labels?.includes("deadline")) signals.push("Deadline mentioned");

    let why = `This ${event.platform} item was classified as ${event.priority} priority with a score of ${event.score || 50}/100.`;
    if (signals.length > 0) why += ` Signals: ${signals.join(", ")}.`;
    if (event.rulesMatched?.length > 0) why += ` Matched ${event.rulesMatched.length} rule(s).`;

    const category = classifyPlatform(event.platform);
    explanations[event.id] = {
      whyClassified: why,
      signals,
      confidence: event.confidence || 0.85,
      recommendedAction: event.priority === "critical" ? "Address immediately" :
        event.priority === "high" ? "Review within the hour" :
        event.priority === "medium" ? "Review today" : "Review when convenient",
    };
  }

  return explanations;
}

export async function generateEnhancedBriefing(events: NormalizedEvent[], briefType: "morning" | "midday" | "evening" | "weekly"): Promise<AIResponseBriefing | null> {
  const prompt = `You are Syncra's briefing generator. Generate a ${briefType} briefing JSON from normalized events. Output exactly the AIResponseBriefing schema. Include an "activity" category for GitHub (releases, stars, PRs) and LinkedIn (feed updates, connection requests) items that don't fit email/messages/tasks/followUps.`;

  const eventData = events.slice(0, 50).map(e => ({
    platform: e.platform,
    title: e.title,
    summary: e.summary,
    priority: e.priority,
    score: e.score,
    sender: e.sender.name,
  }));

  return generateJsonResponse<AIResponseBriefing>(prompt, { events: eventData, briefType } as any);
}
