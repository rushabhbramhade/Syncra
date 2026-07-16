"use server";

import { ToolPermissionsRepository } from "@/lib/repositories/tool-permissions-repository";
import { PLATFORM_MCP_TOOLS } from "@/constants/mcp-tools";

const repo = new ToolPermissionsRepository();

export async function getToolPermissionsAction(userId: string): Promise<Record<string, boolean>> {
  const perms = await repo.getAllForUser(userId);
  const result: Record<string, boolean> = {};
  for (const p of perms) {
    result[p.tool_name] = p.enabled;
  }
  return result;
}

export async function setToolEnabledAction(userId: string, toolName: string, provider: string, enabled: boolean): Promise<{ success: boolean }> {
  await repo.setEnabled(userId, toolName, provider, enabled);
  return { success: true };
}

export async function initializeToolPermissionsAction(userId: string): Promise<void> {
  const tools: { name: string; provider: string }[] = [];
  for (const [provider, providerTools] of Object.entries(PLATFORM_MCP_TOOLS)) {
    for (const tool of providerTools) {
      tools.push({ name: tool.name, provider });
    }
  }
  await repo.initializeDefaults(userId, tools);
}
