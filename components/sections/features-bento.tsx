
import React from "react";
import { Card } from "@/components/ui/card";
import { Sparkles, ShieldCheck, Search, Bell, Clock, Brain, BarChart3, Inbox, Layers } from "lucide-react";

export function FeaturesBento() {
  const features = [
    {
      title: "Omni-Inbox Sync",
      desc: "Gmail, Slack, WhatsApp, and Telegram in one single place. No more tab hopping.",
      size: "lg:col-span-8",
      color: "border-l-[6px] border-l-primary",
      icon: <Inbox className="w-6 h-6 text-primary" />
    },
    {
      title: "Secure Local Processing",
      desc: "Your data is processed locally with bank-grade encryption. Private by design.",
      size: "lg:col-span-4",
      color: "border-l-[6px] border-l-accent-green",
      icon: <ShieldCheck className="w-6 h-6 text-accent-green" />
    },
    {
      title: "10-Sec Summaries",
      desc: "Turn messy 100-message threads into brief key points and actions.",
      size: "lg:col-span-4",
      color: "border-l-[6px] border-l-accent-purple",
      icon: <Clock className="w-6 h-6 text-accent-purple" />
    },
    {
      title: "Cross-Platform Semantic Search",
      desc: "Query 'contract design' and search attachment files, Slack logs, and WhatsApp voice notes simultaneously.",
      size: "lg:col-span-8",
      color: "border-l-[6px] border-l-accent-cyan",
      icon: <Search className="w-6 h-6 text-accent-cyan" />
    },
    {
      title: "Deep Context Memory",
      desc: "Syncar remembers user projects, deadlines, and links to make predictions.",
      size: "lg:col-span-6",
      color: "border-l-[6px] border-l-accent-orange",
      icon: <Brain className="w-6 h-6 text-accent-orange" />
    },
    {
      title: "Smart Statistics",
      desc: "Track communication habits, noise levels, and focus hours saved.",
      size: "lg:col-span-6",
      color: "border-l-[6px] border-l-accent-pink",
      icon: <BarChart3 className="w-6 h-6 text-accent-pink" />
    },
    {
      title: "AI Response Drafting",
      desc: "Automatic draft suggestions that fit your brand voice, formatting, and tone.",
      size: "lg:col-span-4",
      color: "border-l-[6px] border-l-accent-yellow",
      icon: <Sparkles className="w-6 h-6 text-accent-yellow" />
    },
    {
      title: "Follow-Up Flags",
      desc: "Syncar alerts you when clients expect a response or tasks remain open.",
      size: "lg:col-span-4",
      color: "border-l-[6px] border-l-secondary",
      icon: <Bell className="w-6 h-6 text-secondary" />
    },
    {
      title: "Flexible Integrations",
      desc: "Connect new systems in 2 clicks. Support for custom webhooks and custom endpoints.",
      size: "lg:col-span-4",
      color: "border-l-[6px] border-l-primary",
      icon: <Layers className="w-6 h-6 text-primary" />
    }
  ];

  return (
    <section id="features" className="py-24 md:py-32 bg-white border-b-[2.5px] border-secondary">
      <div className="max-w-[1280px] mx-auto px-6 md:px-12">
        {/* Intro */}
        <div className="text-center max-w-[800px] mx-auto mb-16">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full neo-border bg-accent-yellow font-mono text-[13px] font-bold neo-shadow-sm mb-6">
            <Sparkles className="w-3.5 h-3.5" />
            <span>FEATURES</span>
          </div>

          <h2 className="font-display font-black text-secondary text-3xl sm:text-4xl md:text-5xl leading-tight tracking-tight mb-6">
            Supercharged productivity. <br />
            Built into <span className="text-primary">every pixel.</span>
          </h2>

          <p className="font-sans text-text-slate text-lg">
            A comprehensive suite of intelligence tools designed to cut communication time in half.
          </p>
        </div>

        {/* Bento Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8">
          {features.map((feat, index) => (
            <Card
              key={index}
              interactive
              className={`${feat.size} ${feat.color} flex flex-col justify-between`}
            >
              <div className="flex flex-col items-start gap-4">
                <div className="p-3 bg-background-mist rounded-[14px] neo-border">
                  {feat.icon}
                </div>
                <h3 className="font-display font-bold text-xl text-secondary">
                  {feat.title}
                </h3>
                <p className="font-sans text-[15px] text-text-slate leading-relaxed">
                  {feat.desc}
                </p>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
