"use client";

import React, { useState, useEffect } from "react";
import { BriefingItemRecord } from "@/lib/repositories/briefings-repository";
import { replyToBriefingItemAction, updateBriefingItemStatusAction, getBriefingItemSenderAction, generateDraftAction } from "@/app/actions/briefing";
import { useAuth } from "@/components/auth-provider";
import {
  X, Send, Check, Clock, Archive, CheckCircle, Inbox, AlertCircle,
  Mail, MessageCircle, Calendar, AlertTriangle, FileText, ThumbsUp, MessageSquare, Sparkles
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { decodeHtmlEntities } from "@/lib/utils";

interface BriefingDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: BriefingItemRecord | null;
  onItemUpdated: () => void;
}

export function BriefingDetailsModal({ isOpen, onClose, item, onItemUpdated }: BriefingDetailsModalProps) {
  const { user, dbUser } = useAuth();

  const [replyText, setReplyText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [replySuccess, setReplySuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [showSnoozeOptions, setShowSnoozeOptions] = useState(false);
  const [isStatusUpdating, setIsStatusUpdating] = useState(false);
  const [isLiking, setIsLiking] = useState(false);
  const [isGeneratingDraft, setIsGeneratingDraft] = useState(false);
  const [emailFrom, setEmailFrom] = useState<string | null>(null);
  const [emailTo, setEmailTo] = useState<string | null>(null);

  useEffect(() => {
    setReplyText("");
    setIsSending(false);
    setReplySuccess(false);
    setErrorMessage(null);
    setShowSnoozeOptions(false);
    setIsStatusUpdating(false);
    setIsLiking(false);
    setEmailFrom(null);
    setEmailTo(null);
  }, [item?.id]);

  useEffect(() => {
    if (!item || !isOpen) return;
    const uid = dbUser?.id || user?.id;
    if (!uid) return;
    setEmailFrom(null);
    setEmailTo(null);
    const p = item.platform?.toLowerCase();
    if (p !== "gmail" && p !== "outlook") return;
    const meta = (item.metadata || {}) as Record<string, any>;
    if (meta.from && meta.to) return;

    getBriefingItemSenderAction(uid, item.id!).then(res => {
      if (res.from) setEmailFrom(res.from);
      if (res.to) setEmailTo(res.to);
    }).catch(() => {});
  }, [item?.id, isOpen, dbUser?.id, user?.id]);

  if (!isOpen || !item || !user) return null;
  const activeUserId = dbUser?.id || user.id;

  const metadata = (item.metadata || {}) as Record<string, any>;
  const title = metadata.title || "Untitled Briefing Item";
  const shortSummary = metadata.shortSummary || "";
  const originalContent = decodeHtmlEntities(metadata.originalContent || "No original content available.");
  const platform = item.platform.toLowerCase();
  const category = item.category.toLowerCase();

  const renderIcon = () => {
    if (platform === "gmail" || platform === "outlook") return <Mail className="w-5 h-5" />;
    if (platform === "slack" || platform === "whatsapp" || platform === "telegram" || platform === "discord") return <MessageCircle className="w-5 h-5" />;
    if (platform === "calendar") return <Calendar className="w-5 h-5" />;
    if (platform === "github") return <AlertCircle className="w-5 h-5" />;
    if (platform === "linkedin") return <ThumbsUp className="w-5 h-5" />;
    if (platform === "notion" || platform === "linear") return <FileText className="w-5 h-5" />;
    return <Inbox className="w-5 h-5" />;
  };

  const getPlatformColors = () => {
    if (platform === "gmail") return "bg-red-500/10 text-red-600 border-red-500/20";
    if (platform === "outlook") return "bg-blue-600/10 text-blue-700 border-blue-600/20";
    if (platform === "whatsapp") return "bg-green-500/10 text-green-600 border-green-500/20";
    if (platform === "slack") return "bg-purple-500/10 text-purple-600 border-purple-500/20";
    if (platform === "telegram") return "bg-sky-500/10 text-sky-600 border-sky-500/20";
    if (platform === "discord") return "bg-indigo-500/10 text-indigo-600 border-indigo-500/20";
    if (platform === "github") return "bg-gray-500/10 text-gray-700 border-gray-500/20";
    if (platform === "linkedin") return "bg-blue-500/10 text-blue-600 border-blue-500/20";
    if (platform === "calendar") return "bg-emerald-500/10 text-emerald-600 border-emerald-500/20";
    if (platform === "notion") return "bg-stone-500/10 text-stone-600 border-stone-500/20";
    if (platform === "linear") return "bg-rose-500/10 text-rose-600 border-rose-500/20";
    return "bg-slate-500/10 text-slate-600 border-slate-500/20";
  };

  const getCategoryColors = () => {
    if (category === "email") return "bg-blue-500/10 text-blue-600 border-blue-500/20";
    if (category === "meetings") return "bg-emerald-500/10 text-emerald-600 border-emerald-500/20";
    if (category === "messages") return "bg-violet-500/10 text-violet-600 border-violet-500/20";
    if (category === "tasks") return "bg-amber-500/10 text-amber-600 border-amber-500/20";
    if (category === "activity") return "bg-rose-500/10 text-rose-600 border-rose-500/20";
    return "bg-slate-500/10 text-slate-600 border-slate-500/20";
  };

  const handleSendReply = async () => {
    if (!replyText.trim() || isSending) return;
    setIsSending(true);
    setErrorMessage(null);
    setReplySuccess(false);

    try {
      const res = await replyToBriefingItemAction(activeUserId, item.id!, replyText);
      if (res.success) {
        setReplySuccess(true);
        setReplyText("");
        onItemUpdated();
        setTimeout(() => { setReplySuccess(false); onClose(); }, 1500);
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

  const handleGitHubComment = async () => {
    if (!replyText.trim() || isSending) return;
    setIsSending(true);
    setErrorMessage(null);
    setReplySuccess(false);

    try {
      const issueNumber = metadata.issueNumber || metadata.prNumber;
      const repo = metadata.repo || metadata.repository;
      if (!issueNumber || !repo) throw new Error("Missing issue/PR number or repository metadata.");

      const { executeMCPAction } = await import("@/app/actions/integrations");
      const res = await executeMCPAction(activeUserId, "github", "github_add_comment", {
        repo, issueNumber: parseInt(issueNumber), body: replyText,
      });
      if (res.status === "success") {
        setReplySuccess(true);
        setReplyText("");
        onItemUpdated();
        setTimeout(() => { setReplySuccess(false); onClose(); }, 1500);
      } else {
        throw new Error(res.error?.message || "Failed to post comment");
      }
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || "Failed to post comment.");
    } finally {
      setIsSending(false);
    }
  };

  const handleLinkedInLike = async () => {
    if (isLiking) return;
    setIsLiking(true);
    setErrorMessage(null);
    try {
      const { executeMCPAction } = await import("@/app/actions/integrations");
      const postId = metadata.postId || item.source_id;
      if (!postId) throw new Error("Missing post ID.");

      const res = await executeMCPAction(activeUserId, "linkedin", "linkedin_like_post", { postId });
      if (res.status === "success") {
        setReplySuccess(true);
        setTimeout(() => setReplySuccess(false), 2000);
      } else {
        throw new Error(res.error?.message || "Failed to like");
      }
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || "Failed to like post.");
    } finally {
      setIsLiking(false);
    }
  };

  const handleGenerateDraft = async () => {
    if (isGeneratingDraft) return;
    setIsGeneratingDraft(true);
    setErrorMessage(null);
    try {
      const instruction = `Reply to email titled "${title}"${originalContent ? `\n\nOriginal email content:\n${originalContent}` : ""}`;
      const res = await generateDraftAction(instruction, "gmail");
      if (res.success && res.draft) {
        setReplyText(res.draft);
      } else {
        setErrorMessage(res.error || "Failed to generate draft");
      }
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || "Failed to generate draft");
    } finally {
      setIsGeneratingDraft(false);
    }
  };

  const handleUpdateStatus = async (newStatus: "completed" | "archived" | "read") => {
    if (isStatusUpdating) return;
    setIsStatusUpdating(true);
    setErrorMessage(null);
    try {
      await updateBriefingItemStatusAction(activeUserId, item.id!, newStatus);
      onItemUpdated();
      onClose();
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || "Failed to update item.");
    } finally {
      setIsStatusUpdating(false);
    }
  };

  const handleSnooze = async (minutes: number) => {
    if (isStatusUpdating) return;
    setIsStatusUpdating(true);
    setShowSnoozeOptions(false);
    setErrorMessage(null);
    const snoozeUntil = new Date(Date.now() + minutes * 60000).toISOString();
    try {
      await updateBriefingItemStatusAction(activeUserId, item.id!, "snoozed", null, snoozeUntil);
      onItemUpdated();
      onClose();
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || "Failed to snooze item.");
    } finally {
      setIsStatusUpdating(false);
    }
  };

  const canReply = platform === "gmail" || platform === "whatsapp" || platform === "slack" || platform === "telegram" || platform === "discord";
  const isGitHub = platform === "github";
  const isLinkedIn = platform === "linkedin";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 dark:bg-black/60 backdrop-blur-[4px] animate-in fade-in duration-200">
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
                item.priority === "high" ? "bg-error/10 text-error border-error/20" :
                item.priority === "normal" ? "bg-warning/10 text-warning border-warning/20" :
                "bg-success/10 text-success border-success/20"
              }`}>
                {item.priority}
              </span>
              <p className="text-[12px] font-bold text-text-slate mt-1.5">
                {new Date(item.timestamp).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
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
          {errorMessage && (
            <div className="p-4 bg-error-bg border-[1.5px] border-error text-error rounded-2xl flex items-center gap-2 font-bold text-[13px]">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <p>{errorMessage}</p>
            </div>
          )}

          <div>
            {(metadata.from || metadata.to || emailFrom || emailTo) && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-3 text-[12px] font-semibold text-text-slate bg-slate-50 dark:bg-slate-900/30 px-4 py-2.5 rounded-2xl border border-slate-100 dark:border-slate-800/80">
                {(metadata.from || emailFrom) && (
                  <span className="flex items-center gap-1.5">
                    <span className="text-text-fog font-bold uppercase text-[10px] tracking-wider">From:</span>
                    <span>{metadata.from || emailFrom}</span>
                  </span>
                )}
                {(metadata.to || emailTo) && (
                  <span className="flex items-center gap-1.5">
                    <span className="text-text-fog font-bold uppercase text-[10px] tracking-wider">To:</span>
                    <span>{metadata.to || emailTo}</span>
                  </span>
                )}
              </div>
            )}
            <h3 className="font-display font-black text-xl text-secondary mb-2 leading-snug">{title}</h3>
            {shortSummary && (
              <p className="text-[14px] text-text-slate font-medium leading-relaxed bg-slate-50 dark:bg-slate-900/30 p-4 rounded-2xl border border-slate-100 dark:border-slate-800/80">
                {shortSummary}
              </p>
            )}
          </div>

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

          {/* Platform-specific actions */}
          {canReply && (
            <div className="space-y-3 bg-accent-purple/5 p-5 rounded-3xl border border-accent-purple/10">
              <h4 className="text-[13px] font-black text-accent-purple uppercase tracking-wider flex items-center gap-1.5">
                <Send className="w-4 h-4" />
                <span>Quick Reply via {platform === "gmail" ? "Gmail" : platform}</span>
              </h4>
              {replySuccess ? (
                <div className="py-8 flex flex-col items-center justify-center gap-2 text-center text-success animate-in fade-in duration-200">
                  <div className="w-12 h-12 bg-success/10 border border-success rounded-full flex items-center justify-center">
                    <Check className="w-6 h-6" />
                  </div>
                  <h5 className="font-bold text-[14px]">Reply Sent Successfully</h5>
                  <p className="text-[12px] text-text-slate font-semibold">Item marked as completed.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder={`Type your reply...`}
                    rows={3}
                    className="w-full rounded-2xl border border-border-mist focus:border-accent-purple bg-white dark:bg-[#0F172A] text-[14px] font-semibold text-secondary p-4 outline-none resize-none shadow-sm focus:ring-2 focus:ring-accent-purple/10 duration-200 leading-relaxed placeholder:text-text-fog"
                  />
                  <div className="flex items-center justify-between gap-2">
                    <Button
                      onClick={handleGenerateDraft}
                      disabled={isGeneratingDraft || isSending}
                      variant="ghost"
                      className="rounded-xl border border-accent-purple/20 text-accent-purple hover:bg-accent-purple/5 font-bold text-[12px] h-10 px-3.5 flex items-center gap-1.5"
                    >
                      {isGeneratingDraft ? (
                        <><span className="w-4 h-4 border-2 border-accent-purple border-t-transparent rounded-full animate-spin"></span><span>Generating...</span></>
                      ) : (
                        <><Sparkles className="w-3.5 h-3.5" /><span>AI Draft</span></>
                      )}
                    </Button>
                    <Button
                      onClick={handleSendReply}
                      disabled={!replyText.trim() || isSending}
                      className="rounded-xl bg-accent-purple hover:bg-accent-purple/90 text-white font-bold text-[13px] h-10 px-4 flex items-center gap-1.5 shadow-md hover:translate-y-[-1px] active:translate-y-0 duration-150"
                    >
                      {isSending ? (
                        <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span><span>Sending...</span></>
                      ) : (
                        <><Send className="w-3.5 h-3.5" /><span>Send Reply</span></>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {isGitHub && (
            <div className="space-y-3 bg-gray-50 dark:bg-gray-900/30 p-5 rounded-3xl border border-gray-200 dark:border-gray-800">
              <h4 className="text-[13px] font-black text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                <MessageSquare className="w-4 h-4" />
                <span>Comment on Issue / PR</span>
              </h4>
              {replySuccess ? (
                <div className="py-8 flex flex-col items-center justify-center gap-2 text-center text-success animate-in fade-in duration-200">
                  <div className="w-12 h-12 bg-success/10 border border-success rounded-full flex items-center justify-center">
                    <Check className="w-6 h-6" />
                  </div>
                  <h5 className="font-bold text-[14px]">Comment Posted</h5>
                </div>
              ) : (
                <div className="space-y-3">
                  <textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Write a comment..."
                    rows={3}
                    className="w-full rounded-2xl border border-border-mist focus:border-accent-purple bg-white dark:bg-[#0F172A] text-[14px] font-semibold text-secondary p-4 outline-none resize-none shadow-sm focus:ring-2 focus:ring-accent-purple/10 duration-200 leading-relaxed placeholder:text-text-fog"
                  />
                  <div className="flex justify-end">
                    <Button
                      onClick={handleGitHubComment}
                      disabled={!replyText.trim() || isSending}
                      className="rounded-xl bg-gray-700 hover:bg-gray-800 text-white font-bold text-[13px] h-10 px-4 flex items-center gap-1.5 shadow-md"
                    >
                      {isSending ? (
                        <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span><span>Posting...</span></>
                      ) : (
                        <><MessageSquare className="w-3.5 h-3.5" /><span>Post Comment</span></>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {isLinkedIn && (
            <div className="space-y-3 bg-blue-50 dark:bg-blue-900/20 p-5 rounded-3xl border border-blue-200 dark:border-blue-800">
              <h4 className="text-[13px] font-black text-blue-700 uppercase tracking-wider flex items-center gap-1.5">
                <ThumbsUp className="w-4 h-4" />
                <span>LinkedIn Interaction</span>
              </h4>
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={handleLinkedInLike}
                  disabled={isLiking || replySuccess}
                  className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-[13px] h-10 px-4 flex items-center gap-1.5 shadow-md"
                >
                  {isLiking ? (
                    <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span><span>Liking...</span></>
                  ) : (
                    <><ThumbsUp className="w-3.5 h-3.5" /><span>Like Post</span></>
                  )}
                </Button>
              </div>
              <div className="space-y-3">
                  <textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Write a comment..."
                  rows={2}
                  className="w-full rounded-2xl border border-border-mist focus:border-accent-purple bg-white dark:bg-[#0F172A] text-[14px] font-semibold text-secondary p-4 outline-none resize-none shadow-sm"
                />
                <div className="flex justify-end">
                  <Button
                    onClick={handleSendReply}
                    disabled={!replyText.trim() || isSending}
                    className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-[13px] h-10 px-4 flex items-center gap-1.5"
                  >
                    {isSending ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span><span>Posting...</span></> : <><MessageSquare className="w-3.5 h-3.5" /><span>Post Comment</span></>}
                  </Button>
                </div>
              </div>
              {replySuccess && (
                <p className="text-[12px] font-bold text-success">Action completed successfully!</p>
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
                  <button onClick={() => handleSnooze(30)} className="w-full text-left px-3 py-2 rounded-xl text-[12.5px] font-bold text-secondary hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">Snooze 30 mins</button>
                  <button onClick={() => handleSnooze(60)} className="w-full text-left px-3 py-2 rounded-xl text-[12.5px] font-bold text-secondary hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">Snooze 1 hour</button>
                  <button onClick={() => handleSnooze(1440)} className="w-full text-left px-3 py-2 rounded-xl text-[12.5px] font-bold text-secondary hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">Snooze 1 day</button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
