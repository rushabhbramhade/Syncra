"use client";

import React, { useState } from "react";
import { Sparkles, Brain, Search, Clock, FileText, CheckCircle, ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function AICapabilities() {
  const [activeTab, setActiveTab] = useState(0);

  const capabilities = [
    {
      title: "Context-Aware Memory",
      tagline: "Build a permanent knowledge base.",
      desc: "Syncar doesn't just read messages — it learns about your products, projects, team members, and clients. It maintains a secure local context graph so it can provide perfect answers later.",
      icon: <Brain className="w-5 h-5" />,
      color: "bg-accent-purple text-white",
      preview: (
        <div className="flex flex-col gap-3 font-sans text-xs">
          <div className="bg-background-mist p-3 rounded-lg border border-border-mist">
            <span className="font-mono text-[9px] font-bold text-accent-purple uppercase block mb-1">LOCAL MEMORY LAYER</span>
            <strong>Knowledge added:</strong> Sophia is the Lead Designer. Project Acme launched Q3. Figma file links stored under /design.
          </div>
          <div className="bg-background-mist p-3 rounded-lg border border-border-mist opacity-70">
            <span className="font-mono text-[9px] font-bold text-text-slate uppercase block mb-1">RELATIONSHIP GRAPH</span>
            <strong>Connected nodes:</strong> [Jason] -- (Developer) -- [API gateway token issue]
          </div>
        </div>
      )
    },
    {
      title: "AI Summarizer",
      tagline: "1-hour meetings, 10-second summaries.",
      desc: "Never read 200 message threads. Get clean bullet points, core files mentioned, calendar blocks suggested, and who needs to do what. Instantly compiled and cataloged.",
      icon: <FileText className="w-5 h-5" />,
      color: "bg-accent-pink text-white",
      preview: (
        <div className="flex flex-col gap-3 font-sans text-xs">
          <div className="bg-white p-3 rounded-lg border-[2.5px] border-secondary neo-shadow-sm">
            <div className="flex items-center gap-1.5 mb-1">
              <Sparkles className="w-3.5 h-3.5 text-accent-purple" />
              <strong className="text-secondary text-sm">Thread Summary</strong>
            </div>
            <ul className="list-disc pl-4 space-y-1 mt-2 text-text-slate">
              <li>Jason requests API gateway endpoint review.</li>
              <li>Launch delayed by 2 days until resolved.</li>
              <li>Sophia has uploaded design mocks to GDrive.</li>
            </ul>
          </div>
        </div>
      )
    },
    {
      title: "Semantic Cross-Search",
      tagline: "Search by meaning, not keywords.",
      desc: "Query 'pricing discussion' and Syncar searches invoice emails, Slack chat threads, WhatsApp files, and Telegram messages all at once, returning exact results with citations.",
      icon: <Search className="w-5 h-5" />,
      color: "bg-accent-cyan text-secondary",
      preview: (
        <div className="flex flex-col gap-2 font-sans text-xs">
          <div className="bg-secondary text-white p-2.5 rounded-lg font-mono text-[11px] flex justify-between">
            <span>Query: "Acme budget proposal"</span>
            <span className="text-accent-yellow">Searching...</span>
          </div>
          <div className="space-y-1.5">
            <div className="bg-white p-2.5 rounded-lg border border-border-mist flex justify-between items-center">
              <span>📄 Acme_Quote_v3.pdf</span>
              <span className="font-mono text-[10px] text-accent-orange">Gmail</span>
            </div>
            <div className="bg-white p-2.5 rounded-lg border border-border-mist flex justify-between items-center">
              <span>💬 'Jason agreed on $12K cap'</span>
              <span className="font-mono text-[10px] text-accent-pink">Slack</span>
            </div>
          </div>
        </div>
      )
    },
    {
      title: "Action Item Engine",
      tagline: "Auto-detect deadlines & tasks.",
      desc: "Whenever someone says 'I will send this by Monday' or 'Could you check that file', Syncar automatically detects the action, creates a reminder card, and populates your task manager.",
      icon: <Clock className="w-5 h-5" />,
      color: "bg-accent-yellow text-secondary",
      preview: (
        <div className="flex flex-col gap-3 font-sans text-xs">
          <div className="bg-background-mist p-3 rounded-lg border border-border-mist flex items-center justify-between">
            <div>
              <span className="font-mono text-[9px] font-bold text-accent-green uppercase block mb-1">TASK DETECTED</span>
              <strong>Action:</strong> Send mockup reviews to team
            </div>
            <span className="font-mono text-[10px] text-text-muted">Due 5pm</span>
          </div>
          <div className="bg-background-mist p-3 rounded-lg border border-border-mist opacity-70">
            <div>
              <span className="font-mono text-[9px] font-bold text-text-slate uppercase block mb-1">UPCOMING CALENDAR</span>
              <strong>Meeting:</strong> Acme Q3 Review (Mon 2pm)
            </div>
          </div>
        </div>
      )
    }
  ];

  return (
    <section id="ai-capabilities" className="py-24 md:py-32 bg-white border-b-[2.5px] border-secondary">
      <div className="max-w-[1280px] mx-auto px-6 md:px-12">
        {/* Intro */}
        <div className="text-center max-w-[800px] mx-auto mb-16">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full neo-border bg-accent-purple text-white font-mono text-[13px] font-bold neo-shadow-sm mb-6">
            <Brain className="w-3.5 h-3.5" />
            <span>AI CAPABILITIES</span>
          </div>

          <h2 className="font-display font-black text-secondary text-3xl sm:text-4xl md:text-5xl leading-tight tracking-tight mb-6">
            Powered by the <span className="text-primary">Syncar AI Brain.</span>
          </h2>

          <p className="font-sans text-text-slate text-lg">
            Explore the algorithms running in the background to simplify your digital workplace.
          </p>
        </div>

        {/* Interactive Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Left: Tab list */}
          <div className="lg:col-span-6 flex flex-col gap-4">
            {capabilities.map((cap, index) => (
              <button
                key={index}
                onClick={() => setActiveTab(index)}
                className={`flex items-start gap-4 p-5 rounded-[24px] border-[2px] transition-all duration-300 text-left outline-none cursor-pointer ${
                  activeTab === index
                    ? "border-secondary bg-background-mist -translate-y-1 neo-shadow-md"
                    : "border-border-mist bg-transparent hover:border-text-slate/40"
                }`}
              >
                <div className={`p-3 rounded-xl neo-border shrink-0 ${cap.color}`}>
                  {cap.icon}
                </div>
                <div>
                  <h3 className="font-display font-black text-secondary text-lg mb-1">
                    {cap.title}
                  </h3>
                  <span className="font-mono text-xs text-text-slate font-bold block mb-2">
                    {cap.tagline}
                  </span>
                </div>
              </button>
            ))}
          </div>

          {/* Right: Tab Detail Preview Panel */}
          <div className="lg:col-span-6">
            <Card className="min-h-[380px] bg-white rounded-[28px] neo-border neo-shadow-lg p-8 flex flex-col justify-between">
              <div>
                <span className="font-mono text-xs text-text-slate font-bold uppercase tracking-wider block mb-4 border-b border-border-mist pb-2">
                  MODULE EXPLORER
                </span>

                <h3 className="font-display font-black text-secondary text-2xl mb-2">
                  {capabilities[activeTab].title}
                </h3>
                <p className="font-sans text-text-slate text-[15px] leading-relaxed mb-6">
                  {capabilities[activeTab].desc}
                </p>
              </div>

              {/* Dynamic visual preview block */}
              <div className="p-5 bg-background-mist rounded-[18px] neo-border">
                {capabilities[activeTab].preview}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </section>
  );
}
