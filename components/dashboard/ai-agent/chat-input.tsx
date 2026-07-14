"use client";

import React from "react";
import {
  Paperclip,
  Loader2,
  Send,
  X,
} from "lucide-react";

function ChatInput({
  onSend,
  attachedFiles,
  onFileAttach,
  onRemoveFile,
  uploadingFile,
  inputRef,
  fileInputRef,
  value,
  onChange,
  isGenerating,
  onCancel,
  formatBytes,
}: {
  onSend: (e: React.FormEvent) => void;
  attachedFiles: any[];
  onFileAttach: () => void;
  onRemoveFile: (idx: number) => void;
  uploadingFile: boolean;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  isGenerating: boolean;
  onCancel: () => void;
  formatBytes: (bytes: number, decimals?: number) => string;
}) {
  return (
    <footer className="p-4 border-t-[2px] border-border-mist bg-surface-white z-10">
      <form onSubmit={onSend} className="max-w-3xl mx-auto space-y-3">
        {attachedFiles.length > 0 && (
          <div className="flex flex-wrap gap-2 pb-2">
            {attachedFiles.map((file, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2 px-2.5 py-1 bg-background-mist rounded-xl border border-border-mist text-[11px] font-medium text-text-ink"
              >
                <span className="max-w-[150px] truncate">{file.name}</span>
                <span className="text-[9px] text-text-slate">({formatBytes(file.size)})</span>
                <button
                  type="button"
                  onClick={() => onRemoveFile(idx)}
                  className="text-text-slate hover:text-error transition-colors cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-end gap-2 border-[2px] border-border-mist focus-within:border-primary/50 bg-background-mist rounded-2xl px-4 py-2.5 transition-colors duration-200">
          <button
            type="button"
            onClick={onFileAttach}
            disabled={uploadingFile}
            className="p-1.5 hover:bg-border-mist rounded-xl text-text-slate hover:text-text-ink transition-colors cursor-pointer shrink-0 disabled:opacity-50"
            title="Attach files"
          >
            {uploadingFile ? (
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
            ) : (
              <Paperclip className="w-5 h-5" />
            )}
          </button>
          <input
            type="file"
            ref={fileInputRef as React.RefObject<HTMLInputElement>}
            onChange={() => {}}
            className="hidden"
          />

          <textarea
            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
            rows={1}
            placeholder="Message Syncra agent..."
            value={value}
            onChange={onChange}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onSend(e);
              }
            }}
            disabled={isGenerating}
            className="flex-1 bg-transparent border-none text-[13px] leading-relaxed max-h-[200px] py-1.5 resize-none focus:outline-none placeholder-text-slate text-text-ink"
          />

          <button
            type="submit"
            disabled={(!value.trim() && attachedFiles.length === 0) || isGenerating}
            className="p-2.5 bg-gradient-to-br from-primary to-primary/80 hover:from-primary hover:to-primary/90 text-white rounded-xl shadow-md hover:shadow-lg transition-all duration-200 shrink-0 cursor-pointer disabled:opacity-50 disabled:transform-none disabled:shadow-none"
          >
            {isGenerating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>

        <div className="flex justify-between items-center px-2">
          <span className="text-[9px] text-text-fog">
            Press Enter to send, Shift+Enter for new line.
          </span>
          {isGenerating && (
            <button
              type="button"
              onClick={onCancel}
              className="text-[10px] text-error font-bold hover:underline cursor-pointer"
            >
              Cancel Generation
            </button>
          )}
        </div>
      </form>
    </footer>
  );
}

export { ChatInput };
export default ChatInput;
