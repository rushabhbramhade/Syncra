export interface IntelligenceRelationship {
  title: string;
  summary: string;
  platforms: string[];
  items: Array<{ platform: string; title: string }>;
}

export interface IntelligenceRecommendation {
  text: string;
  type: string;
  platform: string;
  sourceId?: string;
  priority: "high" | "medium" | "low";
  reason: string;
  confidence: number;
  affectedPlatforms: string[];
  relatedData: string[];
  /** Real Gmail provenance resolved by the backend from the referenced item —
   * never AI-invented. Used to build a truthful "Open in Gmail" link. */
  threadId?: string;
  messageId?: string;
  rfc822MessageId?: string;
}

export interface IntelligenceTimelineEntry {
  time: string;
  title: string;
  platform?: string;
}

export interface IntelligenceConfidence {
  overall?: number;
  reason: string;
  missingData: string[];
}

export interface IntelligenceSourceStat {
  platform: string;
  syncStatus: "ok" | "partial" | "error" | "skipped";
  itemsProcessed: number;
  lastSync?: string;
}

export interface BriefingIntelligence {
  relationships: IntelligenceRelationship[];
  recommendations: IntelligenceRecommendation[];
  timeline: IntelligenceTimelineEntry[];
  confidence: IntelligenceConfidence;
  sourceStats: IntelligenceSourceStat[];
}

export interface IntelligenceGoal {
  text: string;
  priority: "high" | "medium" | "low";
  reason?: string;
}

export interface BriefingIntelligenceContent {
  relationships?: IntelligenceRelationship[];
  recommendations?: IntelligenceRecommendation[];
  goals?: IntelligenceGoal[];
  timeline?: IntelligenceTimelineEntry[];
  confidence?: IntelligenceConfidence;
  sourceStats?: IntelligenceSourceStat[];
}