"use client";

import React from "react";
import {
  Search,
  Send,
  Mail,
  Sliders,
  Archive,
  Trash2,
  CornerUpLeft,
  Paperclip,
  FileText,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { MCPTool } from "@/constants/mcp-tools";

function renderLinkedInIcon() {
  return (
    <svg className="w-6 h-6 text-[#0A66C2]" viewBox="0 0 24 24" fill="currentColor">
      <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.32 1.3v-1.11h-2.8v8.37h2.8v-4.67c0-.25.02-.5.1-.68a1.14 1.14 0 0 1 1-.77c.76 0 1 .56 1 1.39v4.73h2.8m-11.23-9.5c-.94 0-1.7.76-1.7 1.7a1.71 1.71 0 0 0 1.7 1.71c.95 0 1.7-.77 1.7-1.71a1.71 1.71 0 0 0-1.7-1.7M5.7 18h2.8v-8.37H5.7V18z" />
    </svg>
  );
}

function renderGitHubIcon() {
  return (
    <svg className="w-6 h-6 text-secondary dark:text-white" viewBox="0 0 24 24" fill="currentColor">
      <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.167 6.839 9.49.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.577.688.479C19.138 20.164 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
    </svg>
  );
}

function getToolIcon(toolName: string) {
  if (toolName.includes("search")) return <Search className="w-4 h-4" />;
  if (toolName.includes("send")) return <Send className="w-4 h-4" />;
  if (toolName.includes("get") || toolName.includes("read")) return <Mail className="w-4 h-4" />;
  if (toolName.includes("list") || toolName.includes("label")) return <Sliders className="w-4 h-4" />;
  if (toolName.includes("archive")) return <Archive className="w-4 h-4" />;
  if (toolName.includes("delete") || toolName.includes("trash")) return <Trash2 className="w-4 h-4" />;
  if (toolName.includes("reply")) return <CornerUpLeft className="w-4 h-4" />;
  if (toolName.includes("attachment")) return <Paperclip className="w-4 h-4" />;
  return <FileText className="w-4 h-4" />;
}

export interface MCPSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  platform: { id: string; name: string; icon: string };
  mcpTools: MCPTool[] | null;
  enabledTools: Record<string, boolean>;
  onToggleTool: (toolName: string) => void;
}

function MCPSettingsModal({
  isOpen,
  onClose,
  platform,
  mcpTools,
  enabledTools,
  onToggleTool,
}: MCPSettingsModalProps) {
  if (!isOpen) return null;

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-surface-white neo-border rounded-[28px] max-w-md w-full overflow-hidden neo-shadow-lg flex flex-col max-h-[85vh] animate-in fade-in zoom-in duration-200 text-left">

        <div className="p-6 border-b-[2.5px] border-border-mist bg-background-mist flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-surface-white border border-border-mist shrink-0">
              {platform.icon ? (
                <img src={platform.icon} alt={platform.name} className="w-6 h-6 object-contain" />
              ) : platform.id === "linkedin" ? (
                renderLinkedInIcon()
              ) : (
                renderGitHubIcon()
              )}
            </div>
            <div>
              <h3 className="font-display font-black text-lg text-secondary">
                {platform.name} MCP Tools
              </h3>
              <p className="text-text-slate text-[12px] font-medium mt-0.5">
                Toggle active tools inside the AI context window.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-black/5 rounded-lg text-text-slate transition-all shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="divide-y-[2px] divide-border-mist">
            {mcpTools === null ? (
              <div className="py-8 text-center text-text-slate italic">
                Loading MCP tools dynamically...
              </div>
            ) : mcpTools.length > 0 ? (
              mcpTools.map((tool) => {
                const isActive = enabledTools[tool.name] !== false;

                return (
                  <div
                    key={tool.name}
                    className="py-4 first:pt-0 last:pb-0 flex items-center justify-between gap-4"
                  >
                    <div className="flex gap-3 items-start min-w-0">
                      <div className={`p-2.5 rounded-xl border-[1.5px] shrink-0 mt-0.5 ${
                        isActive
                          ? "bg-primary/10 border-primary text-primary"
                          : "bg-background-mist border-border-mist text-text-slate"
                      }`}>
                        {getToolIcon(tool.name)}
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-mono font-bold text-[13px] text-secondary truncate">
                          {tool.displayName}
                        </h4>
                        <p className="text-text-slate text-[12px] leading-relaxed mt-0.5 font-medium">
                          {tool.description}
                        </p>
                      </div>
                    </div>

                    <button
                      role="switch"
                      aria-checked={isActive}
                      onClick={() => onToggleTool(tool.name)}
                      className={`w-12 h-[26px] rounded-full p-1 flex items-center cursor-pointer transition-all duration-300 shrink-0 ${
                        isActive ? "bg-success border-[2px] border-secondary justify-end" : "bg-text-fog border-[2px] border-border-mist justify-start"
                      }`}
                    >
                      <span className="w-4 h-4 bg-white rounded-full shadow-inner border border-secondary/25" />
                    </button>
                  </div>
                );
              })
            ) : (
              <div className="py-8 text-center text-text-slate italic">
                No MCP tools exposed for this channel.
              </div>
            )}
          </div>
        </div>

        <div className="p-6 border-t-[2.5px] border-border-mist bg-background-mist flex justify-end shrink-0">
          <Button
            onClick={onClose}
            variant="primary"
            className="min-h-[44px] px-8 text-[14px]"
          >
            Save Settings
          </Button>
        </div>

      </div>
    </div>
  );
}

export { MCPSettingsModal };
export default MCPSettingsModal;
