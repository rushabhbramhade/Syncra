"use client";

import React from "react";
import {
  Bot,
  PanelLeftClose,
  Plus,
  Search,
  Pin,
  Star,
} from "lucide-react";
import SidebarChatItem from "./sidebar-chat-item";

function AgentSidebar({
  conversations,
  pinnedConversations,
  favoriteConversations,
  groupedStandard,
  searchQuery,
  onSearchChange,
  activeConversationId,
  onSelect,
  onNewChat,
  onPin,
  onFavorite,
  onArchive,
  onDelete,
  onRename,
  isOpen,
  onClose,
  loadingHistory,
}: {
  conversations: any[];
  pinnedConversations: any[];
  favoriteConversations: any[];
  groupedStandard: { today: any[]; yesterday: any[]; last7: any[]; older: any[] };
  searchQuery: string;
  onSearchChange: (query: string) => void;
  activeConversationId: string | null;
  onSelect: (id: string) => void;
  onNewChat: () => void;
  onPin: (id: string, pinned: boolean) => void;
  onFavorite: (id: string, favorite: boolean) => void;
  onArchive: (id: string) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, title: string) => void;
  isOpen: boolean;
  onClose: () => void;
  loadingHistory: boolean;
}) {
  return (
    <div
      className={`${
        isOpen ? "w-76" : "w-0"
      } border-r-[2px] border-border-mist bg-surface-white flex flex-col transition-all duration-200 overflow-hidden hidden md:flex`}
    >
      <div className="p-4 border-b-[2px] border-border-mist flex justify-between items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-primary/10 rounded-xl border border-primary/20">
            <Bot className="w-5 h-5 text-primary" />
          </div>
          <span className="font-display font-bold text-[15px]">Agent Chats</span>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 hover:bg-border-mist rounded-xl transition-colors cursor-pointer"
          title="Collapse Sidebar"
        >
          <PanelLeftClose className="w-4 h-4 text-text-slate" />
        </button>
      </div>

      <div className="p-3 border-b-[2px] border-border-mist flex flex-col gap-2.5">
        <button
          onClick={onNewChat}
          className="w-full py-2.5 px-4 bg-gradient-to-br from-primary to-primary/80 hover:from-primary/95 hover:to-primary/85 text-white font-bold text-[13.5px] rounded-xl shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          New Chat
        </button>

        <div className="relative flex items-center bg-background-mist rounded-xl border-[2px] border-border-mist focus-within:border-primary/50 px-3 py-2 transition-colors duration-200">
          <Search className="w-4 h-4 text-text-fog mr-2" />
          <input
            type="text"
            placeholder="Search chats..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full bg-transparent border-none text-[12.5px] focus:outline-none placeholder-text-fog"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4 scrollbar-hide">
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
                onSelect={onSelect}
                onPin={onPin}
                onFavorite={onFavorite}
                onArchive={onArchive}
                onDelete={onDelete}
                onRename={onRename}
              />
            ))}
          </div>
        )}

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
                onSelect={onSelect}
                onPin={onPin}
                onFavorite={onFavorite}
                onArchive={onArchive}
                onDelete={onDelete}
                onRename={onRename}
              />
            ))}
          </div>
        )}

        {groupedStandard.today.length > 0 && (
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-text-fog tracking-wider uppercase pl-2">Today</span>
            {groupedStandard.today.map((convo) => (
              <SidebarChatItem
                key={convo.id}
                convo={convo}
                active={activeConversationId === convo.id}
                onSelect={onSelect}
                onPin={onPin}
                onFavorite={onFavorite}
                onArchive={onArchive}
                onDelete={onDelete}
                onRename={onRename}
              />
            ))}
          </div>
        )}

        {groupedStandard.yesterday.length > 0 && (
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-text-fog tracking-wider uppercase pl-2">Yesterday</span>
            {groupedStandard.yesterday.map((convo) => (
              <SidebarChatItem
                key={convo.id}
                convo={convo}
                active={activeConversationId === convo.id}
                onSelect={onSelect}
                onPin={onPin}
                onFavorite={onFavorite}
                onArchive={onArchive}
                onDelete={onDelete}
                onRename={onRename}
              />
            ))}
          </div>
        )}

        {groupedStandard.last7.length > 0 && (
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-text-fog tracking-wider uppercase pl-2">Previous 7 Days</span>
            {groupedStandard.last7.map((convo) => (
              <SidebarChatItem
                key={convo.id}
                convo={convo}
                active={activeConversationId === convo.id}
                onSelect={onSelect}
                onPin={onPin}
                onFavorite={onFavorite}
                onArchive={onArchive}
                onDelete={onDelete}
                onRename={onRename}
              />
            ))}
          </div>
        )}

        {groupedStandard.older.length > 0 && (
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-text-fog tracking-wider uppercase pl-2">Older</span>
            {groupedStandard.older.map((convo) => (
              <SidebarChatItem
                key={convo.id}
                convo={convo}
                active={activeConversationId === convo.id}
                onSelect={onSelect}
                onPin={onPin}
                onFavorite={onFavorite}
                onArchive={onArchive}
                onDelete={onDelete}
                onRename={onRename}
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
  );
}

export { AgentSidebar };
export default AgentSidebar;
