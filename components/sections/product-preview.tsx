"use client";

import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { Sparkles, MessageSquare, Mail, Search, CheckSquare, Bell, Calendar, Send, Compass } from "lucide-react";

export function ProductPreview() {
  const [activeHotspot, setActiveHotspot] = useState<number | null>(null);

  const hotspots = [
    {
      id: 1,
      title: "Omni-Search Bar",
      desc: "Search across every conversation, email, attachment, and link in Slack, Whatsapp, and Gmail simultaneously.",
      position: "top-[6%] left-[30%]"
    },
    {
      id: 2,
      title: "AI Consolidated Feed",
      desc: "All incoming streams sorted, cleaned, and condensed. No unread message stress — just high-level priorities.",
      position: "top-[25%] left-[15%]"
    },
    {
      id: 3,
      title: "Dynamic Smart Summaries",
      desc: "Get context-rich bullet points. Auto-extracts action items, calendar invites, files, and follow-up flags.",
      position: "top-[40%] right-[32%]"
    },
    {
      id: 4,
      title: "One-Click Quick Reply",
      desc: "AI draft system matches your writing style to generate drafts. Review, adjust, and reply in under 5 seconds.",
      position: "bottom-[18%] right-[12%]"
    }
  ];

  const dashboardFeed = [
    {
      app: "WhatsApp",
      badgeColor: "bg-accent-green text-white",
      sender: "Sophia (Designer)",
      subject: "Updated mockup assets",
      desc: "Uploaded the final design frames to the shared drive. Let me know when you review.",
      status: "Task: Review mockups",
      time: "10m ago"
    },
    {
      app: "Slack",
      badgeColor: "bg-accent-pink text-white",
      sender: "Jason (Dev)",
      subject: "API Gateway blocker",
      desc: "Having issues with the checkout endpoint token expiration. Blocking launch preparation.",
      status: "Priority: Critical",
      time: "24m ago"
    },
    {
      app: "Gmail",
      badgeColor: "bg-accent-orange text-white",
      sender: "Loom Invoice",
      subject: "Your monthly invoice is ready",
      desc: "Invoice for team account billed on Jul 5. Total amount: $48.00.",
      status: "Auto-archived",
      time: "2h ago"
    }
  ];

  return (
    <section id="preview" className="py-24 md:py-32 bg-background-mist border-b-[2.5px] border-secondary overflow-hidden">
      <div className="max-w-[1280px] mx-auto px-6 md:px-12 text-center">
        {/* Intro */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full neo-border bg-accent-purple text-white font-mono text-[13px] font-bold neo-shadow-sm mb-6">
          <Compass className="w-3.5 h-3.5" />
          <span>PRODUCT INTERACTION</span>
        </div>

        <h2 className="font-display font-black text-secondary text-3xl sm:text-4xl md:text-5xl leading-tight tracking-tight mb-6 max-w-[800px] mx-auto">
          Deep work starts here. <br />
          Explore the <span className="text-primary">Syncar Dashboard.</span>
        </h2>

        <p className="font-sans text-text-slate text-lg max-w-[620px] mx-auto mb-16">
          Interactive Hotspots are scattered across the screen. Click on a glowing hotspot to see how the Syncar engine operates.
        </p>

        {/* Dashboard Mockup Container */}
        <div className="relative w-full max-w-[1080px] mx-auto bg-white rounded-[28px] neo-border neo-shadow-lg overflow-hidden flex flex-col md:flex-row aspect-video md:h-[620px] select-none text-left">
          
          {/* Dashboard Sidebar */}
          <div className="w-full md:w-60 bg-secondary text-white p-6 flex flex-col border-r-[2.5px] border-secondary">
            <div className="flex items-center gap-2 mb-8">
              <div className="w-6 h-6 rounded bg-primary flex items-center justify-center font-black text-sm">
                S
              </div>
              <span className="font-display font-bold text-lg tracking-tight">Syncar Hub</span>
            </div>

            <nav className="flex flex-col gap-3 font-sans text-[15px] font-medium text-text-fog/75">
              <a href="#" className="flex items-center gap-2.5 text-white bg-white/10 px-3.5 py-2 rounded-[12px] font-bold">
                <Bell className="w-4.5 h-4.5 text-primary" />
                <span>Inbox Feed</span>
              </a>
              <a href="#" className="flex items-center gap-2.5 hover:text-white px-3.5 py-2 rounded-[12px]">
                <Calendar className="w-4.5 h-4.5" />
                <span>Tasks & Reminders</span>
              </a>
              <a href="#" className="flex items-center gap-2.5 hover:text-white px-3.5 py-2 rounded-[12px]">
                <Search className="w-4.5 h-4.5" />
                <span>Search Archives</span>
              </a>
            </nav>

            <div className="mt-auto flex items-center gap-2 border-t border-white/10 pt-4">
              <div className="w-8 h-8 rounded-full bg-accent-purple flex items-center justify-center font-bold text-xs text-white neo-border border-white">
                ME
              </div>
              <div className="flex flex-col font-sans text-xs">
                <span className="font-bold text-white">Alex Johnson</span>
                <span className="text-text-fog text-[10px]">Free Tier</span>
              </div>
            </div>
          </div>

          {/* Dashboard Main Content */}
          <div className="flex-1 bg-background-mist flex flex-col min-h-0 relative">
            
            {/* Dashboard Top Search Header */}
            <div className="bg-white px-8 py-4 border-b-[2.5px] border-secondary flex items-center gap-4 relative z-0">
              <Search className="w-5 h-5 text-text-slate" />
              <input
                type="text"
                placeholder="Ask AI or search WhatsApp, Slack, Gmail..."
                className="bg-transparent border-none outline-none font-sans text-sm text-secondary w-full placeholder:text-text-muted"
                disabled
              />
            </div>

            {/* Dashboard Workspace Columns */}
            <div className="flex-1 p-6 md:p-8 grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-0 overflow-y-auto">
              
              {/* Left Feed Panel */}
              <div className="lg:col-span-6 flex flex-col gap-4">
                <h3 className="font-display font-black text-sm text-secondary tracking-wide uppercase">
                  UNREAD SUMMARIES (3)
                </h3>

                <div className="flex flex-col gap-3.5">
                  {dashboardFeed.map((item, idx) => (
                    <div
                      key={idx}
                      className={`p-4 bg-white rounded-[18px] border-[2px] border-secondary ${
                        idx === 0 ? "neo-shadow-sm border-primary" : "border-secondary/40 shadow-none"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className={`font-mono text-[9px] font-bold px-2 py-0.5 rounded-full ${item.badgeColor}`}>
                          {item.app}
                        </span>
                        <span className="font-mono text-[10px] text-text-muted">{item.time}</span>
                      </div>
                      <h4 className="font-sans font-bold text-[14px] text-secondary">
                        {item.sender}
                      </h4>
                      <p className="font-sans text-xs text-text-slate line-clamp-2 mt-1">
                        {item.desc}
                      </p>
                      
                      <div className="flex items-center justify-between mt-3 pt-3 border-t border-border-mist">
                        <span className="font-mono text-[10px] text-accent-purple font-bold">
                          {item.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right Summary Details Panel */}
              <div className="lg:col-span-6 bg-white p-6 rounded-[24px] border-[2.5px] border-secondary flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-4 pb-4 border-b border-border-mist">
                    <span className="font-mono text-[10px] font-bold text-accent-green px-2 py-0.5 rounded-full bg-accent-green/10">
                      ACTIVE SUMMARIZATION
                    </span>
                    <span className="font-mono text-[10px] text-text-muted">WhatsApp • 10m ago</span>
                  </div>

                  <h3 className="font-display font-black text-lg text-secondary mb-2">
                    Updated mockup assets
                  </h3>
                  <p className="font-sans text-xs text-text-slate mb-4">
                    From Sophia (Lead Designer) regarding design files:
                  </p>

                  <div className="space-y-2 mb-6">
                    <div className="bg-background-mist p-3 rounded-[12px] text-xs font-sans text-secondary flex items-start gap-2">
                      <Sparkles className="w-4 h-4 text-accent-purple shrink-0 mt-0.5" />
                      <div>
                        <strong>Key points:</strong> Sophia has loaded the latest Figma export images into GDrive. Needs review of the onboarding screen flow.
                      </div>
                    </div>
                    
                    <div className="bg-background-mist p-3 rounded-[12px] text-xs font-sans text-secondary flex items-start gap-2">
                      <CheckSquare className="w-4 h-4 text-accent-green shrink-0 mt-0.5" />
                      <div>
                        <strong>Task created:</strong> Review onboarding screen mockups. (Assigned to you)
                      </div>
                    </div>
                  </div>
                </div>

                {/* Reply draft zone */}
                <div className="border-t border-border-mist pt-4">
                  <div className="bg-background-mist p-3 rounded-[18px] border border-border-mist flex items-center justify-between">
                    <span className="font-sans text-xs text-text-slate">
                      AI Draft: "Looks great, Sophia! I'll review..."
                    </span>
                    <button className="p-1.5 rounded-lg bg-primary text-white border border-secondary hover:scale-105 active:scale-95 transition-transform" disabled>
                      <Send className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

            </div>

          </div>

          {/* Interactive Hotspot buttons overlay */}
          {hotspots.map((spot) => (
            <div key={spot.id} className={`absolute ${spot.position} z-30`}>
              <button
                onClick={() => setActiveHotspot(activeHotspot === spot.id ? null : spot.id)}
                className={`w-6 h-6 rounded-full border-2 border-secondary flex items-center justify-center font-bold text-xs select-none outline-none transition-all duration-300 ${
                  activeHotspot === spot.id
                    ? "bg-primary text-white scale-125 shadow-flat-sm animate-none"
                    : "bg-accent-yellow text-secondary scale-100 hover:scale-110 shadow-none animate-ping"
                }`}
                aria-label={`Hotspot info: ${spot.title}`}
              >
                {spot.id}
              </button>

              {/* Glowing static overlay for ping element */}
              <span className={`absolute inset-0 rounded-full border-2 border-accent-yellow scale-125 z-0 pointer-events-none ${activeHotspot === spot.id ? "hidden" : "animate-ping"}`} />

              {/* Tooltip Card */}
              {activeHotspot === spot.id && (
                <div className="absolute top-8 left-1/2 -translate-x-1/2 w-[260px] p-4 bg-secondary text-white rounded-[18px] border-2 border-white shadow-flat-lg z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                  <h4 className="font-display font-black text-sm text-accent-yellow mb-1">
                    {spot.title}
                  </h4>
                  <p className="font-sans text-xs text-text-fog leading-relaxed">
                    {spot.desc}
                  </p>
                </div>
              )}
            </div>
          ))}

        </div>
      </div>
    </section>
  );
}
