"use client";

import React from "react";
import ScrollVelocity from "../ui/ScrollVelocity";

export function TrustedBy() {
  const logoItems = [
    { icon: "▲", name: "Vercel" },
    { icon: "⧉", name: "Linear" },
    { icon: "💳", name: "Stripe" },
    { icon: "�", name: "Framer" },
    { icon: "�", name: "Notion" },
    { icon: "🧭", name: "Arc" },
    { icon: "⌘", name: "Raycast" },
    { icon: "🏠", name: "Airbnb" },
  ];

  const LogoRow = () => (
    <div className="flex items-center">
      {logoItems.map((logo, i) => (
        <div
          key={`logo-${i}`}
          className="flex items-center gap-3.5 mx-8 md:mx-12 font-display font-black text-xl md:text-2xl text-secondary grayscale hover:grayscale-0 hover:scale-105 transition-all duration-300 ease-out cursor-pointer"
        >
          <span className="text-lg md:text-xl">{logo.icon}</span>
          <span>{logo.name}</span>
        </div>
      ))}
    </div>
  );

  return (
    <section className="py-12 bg-white border-y-[2.5px] border-secondary overflow-hidden select-none">
      <div className="max-w-[1280px] mx-auto px-6 md:px-12 flex flex-col items-center">
        <h2 className="font-mono text-xs uppercase tracking-widest text-text-slate mb-8">
          TRUSTED BY MODERN TEAMS AT
        </h2>
      </div>

      <div className="relative w-full overflow-hidden">
        <div className="absolute top-0 bottom-0 left-0 w-24 md:w-32 bg-gradient-to-r from-white via-white/90 to-transparent z-10 pointer-events-none" />
        <div className="absolute top-0 bottom-0 right-0 w-24 md:w-32 bg-gradient-to-l from-white via-white/90 to-transparent z-10 pointer-events-none" />

        <ScrollVelocity
          texts={[<LogoRow key="logos" />]}
          velocity={50}
          numCopies={6}
        />
      </div>
    </section>
  );
}
