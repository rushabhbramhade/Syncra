"use client";

import React, { useState } from "react";
import { MessageCircle, X, Loader2, CheckCircle2, AlertCircle } from "lucide-react";

interface TelegramConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnect: (botToken: string) => Promise<{ success: boolean; error?: string }>;
}

export function TelegramConnectionModal({ isOpen, onClose, onConnect }: TelegramConnectionModalProps) {
  const [botToken, setBotToken] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!botToken.trim()) return;
    setIsConnecting(true);
    setError(null);
    try {
      const res = await onConnect(botToken.trim());
      if (res.success) {
        setSuccess(true);
        setTimeout(() => { onClose(); }, 1500);
      } else {
        setError(res.error || "Failed to connect. Check your bot token.");
      }
    } catch {
      setError("An unexpected error occurred.");
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 bg-slate-950/40 backdrop-blur-[4px] z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
    >
      <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl shadow-slate-950/10 animate-in fade-in zoom-in duration-200">
        <div className="px-6 py-4.5 border-b border-slate-100 bg-slate-50/[0.3] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#0088cc]/10 text-[#0088cc] rounded-xl flex items-center justify-center shrink-0">
              <MessageCircle className="w-5 h-5" />
            </div>
            <span className="font-sans font-semibold text-[17px] text-slate-900 tracking-tight">
              Connect Telegram Bot
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-slate-400/20"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-6 text-left">
          {success ? (
            <div className="flex flex-col items-center justify-center py-8 gap-3">
              <CheckCircle2 className="w-12 h-12 text-green-500" />
              <p className="font-semibold text-[15px] text-slate-800">Telegram connected successfully!</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2.5 text-slate-600">
                <p className="text-[13.5px] font-medium text-slate-750">
                  Enter your Telegram bot token to connect. Get it from{" "}
                  <a
                    href="https://t.me/BotFather"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[#0088cc] font-semibold hover:underline"
                  >
                    @BotFather
                  </a>
                  .
                </p>
                <ul className="space-y-1.5 text-[12.5px] font-medium text-slate-500 pl-1 ml-1 list-disc marker:text-[#0088cc]">
                  <li className="pl-1">Create a bot with <strong className="text-slate-700">/newbot</strong> in BotFather.</li>
                  <li className="pl-1">Copy the HTTP API token (e.g., <span className="font-mono text-[11px] font-semibold">123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11</span>).</li>
                  <li className="pl-1">Paste it below. The bot must be able to send messages to your chats.</li>
                </ul>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="telegram-token-input" className="block text-[12.5px] font-semibold text-slate-700">
                  Bot Token
                </label>
                <div className="relative">
                  <input
                    id="telegram-token-input"
                    type="password"
                    required
                    disabled={isConnecting}
                    value={botToken}
                    onChange={(e) => setBotToken(e.target.value)}
                    placeholder="1234567890:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
                    className="w-full h-11 px-3.5 rounded-xl bg-slate-50 border border-slate-200 text-[14px] font-mono font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0088cc]/20 focus:border-[#0088cc] transition-all disabled:opacity-60"
                  />
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                  <p className="text-[12.5px] font-medium text-red-700">{error}</p>
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 inline-flex items-center justify-center font-medium text-[13.5px] rounded-xl h-10 min-h-[40px] bg-transparent hover:bg-slate-50 border border-slate-200 text-slate-700 transition-all duration-200 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-slate-400/20 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isConnecting || !botToken.trim()}
                  className="flex-1 inline-flex items-center justify-center font-medium text-[13.5px] rounded-xl h-10 min-h-[40px] bg-slate-900 hover:bg-slate-800 text-white transition-all duration-200 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-slate-400/20 disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
                >
                  {isConnecting ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : null}
                  Connect
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default TelegramConnectionModal;
