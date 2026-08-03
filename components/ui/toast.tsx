"use client";

import React, { createContext, useContext, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";

type ToastType = "success" | "error" | "info";

interface ToastItem {
  id: number;
  type: ToastType;
  title: string;
  description?: string;
}

interface ToastContextValue {
  toast: (type: ToastType, title: string, description?: string) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const STYLES: Record<ToastType, { icon: React.ReactNode; border: string; text: string; iconColor: string }> = {
  success: {
    icon: <CheckCircle2 className="w-5 h-5" />,
    border: "border-success",
    text: "text-success",
    iconColor: "bg-success-bg text-success",
  },
  error: {
    icon: <AlertCircle className="w-5 h-5" />,
    border: "border-error",
    text: "text-error",
    iconColor: "bg-error-bg text-error",
  },
  info: {
    icon: <Info className="w-5 h-5" />,
    border: "border-info",
    text: "text-info",
    iconColor: "bg-info-bg text-info",
  },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const counter = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((type: ToastType, title: string, description?: string) => {
    const id = ++counter.current;
    setToasts((prev) => [...prev.slice(-3), { id, type, title, description }]);
    setTimeout(() => dismiss(id), 5000);
  }, [dismiss]);

  const value: ToastContextValue = {
    toast,
    success: (t, d) => toast("success", t, d),
    error: (t, d) => toast("error", t, d),
    info: (t, d) => toast("info", t, d),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-3 w-[min(92vw,380px)]">
        <AnimatePresence>
          {toasts.map((t) => {
            const s = STYLES[t.type];
            return (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, x: 40, scale: 0.96 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 40, scale: 0.96 }}
                transition={{ type: "spring", stiffness: 320, damping: 28 }}
                className={`flex items-start gap-3 p-4 bg-surface-white neo-border rounded-[18px] shadow-lg border-[2px] ${s.border}`}
              >
                <span className={`w-9 h-9 shrink-0 rounded-xl flex items-center justify-center ${s.iconColor}`}>
                  {s.icon}
                </span>
                <div className="flex-1 min-w-0">
                  <p className={`font-display font-black text-[14px] ${s.text}`}>{t.title}</p>
                  {t.description && (
                    <p className="text-[12px] text-text-slate font-medium mt-0.5 leading-snug">{t.description}</p>
                  )}
                </div>
                <button onClick={() => dismiss(t.id)} className="p-1 hover:bg-black/5 rounded-lg text-text-fog shrink-0">
                  <X className="w-4 h-4" />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
