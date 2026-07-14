"use client";

import React, { useState } from "react";
import {
  MessageSquare,
  Pin,
  Star,
  Settings,
  Archive,
  Trash2,
} from "lucide-react";

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
        <MessageSquare
          className={`w-4 h-4 shrink-0 ${active ? "text-primary" : "text-text-fog"}`}
        />
        <span className="text-[12.5px] font-semibold truncate leading-tight pr-1">
          {convo.title || "New Chat"}
        </span>
      </button>

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => onPin(convo.id, !convo.pinned)}
          className={`p-1 rounded hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer ${
            convo.pinned ? "text-primary opacity-100" : "text-text-fog"
          }`}
          title={convo.pinned ? "Unpin Chat" : "Pin Chat"}
        >
          <Pin className={`w-3.5 h-3.5 ${convo.pinned ? "rotate-45" : ""}`} />
        </button>

        <button
          onClick={() => onFavorite(convo.id, !convo.favorite)}
          className={`p-1 rounded hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer ${
            convo.favorite ? "text-accent-orange opacity-100" : "text-text-fog"
          }`}
          title={convo.favorite ? "Unfavorite Chat" : "Favorite Chat"}
        >
          <Star
            className={`w-3.5 h-3.5 ${convo.favorite ? "fill-accent-orange" : ""}`}
          />
        </button>

        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/5 text-text-fog cursor-pointer"
          title="More actions"
        >
          <Settings className="w-3.5 h-3.5" />
        </button>
      </div>

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

export { SidebarChatItem };
export default SidebarChatItem;
