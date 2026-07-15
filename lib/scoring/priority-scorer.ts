import { NormalizedEvent, PriorityLevel } from "../events/normalized-event";

export interface ScoringFactors {
  senderImportance: number;
  unreadStatus: number;
  deadlineProximity: number;
  mentions: number;
  attachments: number;
  customerImpact: number;
  securitySeverity: number;
  deploymentStatus: number;
  calendarProximity: number;
}

const PRIORITY_THRESHOLDS: { level: PriorityLevel; minScore: number }[] = [
  { level: "critical", minScore: 85 },
  { level: "high", minScore: 70 },
  { level: "medium", minScore: 50 },
  { level: "low", minScore: 30 },
  { level: "informational", minScore: 0 },
];

export function getPriorityFromScore(score: number): PriorityLevel {
  for (const t of PRIORITY_THRESHOLDS) {
    if (score >= t.minScore) return t.level;
  }
  return "informational";
}

export function extractFactors(event: NormalizedEvent): ScoringFactors {
  const isVIP = event.sender.isVIP || false;
  const isClient = event.sender.isClient || false;
  const isUnread = event.isUnread;
  const hasAttachments = event.metadata?.gmail?.hasAttachments || false;
  const isMention = event.metadata?.slack?.isMention || false;
  const isDM = event.metadata?.slack?.isDM || false;
  const isSecurity = (event.labels || []).some(l => l === "risk" || l.includes("security"));
  const isBuildFailure = (event.title || "").toLowerCase().match(/fail|error|crash|down|outage/);
  const isPR = event.metadata?.github?.isReviewRequested || false;
  const isFinancial = (event.labels || []).includes("financial");

  return {
    senderImportance: isVIP ? 20 : isClient ? 15 : isPR ? 10 : 5,
    unreadStatus: isUnread ? 15 : 0,
    deadlineProximity: event.category === "task" || event.category === "meeting" ? 15 : 5,
    mentions: isMention ? 15 : isDM ? 10 : 5,
    attachments: hasAttachments ? 10 : 0,
    customerImpact: isClient ? 15 : isFinancial ? 12 : 5,
    securitySeverity: isSecurity ? 25 : isBuildFailure ? 20 : 0,
    deploymentStatus: isBuildFailure ? 10 : 0,
    calendarProximity: event.platform === "calendar" ? 10 : 0,
  };
}

export function calculateScore(event: NormalizedEvent, factors: ScoringFactors): number {
  const raw = Object.values(factors).reduce((sum, v) => sum + v, 0);
  return Math.max(0, Math.min(100, raw));
}

export function scoreEvent(event: NormalizedEvent): { score: number; priority: PriorityLevel; factors: ScoringFactors } {
  const factors = extractFactors(event);
  const score = calculateScore(event, factors);
  const priority = getPriorityFromScore(score);
  return { score, priority, factors };
}

export function scoreEvents(events: NormalizedEvent[]): NormalizedEvent[] {
  return events.map(event => {
    const { score, priority, factors } = scoreEvent(event);
    return { ...event, score, priority, factors };
  });
}
