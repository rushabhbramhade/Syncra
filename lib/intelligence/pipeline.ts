import { DashboardBriefData } from "@/app/actions/dashboard";
import { NormalizedEvent, EventCluster } from "@/lib/events/normalized-event";
import { normalizeAll, RawEvent } from "@/lib/events/normalizer";
import { deduplicate } from "@/lib/events/deduplicator";
import { correlateEvents, applyCorrelations } from "@/lib/events/correlator";
import { evaluateRules } from "@/lib/rules/rule-engine";
import { buildBuiltinRules } from "@/lib/rules/builtins/default-rules";
import { scoreEvents } from "@/lib/scoring/priority-scorer";
import { detectRisks, RiskEvent } from "@/lib/scoring/risk-detector";
import { generateSummary, generateRecommendations, generateExplanations, AIRecommendation, AIExplanation } from "@/lib/briefing/ai-layer";

export interface IntelligenceResult {
  normalized: NormalizedEvent[];
  clusters: EventCluster[];
  risks: RiskEvent[];
  summary: string;
  recommendations: AIRecommendation[];
  explanations: Record<string, AIExplanation>;
}

function briefToRawEvents(brief: DashboardBriefData): RawEvent[] {
  const raw: RawEvent[] = [];
  const seen = new Set<string>();

  for (const item of brief.briefItems) {
    const key = `${item.platform}-${item.text.slice(0, 40)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    raw.push({
      platform: item.platform,
      id: `brief-${raw.length}`,
      title: item.text.slice(0, 80),
      summary: item.text,
      receivedAt: new Date().toISOString(),
    });
  }

  for (const item of brief.priorityItems) {
    const key = `${item.platform}-${item.title}`;
    if (seen.has(key)) continue;
    seen.add(key);
    raw.push({
      platform: item.platform,
      id: `priority-${raw.length}`,
      title: item.title,
      summary: item.description,
      priority: item.priority,
      receivedAt: new Date().toISOString(),
    });
  }

  return raw;
}

export async function runIntelligencePipeline(brief: DashboardBriefData): Promise<IntelligenceResult> {
  const empty: IntelligenceResult = {
    normalized: [], clusters: [], risks: [],
    summary: "", recommendations: [], explanations: {},
  };

  try {
    const rawEvents = briefToRawEvents(brief);

    let normalized: NormalizedEvent[];
    try {
      normalized = normalizeAll({ platform: rawEvents });
    } catch {
      return empty;
    }

    if (normalized.length === 0) return empty;

    let deduped: NormalizedEvent[];
    try {
      deduped = deduplicate(normalized);
    } catch {
      deduped = normalized;
    }

    const builtinRules = buildBuiltinRules();
    try {
      for (const event of deduped) {
        evaluateRules(event, builtinRules);
      }
    } catch {
    }

    let scored: NormalizedEvent[];
    try {
      scored = scoreEvents(deduped);
    } catch {
      scored = deduped;
    }

    let clusters: EventCluster[] = [];
    let crossRefEvents: NormalizedEvent[] = scored;
    try {
      const result = correlateEvents(scored);
      clusters = result.clusters;
      crossRefEvents = applyCorrelations(scored, result.crossRefs);
    } catch {
    }

    let risks: RiskEvent[];
    try {
      risks = detectRisks(scored);
    } catch {
      risks = [];
    }

    let summary = "";
    try {
      summary = generateSummary(scored);
    } catch {
    }

    let recommendations: AIRecommendation[] = [];
    try {
      recommendations = await generateRecommendations(scored);
    } catch {
    }

    let explanations: Record<string, AIExplanation> = {};
    try {
      explanations = generateExplanations(scored);
    } catch {
    }

    return {
      normalized: crossRefEvents,
      clusters,
      risks,
      summary,
      recommendations,
      explanations,
    };
  } catch {
    return empty;
  }
}
