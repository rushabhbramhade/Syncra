import { NextRequest } from "next/server";
import { getCurrentUserAction } from "@/app/actions";
import { createAdminDb } from "@/lib/db";
import { UsersRepository } from "@/lib/repositories/users-repository";
import { AIChatRepository } from "@/lib/repositories/ai-chat-repository";
import { generateStreamingCompletion } from "@/lib/ai-service";
import { PLATFORM_MCP_TOOLS } from "@/constants/mcp-tools";
import { executeMCPAction } from "@/app/actions/integrations";

// Allow long execution time for route (for recursive agent runs)
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate user
    const { data: userData, error: authError } = await getCurrentUserAction();
    if (authError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const db = createAdminDb();
    const usersRepo = new UsersRepository(db);
    const userRecord = await usersRepo.findByAuthId(userData.user.id);
    if (!userRecord) {
      return new Response(JSON.stringify({ error: "User not found in public database" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }
    const userId = userRecord.id;

    // 2. Parse request body
    const { conversationId, content, model, files } = await req.json();
    if (!content) {
      return new Response(JSON.stringify({ error: "Content is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const repo = new AIChatRepository(db);

    // 3. Resolve or create conversation
    let conversation;
    if (conversationId) {
      conversation = await repo.getConversationById(conversationId, userId);
      if (!conversation) {
        return new Response(JSON.stringify({ error: "Conversation not found or access denied" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }
    } else {
      conversation = await repo.createConversation({
        user_id: userId,
        title: content.substring(0, 50) || "New Chat",
        model: model || "deepseek/deepseek-chat-v3",
        pinned: false,
        favorite: false,
        archived: false,
        metadata: {},
      });
    }

    // 4. Save user message
    const userMsg = await repo.createMessage({
      conversation_id: conversation.id,
      role: "user",
      content,
      metadata: {},
    });

    // Save files metadata if provided
    if (files && Array.isArray(files)) {
      for (const file of files) {
        await repo.createFileMetadata({
          conversation_id: conversation.id,
          message_id: userMsg.id,
          name: file.name || "Unnamed File",
          size: file.size || 0,
          type: file.type || "application/octet-stream",
          url: file.url || "",
          content: file.content || null,
        });
      }
    }

    // 5. Fetch active tools for the user
    const { data: integrations } = await db.database
      .from("user_integrations")
      .select("provider, status")
      .eq("user_id", userId)
      .eq("status", "active");

    const activeProviders = new Set((integrations || []).map((i: any) => i.provider));

    const tools: any[] = [];
    for (const [providerId, providerTools] of Object.entries(PLATFORM_MCP_TOOLS)) {
      const isSandbox = ["slack", "outlook", "discord", "telegram", "linkedin", "github"].includes(providerId);
      const isConnected = activeProviders.has(providerId);

      if (isConnected || isSandbox) {
        providerTools.forEach((tool: any) => {
          tools.push({
            type: "function",
            function: {
              name: tool.name,
              description: tool.description,
              parameters: {
                type: "object",
                properties: tool.inputSchema.properties,
                required: tool.inputSchema.required || [],
              },
            },
          });
        });
      }
    }

    // 6. Define tool dispatcher
    async function dispatchToolCall(toolName: string, args: any) {
      const providerId = toolName.split("_")[0];
      const result = await executeMCPAction(userId, providerId, toolName, args);

      if (result.status === "success") {
        return { success: true, output: JSON.stringify(result.result) };
      }

      const sandboxProviders = ["slack", "outlook", "discord", "telegram", "linkedin", "github"];
      if (sandboxProviders.includes(providerId)) {
        console.log(`[Sandbox Simulation] Executed sandbox tool ${toolName} with args:`, args);
        let mockResult: any = { message: `Simulated successful execution of ${toolName}` };
        if (toolName.includes("search") || toolName.includes("get") || toolName.includes("list")) {
          mockResult = {
            data: [],
            message: `Simulated search/retrieve results for ${toolName}`,
            count: 0,
          };
        }
        return { success: true, output: JSON.stringify(mockResult) };
      }

      return { success: false, error: result.error?.message || "Execution failed" };
    }

    // 7. Setup the agent loop
    async function* runAgentLoop() {
      const history = await repo.getMessagesByConversationId(conversation.id);
      
      const openAiMessages: any[] = [];
      openAiMessages.push({
        role: "system",
        content: `You are Syncra's Workspace AI Agent, a helpful, advanced coding and execution assistant.
You can execute actions on behalf of the user using the provided tools.
You are running in a professional workspace.
Be concise, clear, and direct. When you use tools, explain briefly what you are doing.`
      });

      for (const msg of history) {
        if (msg.role === "user") {
          openAiMessages.push({ role: "user", content: msg.content });
        } else if (msg.role === "assistant") {
          const msgToolCalls = await repo.getToolCallsByMessageId(msg.id);
          if (msgToolCalls && msgToolCalls.length > 0) {
            openAiMessages.push({
              role: "assistant",
              content: msg.content || null,
              tool_calls: msgToolCalls.map((tc) => ({
                id: tc.id,
                type: "function",
                function: {
                  name: tc.tool_name,
                  arguments: JSON.stringify(tc.arguments),
                },
              })),
            });

            for (const tc of msgToolCalls) {
              openAiMessages.push({
                role: "tool",
                tool_call_id: tc.id,
                content: tc.output || tc.error || "No output returned",
              });
            }
          } else {
            openAiMessages.push({ role: "assistant", content: msg.content });
          }
        }
      }

      const MAX_ITERATIONS = 5;
      let iteration = 0;
      let continueLoop = true;
      let currentMessages = [...openAiMessages];

      // Yield initial conversation info to the client
      yield { type: "info", conversationId: conversation.id };

      while (continueLoop && iteration < MAX_ITERATIONS) {
        iteration++;
        let currentModel = model || "deepseek/deepseek-chat-v3";
        let accumulatedContent = "";
        const toolCallsToExecute: any[] = [];

        const stream = generateStreamingCompletion(currentMessages, tools, model);

        for await (const chunk of stream) {
          if (chunk.model) currentModel = chunk.model;
          yield chunk;

          if (chunk.type === "content" && chunk.content) {
            accumulatedContent += chunk.content;
          }

          if (chunk.type === "tool_call_done") {
            toolCallsToExecute.push({
              id: chunk.toolCallId,
              index: chunk.toolCallIndex,
              name: chunk.toolCallName,
              arguments: chunk.toolCallArgumentsFull,
            });
          }

          if (chunk.type === "error") {
            continueLoop = false;
            break;
          }
        }

        // Save assistant response
        const assistantMsg = await repo.createMessage({
          conversation_id: conversation.id,
          role: "assistant",
          content: accumulatedContent,
          metadata: { model: currentModel, hasToolCalls: toolCallsToExecute.length > 0 },
        });

        const assistantMessageParam: any = {
          role: "assistant",
          content: accumulatedContent || null,
        };

        if (toolCallsToExecute.length > 0) {
          assistantMessageParam.tool_calls = toolCallsToExecute.map((tc) => ({
            id: tc.id,
            type: "function",
            function: {
              name: tc.name,
              arguments: tc.arguments,
            },
          }));
        }
        currentMessages.push(assistantMessageParam);

        if (toolCallsToExecute.length > 0) {
          for (const tc of toolCallsToExecute) {
            const parsedArgs = JSON.parse(tc.arguments || "{}");

            // 1. Create database record for the tool call
            const tcRecord = await repo.createToolCall({
              message_id: assistantMsg.id,
              tool_name: tc.name,
              provider: "mcp",
              arguments: parsedArgs,
              status: "running",
            });

            // 2. Yield executing status to client
            yield {
              type: "tool_executing",
              toolCallId: tc.id,
              toolCallName: tc.name,
            };

            const startTime = Date.now();
            // 3. Dispatch the tool call
            const execResult = await dispatchToolCall(tc.name, parsedArgs);
            const duration = Date.now() - startTime;

            // 4. Update database tool call record
            await repo.updateToolCall(tcRecord.id, {
              status: execResult.success ? "success" : "failed",
              output: execResult.output || null,
              error: execResult.error || null,
              duration,
            });

            const toolOutputContent = execResult.output || execResult.error || "No output returned";

            // 6. Yield tool result to client
            yield {
              type: "tool_result",
              toolCallId: tc.id,
              toolCallName: tc.name,
              output: toolOutputContent,
              success: execResult.success,
            };

            // 7. Push to current message history for next LLM iteration
            currentMessages.push({
              role: "tool",
              tool_call_id: tc.id,
              content: toolOutputContent,
            });
          }
          continueLoop = true; // Run another loop iteration with the new tool inputs
        } else {
          continueLoop = false; // Finished generating text and no tools were requested
        }
      }

      yield { type: "done" };
    }

    // 8. Stream response using SSE
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (data: any) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        };

        try {
          for await (const event of runAgentLoop()) {
            send(event);
          }
        } catch (err: any) {
          console.error("SSE agent loop error:", err);
          send({ type: "error", error: err.message || "Internal agent loop execution error" });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
      },
    });
  } catch (error: any) {
    console.error("Chat API route error:", error);
    return new Response(JSON.stringify({ error: error.message || "Internal Server Error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
