"use client";

import React from "react";
import { Link2 } from "lucide-react";

interface CorrelationLinkProps {
  text: string;
  platform: string;
  onClick?: () => void;
}

function getPlatformColor(platform: string): string {
  const p = platform.toLowerCase();
  if (p === "gmail") return "text-red-500";
  if (p === "outlook") return "text-blue-600";
  if (p === "slack") return "text-purple-500";
  if (p === "whatsapp") return "text-green-500";
  if (p === "telegram") return "text-sky-500";
  if (p === "discord") return "text-indigo-500";
  if (p === "github") return "text-gray-700";
  if (p === "linkedin") return "text-blue-600";
  if (p === "calendar") return "text-emerald-500";
  if (p === "notion") return "text-stone-500";
  if (p === "linear") return "text-rose-500";
  return "text-text-slate";
}

export function CorrelationLink({ text, platform, onClick }: CorrelationLinkProps) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick?.(); }}
      className="inline-flex items-center gap-1.5 text-[11px] font-bold text-text-slate hover:text-accent-purple bg-accent-purple/5 border border-accent-purple/10 px-2 py-1 rounded-lg transition-colors cursor-pointer"
    >
      <Link2 className="w-3 h-3" />
      <span>{text}</span>
      <span className={getPlatformColor(platform)}>{platform}</span>
    </button>
  );
}
