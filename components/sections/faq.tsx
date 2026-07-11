"use client";

import React, { useState } from "react";
import { ChevronDown, HelpCircle } from "lucide-react";

export function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const faqs = [
    {
      q: "Is my connection and communication data secure?",
      a: "Yes, security is a non-negotiable component of Syncar. We authenticate connections using official OAuth protocols, and data packets are encrypted during transmission. Furthermore, our processing does not store permanent chat history on external databases."
    },
    {
      q: "Which specific platforms are currently supported?",
      a: "Currently, we support full sync for Gmail, Outlook, Slack, WhatsApp, Telegram, and Discord. Support for Messenger, Microsoft Teams, and custom developer webhook payloads is releasing in the upcoming quarter."
    },
    {
      q: "Does Syncar store copy logs of my private messages?",
      a: "No. Syncar does not index or store raw messages on its own servers. The context database representing your projects and connections is kept local to your workspace device, maintaining complete data confidentiality."
    },
    {
      q: "Can I customize the writing voice of the AI drafts?",
      a: "Absolutely. Syncar's draft suggestions can be configured with specific voice guidelines: professional, casual, concise, or detailed. You can supply sample emails so the drafts match your precise style."
    },
    {
      q: "How does the cross-platform search operate?",
      a: "It uses semantic vector indexing. Instead of matching exact keywords (like 'contract'), it matches meaning. A query for 'pricing agreements' returns documents, chats, and messages relating to invoices, caps, quotes, and contract terms."
    }
  ];

  return (
    <section id="faq" className="py-24 md:py-32 bg-background-mist border-b-[2.5px] border-secondary">
      <div className="max-w-[1280px] mx-auto px-6 md:px-12 grid grid-cols-1 lg:grid-cols-12 gap-16">
        
        {/* Left Column: Heading */}
        <div className="lg:col-span-5 flex flex-col items-start text-left">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full neo-border bg-accent-yellow text-secondary font-mono text-[13px] font-bold neo-shadow-sm mb-6">
            <HelpCircle className="w-3.5 h-3.5" />
            <span>SUPPORT</span>
          </div>

          <h2 className="font-display font-black text-secondary text-3xl sm:text-4xl md:text-5xl leading-tight tracking-tight mb-6">
            Frequently Asked <br />
            <span className="text-primary">Questions.</span>
          </h2>

          <p className="font-sans text-text-slate text-lg leading-relaxed max-w-[480px]">
            Have other queries about our setup, security, or integrations? Reach out to support@syncar.ai.
          </p>
        </div>

        {/* Right Column: Accordion list */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          {faqs.map((faq, index) => {
            const isOpen = openIndex === index;
            return (
              <div
                key={index}
                className="bg-white rounded-[24px] border-[2px] border-secondary neo-shadow-sm overflow-hidden transition-all duration-300"
              >
                {/* Header Toggle */}
                <button
                  onClick={() => setOpenIndex(isOpen ? null : index)}
                  className="w-full px-6 py-5 flex items-center justify-between text-left focus:outline-none focus-visible:bg-black/5 cursor-pointer"
                  aria-expanded={isOpen}
                >
                  <span className="font-display font-bold text-secondary text-[17px] pr-4">
                    {faq.q}
                  </span>
                  <ChevronDown
                    className={`w-5 h-5 text-secondary shrink-0 transition-transform duration-300 ${
                      isOpen ? "rotate-180" : "rotate-0"
                    }`}
                  />
                </button>

                {/* Answer Area (Accordion body) */}
                <div
                  className={`transition-all duration-300 ease-in-out ${
                    isOpen ? "max-h-[500px] border-t-[2.5px] border-secondary" : "max-h-0 pointer-events-none"
                  }`}
                >
                  <p className="font-sans text-[15px] text-text-slate leading-relaxed p-6 bg-background-mist/50">
                    {faq.a}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
}
