"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { X, Bot, ExternalLink, CheckCircle2, Loader2, RefreshCw } from "lucide-react";

interface DiscordConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnect: () => Promise<{ success: boolean; error?: string; username?: string; guildCount?: number; inviteUrl?: string }>;
  getInviteUrl: () => Promise<string | null>;
}

export function DiscordConnectionModal({ isOpen, onClose, onConnect, getInviteUrl }: DiscordConnectionModalProps) {
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [botName, setBotName] = useState("");
  const [guildCount, setGuildCount] = useState(0);
  const [isPolling, setIsPolling] = useState(false);
  const [inviteOpened, setInviteOpened] = useState(false);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    setIsPolling(false);
  }, []);

  const startPolling = useCallback(() => {
    setIsPolling(true);
    setError(null);

    pollingRef.current = setInterval(async () => {
      try {
        const res = await onConnect();
        if (res.success) {
          stopPolling();
          setSuccess(true);
          setBotName(res.username || "");
          setGuildCount(res.guildCount || 0);
        }
      } catch {
        // continue polling
      }
    }, 3000);
  }, [onConnect, stopPolling]);

  useEffect(() => {
    if (isOpen) {
      getInviteUrl().then(setInviteUrl);
      setError(null);
      setSuccess(false);
      setInviteOpened(false);
      stopPolling();
    }
    return () => stopPolling();
  }, [isOpen, getInviteUrl, stopPolling]);

  if (!isOpen) return null;

  const handleOpenInvite = () => {
    window.open(inviteUrl || "#", "_blank");
    setInviteOpened(true);
    setTimeout(() => startPolling(), 4000);
  };

  const handleConnect = async () => {
    setIsConnecting(true);
    setError(null);

    try {
      const res = await onConnect();
      if (res.success) {
        setSuccess(true);
        setBotName(res.username || "");
        setGuildCount(res.guildCount || 0);
      } else {
        setError(res.error || "Failed to connect Discord.");
      }
    } catch {
      setError("An unexpected error occurred.");
    } finally {
      setIsConnecting(false);
    }
  };

  const handleClose = () => {
    stopPolling();
    setError(null);
    setSuccess(false);
    setInviteOpened(false);
    onClose();
  };

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-surface-white neo-border rounded-[28px] max-w-md w-full overflow-hidden neo-shadow-lg animate-in fade-in zoom-in duration-200">
        <div className="p-6 border-b-[2.5px] border-border-mist bg-background-mist flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-primary" />
            <span className="font-display font-black text-[18px] text-secondary">
              Connect Discord
            </span>
          </div>
          <button onClick={handleClose} className="p-1.5 hover:bg-black/5 rounded-lg text-text-slate transition-all">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {success ? (
            <div className="text-center space-y-4 py-4">
              <div className="w-16 h-16 bg-success-bg rounded-full flex items-center justify-center mx-auto border-[2.5px] border-success">
                <CheckCircle2 className="w-8 h-8 text-success" />
              </div>
              <div>
                <p className="font-black text-secondary text-lg">Discord Connected</p>
                <p className="text-text-slate font-medium text-[14px] mt-1">
                  Bot <span className="font-bold text-primary">{botName}</span> is linked to your workspace.
                </p>
                <p className="text-text-slate text-[13px] mt-1">
                  Monitoring {guildCount} server{guildCount !== 1 ? "s" : ""}.
                </p>
              </div>
              <button
                onClick={handleClose}
                className="mt-2 px-8 py-2.5 bg-primary text-white font-bold rounded-xl neo-shadow-sm hover:brightness-110 transition-all"
              >
                Done
              </button>
            </div>
          ) : isPolling ? (
            <div className="text-center space-y-4 py-6">
              <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" />
              <div>
                <p className="font-black text-secondary text-lg">Waiting for authorization...</p>
                <p className="text-text-slate font-medium text-[13px] mt-1">
                  Complete the authorization in the Discord tab.
                </p>
                <p className="text-text-slate text-[12px] mt-2">
                  Auto-detecting once the bot joins your server...
                </p>
              </div>
              <button
                onClick={stopPolling}
                className="text-[12px] text-primary hover:underline font-medium"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="space-y-1">
                <p className="text-[13px] text-text-slate font-medium leading-relaxed">
                  Add the Syncra bot to your Discord server to grant the AI Agent access.
                </p>
              </div>

              <div className="bg-background-mist border-[2px] border-border-mist rounded-xl p-4 space-y-3">
                <p className="text-[12px] font-bold text-secondary uppercase tracking-wider">Step 1: Invite Bot</p>
                <button
                  onClick={handleOpenInvite}
                  className="flex items-center justify-center gap-2 w-full py-2.5 bg-primary/5 border-[2px] border-primary text-primary font-bold rounded-xl hover:bg-primary/10 transition-all"
                >
                  <ExternalLink className="w-4 h-4" />
                  Open Invite Link
                </button>
                <p className="text-[11px] text-text-slate font-medium text-center">
                  Select the server and authorize the bot.
                </p>

                {inviteOpened && !isPolling && (
                  <div className="border-t border-border-mist pt-3">
                    <p className="text-[12px] font-bold text-secondary uppercase tracking-wider">Step 2: Verify Manually</p>
                    <p className="text-[12px] text-text-slate font-medium mt-1">
                      If auto-detection didn&apos;t work, click Verify after adding the bot.
                    </p>
                  </div>
                )}
              </div>

              {error && (
                <div className="p-3 bg-error-bg border-[2px] border-error rounded-xl text-error text-[13px] font-bold space-y-2">
                  <p>{error}</p>
                  {inviteUrl && (
                    <button
                      onClick={handleOpenInvite}
                      className="flex items-center justify-center gap-1.5 text-[12px] text-primary hover:underline w-full"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Open invite link again
                    </button>
                  )}
                </div>
              )}

              <button
                onClick={handleConnect}
                disabled={isConnecting}
                className="w-full py-2.5 bg-primary text-white font-bold rounded-xl neo-shadow-sm hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
              >
                {isConnecting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    Verify Connection
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
