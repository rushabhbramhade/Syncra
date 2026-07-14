"use client";

import React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles } from "lucide-react";

export function FinalCTA() {
  return (
    <section className="py-24 md:py-32 bg-white border-b-[2.5px] border-secondary overflow-hidden">
      <div className="max-w-[1280px] mx-auto px-6 md:px-12 text-center">
        
        {/* Banner Card */}
        <div className="bg-primary text-white rounded-[28px] neo-border neo-shadow-lg p-10 md:p-16 relative overflow-hidden flex flex-col items-center max-w-[960px] mx-auto">
          {/* Background shapes (Surrealist editorial style) */}
          <div aria-hidden="true" className="absolute top-0 right-0 w-36 h-36 rounded-full bg-accent-yellow/20 -mr-10 -mt-10 blur-xl pointer-events-none" />
          <div aria-hidden="true" className="absolute bottom-0 left-0 w-44 h-44 rounded-full bg-accent-purple/20 -ml-16 -mb-16 blur-xl pointer-events-none" />

          {/* Icon */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full neo-border bg-accent-yellow text-secondary font-mono text-[13px] font-bold neo-shadow-sm mb-8 z-10">
            <Sparkles className="w-3.5 h-3.5" />
            <span>START RECLAIMING DEEP FOCUS</span>
          </div>

          {/* Heading */}
          <h2 className="font-display font-black text-3xl sm:text-4xl md:text-5xl leading-tight tracking-tight mb-6 max-w-[640px] text-center z-10">
            Ready to end the app-hopping chaos?
          </h2>

          {/* Subtitle */}
          <p className="font-sans text-white/80 text-lg md:text-[20px] max-w-[560px] mx-auto mb-10 z-10 leading-relaxed">
            Consolidate your platforms, let AI handle summaries and follow-ups, and enjoy true focus hours. Setup takes under 2 minutes.
          </p>

          {/* Button */}
          <Link href="/sign-up" className="z-10">
            <Button variant="secondary" size="lg" className="group z-10 neo-border border-secondary">
              <span>Start Free Syncing</span>
              <ArrowRight className="w-5 h-5 ml-2 transition-transform group-hover:translate-x-1.5" />
            </Button>
          </Link>

          {/* Proof checklist */}
          <div className="flex flex-wrap justify-center gap-6 mt-8 font-mono text-xs text-white/70 z-10">
            <span>✓ Connect Slack, Gmail, WhatsApp</span>
            <span>✓ No credit card required</span>
            <span>✓ Free plan forever</span>
          </div>
        </div>

      </div>
    </section>
  );
}
