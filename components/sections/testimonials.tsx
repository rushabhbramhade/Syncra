"use client";

import React from "react";
import { Card } from "@/components/ui/card";
import { Quote } from "lucide-react";

export function Testimonials() {
  const reviews = [
    {
      name: "Marcus Vance",
      role: "Operations Lead at Acme",
      avatar: "MV",
      color: "bg-accent-purple",
      quote: "Checking Slack, WhatsApp, and Gmail used to take half my morning. With Syncra, I get a clean dashboard summary twice a day. It has completely saved my productivity."
    },
    {
      name: "Sophia Carter",
      role: "Creative Director at DesignStudio",
      avatar: "SC",
      color: "bg-accent-pink",
      quote: "Syncra feels incredibly minimal yet powerful. The semantic search is magical — I can find design file links from conversations across Discord and Slack instantly."
    },
    {
      name: "Jason Chen",
      role: "Lead Software Architect at Logix",
      avatar: "JC",
      color: "bg-accent-green",
      quote: "We connected our developer notifications and client feedback channels. Syncra automatically created task lists, saving us hours of manual project management."
    }
  ];

  return (
    <section className="py-24 md:py-32 bg-white border-b-[2.5px] border-secondary">
      <div className="max-w-[1280px] mx-auto px-6 md:px-12">
        {/* Intro */}
        <div className="text-center max-w-[800px] mx-auto mb-16">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full neo-border bg-accent-yellow text-secondary font-mono text-[13px] font-bold neo-shadow-sm mb-6">
            <span>TESTIMONIALS</span>
          </div>

          <h2 className="font-display font-black text-secondary text-3xl sm:text-4xl md:text-5xl leading-tight tracking-tight mb-6">
            Approved by <span className="text-primary">focused builders.</span>
          </h2>

          <p className="font-sans text-text-slate text-lg">
            See how founders, freelancers, and design teams are reclaiming their deep-work hours.
          </p>
        </div>

        {/* Testimonials Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {reviews.map((rev, index) => (
            <Card
              key={index}
              className="bg-background-mist flex flex-col justify-between"
            >
              <div className="flex flex-col items-start gap-4">
                <Quote className="w-8 h-8 text-primary opacity-30" />
                <p className="font-serif italic text-lg leading-relaxed text-secondary">
                  &quot;{rev.quote}&quot;
                </p>
              </div>

              <div className="flex items-center gap-3.5 mt-8 border-t border-border-mist pt-4 w-full">
                <div className={`w-10 h-10 rounded-full neo-border ${rev.color} flex items-center justify-center font-mono font-bold text-xs text-white`}>
                  {rev.avatar}
                </div>
                <div className="flex flex-col font-sans">
                  <span className="font-bold text-secondary text-sm">{rev.name}</span>
                  <span className="text-text-slate text-xs">{rev.role}</span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
