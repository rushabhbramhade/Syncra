"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import React, { useEffect, useState, useCallback, useRef } from "react";
import { Smartphone, X, Loader2, CheckCircle2, AlertCircle, RefreshCw, Phone, QrCode, Copy, Check } from "lucide-react";

const QR_TTL_SECONDS = 60;
const CODE_TTL_SECONDS = 120;
const E164_REGEX = /^\+[1-9]\d{1,14}$/;

type AuthMethod = "qr" | "code";

export interface WhatsAppConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  // QR flow
  qr: string | null;
  // Backend-driven QR expiry (absolute epoch ms). Single source of truth for
  // the countdown — the frontend never hardcodes its own TTL.
  qrExpiresAt?: number | null;
  // Pairing code flow
  code: string | null;
  // Shared
  isLoading: boolean;
  error: string | null;
  connected: boolean;
  // QR actions
  onStartQR: () => void;
  onRefreshQR: () => void;
  // Pairing code actions
  onStartCode: (phone: string) => void;
  onRefreshCode: () => void;
  // Shared
  onCancel: () => void;
}

function WhatsAppConnectionModal({
  isOpen,
  onClose,
  qr,
  qrExpiresAt,
  code,
  isLoading,
  error,
  connected,
  onStartQR,
  onRefreshQR,
  onStartCode,
  onRefreshCode,
  onCancel,
}: WhatsAppConnectionModalProps) {
  const [method, setMethod] = useState<AuthMethod>("qr");
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [phase, setPhase] = useState<"select" | "auth">("select");
  const [secondsLeft, setSecondsLeft] = useState(QR_TTL_SECONDS);
  const [copied, setCopied] = useState(false);
  const lastValueRef = useRef<string | null>(null);

  // Countdown. QR: backend-driven via qrExpiresAt (absolute epoch) — no local
  // TTL. Code: local 120s window.
  useEffect(() => {
    if (method === "qr") {
      setSecondsLeft(
        qrExpiresAt ? Math.max(0, Math.ceil((qrExpiresAt - Date.now()) / 1000)) : QR_TTL_SECONDS,
      );
    } else {
      setSecondsLeft(CODE_TTL_SECONDS);
    }
  }, [method, qr, code, qrExpiresAt]);

  useEffect(() => {
    const value = method === "qr" ? qr : code;
    if (!value) return;
    const t = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [method, qr, code]);

  // Auto-refresh on expiry. QR renewal is NON-destructive on the backend (same
  // pairing session + auth state + DB session; only the socket + QR are
  // regenerated), so it's safe to request on countdown zero. The QR is also
  // streamed in via the page poll (qr prop change resets the countdown). A ref
  // guard prevents a repeat fire every tick while a refresh is in flight.
  const expiryHandledRef = useRef(false);
  useEffect(() => {
    if (secondsLeft > 0) { expiryHandledRef.current = false; return; }
    const value = method === "qr" ? qr : code;
    if (!value || expiryHandledRef.current || isLoading) return;
    expiryHandledRef.current = true;
    if (method === "qr") onRefreshQR();
    else onRefreshCode();
  }, [method, qr, code, secondsLeft, isLoading, onRefreshQR, onRefreshCode]);

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setPhase("select");
      setMethod("qr");
      setPhone("");
      setPhoneError(null);
    }
  }, [isOpen]);

  // Auto-close on connected
  useEffect(() => {
    if (connected) {
      const t = setTimeout(() => {
        setPhase("select");
        setPhone("");
        onClose();
      }, 800);
      return () => clearTimeout(t);
    }
  }, [connected, onClose]);

  if (!isOpen) return null;

  const handleCancel = () => {
    onCancel();
    setPhase("select");
    setPhone("");
    onClose();
  };

  const handleSelectQR = () => {
    setMethod("qr");
    setPhase("auth");
    onStartQR();
  };

  const handleSelectCode = () => {
    setMethod("code");
    setPhase("auth");
  };

  const handleCodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const err = validatePhone(phone);
    if (err) { setPhoneError(err); return; }
    setPhoneError(null);
    onStartCode(phone);
  };

  const handleCopyCode = () => {
    const value = method === "qr" ? undefined : code;
    if (!value) return;
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRetry = () => {
    if (method === "qr") {
      onStartQR();
    } else {
      setPhase("select");
      setPhone("");
    }
  };

  const currentValue = method === "qr" ? qr : code;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 bg-slate-950/40 dark:bg-black/60 backdrop-blur-[4px] z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
    >
      <div className="bg-white dark:bg-[#0B1120] border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl shadow-slate-950/10 dark:shadow-black/50 animate-in fade-in zoom-in duration-200">
        <div className="px-6 py-4.5 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/[0.3] dark:bg-slate-900/[0.15] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#25D366]/10 dark:bg-[#25D366]/20 text-[#128C7E] dark:text-[#25D366] rounded-xl flex items-center justify-center shrink-0">
              <Smartphone className="w-5 h-5" />
            </div>
            <span className="font-sans font-semibold text-[17px] text-slate-900 dark:text-slate-100 tracking-tight">
              Link WhatsApp
            </span>
          </div>
          <button
            onClick={handleCancel}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-slate-400/20"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5 text-left">
          {connected ? (
            <div className="flex flex-col items-center justify-center py-8 gap-3 text-center">
              <CheckCircle2 className="w-12 h-12 text-[#25D366]" />
              <p className="font-semibold text-[15px] text-slate-800 dark:text-slate-100">WhatsApp connected!</p>
            </div>
          ) : phase === "select" ? (
            /* ── Method Selection ── */
            <div className="space-y-3">
              <p className="text-[13px] font-medium text-slate-500 dark:text-slate-400 text-center">
                Choose how you&apos;d like to link your WhatsApp account.
              </p>
              <button
                type="button"
                onClick={handleSelectQR}
                className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-slate-200 dark:border-slate-800 hover:border-[#25D366] dark:hover:border-[#25D366] bg-slate-50 dark:bg-black/10 hover:bg-[#25D366]/5 dark:hover:bg-[#25D366]/5 transition-all duration-200 group cursor-pointer"
              >
                <div className="p-2.5 bg-[#25D366]/10 dark:bg-[#25D366]/20 rounded-xl group-hover:bg-[#25D366]/20 transition-colors">
                  <QrCode className="w-5 h-5 text-[#128C7E] dark:text-[#25D366]" />
                </div>
                <div className="text-left flex-1">
                  <p className="text-[14px] font-semibold text-slate-800 dark:text-slate-100">Scan QR Code</p>
                  <p className="text-[12px] text-slate-500 dark:text-slate-400">Use your phone&apos;s camera to scan</p>
                </div>
                <span className="text-[10px] font-bold text-[#25D366] bg-[#25D366]/10 px-2 py-0.5 rounded-full">RECOMMENDED</span>
              </button>
              <button
                type="button"
                onClick={handleSelectCode}
                className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-slate-200 dark:border-slate-800 hover:border-[#25D366] dark:hover:border-[#25D366] bg-slate-50 dark:bg-black/10 hover:bg-[#25D366]/5 dark:hover:bg-[#25D366]/5 transition-all duration-200 group cursor-pointer"
              >
                <div className="p-2.5 bg-[#25D366]/10 dark:bg-[#25D366]/20 rounded-xl group-hover:bg-[#25D366]/20 transition-colors">
                  <Phone className="w-5 h-5 text-[#128C7E] dark:text-[#25D366]" />
                </div>
                <div className="text-left flex-1">
                  <p className="text-[14px] font-semibold text-slate-800 dark:text-slate-100">Link with Phone Number</p>
                  <p className="text-[12px] text-slate-500 dark:text-slate-400">Enter a pairing code on your phone</p>
                </div>
              </button>
            </div>
          ) : method === "code" && !currentValue ? (
            /* ── Phone Number Input ── */
            <form onSubmit={handleCodeSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="block text-[13px] font-semibold text-slate-700 dark:text-slate-300">
                  Phone Number
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => { setPhone(e.target.value); setPhoneError(null); }}
                    placeholder="+919876543210"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-800 rounded-xl text-[14px] font-mono text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#25D366]/30 focus:border-[#25D366] transition-all"
                    autoFocus
                  />
                </div>
                {phoneError && (
                  <p className="text-[12px] font-medium text-red-600 dark:text-red-400">{phoneError}</p>
                )}
              </div>
              <p className="text-[12px] font-medium text-slate-500 dark:text-slate-400">
                Include country code. E.164 format (e.g., +14155552671).
              </p>
              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-xl">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                  <p className="text-[12.5px] font-medium text-red-700 dark:text-red-400">{error}</p>
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setPhase("select")}
                  className="flex-1 inline-flex items-center justify-center font-medium text-[13.5px] rounded-xl h-10 min-h-[40px] bg-transparent hover:bg-slate-50 dark:hover:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 transition-all duration-200 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-slate-400/20 cursor-pointer"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={isLoading || !phone}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 font-medium text-[13.5px] rounded-xl h-10 min-h-[40px] bg-[#25D366] hover:bg-[#20BD5A] text-white transition-all duration-200 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-[#25D366]/30 disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
                >
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Phone className="w-4 h-4" />}
                  Generate Code
                </button>
              </div>
            </form>
          ) : (
            /* ── Auth Display (QR or Code) ── */
            <>
              <div className="flex flex-col items-center gap-4">
                {isLoading || !currentValue ? (
                  <div className={`${method === "qr" ? "w-[220px] h-[220px]" : "w-full h-[100px]"} flex items-center justify-center rounded-lg bg-slate-50 dark:bg-black/10 border border-slate-200 dark:border-slate-800`}>
                    {error ? (
                      <div className="flex flex-col items-center gap-2 px-6 text-center">
                        <AlertCircle className="w-8 h-8 text-red-500" />
                        <p className="text-[12.5px] font-medium text-red-600 dark:text-red-400">{error}</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <Loader2 className="w-8 h-8 animate-spin text-[#25D366]" />
                        <span className="text-[12.5px] font-medium text-slate-500 dark:text-slate-400">
                          {method === "qr" ? "Generating QR code..." : "Generating pairing code..."}
                        </span>
                      </div>
                    )}
                  </div>
                ) : method === "qr" ? (
                  <div className="relative">
                    <QrCodeDisplay value={currentValue} />
                    <div className="absolute inset-0 pointer-events-none ring-1 ring-slate-200 dark:ring-slate-800 rounded-lg" />
                  </div>
                ) : (
                  <div className="w-full flex flex-col items-center justify-center rounded-lg bg-slate-50 dark:bg-black/10 border border-slate-200 dark:border-slate-800 p-6 relative">
                    <p className="text-[32px] font-mono font-bold tracking-[0.25em] text-slate-900 dark:text-slate-100 select-all">
                      {currentValue}
                    </p>
                    <button
                      type="button"
                      onClick={handleCopyCode}
                      className="absolute top-3 right-3 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 transition-all"
                      title="Copy code"
                    >
                      {copied ? <Check className="w-4 h-4 text-[#25D366]" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                )}
              </div>

              {method === "qr" ? (
                <div className="space-y-1 text-center">
                  <p className="text-[13.5px] font-medium text-slate-800 dark:text-slate-200">
                    Scan this QR code using WhatsApp
                  </p>
                  <p className="text-[12.5px] font-medium text-slate-500 dark:text-slate-400">
                    Open WhatsApp → Settings → Linked Devices → Link a Device → Scan QR Code
                  </p>
                </div>
              ) : (
                <div className="space-y-2 text-center">
                  <p className="text-[13.5px] font-medium text-slate-800 dark:text-slate-200">
                    Enter this code on your phone
                  </p>
                  <ol className="text-[12px] font-medium text-slate-500 dark:text-slate-400 space-y-1 text-left max-w-[280px] mx-auto">
                    <li>1. Open WhatsApp</li>
                    <li>2. Go to <span className="font-semibold text-slate-700 dark:text-slate-300">Settings → Linked Devices</span></li>
                    <li>3. Tap <span className="font-semibold text-slate-700 dark:text-slate-300">Link a Device</span></li>
                    <li>4. Tap <span className="font-semibold text-slate-700 dark:text-slate-300">Link with Phone Number Instead</span></li>
                    <li>5. Enter the code above</li>
                  </ol>
                </div>
              )}

              <div className="bg-slate-50 dark:bg-slate-900/40 p-4 rounded-2xl border border-slate-100 dark:border-slate-800/80 flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-[#25D366]" />
                <span className="text-[13px] font-semibold text-[#128C7E] dark:text-[#25D366] animate-pulse">
                  Waiting for authorization...
                </span>
                {!!currentValue && !error && (
                  <span className="text-[12px] font-mono font-semibold text-slate-500 dark:text-slate-400">
                    ({secondsLeft}s)
                  </span>
                )}
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-xl text-left">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                  <p className="text-[12.5px] font-medium text-red-700 dark:text-red-400">{error}</p>
                  <button
                    type="button"
                    onClick={handleRetry}
                    className="ml-auto shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-[12px] font-semibold cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Retry
                  </button>
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="flex-1 inline-flex items-center justify-center font-medium text-[13.5px] rounded-xl h-10 min-h-[40px] bg-transparent hover:bg-slate-50 dark:hover:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 transition-all duration-200 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-slate-400/20 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={method === "qr" ? onRefreshQR : onRefreshCode}
                  disabled={isLoading || !currentValue}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 font-medium text-[13.5px] rounded-xl h-10 min-h-[40px] bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-slate-200 text-white dark:text-slate-950 transition-all duration-200 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-slate-400/20 disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
                >
                  <RefreshCw className="w-4 h-4" />
                  {method === "qr" ? "Refresh QR" : "New Code"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function validatePhone(value: string): string | null {
  if (!value) return "Phone number is required.";
  if (!E164_REGEX.test(value)) return "Use E.164 format (e.g., +919876543210).";
  return null;
}

/** Minimal QR renderer using a canvas — same as the old qr-display.tsx. */
function QrCodeDisplay({ value }: { value: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!value || !canvasRef.current) return;
    // Dynamically import qrcode to avoid SSR issues
    import("qrcode").then((QRCode) => {
      QRCode.toCanvas(canvasRef.current!, value, {
        width: 220,
        margin: 2,
        color: { dark: "#000000", light: "#ffffff" },
      });
    });
  }, [value]);

  return <canvas ref={canvasRef} className="rounded-lg" />;
}

export { WhatsAppConnectionModal };
export default WhatsAppConnectionModal;
