"use client";

import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight, Mail, MessageSquare, ShieldAlert, Sparkles, Inbox, Check } from "lucide-react";
import { motion, useMotionValue, useTransform } from "framer-motion";

export function Hero() {
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Parallax effect variables
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const { clientX, clientY } = e;
      const { innerWidth, innerHeight } = window;
      
      // Calculate offset from center of screen (-1 to 1)
      const x = (clientX - innerWidth / 2) / (innerWidth / 2);
      const y = (clientY - innerHeight / 2) / (innerHeight / 2);
      
      setMousePos({ x, y });
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  return (
    <section
      ref={containerRef}
      className="relative pt-32 pb-24 md:pt-40 md:pb-32 overflow-hidden bg-background-mist"
    >
      {/* Background patterns */}
      <div className="absolute inset-0 z-0 pointer-events-none opacity-20">
        {/* Moving grid background */}
        <div 
          className="absolute inset-0 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:4rem_4rem]"
          style={{
            transform: `translate(${mousePos.x * -10}px, ${mousePos.y * -10}px)`,
            transition: "transform 0.2s ease-out"
          }}
        />
      </div>

      <div className="relative z-10 max-w-[1280px] mx-auto px-6 md:px-12 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        {/* Left Column: Heading and Copy */}
        <div className="lg:col-span-6 flex flex-col items-start text-left">
          {/* Badge */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full neo-border bg-accent-yellow font-mono text-[13px] font-bold neo-shadow-sm mb-6">
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI-POWERED COMMUNICATIONS</span>
          </div>

          {/* Heading */}
          <h1 className="font-display font-black text-secondary leading-[1.05] tracking-tight mb-6 text-4xl sm:text-5xl md:text-6xl lg:text-[72px]">
            Every message. <br />
            <span className="text-primary underline decoration-secondary decoration-[6px] underline-offset-4">
              One Inbox.
            </span>
          </h1>

          {/* Subheading */}
          <p className="font-sans text-text-slate text-lg md:text-[20px] leading-relaxed mb-8 max-w-[540px]">
            Syncar connects Gmail, Outlook, WhatsApp, Telegram, Slack, and Discord. 
            AI summarizes your conversations, surfaces priorities, and generates replies so you never check multiple apps again.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
            <Button variant="primary" size="lg" className="group w-full sm:w-auto">
              <span>Start Syncing Free</span>
              <ArrowRight className="w-5 h-5 ml-2 transition-transform group-hover:translate-x-1.5" />
            </Button>
            <Button variant="secondary" size="lg" className="w-full sm:w-auto">
              Book Demo
            </Button>
          </div>

          {/* Inline proof banner */}
          <div className="flex items-center gap-6 mt-8 font-mono text-xs text-text-slate">
            <div className="flex items-center gap-1">
              <Check className="w-4 h-4 text-accent-green stroke-[3px]" />
              <span>No credit card required</span>
            </div>
            <div className="flex items-center gap-1">
              <Check className="w-4 h-4 text-accent-green stroke-[3px]" />
              <span>Connect in 2 minutes</span>
            </div>
          </div>
        </div>

        {/* Right Column: Surrealist Interactive AI Illustration */}
        <div className="lg:col-span-6 relative flex justify-center items-center h-[480px] md:h-[540px] w-full">
          {/* Central Orb / AI Sync Hub */}
          <div 
            className="relative w-44 h-44 rounded-full bg-primary neo-border flex items-center justify-center neo-shadow-lg z-20"
            style={{
              transform: `translate(${mousePos.x * 12}px, ${mousePos.y * 12}px)`,
              transition: "transform 0.1s ease-out"
            }}
          >
            <div className="absolute inset-0 bg-primary/20 rounded-full animate-ping pointer-events-none" />
            <Inbox className="w-16 h-16 text-white" />
            
            {/* Pulsing indicator */}
            <div className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-accent-green neo-border flex items-center justify-center text-[10px] text-white font-bold animate-bounce">
              3
            </div>
          </div>

          {/* Floating Platform 1: Slack Card */}
          <div 
            className="absolute top-8 left-4 md:left-12 bg-white p-4 rounded-[18px] neo-border neo-shadow-md z-30 max-w-[220px]"
            style={{
              transform: `translate(${mousePos.x * -18}px, ${mousePos.y * -18}px) rotate(-4deg)`,
              transition: "transform 0.15s ease-out"
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-mono text-[11px] font-bold text-accent-pink px-2 py-0.5 rounded-full bg-accent-pink/10">SLACK</span>
              <span className="font-mono text-[11px] text-text-muted">10m ago</span>
            </div>
            <p className="font-sans font-bold text-sm text-secondary truncate">Confirming launch dates for v2...</p>
            <p className="font-sans text-xs text-text-slate mt-1 line-clamp-1">AI suggestion: Reply "Sounds good!"</p>
          </div>

          {/* Floating Platform 2: WhatsApp Card */}
          <div 
            className="absolute bottom-16 left-2 md:left-8 bg-white p-4 rounded-[18px] neo-border neo-shadow-md z-30 max-w-[240px]"
            style={{
              transform: `translate(${mousePos.x * -25}px, ${mousePos.y * 20}px) rotate(3deg)`,
              transition: "transform 0.15s ease-out"
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-mono text-[11px] font-bold text-accent-green px-2 py-0.5 rounded-full bg-accent-green/10">WHATSAPP</span>
              <span className="font-mono text-[11px] text-text-muted">Just now</span>
            </div>
            <p className="font-sans font-bold text-sm text-secondary">Sophia: We need the logo asset asap.</p>
            <div className="mt-2 inline-flex items-center gap-1 text-[11px] text-primary font-bold">
              <Sparkles className="w-3.5 h-3.5 text-accent-purple" />
              <span>Task created: Send logo</span>
            </div>
          </div>

          {/* Floating Platform 3: Gmail Card */}
          <div 
            className="absolute top-10 right-4 md:right-12 bg-white p-4 rounded-[18px] neo-border neo-shadow-md z-30 max-w-[230px]"
            style={{
              transform: `translate(${mousePos.x * 20}px, ${mousePos.y * -25}px) rotate(6deg)`,
              transition: "transform 0.15s ease-out"
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-mono text-[11px] font-bold text-accent-orange px-2 py-0.5 rounded-full bg-accent-orange/10">GMAIL</span>
              <span className="font-mono text-[11px] text-text-muted">1h ago</span>
            </div>
            <p className="font-sans font-bold text-sm text-secondary truncate">Google Cloud Invoice - $128.40</p>
            <span className="font-mono text-[10px] text-text-muted">Auto-filed to Finance</span>
          </div>

          {/* Floating Platform 4: Telegram Card */}
          <div 
            className="absolute bottom-10 right-8 md:right-16 bg-white p-4 rounded-[18px] neo-border neo-shadow-md z-30 max-w-[210px]"
            style={{
              transform: `translate(${mousePos.x * 28}px, ${mousePos.y * 15}px) rotate(-3deg)`,
              transition: "transform 0.15s ease-out"
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-mono text-[11px] font-bold text-accent-cyan px-2 py-0.5 rounded-full bg-accent-cyan/10">TELEGRAM</span>
              <span className="font-mono text-[11px] text-text-muted">45m ago</span>
            </div>
            <p className="font-sans font-bold text-sm text-secondary truncate">Group chat: 15 unread messages</p>
            <p className="font-sans text-[11px] text-accent-purple font-medium">Summary: Devs decided to delay...</p>
          </div>
        </div>
      </div>
    </section>
  );
}
