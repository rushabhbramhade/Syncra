export interface IntelligenceHealthDimension {
  name: string;
  score: number;
  reason: string;
}

export interface IntelligenceHealth {
  overall: number;
  breakdown: IntelligenceHealthDimension[];
  summary: string;
}

export interface IntelligenceInsight {
  text: string;
  type: "pattern" | "warning" | "opportunity" | "concept";
  importance: "high" | "medium" | "low";
}

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
}

export interface IntelligenceTimelineEntry {
  time: string;
  title: string;
  platform?: string;
}

export interface IntelligenceConfidence {
  overall: number;
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
  health: IntelligenceHealth;
  insights: IntelligenceInsight[];
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
  health?: IntelligenceHealth;
  insights?: IntelligenceInsight[];
  relationships?: IntelligenceRelationship[];
  recommendations?: IntelligenceRecommendation[];
  goals?: IntelligenceGoal[];
  timeline?: IntelligenceTimelineEntry[];
  confidence?: IntelligenceConfidence;
  sourceStats?: IntelligenceSourceStat[];
}