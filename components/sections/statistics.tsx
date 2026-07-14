
import React from "react";
import { Card } from "@/components/ui/card";

export function Statistics() {
  const stats = [
    { value: "250K+", label: "Focus Hours Saved", desc: "Reclaimed time spent on context-switching and logging in." },
    { value: "18M+", label: "Messages Sorted", desc: "Chats, email alerts, and logs consolidated securely." },
    { value: "45,000+", label: "Connected Workspaces", desc: "Integrations running actively and syncing data." },
    { value: "99.8%", label: "AI Parsing Accuracy", desc: "Accurate summarization and action-item detection." }
  ];

  return (
    <section className="py-24 bg-background-mist border-b-[2.5px] border-secondary">
      <div className="max-w-[1280px] mx-auto px-6 md:px-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {stats.map((stat, idx) => (
            <Card key={idx} className="bg-white p-8 neo-border neo-shadow-sm flex flex-col justify-between hover:-translate-y-1 transition-transform">
              <div className="flex flex-col">
                <span className="font-display font-black text-4xl lg:text-[48px] text-primary tracking-tight mb-2">
                  {stat.value}
                </span>
                <span className="font-sans font-bold text-secondary text-sm mb-3">
                  {stat.label}
                </span>
              </div>
              <p className="font-sans text-xs text-text-slate leading-relaxed border-t border-border-mist pt-3">
                {stat.desc}
              </p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
