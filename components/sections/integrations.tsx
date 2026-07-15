"use client";

import React, { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { Layers, Sparkles } from "lucide-react";

export function Integrations() {
  const [activePlatform, setActivePlatform] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const centerRef = useRef<HTMLDivElement>(null);
  const platformRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [lines, setLines] = useState<{ x1: number; y1: number; x2: number; y2: number }[]>([]);

  const platforms = [
    { name: "Gmail", icon: "/gmail.png", color: "border-accent-orange bg-accent-orange/10 text-accent-orange", desc: "Auto-sort labels, filter receipts, draft professional responses." },
    { name: "Slack", icon: "/slack.png", color: "border-accent-pink bg-accent-pink/10 text-accent-pink", desc: "Thread summarization, task creation, follow-up flags." },
    { name: "WhatsApp", icon: "/whatsapp.png", color: "border-accent-green bg-accent-green/10 text-accent-green", desc: "Summarize voice notes, reply suggestions, client notification hub." },
    { name: "Telegram", icon: "/telegram.png", color: "border-accent-cyan bg-accent-cyan/10 text-accent-cyan", desc: "Group chat indexing, topic highlights, project management." },
    { name: "GitHub", icon: "/github.svg", color: "border-secondary bg-secondary/10 text-secondary", desc: "Issue tracking, PR review, CI/CD status, code commit monitoring." },
    { name: "Discord", icon: "/discord.png", color: "border-accent-purple bg-accent-purple/10 text-accent-purple", desc: "Support ticketing, community summaries, alert filters." },
  ];

  const calculateLines = () => {
    if (!containerRef.current || !svgRef.current || !centerRef.current) return;

    const svgRect = svgRef.current.getBoundingClientRect();
    const centerRect = centerRef.current.getBoundingClientRect();
    const centerX = centerRect.left + centerRect.width / 2 - svgRect.left;
    const centerY = centerRect.top + centerRect.height / 2 - svgRect.top;

    const newLines = platformRefs.current.map((ref) => {
      if (!ref) return { x1: 0, y1: 0, x2: 0, y2: 0 };
      const rect = ref.getBoundingClientRect();
      const x = rect.left + rect.width / 2 - svgRect.left;
      const y = rect.top + rect.height / 2 - svgRect.top;
      return { x1: centerX, y1: centerY, x2: x, y2: y };
    });

    setLines(newLines);
  };

  useEffect(() => {
    const resizeObserver = new ResizeObserver(() => {
      calculateLines();
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    window.addEventListener("resize", calculateLines);
    setTimeout(calculateLines, 100);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", calculateLines);
    };
  }, []);

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
            Syncra integrates directly with the applications you already use. Setup takes 2 clicks, and sync starts instantly. 
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
        <div className="lg:col-span-7 relative flex justify-center items-center h-[520px] md:h-[600px] w-full" ref={containerRef}>
          {/* SVG Connector Lines */}
          <svg ref={svgRef} className="absolute inset-0 w-full h-full pointer-events-none z-0 hidden md:block">
            {lines.map((line, index) => (
              <line
                key={index}
                x1={line.x1}
                y1={line.y1}
                x2={line.x2}
                y2={line.y2}
                stroke="#0F172A"
                strokeWidth="2.5"
                className="sync-line"
              />
            ))}
          </svg>

          {/* Central Sync Core */}
          <div
            ref={centerRef}
            className="relative w-36 h-36 rounded-full bg-primary neo-border flex items-center justify-center neo-shadow-lg z-20 hover:scale-105 transition-transform duration-300"
          >
            <div className="absolute inset-0 bg-primary/20 rounded-full animate-ping pointer-events-none" />
            <Layers className="w-14 h-14 text-white" />
          </div>

          {/* Mobile: Stacked Integrations */}
          <div className="absolute bottom-0 left-0 right-0 flex flex-wrap justify-center gap-4 md:hidden px-4 pb-4">
            {platforms.map((platform, index) => (
              <button
                key={index}
                onMouseEnter={() => setActivePlatform(platform.name)}
                onMouseLeave={() => setActivePlatform(null)}
                onClick={() => setActivePlatform(platform.name)}
                className="w-16 h-16 rounded-xl neo-border bg-white flex items-center justify-center neo-shadow-sm hover:-translate-y-1 hover:shadow-flat-md active:translate-y-0 transition-all cursor-pointer z-10"
                aria-label={`${platform.name} integration details`}
              >
                <Image
                  src={platform.icon}
                  alt={platform.name}
                  width={32}
                  height={32}
                  className="object-contain"
                />
              </button>
            ))}
          </div>

          {/* Desktop: Grid-based Integrations */}
          <div className="hidden md:grid grid-cols-3 grid-rows-3 w-full h-full absolute inset-0 gap-4 p-8">
            {/* Top Left */}
            <button
              ref={(el) => { platformRefs.current[0] = el; }}
              onMouseEnter={() => setActivePlatform(platforms[0].name)}
              onMouseLeave={() => setActivePlatform(null)}
              className="w-18 h-18 rounded-2xl neo-border bg-white flex items-center justify-center neo-shadow-sm hover:-translate-y-1 hover:shadow-flat-md active:translate-y-0 transition-all cursor-pointer z-10"
              aria-label={`${platforms[0].name} integration details`}
            >
              <Image
                src={platforms[0].icon}
                alt={platforms[0].name}
                width={32}
                height={32}
                className="object-contain"
              />
            </button>
            {/* Top Center (Empty) */}
            <div></div>
            {/* Top Right */}
            <button
              ref={(el) => { platformRefs.current[1] = el; }}
              onMouseEnter={() => setActivePlatform(platforms[1].name)}
              onMouseLeave={() => setActivePlatform(null)}
              className="w-18 h-18 rounded-2xl neo-border bg-white flex items-center justify-center neo-shadow-sm hover:-translate-y-1 hover:shadow-flat-md active:translate-y-0 transition-all cursor-pointer z-10 justify-self-end"
              aria-label={`${platforms[1].name} integration details`}
            >
              <Image
                src={platforms[1].icon}
                alt={platforms[1].name}
                width={32}
                height={32}
                className="object-contain"
              />
            </button>
            {/* Mid Left */}
            <button
              ref={(el) => { platformRefs.current[2] = el; }}
              onMouseEnter={() => setActivePlatform(platforms[2].name)}
              onMouseLeave={() => setActivePlatform(null)}
              className="w-18 h-18 rounded-2xl neo-border bg-white flex items-center justify-center neo-shadow-sm hover:-translate-y-1 hover:shadow-flat-md active:translate-y-0 transition-all cursor-pointer z-10 self-center"
              aria-label={`${platforms[2].name} integration details`}
            >
              <Image
                src={platforms[2].icon}
                alt={platforms[2].name}
                width={32}
                height={32}
                className="object-contain"
              />
            </button>
            {/* Mid Center (Empty - Center is in middle) */}
            <div></div>
            {/* Mid Right */}
            <button
              ref={(el) => { platformRefs.current[3] = el; }}
              onMouseEnter={() => setActivePlatform(platforms[3].name)}
              onMouseLeave={() => setActivePlatform(null)}
              className="w-18 h-18 rounded-2xl neo-border bg-white flex items-center justify-center neo-shadow-sm hover:-translate-y-1 hover:shadow-flat-md active:translate-y-0 transition-all cursor-pointer z-10 self-center justify-self-end"
              aria-label={`${platforms[3].name} integration details`}
            >
              <Image
                src={platforms[3].icon}
                alt={platforms[3].name}
                width={32}
                height={32}
                className="object-contain"
              />
            </button>
            {/* Bottom Left */}
            <button
              ref={(el) => { platformRefs.current[4] = el; }}
              onMouseEnter={() => setActivePlatform(platforms[4].name)}
              onMouseLeave={() => setActivePlatform(null)}
              className="w-18 h-18 rounded-2xl neo-border bg-white flex items-center justify-center neo-shadow-sm hover:-translate-y-1 hover:shadow-flat-md active:translate-y-0 transition-all cursor-pointer z-10 self-end"
              aria-label={`${platforms[4].name} integration details`}
            >
              <Image
                src={platforms[4].icon}
                alt={platforms[4].name}
                width={32}
                height={32}
                className="object-contain"
              />
            </button>
            {/* Bottom Center (Empty) */}
            <div></div>
            {/* Bottom Right */}
            <button
              ref={(el) => { platformRefs.current[5] = el; }}
              onMouseEnter={() => setActivePlatform(platforms[5].name)}
              onMouseLeave={() => setActivePlatform(null)}
              className="w-18 h-18 rounded-2xl neo-border bg-white flex items-center justify-center neo-shadow-sm hover:-translate-y-1 hover:shadow-flat-md active:translate-y-0 transition-all cursor-pointer z-10 self-end justify-self-end"
              aria-label={`${platforms[5].name} integration details`}
            >
              <Image
                src={platforms[5].icon}
                alt={platforms[5].name}
                width={32}
                height={32}
                className="object-contain"
              />
            </button>
          </div>
        </div>

      </div>
    </section>
  );
}
