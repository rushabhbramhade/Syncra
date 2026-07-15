"use server";

export interface ClassificationLogEntry {
  userId: string;
  eventId: string;
  platform: string;
  ruleMatches: string[];
  scoreFactors: Record<string, number>;
  finalPriority: string;
  finalScore: number;
  aiConfidence?: number;
  aiExplanation?: string;
  timestamp: string;
}

export async function logClassification(entry: ClassificationLogEntry): Promise<void> {
  console.log("[ClassificationLog]", JSON.stringify(entry, null, 2));
}
