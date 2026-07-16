"use server";

import { createAdminDb } from "@/lib/db";
import { generateJsonResponse } from "@/lib/ai-service";

interface ExtractedTask {
  title: string;
  description?: string;
  owner?: string;
  deadline?: string;
  source_platform?: string;
  source_item_id?: string;
}

export class TaskExtractionService {
  async extractFromText(userId: string, text: string, sourcePlatform?: string, sourceItemId?: string): Promise<ExtractedTask[]> {
    try {
      const result = await generateJsonResponse<{ tasks: ExtractedTask[] }>(
        `Extract action items from the following text. For each task extract: title (required), description, owner (if mentioned), deadline (if mentioned in ISO format).
Only include items that are clearly action items with an implied or explicit owner.
Output JSON: { "tasks": [{ "title": string, "description"?: string, "owner"?: string, "deadline"?: string }] }`,
        { text }
      );
      if (result?.tasks) {
        for (const task of result.tasks) {
          task.source_platform = sourcePlatform;
          task.source_item_id = sourceItemId;
        }
        return result.tasks;
      }
    } catch {}
    return [];
  }

  async saveTasks(userId: string, tasks: ExtractedTask[]): Promise<void> {
    if (tasks.length === 0) return;
    const db = createAdminDb();
    for (const task of tasks) {
      await db.database.from("user_tasks").insert({
        user_id: userId,
        title: task.title,
        description: task.description || null,
        owner: task.owner || null,
        deadline: task.deadline || null,
        source_platform: task.source_platform || null,
        source_item_id: task.source_item_id || null,
        status: "pending",
      });
    }
  }

  async getTasks(userId: string): Promise<any[]> {
    const db = createAdminDb();
    const { data } = await db.database
      .from("user_tasks")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    return data || [];
  }

  async updateTaskStatus(userId: string, taskId: string, status: string): Promise<void> {
    const db = createAdminDb();
    await db.database.from("user_tasks").update({ status }).eq("id", taskId).eq("user_id", userId);
  }
}
