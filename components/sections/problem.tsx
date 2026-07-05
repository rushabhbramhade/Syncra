"use client";

import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { AlertTriangle, Bell, Clock, Brain, Mail, MessageSquare, AlertCircle } from "lucide-react";

export function Problem() {
  const [activeChaosIndex, setActiveChaosIndex] = useState<number | null>(null);

  const notifications = [
    {
      app: "Slack",
      sender: "Jason",
      desc: "Are you free for a call in 5? Urgent.",
      badgeColor: "bg-accent-pink text-white",
      time: "2m ago",
      icon: <MessageSquare className="w-4 h-4" />
    },
    {
      app: "Gmail",
      sender: "Acme Corp",
      desc: "Update on contract proposal v4.1 - feedback required",
      badgeColor: "bg-accent-orange text-white",
      time: "5m ago",
      icon: <Mail className="w-4 h-4" />
    },
    {
      app: "WhatsApp",
      sender: "Client (Sarah)",
      desc: "Did you check my last voice note? Let me know asap.",
      badgeColor: "bg-accent-green text-white",
      time: "12m ago",
      icon: <MessageSquare className="w-4 h-4" />
    },
    {
      app: "Telegram",
      sender: "Crypto Group",
      desc: "New coin listing update! 100x potential!",
      badgeColor: "bg-accent-cyan text-white",
      time: "15m ago",
      icon: <MessageSquare className="w-4 h-4" />
    },
    {
      app: "Discord",
      sender: "Project-X",
      desc: "@channel we have a critical deployment bug on prod!",
      badgeColor: "bg-accent-purple text-white",
      time: "20m ago",
      icon: <AlertCircle className="w-4 h-4" />
    }
  ];

  return (
    <section id="problem" className="py-24 md:py-32 bg-background-mist border-b-[2.5px] border-secondary">
      <div className="max-w-[1280px] mx-auto px-6 md:px-12 grid grid-cols-1 lg:grid-cols-12 gap-16 items-center">
        
        {/* Left: Headline & Explanation */}
        <div className="lg:col-span-6 flex flex-col items-start">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full neo-border bg-error text-white font-mono text-[13px] font-bold neo-shadow-sm mb-6">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>THE MODERN CRITICAL OVERLOAD</span>
          </div>

          <h2 className="font-display font-black text-secondary text-3xl sm:text-4xl md:text-5xl leading-tight tracking-tight mb-6">
            We are drowning in <br />
            <span className="text-error">communication noise.</span>
          </h2>

          <p className="font-sans text-text-slate text-lg leading-relaxed mb-8 max-w-[540px]">
            Every day, we context-switch between 8 different apps. Work happens in Slack, support in WhatsApp, 
            relations in Telegram, invoices in Gmail. 
            <strong className="text-secondary font-bold"> The result? </strong> 
            Missed deadlines, lost opportunities, and constant digital anxiety.
          </p>

          {/* Stats Boxes */}
          <div className="grid grid-cols-2 gap-4 w-full">
            <Card className="p-5 border-error/50">
              <div className="flex items-center gap-2 mb-2 text-error">
                <Clock className="w-5 h-5" />
                <span className="font-mono text-sm font-black">2.5 HOURS</span>
              </div>
              <p className="font-sans text-[15px] text-text-slate">
                Lost daily to context switching and email retrieval.
              </p>
            </Card>

            <Card className="p-5 border-error/50">
              <div className="flex items-center gap-2 mb-2 text-error">
                <Brain className="w-5 h-5" />
                <span className="font-mono text-sm font-black">64 SECONDS</span>
              </div>
              <p className="font-sans text-[15px] text-text-slate">
                To regain deep focus after checking a single notification.
              </p>
            </Card>
          </div>
        </div>

        {/* Right: The Chaotic Floating Interface Stack */}
        <div className="lg:col-span-6 relative flex justify-center items-center h-[460px] w-full">
          <div className="relative w-full max-w-[420px] p-6 bg-white rounded-[24px] neo-border neo-shadow-md">
            <div className="flex items-center justify-between border-b-[2.5px] border-secondary pb-4 mb-4">
              <div className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-error animate-bounce" />
                <span className="font-display font-black text-secondary">Incoming Overload</span>
              </div>
              <span className="font-mono text-xs text-error font-bold px-2 py-0.5 rounded-full bg-error/10">
                +148 UNREAD
              </span>
            </div>

            {/* Simulated Notification Stack */}
            <div className="flex flex-col gap-3">
              {notifications.map((notif, idx) => (
                <div
                  key={idx}
                  onMouseEnter={() => setActiveChaosIndex(idx)}
                  onMouseLeave={() => setActiveChaosIndex(null)}
                  className={`p-3.5 rounded-[18px] border-[2px] transition-all duration-200 cursor-pointer ${
                    activeChaosIndex === idx
                      ? "border-error bg-error/5 -translate-y-1 neo-shadow-sm"
                      : "border-border-mist bg-background-mist/50"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <div className={`p-1 rounded-md ${notif.badgeColor} neo-border`}>
                        {notif.icon}
                      </div>
                      <span className="font-mono text-xs font-bold text-secondary">
                        {notif.app}
                      </span>
                      <span className="font-sans text-xs text-text-slate font-bold">
                        • {notif.sender}
                      </span>
                    </div>
                    <span className="font-mono text-[10px] text-text-muted">{notif.time}</span>
                  </div>
                  <p className="font-sans text-xs text-text-slate line-clamp-1">
                    {notif.desc}
                  </p>
                </div>
              ))}
            </div>

            {/* Chaotic overlapping dialog overlays (surrealist feeling) */}
            <div className="absolute -top-6 -right-6 bg-accent-orange text-secondary px-4 py-2 rounded-full neo-border font-mono text-xs font-black neo-shadow-sm rotate-[12deg] pointer-events-none">
              ⚠️ PING!
            </div>
            <div className="absolute -bottom-8 -left-8 bg-error text-white px-4 py-2.5 rounded-[18px] neo-border font-mono text-xs font-black neo-shadow-md -rotate-[8deg] pointer-events-none">
              📢 3 MISSED CALLS
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}
