"use client";

import React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { MoveLeft, HelpCircle } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background-mist p-6 relative overflow-hidden font-sans">
      {/* Background surrealist visual motifs */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-accent-purple/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[45%] h-[45%] rounded-full bg-primary/10 blur-[150px] pointer-events-none" />

      <div className="w-full max-w-md text-center z-10 space-y-8">
        {/* Logo/Badge */}
        <div className="flex items-center justify-center gap-3">
          <div className="relative w-10 h-10 rounded-xl bg-primary neo-border flex items-center justify-center text-white font-black text-2xl neo-shadow-sm">
            S
          </div>
          <span className="font-display font-black text-3xl tracking-tight text-secondary">
            Syncra
          </span>
        </div>

        {/* Large 404 text inside modern card */}
        <div className="bg-surface-white border-[2.5px] border-secondary rounded-[28px] p-8 md:p-10 neo-shadow-lg space-y-6">
          <div className="w-14 h-14 bg-error-bg border-[2px] border-error rounded-2xl flex items-center justify-center mx-auto text-error">
            <HelpCircle className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h1 className="font-display font-black text-[64px] text-secondary tracking-tight leading-none">
              404
            </h1>
            <h2 className="font-display font-black text-2xl text-secondary">
              Page Not Found
            </h2>
            <p className="text-text-slate text-[14px] leading-relaxed font-semibold">
              The page you are looking for doesn&apos;t exist, has been moved, or resides in another dimension. Let&apos;s get you back on track.
            </p>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row gap-3">
            <Link href="/" className="w-full">
              <Button
                variant="secondary"
                size="lg"
                className="w-full flex items-center justify-center gap-2 border-[2px] border-secondary"
              >
                <MoveLeft className="w-4 h-4" />
                <span>Go Home</span>
              </Button>
            </Link>
          </div>
        </div>

        <div className="text-[11px] text-text-fog font-mono">
          Syncra App Routing Security Framework
        </div>
      </div>
    </div>
  );
}
