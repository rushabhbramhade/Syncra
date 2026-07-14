"use client";

import { useState, useEffect } from "react";
import { MessageCircle, CheckCircle2, X, Loader2, Send, Trash2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const BOT_USERNAME = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || "syncra_ai_bot";

interface TelegramConnection {
  chatId: string;
  username?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  connectedAt: string;
  lastVerified: string;
}

interface ConnectDialogProps {
  isOpen: boolean;
  onClose: () => void;
  connection: TelegramConnection | null;
  onVerify: () => Promise<void>;
  onDisconnect: () => Promise<void>;
  onSendTest: () => Promise<void>;
  isLoading: boolean;
  testLoading: boolean;
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
}

export function TelegramConnectDialog({
  isOpen,
  onClose,
  connection,
  onVerify,
  onDisconnect,
  onSendTest,
  isLoading,
  testLoading,
}: ConnectDialogProps) {
  const [step, setStep] = useState<"intro" | "connected">(connection ? "connected" : "intro");

  useEffect(() => {
    setStep(connection ? "connected" : "intro");
  }, [connection]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 dark:bg-black/60 backdrop-blur-[4px] animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#0B1120] border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto shadow-2xl shadow-slate-950/10 dark:shadow-black/50 animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4.5 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/[0.3] dark:bg-slate-900/[0.15]">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-sky-500/10 dark:bg-sky-500/20 text-sky-600 dark:text-sky-400 rounded-xl">
              <MessageCircle className="w-5 h-5" />
            </div>
            <span className="font-semibold text-[17px] text-slate-900 dark:text-slate-100 tracking-tight">
              Telegram Notifications
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {step === "intro" && !connection && (
            <>
              {/* Step 1: Connect */}
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-sky-100 dark:bg-sky-900/30 flex items-center justify-center shrink-0">
                    <MessageCircle className="w-8 h-8 text-sky-600 dark:text-sky-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-[15px] text-slate-900 dark:text-slate-100">Syncra Bot</h3>
                    <p className="text-[13px] font-medium text-slate-500 dark:text-slate-400">@{BOT_USERNAME}</p>
                  </div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-900/40 p-4 rounded-xl border border-slate-100 dark:border-slate-800/80 space-y-2">
                  <p className="text-[12.5px] font-medium text-slate-600 dark:text-slate-400 leading-relaxed">
                    Connect your Telegram account to receive AI-powered notifications directly in Telegram.
                  </p>
                  <ul className="space-y-1 text-[12px] text-slate-500 dark:text-slate-500">
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                      <span>Daily AI Brief summaries</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                      <span>Priority items & important alerts</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                      <span>Secure and private — disconnect anytime</span>
                    </li>
                  </ul>
                </div>

                <a
                  href={`https://t.me/${BOT_USERNAME}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full inline-flex items-center justify-center gap-2 h-12 text-[14px] font-semibold rounded-xl bg-sky-500 hover:bg-sky-600 text-white transition-all duration-200 active:scale-[0.98]"
                >
                  <ExternalLink className="w-4 h-4" />
                  Open Telegram
                </a>

                <div className="text-center">
                  <button
                    onClick={onVerify}
                    disabled={isLoading}
                    className="inline-flex items-center justify-center gap-2 h-10 px-6 text-[13px] font-semibold rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-slate-200 text-white dark:text-slate-950 transition-all disabled:opacity-50"
                  >
                    {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                    {isLoading ? "Verifying..." : "Verify Connection"}
                  </button>
                  <p className="mt-2 text-[11px] text-slate-400 dark:text-slate-500">
                    Press Start in Telegram, then click Verify
                  </p>
                </div>
              </div>
            </>
          )}

          {step === "connected" && connection && (
            <>
              {/* Connected State */}
              <div className="flex flex-col items-center text-center gap-4">
                <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-[16px] text-emerald-700 dark:text-emerald-400">Connected</h3>
                  <p className="text-[13px] text-slate-500 dark:text-slate-400 mt-0.5">
                    @{connection.username || connection.chatId}
                  </p>
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-100 dark:border-slate-800/80 divide-y divide-slate-100 dark:divide-slate-800/80">
                <div className="flex items-center justify-between px-4 py-3">
                  <span className="text-[12.5px] font-medium text-slate-500 dark:text-slate-400">Connected</span>
                  <span className="text-[12.5px] font-semibold text-slate-800 dark:text-slate-200">
                    {formatDate(connection.connectedAt)}
                  </span>
                </div>
                <div className="flex items-center justify-between px-4 py-3">
                  <span className="text-[12.5px] font-medium text-slate-500 dark:text-slate-400">Last Verified</span>
                  <span className="text-[12.5px] font-semibold text-slate-800 dark:text-slate-200">
                    {formatDate(connection.lastVerified)}
                  </span>
                </div>
                <div className="flex items-center justify-between px-4 py-3">
                  <span className="text-[12.5px] font-medium text-slate-500 dark:text-slate-400">Username</span>
                  <span className="text-[12.5px] font-semibold text-slate-800 dark:text-slate-200">
                    @{connection.username || "—"}
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Button
                  onClick={onSendTest}
                  disabled={testLoading}
                  variant="primary"
                  size="md"
                  className="w-full"
                >
                  {testLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Send className="w-4 h-4 mr-2" />
                  )}
                  Send Test Notification
                </Button>

                <div className="flex gap-2">
                  <Button
                    onClick={onVerify}
                    disabled={isLoading}
                    variant="secondary"
                    size="md"
                    className="flex-1"
                  >
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Reconnect
                  </Button>
                  <Button
                    onClick={onDisconnect}
                    disabled={isLoading}
                    variant="destructive"
                    size="md"
                    className="flex-1"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Disconnect
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
