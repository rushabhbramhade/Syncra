export interface AIResponseBriefing {
  title: string;
  executiveSummary: string;
  priorityScore: number;
  totalImportantItems: number;
  highPriorityCount: number;
  readingTimeMinutes: number;
  categories: {
    email?: { totalImportant: number; summary: string; priority: string };
    meetings?: { summary: string; items: Array<{ title: string; time: string; participants: string[]; url?: string }> };
    messages?: { summary: string; items: Array<{ platform: string; sender: string; text: string; channel?: string }> };
    tasks?: { summary: string; items: Array<{ title: string; dueDate?: string; status: string; suggestion?: string }> };
    followUps?: { summary: string; items: Array<{ title: string; recommendedAction: string; dueDate?: string }> };
  };
  recommendations: Array<{ text: string; type: string; platform?: string; sourceId?: string }>;
  items: Array<{
    platform: string;
    category: string;
    title: string;
    priority: "high" | "normal" | "low";
    shortSummary: string;
    originalContent: string;
    sourceId?: string;
  }>;
}
