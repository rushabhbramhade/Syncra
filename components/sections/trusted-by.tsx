import React from "react";

export function TrustedBy() {
  const logos = [
    { name: "Vercel", icon: "▲" },
    { name: "Linear", icon: "⧉" },
    { name: "Stripe", icon: "💳" },
    { name: "Framer", icon: "🖽" },
    { name: "Notion", icon: "📝" },
    { name: "Arc", icon: "🧭" },
    { name: "Raycast", icon: "⌘" },
    { name: "Airbnb", icon: "🏠" },
  ];

  // Duplicate the list to create a seamless infinite scrolling loop
  const marqueeLogos = [...logos, ...logos, ...logos, ...logos];

  return (
    <section className="py-12 bg-white border-y-[2.5px] border-secondary overflow-hidden select-none">
      <div className="max-w-[1280px] mx-auto px-6 md:px-12 flex flex-col items-center">
        <h2 className="font-mono text-xs uppercase tracking-widest text-text-slate mb-8">
          TRUSTED BY MODERN TEAMS AT
        </h2>
      </div>

      {/* Marquee Wrapper */}
      <div className="relative w-full overflow-hidden flex">
        {/* Left/Right Scrim gradient shadows */}
        <div className="absolute top-0 bottom-0 left-0 w-20 md:w-32 bg-gradient-to-r from-white to-transparent z-10 pointer-events-none" />
        <div className="absolute top-0 bottom-0 right-0 w-20 md:w-32 bg-gradient-to-l from-white to-transparent z-10 pointer-events-none" />

        {/* Marquee Inner container */}
        <div className="animate-marquee py-2">
          {marqueeLogos.map((logo, index) => (
            <div
              key={`${logo.name}-${index}`}
              className="flex items-center gap-3.5 mx-8 md:mx-12 font-display font-black text-2xl md:text-3xl text-text-slate/60 hover:text-secondary cursor-pointer transition-colors"
            >
              <span className="text-xl md:text-2xl">{logo.icon}</span>
              <span>{logo.name}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
