"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { sendResetPasswordEmailAction } from "@/app/actions";
import { validateEmail } from "@/lib/validation/auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowRight, Mail, AlertCircle, CheckCircle, RefreshCw } from "lucide-react";

const RESEND_COOLDOWN_SECONDS = 60;
const COOLDOWN_KEY = "syncra-reset-cooldown-until";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [formError, setFormError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const cooldownTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const readCooldown = useCallback((): number => {
    if (typeof window === "undefined") return 0;
    const until = Number(sessionStorage.getItem(COOLDOWN_KEY) || 0);
    return Math.max(0, Math.ceil((until - Date.now()) / 1000));
  }, []);

  const [cooldownLeft, setCooldownLeft] = useState(readCooldown);

  useEffect(() => {
    return () => {
      if (cooldownTimer.current) clearInterval(cooldownTimer.current);
    };
  }, []);

  const startCooldown = useCallback(() => {
    if (typeof window !== "undefined") {
      sessionStorage.setItem(COOLDOWN_KEY, String(Date.now() + RESEND_COOLDOWN_SECONDS * 1000));
    }
    setCooldownLeft(RESEND_COOLDOWN_SECONDS);
    if (cooldownTimer.current) clearInterval(cooldownTimer.current);
    cooldownTimer.current = setInterval(() => {
      setCooldownLeft((prev) => {
        if (prev <= 1) {
          if (cooldownTimer.current) clearInterval(cooldownTimer.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    const eErr = validateEmail(email);
    setEmailError(eErr);
    if (eErr) return;

    setIsLoading(true);
    try {
      const { error } = await sendResetPasswordEmailAction(email);
      if (error) {
        const errObj = error as { message?: string; error?: string };
        const msg = errObj.message || "";
        const lower = msg.toLowerCase();
        if (lower.includes("wait") || lower.includes("rate") || lower.includes("too many")) {
          setFormError("Too many requests. Please wait a moment and try again.");
          setIsLoading(false);
          return;
        }
        console.error("sendResetPasswordEmailAction failed:", error);
      }
      setIsSent(true);
      startCooldown();
    } catch (err: unknown) {
      const errorObj = err as { message?: string };
      console.error("sendResetPasswordEmailAction threw:", errorObj);
      setIsSent(true);
      startCooldown();
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (cooldownLeft > 0 || isLoading) return;
    await handleSendCode({
      preventDefault: () => {},
    } as React.FormEvent);
  };

  const handleContinue = () => {
    router.push(`/reset-password-code?email=${encodeURIComponent(email)}`);
  };

  if (isSent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f3f3fd] p-4 font-sans">
        <Card className="w-full max-w-md p-8 text-center">
          <div className="mb-6">
            <div className="w-14 h-14 mx-auto rounded-full bg-green-50 flex items-center justify-center mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h1 className="font-display font-bold text-[24px] text-secondary tracking-tight">
              Check your inbox
            </h1>
            <p className="text-text-slate text-[14px] mt-2 font-medium">
              We&apos;ve sent a 6-digit verification code to{" "}
              <span className="font-bold text-secondary">{email}</span>.
              <br />
              Enter this code on the next screen.
            </p>
          </div>

          {formError && (
            <div aria-live="polite" className="mb-4 p-4 bg-error-bg border-[2.5px] border-error rounded-xl flex items-start gap-3 text-error text-[14px] font-semibold">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <p>{formError}</p>
            </div>
          )}

          <Button
            type="button"
            onClick={handleResend}
            disabled={cooldownLeft > 0 || isLoading}
            className="w-full"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            {cooldownLeft > 0
              ? `Resend email in ${cooldownLeft}s`
              : isLoading
              ? "Sending..."
              : "Resend email"}
          </Button>

          <Button
            onClick={handleContinue}
            className="w-full mt-4"
          >
            Continue
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>

          <p className="text-center text-[14px] font-medium text-slate-500 mt-6">
            <a href="/sign-in" className="font-bold text-[#4f46e5] hover:underline">
              Back to sign in
            </a>
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f3f3fd] p-4 font-sans">
      <Card className="w-full max-w-md p-8">
        <div className="mb-6">
          <Image src="/logo.png" alt="Syncra Logo" className="w-8 h-8 object-contain mb-4" width={32} height={32} />
          <h1 className="font-display font-bold text-[24px] text-secondary tracking-tight">
            Forgot your password?
          </h1>
          <p className="text-text-slate text-[14px] mt-1 font-medium">
            Enter your email and we&apos;ll send you a 6-digit verification code.
          </p>
        </div>

        <form onSubmit={handleSendCode} className="space-y-5" noValidate>
          <div className="space-y-1.5">
            <label htmlFor="email" className="block text-[14px] font-bold text-secondary">
              Your email
            </label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setEmailError("");
                }}
                disabled={isLoading}
                aria-invalid={!!emailError}
                aria-describedby={emailError ? "email-error" : undefined}
                className={`w-full pl-12 pr-4 py-3 rounded-xl border font-medium outline-none bg-surface-white text-secondary transition-all duration-200 ${emailError ? "border-error focus:border-error" : "border-slate-200 focus:border-[#4f46e5]"}`}
              />
            </div>
            {emailError && (
              <p id="email-error" className="text-[13px] font-semibold text-error flex items-center gap-1.5 mt-1">
                <AlertCircle className="w-4 h-4" />
                {emailError}
              </p>
            )}
          </div>

          <Button type="submit" disabled={isLoading} className="w-full">
            {isLoading ? "Sending..." : "Send verification code"}
            {!isLoading && <ArrowRight className="w-5 h-5" />}
          </Button>
        </form>

        <p className="text-center text-[14px] font-medium text-slate-500 mt-6">
          Remembered it?{" "}
          <a href="/sign-in" className="font-bold text-[#4f46e5] hover:underline">
            Back to sign in
          </a>
        </p>
      </Card>
    </div>
  );
}