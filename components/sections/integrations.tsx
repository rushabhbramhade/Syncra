"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { MessageSquare, Mail, Layers, Sparkles, Send } from "lucide-react";

export function Integrations() {
  const [activePlatform, setActivePlatform] = useState<string | null>(null);

  const platforms = [
    { name: "Gmail", icon: "📧", color: "border-accent-orange bg-accent-orange/10 text-accent-orange", desc: "Auto-sort labels, filter receipts, draft professional responses." },
    { name: "Slack", icon: "💬", color: "border-accent-pink bg-accent-pink/10 text-accent-pink", desc: "Thread summarization, task creation, follow-up flags." },
    { name: "WhatsApp", icon: "🟢", color: "border-accent-green bg-accent-green/10 text-accent-green", desc: "Summarize voice notes, reply suggestions, client notification hub." },
    { name: "Telegram", icon: "✈️", color: "border-accent-cyan bg-accent-cyan/10 text-accent-cyan", desc: "Group chat indexing, topic highlights, project management." },
    { name: "Outlook", icon: "📬", color: "border-primary bg-primary/10 text-primary", desc: "Calendar synchronization, email reminders, inbox cleaning." },
    { name: "Discord", icon: "👾", color: "border-accent-purple bg-accent-purple/10 text-accent-purple", desc: "Support ticketing, community summaries, alert filters." },
  ];

  return (
    <section id="integrations" className="py-24 md:py-32 bg-background-mist border-b-[2.5px] border-secondary overflow-hidden">
      {/* CSS Animation style block for dashed lines */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes dash {
          to {
            stroke-dashoffset: -20;
          }
        }
        .sync-line {
          stroke-dasharray: 6, 4;
          animation: dash 1.5s linear infinite;
        }
      `}} />

      <div className="max-w-[1280px] mx-auto px-6 md:px-12 grid grid-cols-1 lg:grid-cols-12 gap-16 items-center">
        
        {/* Left Column: Copy */}
        <div className="lg:col-span-5 flex flex-col items-start text-left">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full neo-border bg-accent-cyan text-secondary font-mono text-[13px] font-bold neo-shadow-sm mb-6">
            <Layers className="w-3.5 h-3.5" />
            <span>INTEGRATIONS</span>
          </div>

          <h2 className="font-display font-black text-secondary text-3xl sm:text-4xl md:text-5xl leading-tight tracking-tight mb-6">
            All your systems, <br />
            <span className="text-primary">unified.</span>
          </h2>

          <p className="font-sans text-text-slate text-lg leading-relaxed mb-8 max-w-[540px]">
            Syncar integrates directly with the applications you already use. Setup takes 2 clicks, and sync starts instantly. 
            All connections use TLS encryption and never store data on outside servers.
          </p>

          {/* Active platform detail display */}
          <div className="w-full min-h-[140px] p-5 bg-white rounded-[24px] neo-border neo-shadow-md">
            {activePlatform ? (
              <div>
                <h4 className="font-display font-black text-secondary text-lg mb-1">
                  {activePlatform}
                </h4>
                <p className="font-sans text-sm text-text-slate">
                  {platforms.find(p => p.name === activePlatform)?.desc}
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center text-center h-full text-text-slate/60 font-mono text-sm py-4">
                <Sparkles className="w-5 h-5 text-accent-purple mb-2 animate-bounce" />
                <span>Hover over an icon to see details</span>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Visual Sync Hub */}
        <div className="lg:col-span-7 relative flex justify-center items-center h-[520px] w-full">
          {/* SVG Connector Lines */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
            {/* Top Left */}
            <path d="M 120 120 Q 200 200 290 230" fill="none" stroke="#0F172A" strokeWidth="2.5" className="sync-line" />
            {/* Top Right */}
            <path d="M 440 120 Q 360 200 310 230" fill="none" stroke="#0F172A" strokeWidth="2.5" className="sync-line" />
            
            {/* Mid Left */}
            <path d="M 80 260 H 280" fill="none" stroke="#0F172A" strokeWidth="2.5" className="sync-line" />
            {/* Mid Right */}
            <path d="M 480 260 H 320" fill="none" stroke="#0F172A" strokeWidth="2.5" className="sync-line" />

            {/* Bottom Left */}
            <path d="M 120 400 Q 200 320 290 290" fill="none" stroke="#0F172A" strokeWidth="2.5" className="sync-line" />
            {/* Bottom Right */}
            <path d="M 440 400 Q 360 320 310 290" fill="none" stroke="#0F172A" strokeWidth="2.5" className="sync-line" />
          </svg>

          {/* Central Sync Core */}
          <div className="relative w-36 h-36 rounded-full bg-primary neo-border flex items-center justify-center neo-shadow-lg z-20 hover:scale-105 transition-transform duration-300">
            <div className="absolute inset-0 bg-primary/20 rounded-full animate-ping pointer-events-none" />
            <Layers className="w-14 h-14 text-white" />
          </div>

          {/* Platforms peripheral items */}
          {/* Top Left */}
          <button
            onMouseEnter={() => setActivePlatform("Gmail")}
            onMouseLeave={() => setActivePlatform(null)}
            className="absolute top-14 left-14 md:left-24 w-18 h-18 rounded-2xl neo-border bg-white text-3xl flex items-center justify-center neo-shadow-sm hover:-translate-y-1 hover:shadow-flat-md active:translate-y-0 transition-all cursor-pointer z-10"
            aria-label="Gmail integration details"
          >
            📧
          </button>

          {/* Top Right */}
          <button
            onMouseEnter={() => setActivePlatform("Slack")}
            onMouseLeave={() => setActivePlatform(null)}
            className="absolute top-14 right-14 md:right-24 w-18 h-18 rounded-2xl neo-border bg-white text-3xl flex items-center justify-center neo-shadow-sm hover:-translate-y-1 hover:shadow-flat-md active:translate-y-0 transition-all cursor-pointer z-10"
            aria-label="Slack integration details"
          >
            💬
          </button>

          {/* Mid Left */}
          <button
            onMouseEnter={() => setActivePlatform("WhatsApp")}
            onMouseLeave={() => setActivePlatform(null)}
            className="absolute top-1/2 left-4 md:left-12 -translate-y-1/2 w-18 h-18 rounded-2xl neo-border bg-white text-3xl flex items-center justify-center neo-shadow-sm hover:-translate-y-1 hover:shadow-flat-md active:translate-y-0 transition-all cursor-pointer z-10"
            aria-label="WhatsApp integration details"
          >
            🟢
          </button>

          {/* Mid Right */}
          <button
            onMouseEnter={() => setActivePlatform("Telegram")}
            onMouseLeave={() => setActivePlatform(null)}
            className="absolute top-1/2 right-4 md:right-12 -translate-y-1/2 w-18 h-18 rounded-2xl neo-border bg-white text-3xl flex items-center justify-center neo-shadow-sm hover:-translate-y-1 hover:shadow-flat-md active:translate-y-0 transition-all cursor-pointer z-10"
            aria-label="Telegram integration details"
          >
            ✈️
          </button>

          {/* Bottom Left */}
          <button
            onMouseEnter={() => setActivePlatform("Outlook")}
            onMouseLeave={() => setActivePlatform(null)}
            className="absolute bottom-14 left-14 md:left-24 w-18 h-18 rounded-2xl neo-border bg-white text-3xl flex items-center justify-center neo-shadow-sm hover:-translate-y-1 hover:shadow-flat-md active:translate-y-0 transition-all cursor-pointer z-10"
            aria-label="Outlook integration details"
          >
            📬
          </button>

          {/* Bottom Right */}
          <button
            onMouseEnter={() => setActivePlatform("Discord")}
            onMouseLeave={() => setActivePlatform(null)}
            className="absolute bottom-14 right-14 md:right-24 w-18 h-18 rounded-2xl neo-border bg-white text-3xl flex items-center justify-center neo-shadow-sm hover:-translate-y-1 hover:shadow-flat-md active:translate-y-0 transition-all cursor-pointer z-10"
            aria-label="Discord integration details"
          >
            👾
          </button>
        </div>

      </div>
    </section>
  );
}
