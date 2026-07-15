"use server";

export interface AIDecisionLogEntry {
  userId: string;
  briefingId?: string;
  promptType: string;
  promptTokens?: number;
  responseTokens?: number;
  model: string;
  latencyMs: number;
  success: boolean;
  error?: string;
  timestamp: string;
}

export async function logAIDecision(entry: AIDecisionLogEntry): Promise<void> {
  console.log("[AIDecisionLog]", JSON.stringify(entry, null, 2));
}
