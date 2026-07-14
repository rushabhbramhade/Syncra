"use server";

import { createAdminDb } from "@/lib/db";
import {
  AIChatRepository,
  AIConversationRecord,
  AIMessageRecord,
  AIWorkspaceMemoryRecord,
} from "@/lib/repositories/ai-chat-repository";

// Helper to authenticate user
async function verifyUserAccess(userId: string) {
  if (!userId) {
    throw new Error("Unauthorized user access");
  }
}

function getRepo() {
  return new AIChatRepository(createAdminDb());
}

export async function getConversationsAction(userId: string) {
  await verifyUserAccess(userId);
  const repo = getRepo();
  return await repo.getConversationsByUserId(userId, { archived: false });
}

export async function getArchivedConversationsAction(userId: string) {
  await verifyUserAccess(userId);
  const repo = getRepo();
  return await repo.getConversationsByUserId(userId, { archived: true });
}

export async function getConversationDetailsAction(userId: string, conversationId: string) {
  await verifyUserAccess(userId);
  const repo = getRepo();

  const conversation = await repo.getConversationById(conversationId, userId);
  if (!conversation) {
    throw new Error("Conversation not found or access denied");
  }

  const messages = await repo.getMessagesByConversationId(conversationId);
  const files = await repo.getFilesByConversationId(conversationId);

  // Hydrate messages with their tool calls
  const messagesWithToolCalls = await Promise.all(
    messages.map(async (msg) => {
      const toolCalls = await repo.getToolCallsByMessageId(msg.id);
      return {
        ...msg,
        toolCalls: toolCalls || [],
      };
    })
  );

  return {
    conversation,
    messages: messagesWithToolCalls,
    files,
  };
}

export async function createConversationAction(userId: string, title: string, model: string) {
  await verifyUserAccess(userId);
  const repo = getRepo();

  return await repo.createConversation({
    user_id: userId,
    title,
    model,
    pinned: false,
    favorite: false,
    archived: false,
    metadata: {},
  });
}

export async function updateConversationAction(
  userId: string,
  id: string,
  updates: Partial<Omit<AIConversationRecord, "id" | "user_id" | "created_at" | "updated_at">>
) {
  await verifyUserAccess(userId);
  const repo = getRepo();

  // Verify ownership
  const convo = await repo.getConversationById(id, userId);
  if (!convo) {
    throw new Error("Conversation not found or access denied");
  }

  return await repo.updateConversation(id, userId, updates);
}

export async function deleteConversationAction(userId: string, id: string) {
  await verifyUserAccess(userId);
  const repo = getRepo();

  // Verify ownership
  const convo = await repo.getConversationById(id, userId);
  if (!convo) {
    throw new Error("Conversation not found or access denied");
  }

  return await repo.deleteConversation(id, userId);
}

export async function duplicateConversationAction(userId: string, id: string) {
  await verifyUserAccess(userId);
  const repo = getRepo();

  // 1. Fetch original conversation
  const convo = await repo.getConversationById(id, userId);
  if (!convo) {
    throw new Error("Conversation not found or access denied");
  }

  // 2. Create duplicated conversation
  const duplicatedConvo = await repo.createConversation({
    user_id: userId,
    title: `Copy of ${convo.title}`,
    model: convo.model,
    pinned: false,
    favorite: false,
    archived: false,
    metadata: convo.metadata || {},
  });

  // 3. Fetch original messages and files
  const originalMessages = await repo.getMessagesByConversationId(id);
  const originalFiles = await repo.getFilesByConversationId(id);

  // Maps original message ID to new message ID for file associations
  const messageIdMap = new Map<string, string>();

  // 4. Duplicate messages and their tool calls
  for (const msg of originalMessages) {
    const newMsg = await repo.createMessage({
      conversation_id: duplicatedConvo.id,
      role: msg.role,
      content: msg.content,
      latency: msg.latency,
      tokens_used: msg.tokens_used,
      metadata: msg.metadata || {},
    });

    messageIdMap.set(msg.id, newMsg.id);

    // Duplicate tool calls for this message
    const toolCalls = await repo.getToolCallsByMessageId(msg.id);
    for (const tc of toolCalls) {
      await repo.createToolCall({
        message_id: newMsg.id,
        tool_name: tc.tool_name,
        provider: tc.provider,
        arguments: tc.arguments,
        status: tc.status,
        duration: tc.duration,
        output: tc.output,
        error: tc.error,
      });
    }
  }

  // 5. Duplicate files metadata
  for (const file of originalFiles) {
    const associatedNewMsgId = file.message_id ? messageIdMap.get(file.message_id) : null;
    await repo.createFileMetadata({
      conversation_id: duplicatedConvo.id,
      message_id: associatedNewMsgId,
      name: file.name,
      size: file.size,
      type: file.type,
      url: file.url,
      content: file.content,
    });
  }

  return duplicatedConvo;
}

// ── AI WORKSPACE MEMORY ACTIONS ──

export async function getMemoryAction(userId: string) {
  await verifyUserAccess(userId);
  const repo = getRepo();
  return await repo.getMemoryByUserId(userId);
}

export async function addMemoryAction(userId: string, key: string, value: string, category: string) {
  await verifyUserAccess(userId);
  const repo = getRepo();
  return await repo.upsertMemory({
    user_id: userId,
    key,
    value,
    category,
  });
}

export async function deleteMemoryAction(userId: string, id: string) {
  await verifyUserAccess(userId);
  const repo = getRepo();
  return await repo.deleteMemory(id, userId);
}
