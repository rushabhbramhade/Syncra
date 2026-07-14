"use client";

import React from "react";
import { Card } from "@/components/ui/card";
import { Link, Zap, Eye, Check } from "lucide-react";

export function WorkflowTimeline() {
  const steps = [
    {
      step: "01",
      title: "Authorize Services",
      tagline: "Secure connection in seconds",
      desc: "Authenticate your chat accounts (WhatsApp, Slack, Telegram) and mail accounts (Gmail, Outlook) with safe credentials.",
      icon: <Link className="w-5 h-5" />,
      color: "bg-accent-purple text-white"
    },
    {
      step: "02",
      title: "Local Sync & Analyze",
      tagline: "Context builds automatically",
      desc: "Syncar scans past conversations to build a local map of projects, partners, deadlines, and links.",
      icon: <Zap className="w-5 h-5" />,
      color: "bg-accent-yellow text-secondary"
    },
    {
      step: "03",
      title: "Consolidated Stream",
      tagline: "Ditch the app hopping",
      desc: "Log into the clean Syncar portal. Review your smart summaries and action items in one list.",
      icon: <Eye className="w-5 h-5" />,
      color: "bg-accent-pink text-white"
    },
    {
      step: "04",
      title: "One-Click Execution",
      tagline: "Perform hours of work in minutes",
      desc: "Draft replies, approve payments, file receipts, create tasks, and sync updates back to their source platforms.",
      icon: <Check className="w-5 h-5" />,
      color: "bg-accent-green text-white"
    }
  ];

  return (
    <section id="workflow" className="py-24 md:py-32 bg-background-mist border-b-[2.5px] border-secondary">
      <div className="max-w-[1280px] mx-auto px-6 md:px-12">
        
        {/* Intro */}
        <div className="text-center max-w-[800px] mx-auto mb-20">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full neo-border bg-accent-pink text-white font-mono text-[13px] font-bold neo-shadow-sm mb-6">
            <span>WORKFLOW TIMELINE</span>
          </div>

          <h2 className="font-display font-black text-secondary text-3xl sm:text-4xl md:text-5xl leading-tight tracking-tight mb-6">
            How Syncar streamlines <br />
            <span className="text-primary">your daily workspace.</span>
          </h2>

          <p className="font-sans text-text-slate text-lg">
            From setup to automated operations in four simple, secure stages.
          </p>
        </div>

        {/* Timeline Grid */}
        <div className="relative">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 relative z-10">
            {steps.map((item, idx) => (
              <div key={idx} className="flex flex-col items-center text-center">
                
                {/* Timeline badge with connector bubble */}
                <div className="relative flex items-center justify-center mb-6">
                  <div className={`w-14 h-14 rounded-full neo-border ${item.color} flex items-center justify-center font-mono font-black text-xl neo-shadow-sm z-10`}>
                    {item.step}
                  </div>
                </div>

                {/* Card container */}
                <Card className="flex-1 w-full bg-white p-6 rounded-[24px] neo-border neo-shadow-sm text-left flex flex-col justify-between hover:-translate-y-1 transition-transform">
                  <div>
                    <div className="flex items-center gap-2 mb-2 text-text-slate">
                      {item.icon}
                      <span className="font-mono text-[11px] font-bold uppercase tracking-wider">
                        {item.tagline}
                      </span>
                    </div>
                    <h3 className="font-display font-black text-lg text-secondary mb-2">
                      {item.title}
                    </h3>
                    <p className="font-sans text-xs leading-relaxed text-text-slate">
                      {item.desc}
                    </p>
                  </div>
                </Card>

              </div>
            ))}
          </div>
        </div>

      </div>
    </section>
  );
}
