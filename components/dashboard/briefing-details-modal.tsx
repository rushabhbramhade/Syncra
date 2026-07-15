"use client";

import React, { useState } from "react";
import { BriefingItemRecord } from "@/lib/repositories/briefings-repository";
import { replyToBriefingItemAction, updateBriefingItemStatusAction } from "@/app/actions/briefing";
import { useAuth } from "@/components/auth-provider";
import {
  X,
  Send,
  Check,
  Clock,
  Archive,
  CheckCircle,
  Inbox,
  AlertCircle,
  Mail,
  MessageCircle,
  Calendar,
  AlertTriangle,
  FileText
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface BriefingDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: BriefingItemRecord | null;
  onItemUpdated: () => void;
}

export function BriefingDetailsModal({
  isOpen,
  onClose,
  item,
  onItemUpdated
}: BriefingDetailsModalProps) {
  const { user } = useAuth();
  
  const [replyText, setReplyText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [replySuccess, setReplySuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  const [showSnoozeOptions, setShowSnoozeOptions] = useState(false);
  const [isStatusUpdating, setIsStatusUpdating] = useState(false);

  if (!isOpen || !item || !user) return null;

  const metadata = (item.metadata || {}) as Record<string, any>;
  const title = metadata.title || "Untitled Briefing Item";
  const shortSummary = metadata.shortSummary || "";
  const originalContent = metadata.originalContent || "No original content available.";
  const platform = item.platform.toLowerCase();
  const category = item.category.toLowerCase();
  
  // Render Platform Icon helper
  const renderIcon = () => {
    if (platform === "gmail") return <Mail className="w-5 h-5" />;
    if (platform === "slack" || platform === "whatsapp" || platform === "telegram" || platform === "discord") {
      return <MessageCircle className="w-5 h-5" />;
    }
    if (platform === "calendar") return <Calendar className="w-5 h-5" />;
    return <Inbox className="w-5 h-5" />;
  };

  // Render Platform Accent Color
  const getPlatformColors = () => {
    if (platform === "gmail") return "bg-red-500/10 text-red-600 border-red-500/20";
    if (platform === "whatsapp") return "bg-green-500/10 text-green-600 border-green-500/20";
    if (platform === "slack") return "bg-purple-500/10 text-purple-600 border-purple-500/20";
    if (platform === "telegram") return "bg-sky-500/10 text-sky-600 border-sky-500/20";
    if (platform === "discord") return "bg-indigo-500/10 text-indigo-600 border-indigo-500/20";
    return "bg-slate-500/10 text-slate-600 border-slate-500/20";
  };

  // Render Category Accent Color
  const getCategoryColors = () => {
    if (category === "email") return "bg-blue-500/10 text-blue-600 border-blue-500/20";
    if (category === "meetings") return "bg-emerald-500/10 text-emerald-600 border-emerald-500/20";
    if (category === "messages") return "bg-violet-500/10 text-violet-600 border-violet-500/20";
    if (category === "tasks") return "bg-amber-500/10 text-amber-600 border-amber-500/20";
    return "bg-slate-500/10 text-slate-600 border-slate-500/20";
  };

  // Reply Submit Handler
  const handleSendReply = async () => {
    if (!replyText.trim() || isSending) return;
    setIsSending(true);
    setErrorMessage(null);
    setReplySuccess(false);

    try {
      const res = await replyToBriefingItemAction(user.id, item.id!, replyText);
      if (res.success) {
        setReplySuccess(true);
        setReplyText("");
        onItemUpdated();
        setTimeout(() => {
          setReplySuccess(false);
          onClose();
        }, 1500);
      } else {
        throw new Error(res.error || "Failed to send reply");
      }
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || "Failed to send reply. Please try again.");
    } finally {
      setIsSending(false);
    }
  };

  // Status Update Handler
  const handleUpdateStatus = async (newStatus: "completed" | "archived" | "read") => {
    if (isStatusUpdating) return;
    setIsStatusUpdating(true);
    setErrorMessage(null);
    
    try {
      await updateBriefingItemStatusAction(user.id, item.id!, newStatus);
      onItemUpdated();
      onClose();
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || "Failed to update item. Please try again.");
    } finally {
      setIsStatusUpdating(false);
    }
  };

  // Snooze Handler
  const handleSnooze = async (minutes: number) => {
    if (isStatusUpdating) return;
    setIsStatusUpdating(true);
    setShowSnoozeOptions(false);
    setErrorMessage(null);

    const snoozeUntil = new Date(Date.now() + minutes * 60000).toISOString();
    
    try {
      await updateBriefingItemStatusAction(user.id, item.id!, "snoozed", null, snoozeUntil);
      onItemUpdated();
      onClose();
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || "Failed to snooze item. Please try again.");
    } finally {
      setIsStatusUpdating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 dark:bg-black/60 backdrop-blur-[4px] animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#0B1120] border border-slate-200 dark:border-slate-800 rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col animate-in fade-in zoom-in duration-200">
        
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/[0.3] dark:bg-slate-900/[0.15]">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-2xl border ${getPlatformColors()}`}>
              {renderIcon()}
            </div>
            <div>
              <span className={`text-[11px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border ${getCategoryColors()}`}>
                {category}
              </span>
              <span className={`text-[11px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border ml-2 ${
                item.priority === 'high' ? 'bg-error/10 text-error border-error/20' :
                item.priority === 'normal' ? 'bg-warning/10 text-warning border-warning/20' :
                'bg-success/10 text-success border-success/20'
              }`}>
                {item.priority}
              </span>
              <p className="text-[12px] font-bold text-text-slate mt-1.5">
                {new Date(item.timestamp).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 flex-1 overflow-y-auto">
          {/* Error message banner */}
          {errorMessage && (
            <div className="p-4 bg-error-bg border-[1.5px] border-error text-error rounded-2xl flex items-center gap-2 font-bold text-[13px]">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <p>{errorMessage}</p>
            </div>
          )}

          {/* Quick Info */}
          <div>
            <h3 className="font-display font-black text-xl text-secondary mb-2 leading-snug">
              {title}
            </h3>
            {shortSummary && (
              <p className="text-[14px] text-text-slate font-medium leading-relaxed bg-slate-50 dark:bg-slate-900/30 p-4 rounded-2xl border border-slate-100 dark:border-slate-800/80">
                {shortSummary}
              </p>
            )}
          </div>

          {/* Original Content */}
          <div className="space-y-2">
            <h4 className="text-[12.5px] font-bold text-secondary uppercase tracking-wider flex items-center gap-1.5">
              <FileText className="w-4 h-4" />
              <span>Original Transcript / Content</span>
            </h4>
            <div className="bg-slate-50 dark:bg-slate-900/60 p-5 rounded-2xl border border-slate-100 dark:border-slate-800/80 max-h-[160px] overflow-y-auto shadow-inner">
              <p className="whitespace-pre-wrap font-sans text-[13px] text-secondary leading-relaxed font-medium">
                {originalContent}
              </p>
            </div>
          </div>

          {/* Quick Reply Box */}
          {(platform === "gmail" || platform === "whatsapp" || platform === "slack" || platform === "telegram") && (
            <div className="space-y-3 bg-accent-purple/5 p-5 rounded-3xl border border-accent-purple/10">
              <h4 className="text-[13px] font-black text-accent-purple uppercase tracking-wider flex items-center gap-1.5">
                <Send className="w-4 h-4" />
                <span>Quick Reply via {platform === "gmail" ? "Gmail" : platform === "whatsapp" ? "WhatsApp" : "Integration"}</span>
              </h4>

              {replySuccess ? (
                <div className="py-8 flex flex-col items-center justify-center gap-2 text-center text-success animate-in fade-in duration-200">
                  <div className="w-12 h-12 bg-success/10 border border-success rounded-full flex items-center justify-center">
                    <Check className="w-6 h-6" />
                  </div>
                  <h5 className="font-bold text-[14px]">Reply Sent Successfully</h5>
                  <p className="text-[12px] text-text-slate font-semibold">Item status marked as completed.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder={`Type your reply to ${platform === 'gmail' ? 'send email' : 'send message'}...`}
                    rows={3}
                    className="w-full rounded-2xl border border-border-mist focus:border-accent-purple bg-white text-[14px] font-semibold text-secondary p-4 outline-none resize-none shadow-sm focus:ring-2 focus:ring-accent-purple/10 duration-200 leading-relaxed placeholder:text-text-fog"
                  />
                  <div className="flex justify-end">
                    <Button
                      onClick={handleSendReply}
                      disabled={!replyText.trim() || isSending}
                      className="rounded-xl bg-accent-purple hover:bg-accent-purple/90 text-white font-bold text-[13px] h-10 px-4 flex items-center gap-1.5 shadow-md hover:translate-y-[-1px] active:translate-y-0 duration-150 shrink-0"
                    >
                      {isSending ? (
                        <>
                          <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                          <span>Sending...</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-3.5 h-3.5" />
                          <span>Send Reply</span>
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Quick Actions Footer */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-slate-100 dark:border-slate-800/80 pt-5">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="ghost"
                onClick={() => handleUpdateStatus("completed")}
                disabled={isStatusUpdating}
                className="rounded-xl border border-slate-200 dark:border-slate-700 font-bold text-[13px] text-secondary hover:bg-success/5 hover:text-success hover:border-success/30 px-3.5 h-10 flex items-center gap-1.5"
              >
                <CheckCircle className="w-4 h-4" />
                <span>Mark Done</span>
              </Button>
              <Button
                variant="ghost"
                onClick={() => handleUpdateStatus("archived")}
                disabled={isStatusUpdating}
                className="rounded-xl border border-slate-200 dark:border-slate-700 font-bold text-[13px] text-secondary hover:bg-slate-100 hover:text-slate-900 px-3.5 h-10 flex items-center gap-1.5"
              >
                <Archive className="w-4 h-4" />
                <span>Archive</span>
              </Button>
            </div>

            <div className="relative">
              <Button
                variant="ghost"
                onClick={() => setShowSnoozeOptions(!showSnoozeOptions)}
                disabled={isStatusUpdating}
                className="rounded-xl border border-slate-200 dark:border-slate-700 font-bold text-[13px] text-secondary hover:bg-warning/5 hover:text-warning hover:border-warning/30 px-3.5 h-10 flex items-center gap-1.5"
              >
                <Clock className="w-4 h-4" />
                <span>Snooze</span>
              </Button>

              {showSnoozeOptions && (
                <div className="absolute right-0 bottom-12 z-20 w-44 bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl p-2 animate-in fade-in slide-in-from-bottom-2 duration-150">
                  <button
                    onClick={() => handleSnooze(30)}
                    className="w-full text-left px-3 py-2 rounded-xl text-[12.5px] font-bold text-secondary hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    Snooze 30 mins
                  </button>
                  <button
                    onClick={() => handleSnooze(60)}
                    className="w-full text-left px-3 py-2 rounded-xl text-[12.5px] font-bold text-secondary hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    Snooze 1 hour
                  </button>
                  <button
                    onClick={() => handleSnooze(1440)} // 24 hours
                    className="w-full text-left px-3 py-2 rounded-xl text-[12.5px] font-bold text-secondary hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    Snooze 1 day
                  </button>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
