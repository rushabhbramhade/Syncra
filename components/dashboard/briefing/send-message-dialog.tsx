"use client";

import React, { useState, useRef, useEffect } from "react";
import { X, Send, Sparkles, Loader2, ChevronRight, ChevronLeft } from "lucide-react";
import { sendMessageAction, generateDraftAction, checkPlatformsConnectionAction } from "@/app/actions/briefing";

interface SendMessageDialogProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
}

const PLATFORMS = [
  { id: "gmail", label: "Gmail", recipientLabel: "To (email)", placeholder: "user@example.com" },
  { id: "slack", label: "Slack", recipientLabel: "Channel", placeholder: "#general or C012345" },
  { id: "whatsapp", label: "WhatsApp", recipientLabel: "Phone / Contact", placeholder: "+1234567890" },
  { id: "telegram", label: "Telegram", recipientLabel: "Chat ID", placeholder: "@username or chat_id" },
  { id: "discord", label: "Discord", recipientLabel: "Channel ID", placeholder: "0123456789" },
];

export function SendMessageDialog({ isOpen, onClose, userId }: SendMessageDialogProps) {
  const [step, setStep] = useState(1);
  const [platform, setPlatform] = useState("gmail");
  const [recipient, setRecipient] = useState("");
  const [subject, setSubject] = useState("");
  const [draftInstruction, setDraftInstruction] = useState("");
  const [message, setMessage] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<Record<string, boolean>>({});
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const platformIds = PLATFORMS.map(p => p.id);
    checkPlatformsConnectionAction(userId, platformIds).then(setConnectionStatus).catch(() => {});
  }, [isOpen, userId]);

  useEffect(() => {
    if (!isOpen) {
      setStep(1);
      setPlatform("gmail");
      setRecipient("");
      setSubject("");
      setDraftInstruction("");
      setMessage("");
      setError(null);
      setResult(null);
      setIsGenerating(false);
      setIsSending(false);
      setConnectionStatus({});
    }
  }, [isOpen]);

  const platformInfo = PLATFORMS.find(p => p.id === platform)!;

  const handleGenerateDraft = async () => {
    if (!draftInstruction.trim()) return;
    setIsGenerating(true);
    setError(null);

    try {
      const res = await generateDraftAction(draftInstruction.trim(), platform);
      if (!res.success) throw new Error(res.error || "Failed to generate draft");
      setMessage(res.draft!);
      setStep(4);
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 100);
    } catch (err: any) {
      setError(err.message || "Failed to generate draft");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSend = async () => {
    if (!recipient.trim() || !message.trim()) return;
    setIsSending(true);
    setError(null);

    try {
      const res = await sendMessageAction(
        userId,
        platform,
        recipient.trim(),
        message.trim(),
        platform === "gmail" ? subject.trim() || undefined : undefined
      );
      if (res.success) {
        setResult("Message sent successfully!");
        setTimeout(() => onClose(), 1500);
      } else {
        setError(res.error || "Failed to send message");
      }
    } catch (err: any) {
      setError(err.message || "Failed to send message");
    } finally {
      setIsSending(false);
    }
  };

  const canProceed = (s: number) => {
    if (s === 1) return !!platform;
    if (s === 2) return !!recipient.trim();
    if (s === 3) return true;
    if (s === 4) return !!message.trim();
    return false;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-[4px] animate-in fade-in duration-200">
      <div className="bg-white border border-slate-200 rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
          <h3 className="font-display font-black text-lg text-secondary">Send Message</h3>
          <button onClick={onClose} className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center gap-1 px-6 pt-5 pb-2">
          {[1, 2, 3, 4].map(s => (
            <div key={s} className="flex items-center gap-1 flex-1">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-black ${
                s < step ? "bg-accent-purple text-white" : s === step ? "bg-accent-purple/10 text-accent-purple border-2 border-accent-purple" : "bg-slate-100 text-slate-400"
              }`}>
                {s}
              </div>
              {s < 4 && <div className={`h-0.5 flex-1 ${s < step ? "bg-accent-purple" : "bg-slate-200"}`} />}
            </div>
          ))}
        </div>

        <div className="px-6 py-4 space-y-5">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-[13px] font-semibold text-red-600">
              {error}
            </div>
          )}

          {result && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-[13px] font-semibold text-green-600">
              {result}
            </div>
          )}

          {!result && (
            <>
              {/* Step 1: Platform */}
              {step === 1 && (
                <div className="space-y-3">
                  <p className="text-[13px] font-bold text-text-slate">Choose a platform to send from:</p>
                  <div className="grid grid-cols-2 gap-3">
                    {PLATFORMS.map(p => {
                      const active = platform === p.id;
                      const connected = connectionStatus[p.id];
                      return (
                        <button key={p.id} type="button" onClick={() => setPlatform(p.id)}
                          className={`flex items-center gap-3 p-4 rounded-2xl border-2 transition-all text-left ${
                            active ? "border-accent-purple bg-accent-purple/5" : "border-border-mist bg-white hover:border-text-fog"
                          } ${connected === false ? "opacity-60" : ""}`}
                        >
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-[13px] font-black uppercase ${
                            active ? "bg-accent-purple text-white" : "bg-slate-100 text-slate-500"
                          }`}>{p.id[0]}</div>
                          <div>
                            <p className="font-bold text-[13px] text-secondary">{p.label}</p>
                            <p className={`text-[11px] font-medium ${connected ? "text-green-600" : connected === false ? "text-red-500" : "text-text-slate"}`}>
                              {connected ? "Connected" : connected === false ? "Not connected" : "Checking..."}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Step 2: Recipient */}
              {step === 2 && (
                <div className="space-y-4">
                  {platform === "gmail" && (
                    <div className="space-y-1">
                      <label className="text-[12px] font-black uppercase text-text-slate tracking-wider">Subject</label>
                      <input
                        type="text" value={subject}
                        onChange={e => setSubject(e.target.value)}
                        placeholder="Email subject"
                        className="w-full rounded-xl border border-border-mist bg-white text-[14px] font-semibold text-secondary px-4 py-2.5 outline-none focus:border-accent-purple"
                      />
                    </div>
                  )}
                  <div className="space-y-1">
                    <label className="text-[12px] font-black uppercase text-text-slate tracking-wider">{platformInfo.recipientLabel}</label>
                    <input
                      type="text" required value={recipient}
                      onChange={e => setRecipient(e.target.value)}
                      placeholder={platformInfo.placeholder}
                      className="w-full rounded-xl border border-border-mist bg-white text-[14px] font-semibold text-secondary px-4 py-2.5 outline-none focus:border-accent-purple"
                    />
                  </div>
                </div>
              )}

              {/* Step 3: AI Draft Assist */}
              {step === 3 && (
                <div className="space-y-4">
                  <p className="text-[13px] font-bold text-text-slate">Optional: Generate a draft with AI</p>
                  <div className="space-y-1">
                    <textarea
                      value={draftInstruction}
                      onChange={e => setDraftInstruction(e.target.value)}
                      placeholder="What do you want to say? (e.g. Remind the team about the standup at 10am)"
                      rows={3}
                      className="w-full rounded-xl border border-border-mist bg-white text-[14px] font-semibold text-secondary p-4 outline-none focus:border-accent-purple resize-none"
                    />
                  </div>
                  <button
                    onClick={handleGenerateDraft}
                    disabled={isGenerating || !draftInstruction.trim()}
                    className="flex items-center gap-2 rounded-xl bg-accent-purple/10 hover:bg-accent-purple/20 text-accent-purple font-bold text-[13px] h-10 px-5 disabled:opacity-50 disabled:pointer-events-none transition-colors"
                  >
                    {isGenerating ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Sparkles className="w-4 h-4" />
                    )}
                    <span>{isGenerating ? "Generating..." : "Generate Draft"}</span>
                  </button>
                </div>
              )}

              {/* Step 4: Review + Send */}
              {step === 4 && (
                <div className="space-y-4">
                  <div className="bg-accent-purple/5 border border-accent-purple/10 rounded-2xl p-4 space-y-2">
                    <p className="text-[13px] font-medium text-secondary">
                      <span className="font-bold">Platform:</span> {platformInfo.label}
                    </p>
                    <p className="text-[13px] font-medium text-secondary">
                      <span className="font-bold">Recipient:</span> {recipient}
                    </p>
                    {platform === "gmail" && subject && (
                      <p className="text-[13px] font-medium text-secondary">
                        <span className="font-bold">Subject:</span> {subject}
                      </p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <label className="text-[12px] font-black uppercase text-text-slate tracking-wider">Message</label>
                    <textarea
                      ref={textareaRef}
                      value={message}
                      onChange={e => setMessage(e.target.value)}
                      placeholder="Type your message..."
                      rows={6}
                      className="w-full rounded-xl border border-border-mist bg-white text-[14px] font-semibold text-secondary p-4 outline-none focus:border-accent-purple resize-none"
                    />
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {!result && (
          <div className="flex items-center justify-between px-6 py-5 border-t border-slate-100">
            <button
              onClick={() => step > 1 ? setStep(step - 1) : onClose()}
              className="flex items-center gap-1 text-[13px] font-bold text-text-slate hover:text-secondary transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>{step > 1 ? "Back" : "Cancel"}</span>
            </button>

            {step < 4 ? (
              <button
                onClick={() => setStep(step + 1)}
                disabled={!canProceed(step)}
                className="flex items-center gap-1 rounded-xl bg-accent-purple hover:bg-accent-purple/90 text-white font-bold text-[13px] h-10 px-5 shadow-md disabled:opacity-50 disabled:pointer-events-none"
              >
                <span>Next</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleSend}
                disabled={isSending || !canProceed(step)}
                className="flex items-center gap-2 rounded-xl bg-accent-purple hover:bg-accent-purple/90 text-white font-bold text-[13px] h-10 px-6 shadow-md disabled:opacity-50 disabled:pointer-events-none"
              >
                {isSending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                <span>{isSending ? "Sending..." : "Send"}</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
