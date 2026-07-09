"use client";

import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { Sparkles, MessageSquare, Mail, Layers, FileText, CheckSquare, Zap } from "lucide-react";

export function Solution() {
  const [activeStep, setActiveStep] = useState(0);

  const steps = [
    {
      title: "1. Centralized Sync",
      desc: "Connect your workspace platforms. Syncar continuously streams all incoming messages securely.",
      icon: <Layers className="w-5 h-5" />,
      color: "border-primary text-primary bg-primary/5"
    },
    {
      title: "2. AI Prioritization",
      desc: "Our localized LLM maps relationships, identifies action items, and weeds out noise.",
      icon: <Sparkles className="w-5 h-5 text-accent-purple" />,
      color: "border-accent-purple text-accent-purple bg-accent-purple/5"
    },
    {
      title: "3. Clean Action Hub",
      desc: "Get an interactive workspace: priorities, instant summaries, reminders, and draft replies.",
      icon: <CheckSquare className="w-5 h-5 text-accent-green" />,
      color: "border-accent-green text-accent-green bg-accent-green/5"
    }
  ];

  return (
    <section id="solution" className="py-24 md:py-32 bg-white border-b-[2.5px] border-secondary overflow-hidden">
      <div className="max-w-[1280px] mx-auto px-6 md:px-12 grid grid-cols-1 lg:grid-cols-12 gap-16 items-center">
        
        {/* Left Column: Visual Pipeline */}
        <div className="lg:col-span-6 relative flex flex-col justify-center items-center w-full min-h-[460px]">
          
          {/* Main Visualizer Board */}
          <div className="w-full max-w-[460px] bg-background-mist p-6 rounded-[24px] neo-border neo-shadow-md relative">
            <div className="flex items-center gap-2 mb-6">
              <Zap className="w-5 h-5 text-primary" />
              <span className="font-display font-black text-secondary">The Syncar Pipeline</span>
            </div>

            {/* Input Platforms (Messy) */}
            <div className="flex justify-between items-center gap-2 mb-8">
              <div className="p-3 bg-white rounded-lg neo-border shadow-flat-sm text-accent-pink flex flex-col items-center">
                <MessageSquare className="w-6 h-6" />
                <span className="font-mono text-[9px] font-bold mt-1">Slack</span>
              </div>
              <div className="p-3 bg-white rounded-lg neo-border shadow-flat-sm text-accent-orange flex flex-col items-center">
                <Mail className="w-6 h-6" />
                <span className="font-mono text-[9px] font-bold mt-1">Gmail</span>
              </div>
              <div className="p-3 bg-white rounded-lg neo-border shadow-flat-sm text-accent-green flex flex-col items-center">
                <MessageSquare className="w-6 h-6" />
                <span className="font-mono text-[9px] font-bold mt-1">WhatsApp</span>
              </div>
              <div className="p-3 bg-white rounded-lg neo-border shadow-flat-sm text-accent-cyan flex flex-col items-center">
                <MessageSquare className="w-6 h-6" />
                <span className="font-mono text-[9px] font-bold mt-1">Telegram</span>
              </div>
            </div>

            {/* Middle: Engine Core */}
            <div className="flex justify-center mb-8 relative z-10">
              <div className="px-6 py-3.5 rounded-[18px] neo-border bg-accent-purple text-white font-mono text-sm font-black flex items-center gap-2 neo-shadow-md animate-pulse">
                <Sparkles className="w-5 h-5 fill-white" />
                <span>SYNCAR AI SYSTEM</span>
              </div>
            </div>

            {/* Output: Structured & Clean Actions */}
            <div className="flex flex-col gap-3">
              <div className="bg-white p-3 rounded-[18px] neo-border shadow-flat-sm flex items-center justify-between border-l-[6px] border-l-accent-purple">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-text-slate" />
                  <span className="font-sans text-xs font-bold text-secondary">Summarized 12 messages from Jason</span>
                </div>
                <span className="font-mono text-[10px] text-text-muted">Finance</span>
              </div>

              <div className="bg-white p-3 rounded-[18px] neo-border shadow-flat-sm flex items-center justify-between border-l-[6px] border-l-accent-green">
                <div className="flex items-center gap-2">
                  <CheckSquare className="w-4 h-4 text-text-slate" />
                  <span className="font-sans text-xs font-bold text-secondary">Task: Review Acme contract proposal</span>
                </div>
                <span className="font-mono text-[10px] text-text-muted">Due 5pm</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Steps description */}
        <div className="lg:col-span-6 flex flex-col items-start">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full neo-border bg-accent-green text-white font-mono text-[13px] font-bold neo-shadow-sm mb-6">
            <Sparkles className="w-3.5 h-3.5" />
            <span>THE SOLUTION</span>
          </div>

          <h2 className="font-display font-black text-secondary text-3xl sm:text-4xl md:text-5xl leading-tight tracking-tight mb-8">
            How Syncar restores <br />
            <span className="text-primary">your focus.</span>
          </h2>

          <div className="flex flex-col gap-6 w-full">
            {steps.map((step, idx) => (
              <div
                key={idx}
                onClick={() => setActiveStep(idx)}
                className={`p-5 rounded-[24px] border-[2px] transition-all duration-300 cursor-pointer text-left ${
                  activeStep === idx
                    ? "border-secondary bg-background-mist -translate-y-1 neo-shadow-md"
                    : "border-border-mist bg-transparent hover:border-text-slate/40"
                }`}
              >
                <div className="flex items-center gap-3.5 mb-2.5">
                  <div className={`p-2.5 rounded-lg border-[2px] border-secondary ${step.color.split(' ')[2]}`}>
                    {step.icon}
                  </div>
                  <h3 className="font-display font-bold text-lg text-secondary">
                    {step.title}
                  </h3>
                </div>
                <p className="font-sans text-[15px] text-text-slate pl-12">
                  {step.desc}
                </p>
              </div>
            ))}
          </div>
        </div>

      </div>
    </section>
  );
}
