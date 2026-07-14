"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/components/auth-provider";
import {
  getConversationsAction,
  getConversationDetailsAction,
  createConversationAction,
  updateConversationAction,
  deleteConversationAction,
  duplicateConversationAction,
  getMemoryAction,
  addMemoryAction,
  deleteMemoryAction,
} from "@/app/actions/ai-chat";
import {
  Bot,
  Send,
  Paperclip,
  Pin,
  Star,
  Trash2,
  Archive,
  MessageSquare,
  Plus,
  Check,
  Loader2,
  Sparkles,
  ChevronDown,
  X,
  Copy,
  FolderSync,
  Compass,
  Database,
  Search,
  User,
  PanelLeftClose,
  PanelLeft,
  Settings,
  ShieldAlert,
  Menu,
} from "lucide-react";

// List of available models
const MODELS = [
  { id: "deepseek/deepseek-chat-v3", name: "DeepSeek V3", desc: "Fast & General Purpose" },
  { id: "openai/gpt-4o-mini", name: "GPT-4o Mini", desc: "Highly Intelligent & Small" },
  { id: "google/gemini-2.0-flash-001", name: "Gemini 2.0 Flash", desc: "Multimodal & High Context" },
];

// Inline markdown renderer helpers
function renderInlineMarkdown(line: string) {
  const codeParts = line.split(/(`[^`]+`)/g);
  return codeParts.map((cPart, cIdx) => {
    if (cPart.startsWith("`") && cPart.endsWith("`")) {
      return (
        <code key={cIdx} className="bg-border-mist dark:bg-[#1E293B] text-text-ink px-1.5 py-0.5 rounded font-mono text-[12px] border border-secondary/10 dark:border-white/10">
          {cPart.slice(1, -1)}
        </code>
      );
    }

    const boldParts = cPart.split(/(\*\*[^*]+\*\*)/g);
    return boldParts.map((bPart, bIdx) => {
      if (bPart.startsWith("**") && bPart.endsWith("**")) {
        return <strong key={bIdx} className="font-bold text-text-ink">{bPart.slice(2, -2)}</strong>;
      }

      const linkParts = bPart.split(/(\[[^\]]+\]\([^)]+\))/g);
      return linkParts.map((lPart, lIdx) => {
        const linkMatch = lPart.match(/\[([^\]]+)\]\(([^)]+)\)/);
        if (linkMatch) {
          const [_, label, url] = linkMatch;
          return (
            <a 
              key={lIdx} 
              href={url} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="text-primary font-medium hover:underline underline-offset-2 break-all"
            >
              {label}
            </a>
          );
        }

        return lPart;
      });
    });
  });
}

function renderMarkdown(text: string) {
  if (!text) return null;

  const parts = text.split(/(```[\s\S]*?```)/g);

  return parts.map((part, idx) => {
    if (part.startsWith("```")) {
      const match = part.match(/```(\w*)\n([\s\S]*?)```/);
      const language = match ? match[1] : "";
      const code = match ? match[2] : part.slice(3, -3);

      return (
        <div key={idx} className="my-4 neo-border bg-surface-white dark:bg-[#0f172a] neo-shadow-sm rounded-btn overflow-hidden font-mono text-[13px]">
          <div className="bg-secondary text-white px-4 py-1.5 flex justify-between items-center text-[11px] font-sans font-bold border-b-2 neo-border">
            <span>{language.toUpperCase() || "CODE"}</span>
            <button 
              onClick={() => navigator.clipboard.writeText(code)}
              className="hover:text-primary transition-colors flex items-center gap-1 cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5" />
              Copy
            </button>
          </div>
          <pre className="p-4 overflow-x-auto bg-[#0f172a] text-[#f8fafc] scrollbar-hide">
            <code>{code}</code>
          </pre>
        </div>
      );
    } else {
      const lines = part.split("\n");
      return lines.map((line, lIdx) => {
        if (line.trim().startsWith("- ") || line.trim().startsWith("* ")) {
          return (
            <li key={`${idx}-${lIdx}`} className="ml-6 list-disc text-[14px] text-text-ink leading-relaxed my-1">
              {renderInlineMarkdown(line.trim().substring(2))}
            </li>
          );
        }

        if (line.trim().startsWith("### ")) {
          return (
            <h3 key={`${idx}-${lIdx}`} className="text-[15px] font-bold font-display text-text-ink mt-4 mb-1">
              {renderInlineMarkdown(line.substring(4))}
            </h3>
          );
        }
        if (line.trim().startsWith("## ")) {
          return (
            <h2 key={`${idx}-${lIdx}`} className="text-[17px] font-bold font-display text-text-ink mt-5 mb-2 border-b-2 border-border-mist pb-1">
              {renderInlineMarkdown(line.substring(3))}
            </h2>
          );
        }
        if (line.trim().startsWith("# ")) {
          return (
            <h1 key={`${idx}-${lIdx}`} className="text-[19px] font-bold font-display text-text-ink mt-6 mb-3">
              {renderInlineMarkdown(line.substring(2))}
            </h1>
          );
        }

        return (
          <p key={`${idx}-${lIdx}`} className="text-[14px] text-text-ink leading-relaxed my-1.5 min-h-[1rem]">
            {renderInlineMarkdown(line)}
          </p>
        );
      });
    }
  });
}

// Format bytes
function formatBytes(bytes: number, decimals = 2) {
  if (!+bytes) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export default function AIAgentPage() {
  const { dbUser } = useAuth();
  const userId = dbUser?.id;

  // Sidebar visibility
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // States
  const [conversations, setConversations] = useState<any[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [files, setFiles] = useState<any[]>([]);
  
  // UI states
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [loadingChat, setLoadingChat] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [activeModel, setActiveModel] = useState("deepseek/deepseek-chat-v3");
  
  // Model dropdown state
  const [modelMenuOpen, setModelMenuOpen] = useState(false);

  // Input states
  const [inputVal, setInputVal] = useState("");
  const [attachedFiles, setAttachedFiles] = useState<any[]>([]);
  const [uploadingFile, setUploadingFile] = useState(false);

  // Search filter
  const [searchQuery, setSearchQuery] = useState("");

  // Memory manager
  const [memoryOpen, setMemoryOpen] = useState(false);
  const [memories, setMemories] = useState<any[]>([]);
  const [memoryKey, setMemoryKey] = useState("");
  const [memoryVal, setMemoryVal] = useState("");
  const [memoryCategory, setMemoryCategory] = useState("context");

  // Rename modal
  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [convoToRename, setConvoToRename] = useState<string | null>(null);
  const [newName, setNewName] = useState("");

  // Active executing tool track
  const [executingTool, setExecutingTool] = useState<{ id: string; name: string } | null>(null);
  const [toolResults, setToolResults] = useState<Record<string, { output: string; success: boolean }>>({});

  // Refs for auto-scroll and input focus
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const eventSourceRef = useRef<any>(null);

  // Load chat history list
  const loadHistory = useCallback(async () => {
    if (!userId) return;
    try {
      const data = await getConversationsAction(userId);
      setConversations(data || []);
    } catch (e) {
      console.error("Failed to load chat history:", e);
    } finally {
      setLoadingHistory(false);
    }
  }, [userId]);

  // Load conversation details (messages, files)
  const selectConversation = async (convoId: string) => {
    if (!userId) return;
    setLoadingChat(true);
    setActiveConversationId(convoId);
    setStreamingContent("");
    setExecutingTool(null);
    setToolResults({});
    setMobileSidebarOpen(false);

    try {
      const { conversation, messages: msgList, files: fileList } = await getConversationDetailsAction(userId, convoId);
      setMessages(msgList || []);
      setFiles(fileList || []);
      setActiveModel(conversation.model || "deepseek/deepseek-chat-v3");
      setTimeout(scrollToBottom, 50);
    } catch (e) {
      console.error("Failed to load conversation details:", e);
    } finally {
      setLoadingChat(false);
    }
  };

  // Create new conversation
  const createNewChat = () => {
    setActiveConversationId(null);
    setMessages([]);
    setFiles([]);
    setStreamingContent("");
    setExecutingTool(null);
    setToolResults({});
    setAttachedFiles([]);
    setMobileSidebarOpen(false);
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 50);
  };

  // Scroll message list to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Format Textarea Height
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputVal(e.target.value);
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  };

  // Trigger file upload
  const handleFileUploadClick = () => {
    fileInputRef.current?.click();
  };

  // Perform file upload
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingFile(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/ai-agent/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("Upload failed");
      const fileData = await res.json();

      setAttachedFiles((prev) => [...prev, fileData]);
    } catch (err) {
      console.error("File upload error:", err);
    } finally {
      setUploadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Remove attached file
  const removeAttachedFile = (idx: number) => {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  // Submit User Message
  const handleMessageSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputVal.trim() && attachedFiles.length === 0) return;
    if (loadingChat) return;

    const userMessageContent = inputVal.trim();
    setInputVal("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    // Setup optimistic UI
    const tempUserMsgId = `temp-${Date.now()}`;
    const newUserMsg = {
      id: tempUserMsgId,
      role: "user",
      content: userMessageContent,
      created_at: new Date().toISOString(),
    };
    
    setMessages((prev) => [...prev, newUserMsg]);
    setLoadingChat(true);

    const activeFilesList = [...attachedFiles];
    setAttachedFiles([]);

    try {
      // Stream Response from SSE Route
      const res = await fetch("/api/ai-agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: activeConversationId,
          content: userMessageContent,
          model: activeModel,
          files: activeFilesList,
        }),
      });

      if (!res.ok) throw new Error("Chat stream initialization failed");
      
      const reader = res.body?.getReader();
      if (!reader) throw new Error("Could not construct stream reader");

      const decoder = new TextDecoder();
      let buffer = "";
      
      // Update UI with stream
      setStreamingContent("");
      setExecutingTool(null);

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        
        // Parse SSE protocol: data: {...}\n\n
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || ""; // keep incomplete line in buffer

        for (const line of lines) {
          if (!line.trim().startsWith("data: ")) continue;
          const jsonStr = line.replace(/^data:\s*/, "").trim();
          if (!jsonStr) continue;

          try {
            const chunk = JSON.parse(jsonStr);

            if (chunk.type === "info") {
              // Store conversationId if it was newly created
              if (!activeConversationId) {
                setActiveConversationId(chunk.conversationId);
                loadHistory();
              }
            } else if (chunk.type === "content") {
              setStreamingContent((prev) => prev + (chunk.content || ""));
              setTimeout(scrollToBottom, 10);
            } else if (chunk.type === "tool_executing") {
              setExecutingTool({ id: chunk.toolCallId, name: chunk.toolCallName });
              setTimeout(scrollToBottom, 10);
            } else if (chunk.type === "tool_result") {
              setExecutingTool(null);
              setToolResults((prev) => ({
                ...prev,
                [chunk.toolCallId]: { output: chunk.output, success: chunk.success },
              }));
              // Clear streamingContent accumulated in tool blocks and add to message history
              setTimeout(scrollToBottom, 10);
            } else if (chunk.type === "error") {
              setStreamingContent((prev) => prev + `\n\n[Error: ${chunk.error}]`);
            } else if (chunk.type === "done") {
              setStreamingContent("");
              // Reload conversation details to get standard saved messages from database
              if (activeConversationId) {
                selectConversation(activeConversationId);
              } else if (chunk.conversationId) {
                selectConversation(chunk.conversationId);
              }
            }
          } catch (err) {
            console.error("SSE parse chunk error:", err, jsonStr);
          }
        }
      }
    } catch (err) {
      console.error("Failed to execute chat stream:", err);
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: "assistant",
          content: "Failed to communicate with the assistant. Please try again.",
          created_at: new Date().toISOString(),
        },
      ]);
    } finally {
      setLoadingChat(false);
      setStreamingContent("");
      setExecutingTool(null);
      setToolResults({});
      loadHistory();
    }
  };

  // Actions for pinning/favoriting
  const togglePin = async (convoId: string, pinned: boolean) => {
    if (!userId) return;
    try {
      await updateConversationAction(userId, convoId, { pinned });
      loadHistory();
    } catch (e) {
      console.error("Failed to pin convo:", e);
    }
  };

  const toggleFavorite = async (convoId: string, favorite: boolean) => {
    if (!userId) return;
    try {
      await updateConversationAction(userId, convoId, { favorite });
      loadHistory();
    } catch (e) {
      console.error("Failed to favorite convo:", e);
    }
  };

  const archiveConvo = async (convoId: string) => {
    if (!userId) return;
    try {
      await updateConversationAction(userId, convoId, { archived: true });
      if (activeConversationId === convoId) createNewChat();
      loadHistory();
    } catch (e) {
      console.error("Failed to archive convo:", e);
    }
  };

  const deleteConvo = async (convoId: string) => {
    if (!userId) return;
    if (!confirm("Are you sure you want to delete this chat forever?")) return;
    try {
      await deleteConversationAction(userId, convoId);
      if (activeConversationId === convoId) createNewChat();
      loadHistory();
    } catch (e) {
      console.error("Failed to delete convo:", e);
    }
  };

  const triggerRename = (convoId: string, currentTitle: string) => {
    setConvoToRename(convoId);
    setNewName(currentTitle);
    setRenameModalOpen(true);
  };

  const saveRename = async () => {
    if (!userId || !convoToRename || !newName.trim()) return;
    try {
      await updateConversationAction(userId, convoToRename, { title: newName.trim() });
      setRenameModalOpen(false);
      loadHistory();
    } catch (e) {
      console.error("Rename failed:", e);
    }
  };

  // Load Memories
  const loadMemories = useCallback(async () => {
    if (!userId) return;
    try {
      const data = await getMemoryAction(userId);
      setMemories(data || []);
    } catch (e) {
      console.error("Failed to load memory:", e);
    }
  }, [userId]);

  // Save new Memory manually
  const saveMemory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || !memoryKey.trim() || !memoryVal.trim()) return;

    try {
      await addMemoryAction(userId, memoryKey.trim(), memoryVal.trim(), memoryCategory);
      setMemoryKey("");
      setMemoryVal("");
      loadMemories();
    } catch (e) {
      console.error("Memory saving failed:", e);
    }
  };

  const deleteMemoryItem = async (memId: string) => {
    if (!userId) return;
    try {
      await deleteMemoryAction(userId, memId);
      loadMemories();
    } catch (e) {
      console.error("Memory delete failed:", e);
    }
  };

  // Load items on mount
  useEffect(() => {
    if (userId) {
      loadHistory();
      loadMemories();
    }
  }, [userId, loadHistory, loadMemories]);

  // Filter conversations based on search
  const filteredConversations = conversations.filter((c) =>
    c.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Group conversations by Pin, Favorite and Date
  const pinnedConversations = filteredConversations.filter((c) => c.pinned && !c.archived);
  const favoriteConversations = filteredConversations.filter((c) => c.favorite && !c.pinned && !c.archived);
  const standardConversations = filteredConversations.filter((c) => !c.pinned && !c.favorite && !c.archived);

  // Group standard conversations by date
  const groupConversationsByDate = (convos: any[]) => {
    const today: any[] = [];
    const yesterday: any[] = [];
    const last7: any[] = [];
    const older: any[] = [];

    const now = new Date();
    const oneDay = 24 * 60 * 60 * 1000;

    convos.forEach((convo) => {
      const date = new Date(convo.updated_at || convo.created_at);
      const diffTime = Math.abs(now.getTime() - date.getTime());
      const diffDays = Math.ceil(diffTime / oneDay);

      if (diffDays <= 1 && date.getDate() === now.getDate()) {
        today.push(convo);
      } else if (diffDays <= 2) {
        yesterday.push(convo);
      } else if (diffDays <= 7) {
        last7.push(convo);
      } else {
        older.push(convo);
      }
    });

    return { today, yesterday, last7, older };
  };

  const groupedStandard = groupConversationsByDate(standardConversations);

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden font-sans text-text-ink relative bg-background-mist dark:bg-[#0B1120] theme-transition">
      
      {/* ── SIDEBAR DESKTOP ── */}
      <div 
        className={`${
          sidebarOpen ? "w-76" : "w-0"
        } border-r-2.5 border-secondary dark:border-slate-800 bg-surface-white dark:bg-[#111827] flex flex-col transition-all duration-300 overflow-hidden hidden md:flex`}
      >
        {/* Sidebar Header */}
        <div className="p-4 border-b-2.5 border-secondary dark:border-slate-800 flex justify-between items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-primary/10 rounded-btn neo-border border-primary">
              <Bot className="w-5 h-5 text-primary" />
            </div>
            <span className="font-display font-bold text-[15px]">Agent Chats</span>
          </div>
          <button 
            onClick={() => setSidebarOpen(false)}
            className="p-1.5 hover:bg-border-mist dark:hover:bg-slate-800 rounded-btn transition-colors cursor-pointer"
            title="Collapse Sidebar"
          >
            <PanelLeftClose className="w-4 h-4 text-text-slate" />
          </button>
        </div>

        {/* Action Header */}
        <div className="p-3 border-b-2.5 border-secondary dark:border-slate-800 flex flex-col gap-2">
          <button
            onClick={createNewChat}
            className="w-full py-2 px-4 bg-primary text-white font-bold text-[13px] rounded-btn neo-border neo-shadow-sm neo-button-transition neo-button-hover neo-button-active flex items-center justify-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            New Chat
          </button>

          {/* Search Bar */}
          <div className="relative flex items-center bg-background-mist dark:bg-[#0F1629] rounded-btn border-2 border-secondary dark:border-slate-800 px-3 py-1.5">
            <Search className="w-4 h-4 text-text-fog mr-2" />
            <input 
              type="text" 
              placeholder="Search chats..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent border-none text-[12px] focus:outline-none placeholder-text-fog"
            />
          </div>
        </div>

        {/* Conversations Lists */}
        <div className="flex-1 overflow-y-auto p-3 space-y-4 scrollbar-hide">
          {/* Pinned List */}
          {pinnedConversations.length > 0 && (
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-text-fog tracking-wider uppercase pl-2 flex items-center gap-1">
                <Pin className="w-3 h-3 rotate-45" /> Pinned
              </span>
              {pinnedConversations.map((convo) => (
                <SidebarChatItem 
                  key={convo.id} 
                  convo={convo} 
                  active={activeConversationId === convo.id}
                  onSelect={selectConversation}
                  onPin={togglePin}
                  onFavorite={toggleFavorite}
                  onArchive={archiveConvo}
                  onDelete={deleteConvo}
                  onRename={triggerRename}
                />
              ))}
            </div>
          )}

          {/* Favorite List */}
          {favoriteConversations.length > 0 && (
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-text-fog tracking-wider uppercase pl-2 flex items-center gap-1">
                <Star className="w-3 h-3 fill-accent-orange text-accent-orange" /> Favorites
              </span>
              {favoriteConversations.map((convo) => (
                <SidebarChatItem 
                  key={convo.id} 
                  convo={convo} 
                  active={activeConversationId === convo.id}
                  onSelect={selectConversation}
                  onPin={togglePin}
                  onFavorite={toggleFavorite}
                  onArchive={archiveConvo}
                  onDelete={deleteConvo}
                  onRename={triggerRename}
                />
              ))}
            </div>
          )}

          {/* Today Standard List */}
          {groupedStandard.today.length > 0 && (
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-text-fog tracking-wider uppercase pl-2">Today</span>
              {groupedStandard.today.map((convo) => (
                <SidebarChatItem 
                  key={convo.id} 
                  convo={convo} 
                  active={activeConversationId === convo.id}
                  onSelect={selectConversation}
                  onPin={togglePin}
                  onFavorite={toggleFavorite}
                  onArchive={archiveConvo}
                  onDelete={deleteConvo}
                  onRename={triggerRename}
                />
              ))}
            </div>
          )}

          {/* Yesterday Standard List */}
          {groupedStandard.yesterday.length > 0 && (
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-text-fog tracking-wider uppercase pl-2">Yesterday</span>
              {groupedStandard.yesterday.map((convo) => (
                <SidebarChatItem 
                  key={convo.id} 
                  convo={convo} 
                  active={activeConversationId === convo.id}
                  onSelect={selectConversation}
                  onPin={togglePin}
                  onFavorite={toggleFavorite}
                  onArchive={archiveConvo}
                  onDelete={deleteConvo}
                  onRename={triggerRename}
                />
              ))}
            </div>
          )}

          {/* Last 7 Days List */}
          {groupedStandard.last7.length > 0 && (
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-text-fog tracking-wider uppercase pl-2">Previous 7 Days</span>
              {groupedStandard.last7.map((convo) => (
                <SidebarChatItem 
                  key={convo.id} 
                  convo={convo} 
                  active={activeConversationId === convo.id}
                  onSelect={selectConversation}
                  onPin={togglePin}
                  onFavorite={toggleFavorite}
                  onArchive={archiveConvo}
                  onDelete={deleteConvo}
                  onRename={triggerRename}
                />
              ))}
            </div>
          )}

          {/* Older List */}
          {groupedStandard.older.length > 0 && (
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-text-fog tracking-wider uppercase pl-2">Older</span>
              {groupedStandard.older.map((convo) => (
                <SidebarChatItem 
                  key={convo.id} 
                  convo={convo} 
                  active={activeConversationId === convo.id}
                  onSelect={selectConversation}
                  onPin={togglePin}
                  onFavorite={toggleFavorite}
                  onArchive={archiveConvo}
                  onDelete={deleteConvo}
                  onRename={triggerRename}
                />
              ))}
            </div>
          )}

          {conversations.length === 0 && !loadingHistory && (
            <div className="text-center py-6 text-text-fog text-[12px]">
              No conversations yet.
            </div>
          )}
        </div>
      </div>

      {/* ── CHAT CONTAINER ── */}
      <div className="flex-1 flex flex-col overflow-hidden bg-background-mist dark:bg-[#0B1120]">
        
        {/* Header bar */}
        <header className="h-16 px-4 border-b-2.5 border-secondary dark:border-slate-800 bg-surface-white dark:bg-[#111827] flex justify-between items-center z-10">
          
          <div className="flex items-center gap-3">
            {/* Sidebar toggle desktop */}
            {!sidebarOpen && (
              <button 
                onClick={() => setSidebarOpen(true)}
                className="p-1.5 hover:bg-border-mist dark:hover:bg-slate-800 rounded-btn transition-colors cursor-pointer hidden md:block"
                title="Expand Sidebar"
              >
                <PanelLeft className="w-5 h-5 text-text-slate" />
              </button>
            )}

            {/* Mobile Menu trigger */}
            <button 
              onClick={() => setMobileSidebarOpen(true)}
              className="p-2 bg-background-mist dark:bg-slate-800 rounded-btn border border-secondary dark:border-slate-700 md:hidden cursor-pointer"
            >
              <Menu className="w-5 h-5 text-text-slate" />
            </button>

            {/* Title / Current Chat */}
            {activeConversationId ? (
              <div className="flex flex-col">
                <span className="font-display font-bold text-[14px] text-text-ink line-clamp-1">
                  {conversations.find((c) => c.id === activeConversationId)?.title || "Active Chat"}
                </span>
                <span className="text-[10px] text-text-slate uppercase font-bold flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-primary animate-pulse" /> {MODELS.find(m => m.id === activeModel)?.name || "DeepSeek V3"}
                </span>
              </div>
            ) : (
              <div className="flex flex-col">
                <span className="font-display font-bold text-[14px] text-text-ink">New Conversation</span>
                <span className="text-[10px] text-text-slate font-bold">WORKSPACE ASSISTANT</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            
            {/* Model Selector Dropdown */}
            <div className="relative">
              <button
                onClick={() => setModelMenuOpen(!modelMenuOpen)}
                className="py-1.5 px-3 bg-surface-white dark:bg-slate-800 rounded-btn border-2 border-secondary dark:border-slate-700 neo-shadow-sm neo-button-transition hover:-translate-y-0.5 active:translate-y-0 text-[11px] font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-primary" />
                {MODELS.find(m => m.id === activeModel)?.name}
                <ChevronDown className="w-3 h-3 text-text-slate" />
              </button>

              {modelMenuOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-surface-white dark:bg-[#111827] rounded-panel border-2.5 border-secondary dark:border-slate-700 neo-shadow-md z-30 overflow-hidden">
                  <div className="p-2 border-b border-secondary/10 dark:border-slate-800">
                    <span className="text-[10px] font-bold text-text-fog uppercase pl-2">Select LLM Engine</span>
                  </div>
                  <div className="p-1 space-y-0.5">
                    {MODELS.map((model) => (
                      <button
                        key={model.id}
                        onClick={async () => {
                          setActiveModel(model.id);
                          setModelMenuOpen(false);
                          if (activeConversationId && userId) {
                            try {
                              await updateConversationAction(userId, activeConversationId, { model: model.id });
                              loadHistory();
                            } catch (e) { console.error("Model save failed:", e); }
                          }
                        }}
                        className={`w-full text-left p-2 rounded-btn transition-colors hover:bg-border-mist dark:hover:bg-slate-800 flex flex-col cursor-pointer ${
                          activeModel === model.id ? "bg-primary/5 dark:bg-primary/10 border-l-3 border-primary" : ""
                        }`}
                      >
                        <span className="text-[12px] font-bold text-text-ink">{model.name}</span>
                        <span className="text-[10px] text-text-slate">{model.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Memory Manager Toggle */}
            <button
              onClick={() => setMemoryOpen(true)}
              className="py-1.5 px-3 bg-surface-white dark:bg-slate-800 rounded-btn border-2 border-secondary dark:border-slate-700 neo-shadow-sm neo-button-transition hover:-translate-y-0.5 active:translate-y-0 text-[11px] font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <Database className="w-3.5 h-3.5 text-accent-purple" />
              Memory
            </button>
          </div>
        </header>

        {/* Main chat window */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 scrollbar-hide relative">
          
          {loadingChat && messages.length === 0 ? (
            // Chat loading state skeleton
            <div className="space-y-4 max-w-3xl mx-auto py-10">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-border-mist dark:bg-slate-800 animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-border-mist dark:bg-slate-800 rounded w-1/3 animate-pulse" />
                  <div className="h-16 bg-border-mist dark:bg-slate-800 rounded w-3/4 animate-pulse" />
                </div>
              </div>
              <div className="flex items-start justify-end gap-3">
                <div className="flex-1 space-y-2 flex flex-col items-end">
                  <div className="h-4 bg-border-mist dark:bg-slate-800 rounded w-1/4 animate-pulse" />
                  <div className="h-10 bg-border-mist dark:bg-slate-800 rounded w-2/3 animate-pulse" />
                </div>
                <div className="w-8 h-8 rounded-full bg-border-mist dark:bg-slate-800 animate-pulse" />
              </div>
            </div>
          ) : messages.length === 0 ? (
            // Empty State Welcoming Page
            <div className="max-w-3xl mx-auto py-10 md:py-16 text-center space-y-8">
              <div className="flex flex-col items-center gap-3">
                <div className="w-16 h-16 bg-primary/10 rounded-panel neo-border border-primary flex items-center justify-center neo-shadow-md">
                  <Bot className="w-9 h-9 text-primary" />
                </div>
                <h1 className="text-2xl font-bold font-display text-text-ink mt-2">
                  Syncra Workspace Agent
                </h1>
                <p className="text-text-slate text-[14px] max-w-md mx-auto">
                  I can check your briefings, write Gmail replies, execute updates on platforms, and perform workspace automated tasks.
                </p>
              </div>

              {/* Suggestions Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left max-w-2xl mx-auto pt-4">
                <button
                  onClick={() => setInputVal("Summarize today's briefings and list actions.")}
                  className="p-4 bg-surface-white dark:bg-[#111827] rounded-panel border-2 border-secondary dark:border-slate-800 neo-shadow-sm neo-button-transition neo-button-hover neo-button-active text-left cursor-pointer"
                >
                  <FolderSync className="w-5 h-5 text-accent-green mb-2" />
                  <div className="text-[13px] font-bold text-text-ink">Summarize Briefings</div>
                  <div className="text-[11px] text-text-slate mt-1">Get a daily rundown and action items from connected networks.</div>
                </button>

                <button
                  onClick={() => setInputVal("Help me drafts action items to Slack and Outlook.")}
                  className="p-4 bg-surface-white dark:bg-[#111827] rounded-panel border-2 border-secondary dark:border-slate-800 neo-shadow-sm neo-button-transition neo-button-hover neo-button-active text-left cursor-pointer"
                >
                  <Compass className="w-5 h-5 text-accent-purple mb-2" />
                  <div className="text-[13px] font-bold text-text-ink">Draft Action Replies</div>
                  <div className="text-[11px] text-text-slate mt-1">Send customized messages or replies through integrations.</div>
                </button>
              </div>
            </div>
          ) : (
            // Message List
            <div className="max-w-3xl mx-auto space-y-6">
              {messages.map((msg, index) => {
                const isUser = msg.role === "user";
                return (
                  <div key={msg.id || index} className={`flex items-start gap-3 ${isUser ? "justify-end" : ""}`}>
                    
                    {/* Bot avatar */}
                    {!isUser && (
                      <div className="w-8 h-8 rounded-full bg-primary/10 dark:bg-primary/20 border-2 border-secondary dark:border-slate-800 flex items-center justify-center shrink-0">
                        <Bot className="w-4 h-4 text-primary" />
                      </div>
                    )}

                    {/* Message Card */}
                    <div 
                      className={`max-w-[85%] rounded-panel border-2 border-secondary dark:border-slate-800 p-4 neo-shadow-sm ${
                        isUser 
                          ? "bg-secondary text-white border-secondary dark:bg-[#1E293B] dark:border-slate-700" 
                          : "bg-surface-white dark:bg-[#111827]"
                      }`}
                    >
                      {/* Message Content */}
                      <div className="space-y-2">
                        {isUser ? (
                          <p className="text-[14px] leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                        ) : (
                          renderMarkdown(msg.content)
                        )}
                      </div>

                      {/* Tool Calls block (if any) */}
                      {!isUser && msg.toolCalls && msg.toolCalls.length > 0 && (
                        <div className="mt-4 space-y-2 border-t border-secondary/10 dark:border-slate-800 pt-3">
                          <span className="text-[10px] font-bold text-text-fog uppercase tracking-wider block">Tool executions:</span>
                          {msg.toolCalls.map((tc: any, tcIdx: number) => (
                            <ToolExecutionItem key={tc.id || tcIdx} tc={tc} />
                          ))}
                        </div>
                      )}
                    </div>

                    {/* User avatar */}
                    {isUser && (
                      <div className="w-8 h-8 rounded-full bg-secondary dark:bg-slate-700 border-2 border-secondary dark:border-slate-800 flex items-center justify-center shrink-0 text-white font-bold text-[12px] uppercase">
                        <User className="w-4.5 h-4.5" />
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Streaming state UI (real-time thinking / executing / printing) */}
              {(streamingContent || executingTool) && (
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 dark:bg-primary/20 border-2 border-secondary dark:border-slate-800 flex items-center justify-center shrink-0">
                    <Bot className="w-4 h-4 text-primary animate-bounce" />
                  </div>
                  
                  <div className="max-w-[85%] rounded-panel border-2 border-secondary dark:border-slate-800 p-4 neo-shadow-sm bg-surface-white dark:bg-[#111827]">
                    
                    {/* Render live content stream */}
                    {streamingContent ? renderMarkdown(streamingContent) : (
                      <div className="flex items-center gap-2 text-text-slate text-[13px] font-semibold italic">
                        <Loader2 className="w-4 h-4 animate-spin text-primary" />
                        Thinking…
                      </div>
                    )}

                    {/* Live executing tool block */}
                    {executingTool && (
                      <div className="mt-4 border-t border-secondary/10 dark:border-slate-800 pt-3 space-y-2">
                        <span className="text-[10px] font-bold text-text-fog uppercase tracking-wider block">Tool executions:</span>
                        <div className="p-3 bg-background-mist dark:bg-[#0F1629] rounded-btn border border-secondary/10 dark:border-slate-800 flex items-center justify-between gap-3 animate-pulse">
                          <div className="flex items-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin text-accent-purple" />
                            <span className="text-[12px] font-mono font-bold text-text-ink">
                              Executing: {executingTool.name}
                            </span>
                          </div>
                          <span className="text-[10px] bg-accent-purple/10 text-accent-purple px-1.5 py-0.5 rounded font-bold uppercase">
                            MCP
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input box */}
        <footer className="p-4 border-t-2.5 border-secondary dark:border-slate-800 bg-surface-white dark:bg-[#111827] z-10">
          <form onSubmit={handleMessageSubmit} className="max-w-3xl mx-auto space-y-3">
            
            {/* Uploaded files attachment view */}
            {attachedFiles.length > 0 && (
              <div className="flex flex-wrap gap-2 pb-2">
                {attachedFiles.map((file, idx) => (
                  <div 
                    key={idx}
                    className="flex items-center gap-2 px-2.5 py-1 bg-background-mist dark:bg-slate-800 rounded-btn border border-secondary/20 dark:border-slate-700 text-[11px] font-medium text-text-ink"
                  >
                    <span className="max-w-[150px] truncate">{file.name}</span>
                    <span className="text-[9px] text-text-slate">({formatBytes(file.size)})</span>
                    <button 
                      type="button" 
                      onClick={() => removeAttachedFile(idx)}
                      className="text-text-slate hover:text-error transition-colors cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Input wrapper */}
            <div className="flex items-end gap-2 border-2 border-secondary dark:border-slate-800 bg-background-mist dark:bg-[#0F1629] rounded-panel px-3 py-2">
              
              {/* Attachment Button */}
              <button
                type="button"
                onClick={handleFileUploadClick}
                disabled={uploadingFile}
                className="p-1.5 hover:bg-border-mist dark:hover:bg-slate-800 rounded-btn text-text-slate hover:text-text-ink transition-colors cursor-pointer shrink-0 disabled:opacity-50"
                title="Attach files"
              >
                {uploadingFile ? (
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                ) : (
                  <Paperclip className="w-5 h-5" />
                )}
              </button>
              <input 
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                className="hidden"
              />

              {/* Text Input area */}
              <textarea
                ref={textareaRef}
                rows={1}
                placeholder="Message Syncra agent..."
                value={inputVal}
                onChange={handleInputChange}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleMessageSubmit(e);
                  }
                }}
                disabled={loadingChat}
                className="flex-1 bg-transparent border-none text-[13px] leading-relaxed max-h-[200px] py-1.5 resize-none focus:outline-none placeholder-text-slate text-text-ink"
              />

              {/* Submit Button */}
              <button
                type="submit"
                disabled={(!inputVal.trim() && attachedFiles.length === 0) || loadingChat}
                className="p-2 bg-primary text-white rounded-btn neo-border neo-shadow-sm neo-button-transition hover:-translate-y-0.5 active:translate-y-0 shrink-0 cursor-pointer disabled:opacity-50 disabled:transform-none disabled:shadow-none"
              >
                {loadingChat ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            </div>
            
            <div className="flex justify-between items-center px-2">
              <span className="text-[9px] text-text-fog">
                Press Enter to send, Shift+Enter for new line.
              </span>
              {loadingChat && (
                <button
                  type="button"
                  onClick={() => {
                    if (eventSourceRef.current) eventSourceRef.current.abort();
                    setLoadingChat(false);
                    setStreamingContent("");
                    setExecutingTool(null);
                  }}
                  className="text-[10px] text-error font-bold hover:underline cursor-pointer"
                >
                  Cancel Generation
                </button>
              )}
            </div>
          </form>
        </footer>
      </div>

      {/* ── MEMORY MANAGER PANEL (Sheet side drawer) ── */}
      {memoryOpen && (
        <div className="absolute inset-0 bg-black/40 dark:bg-black/60 z-40 flex justify-end">
          <div className="w-full max-w-md bg-surface-white dark:bg-[#111827] h-full border-l-2.5 border-secondary dark:border-slate-800 flex flex-col neo-shadow-lg">
            
            {/* Sheet Header */}
            <div className="p-4 border-b-2.5 border-secondary dark:border-slate-800 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-accent-purple" />
                <span className="font-display font-bold text-[15px]">Agent Memory</span>
              </div>
              <button 
                onClick={() => setMemoryOpen(false)}
                className="p-1 hover:bg-border-mist dark:hover:bg-slate-800 rounded-btn transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Memory form */}
            <form onSubmit={saveMemory} className="p-4 border-b border-secondary/10 dark:border-slate-800 space-y-3">
              <span className="text-[10px] font-bold text-text-fog uppercase block">Add manual memory</span>
              
              <div className="flex gap-2">
                <input 
                  type="text" 
                  placeholder="Key (e.g. preferred_model)"
                  value={memoryKey}
                  onChange={(e) => setMemoryKey(e.target.value)}
                  className="flex-1 text-[12px] p-2 bg-background-mist dark:bg-slate-800 rounded-btn border border-secondary/20 dark:border-slate-700 focus:outline-none"
                  required
                />
                
                <select
                  value={memoryCategory}
                  onChange={(e) => setMemoryCategory(e.target.value)}
                  className="text-[12px] p-2 bg-background-mist dark:bg-slate-800 rounded-btn border border-secondary/20 dark:border-slate-700 focus:outline-none"
                >
                  <option value="context">Context</option>
                  <option value="instruction">Instruction</option>
                  <option value="preference">Preference</option>
                </select>
              </div>

              <div className="flex gap-2">
                <input 
                  type="text" 
                  placeholder="Memory value detail..."
                  value={memoryVal}
                  onChange={(e) => setMemoryVal(e.target.value)}
                  className="flex-1 text-[12px] p-2 bg-background-mist dark:bg-slate-800 rounded-btn border border-secondary/20 dark:border-slate-700 focus:outline-none"
                  required
                />
                <button
                  type="submit"
                  className="py-1.5 px-3 bg-primary text-white font-bold text-[12px] rounded-btn neo-border neo-shadow-sm hover:-translate-y-0.5 active:translate-y-0 cursor-pointer shrink-0"
                >
                  Add
                </button>
              </div>
            </form>

            {/* Memory List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-hide">
              <span className="text-[10px] font-bold text-text-fog uppercase block pb-1">Stored Memories</span>
              
              {memories.map((mem) => (
                <div 
                  key={mem.id}
                  className="p-3 bg-background-mist dark:bg-[#0F1629] rounded-panel border border-secondary/10 dark:border-slate-800 flex justify-between items-start gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[12px] font-mono font-bold text-text-ink">{mem.key}</span>
                      <span className="text-[8px] bg-accent-purple/10 text-accent-purple px-1.5 py-0.5 rounded font-bold uppercase">
                        {mem.category}
                      </span>
                    </div>
                    <p className="text-[11px] text-text-slate">{mem.value}</p>
                  </div>
                  <button
                    onClick={() => deleteMemoryItem(mem.id)}
                    className="p-1 hover:text-error text-text-slate transition-colors cursor-pointer"
                    title="Forget Memory"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}

              {memories.length === 0 && (
                <div className="text-center py-8 text-text-fog text-[12px]">
                  No memory records found.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── RENAME MODAL ── */}
      {renameModalOpen && (
        <div className="absolute inset-0 bg-black/40 dark:bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-surface-white dark:bg-[#111827] rounded-modal border-2.5 border-secondary dark:border-slate-700 p-5 neo-shadow-lg space-y-4">
            <h3 className="font-display font-bold text-[16px]">Rename Chat</h3>
            <input 
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full text-[13px] p-2.5 bg-background-mist dark:bg-slate-800 rounded-btn border border-secondary/20 dark:border-slate-700 focus:outline-none"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setRenameModalOpen(false)}
                className="py-1.5 px-3 border-2 border-secondary dark:border-slate-700 rounded-btn text-[11px] font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={saveRename}
                className="py-1.5 px-4 bg-primary text-white rounded-btn neo-border border-primary text-[11px] font-bold cursor-pointer"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MOBILE SIDEBAR OVERLAY ── */}
      {mobileSidebarOpen && (
        <div className="absolute inset-0 bg-black/40 dark:bg-black/60 z-40 md:hidden flex">
          <div className="w-72 bg-surface-white dark:bg-[#111827] h-full border-r-2.5 border-secondary dark:border-slate-800 flex flex-col">
            <div className="p-4 border-b-2.5 border-secondary dark:border-slate-800 flex justify-between items-center">
              <span className="font-display font-bold text-[14px]">Agent Chats</span>
              <button 
                onClick={() => setMobileSidebarOpen(false)}
                className="p-1 hover:bg-border-mist dark:hover:bg-slate-800 rounded-btn transition-colors cursor-pointer"
              >
                <X className="w-5 h-5 text-text-slate" />
              </button>
            </div>
            
            <div className="p-3 border-b border-secondary/10">
              <button
                onClick={createNewChat}
                className="w-full py-2 bg-primary text-white font-bold text-[13px] rounded-btn neo-border neo-shadow-sm flex items-center justify-center gap-2 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                New Chat
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-3 scrollbar-hide">
              {filteredConversations.map((convo) => (
                <SidebarChatItem 
                  key={convo.id} 
                  convo={convo} 
                  active={activeConversationId === convo.id}
                  onSelect={selectConversation}
                  onPin={togglePin}
                  onFavorite={toggleFavorite}
                  onArchive={archiveConvo}
                  onDelete={deleteConvo}
                  onRename={triggerRename}
                />
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// ── SUB-COMPONENT: SIDEBAR CHAT ITEM ──
function SidebarChatItem({
  convo,
  active,
  onSelect,
  onPin,
  onFavorite,
  onArchive,
  onDelete,
  onRename,
}: {
  convo: any;
  active: boolean;
  onSelect: (id: string) => void;
  onPin: (id: string, pinned: boolean) => void;
  onFavorite: (id: string, favorite: boolean) => void;
  onArchive: (id: string) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, title: string) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div 
      className={`group w-full p-2.5 rounded-btn transition-all duration-200 border-2 flex items-center justify-between gap-2 relative ${
        active 
          ? "bg-secondary text-white border-secondary dark:bg-[#1E293B] dark:border-slate-700" 
          : "bg-surface-white dark:bg-[#111827] border-transparent hover:bg-border-mist dark:hover:bg-slate-800"
      }`}
    >
      <button
        onClick={() => onSelect(convo.id)}
        className="flex-1 text-left flex items-center gap-2 overflow-hidden cursor-pointer"
      >
        <MessageSquare className={`w-4 h-4 shrink-0 ${active ? "text-primary" : "text-text-fog"}`} />
        <span className="text-[12.5px] font-semibold truncate leading-tight pr-1">
          {convo.title || "New Chat"}
        </span>
      </button>

      {/* Action Buttons */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        
        {/* Toggle Pin */}
        <button
          onClick={() => onPin(convo.id, !convo.pinned)}
          className={`p-1 rounded hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer ${
            convo.pinned ? "text-primary opacity-100" : "text-text-fog"
          }`}
          title={convo.pinned ? "Unpin Chat" : "Pin Chat"}
        >
          <Pin className={`w-3.5 h-3.5 ${convo.pinned ? "rotate-45" : ""}`} />
        </button>

        {/* Toggle Favorite */}
        <button
          onClick={() => onFavorite(convo.id, !convo.favorite)}
          className={`p-1 rounded hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer ${
            convo.favorite ? "text-accent-orange opacity-100" : "text-text-fog"
          }`}
          title={convo.favorite ? "Unfavorite Chat" : "Favorite Chat"}
        >
          <Star className={`w-3.5 h-3.5 ${convo.favorite ? "fill-accent-orange" : ""}`} />
        </button>

        {/* Dropdown/Quick Actions Toggle */}
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/5 text-text-fog cursor-pointer"
          title="More actions"
        >
          <Settings className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Floating Settings Menu */}
      {menuOpen && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} />
          <div className="absolute right-2 top-9 bg-white dark:bg-[#1E293B] rounded-panel border-2 border-secondary dark:border-slate-700 shadow-md z-40 w-36 overflow-hidden py-1">
            <button
              onClick={() => { onRename(convo.id, convo.title); setMenuOpen(false); }}
              className="w-full text-left px-3 py-1.5 hover:bg-border-mist dark:hover:bg-slate-700 text-[11px] font-bold text-text-ink flex items-center gap-1.5 cursor-pointer"
            >
              Rename
            </button>
            <button
              onClick={() => { onArchive(convo.id); setMenuOpen(false); }}
              className="w-full text-left px-3 py-1.5 hover:bg-border-mist dark:hover:bg-slate-700 text-[11px] font-bold text-text-ink flex items-center gap-1.5 cursor-pointer"
            >
              <Archive className="w-3 h-3 text-text-fog" />
              Archive
            </button>
            <button
              onClick={() => { onDelete(convo.id); setMenuOpen(false); }}
              className="w-full text-left px-3 py-1.5 hover:bg-error/10 text-error hover:bg-border-mist text-[11px] font-bold flex items-center gap-1.5 cursor-pointer border-t border-secondary/10 dark:border-slate-800"
            >
              <Trash2 className="w-3 h-3" />
              Delete
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ── SUB-COMPONENT: TOOL EXECUTION ITEM ──
function ToolExecutionItem({ tc }: { tc: any }) {
  const [expanded, setExpanded] = useState(false);
  const isSuccess = tc.status === "success";
  const isFailed = tc.status === "failed";
  const duration = tc.duration ? `${(tc.duration / 1000).toFixed(2)}s` : null;

  return (
    <div className="bg-background-mist dark:bg-[#0F1629] rounded-panel border border-secondary/15 dark:border-slate-800 overflow-hidden text-[12.5px] font-mono shadow-sm">
      
      {/* Title Bar */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-3 hover:bg-secondary/5 dark:hover:bg-slate-800 cursor-pointer"
      >
        <div className="flex items-center gap-2">
          {tc.status === "pending" && <Loader2 className="w-4 h-4 animate-spin text-accent-purple" />}
          {isSuccess && <Check className="w-4 h-4 text-success" />}
          {isFailed && <ShieldAlert className="w-4 h-4 text-error" />}
          
          <span className="font-bold text-text-ink">
            {tc.tool_name}
          </span>
        </div>

        <div className="flex items-center gap-2 text-[10px]">
          {duration && <span className="text-text-slate font-sans font-medium">{duration}</span>}
          <span 
            className={`px-1.5 py-0.5 rounded font-sans font-bold uppercase text-[9px] ${
              tc.status === "pending" ? "bg-accent-purple/10 text-accent-purple" : 
              isSuccess ? "bg-success-bg text-success" : "bg-error-bg text-error"
            }`}
          >
            {tc.status}
          </span>
        </div>
      </button>

      {/* Expanded body (Input args and Output results) */}
      {expanded && (
        <div className="p-3 bg-surface-white dark:bg-[#111827] border-t border-secondary/10 dark:border-slate-800 space-y-3 font-mono text-[11px] text-text-slate">
          
          {/* Input Parameters */}
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-text-fog uppercase block font-sans">Arguments</span>
            <pre className="p-2 bg-background-mist dark:bg-[#0F1629] rounded border border-secondary/5 dark:border-slate-800 overflow-x-auto scrollbar-hide text-text-ink">
              {JSON.stringify(tc.arguments, null, 2)}
            </pre>
          </div>

          {/* Output Results */}
          {(tc.output || tc.error) && (
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-text-fog uppercase block font-sans">
                {isFailed ? "Error Message" : "Output Results"}
              </span>
              <pre className={`p-2 rounded border overflow-x-auto scrollbar-hide text-text-ink ${
                isFailed 
                  ? "bg-error-bg/30 border-error/20 text-error" 
                  : "bg-background-mist dark:bg-[#0F1629] border-secondary/5 dark:border-slate-800"
              }`}>
                {tc.output ? (
                  tc.output.startsWith("{") ? JSON.stringify(JSON.parse(tc.output), null, 2) : tc.output
                ) : tc.error}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
