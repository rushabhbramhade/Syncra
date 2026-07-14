"use client";

import React from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";

export function Pricing() {
  const plans = [
    {
      name: "Starter",
      price: "$0",
      period: "forever",
      desc: "Perfect for testing the waters of unified messaging.",
      features: [
        "Connect up to 2 integrations",
        "Standard stream synchronization",
        "10 core summaries per day",
        "Basic keyword search",
        "Secure local storage"
      ],
      cta: "Start Free",
      variant: "secondary" as const,
      featured: false
    },
    {
      name: "Pro",
      price: "$12",
      period: "per month",
      desc: "For professionals seeking absolute context control.",
      features: [
        "Connect unlimited integrations",
        "Instant stream synchronization",
        "Unlimited summaries & tasks",
        "AI response drafting & matching",
        "Full semantic cross-search",
        "Priority follow-up alert badges"
      ],
      cta: "Upgrade to Pro",
      variant: "primary" as const,
      featured: true
    },
    {
      name: "Team",
      price: "$39",
      period: "per user / month",
      desc: "For collaborative builders keeping teams in deep work.",
      features: [
        "Everything in Pro plan",
        "Offline local LLM processing option",
        "Shared team inbox folders",
        "Permissions & audit credentials log",
        "Dedicated support line",
        "Custom app webhook integrations"
      ],
      cta: "Contact Sales",
      variant: "secondary" as const,
      featured: false
    }
  ];

  return (
    <section id="pricing" className="py-24 md:py-32 bg-white border-b-[2.5px] border-secondary">
      <div className="max-w-[1280px] mx-auto px-6 md:px-12">
        {/* Intro */}
        <div className="text-center max-w-[800px] mx-auto mb-20">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full neo-border bg-accent-orange text-secondary font-mono text-[13px] font-bold neo-shadow-sm mb-6">
            <span>PRICING</span>
          </div>

          <h2 className="font-display font-black text-secondary text-3xl sm:text-4xl md:text-5xl leading-tight tracking-tight mb-6">
            Transparent pricing. <br />
            Built to <span className="text-primary">scale with you.</span>
          </h2>

          <p className="font-sans text-text-slate text-lg">
            No hidden fees, no long contracts. Choose the setup that fits your workflow.
          </p>
        </div>

        {/* Plans Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
          {plans.map((plan, index) => (
            <Card
              key={index}
              className={`bg-white flex flex-col justify-between relative ${
                plan.featured
                  ? "border-[3px] border-primary neo-shadow-lg lg:-translate-y-4"
                  : "border-[2.5px] border-secondary neo-shadow-sm"
              }`}
            >
              {plan.featured && (
                <span className="absolute -top-4 left-1/2 -translate-x-1/2 bg-accent-yellow text-secondary border-[2.5px] border-secondary px-4 py-1 rounded-full font-mono text-[11px] font-black neo-shadow-sm">
                  MOST POPULAR
                </span>
              )}

              <div>
                <h3 className="font-display font-black text-xl text-secondary mb-1">
                  {plan.name}
                </h3>
                <p className="font-sans text-xs text-text-slate mb-6 leading-relaxed">
                  {plan.desc}
                </p>

                {/* Price block */}
                <div className="flex items-baseline gap-2 mb-6">
                  <span className="font-display font-black text-4xl sm:text-5xl text-secondary">
                    {plan.price}
                  </span>
                  <span className="font-mono text-xs text-text-slate">
                    / {plan.period}
                  </span>
                </div>

                {/* Features checklist */}
                <ul className="space-y-3.5 mb-8 border-t border-border-mist pt-6">
                  {plan.features.map((feat, idx) => (
                    <li key={idx} className="flex items-start gap-2.5 font-sans text-xs text-secondary font-medium">
                      <div className="p-0.5 rounded bg-accent-green/10 border border-accent-green shrink-0 mt-0.5">
                        <Check className="w-3.5 h-3.5 text-accent-green stroke-[3px]" />
                      </div>
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <Link href={plan.name === "Team" ? "mailto:support@syncra.ai" : "/sign-up"} className="w-full">
                <Button variant={plan.variant} size="lg" className="w-full">
                  {plan.cta}
                </Button>
              </Link>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
