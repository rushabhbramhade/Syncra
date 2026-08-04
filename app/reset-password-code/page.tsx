"use client";

import React, { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { exchangeResetPasswordTokenAction, resetPasswordAction } from "@/app/actions";
import { validatePassword, PASSWORD_REQUIREMENTS } from "@/lib/validation/auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowRight, AlertCircle, CheckCircle, KeyRound, Eye, EyeOff, Check, X } from "lucide-react";

type ResetState = "code" | "exchanging" | "resetting" | "success" | "expired" | "error";

function ResetPasswordCodeForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email") || "";

  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [codeError, setCodeError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [confirmError, setConfirmError] = useState("");
  const [formError, setFormError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [state, setState] = useState<ResetState>("code");

  const isCodeValid = code.length === 6;
  const isPasswordValid = validatePassword(newPassword) === "";
  const isConfirmValid = newPassword === confirmPassword && confirmPassword.length > 0;

  const canSubmit = isCodeValid && isPasswordValid && isConfirmValid && !isLoading;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setCodeError("");
    setPasswordError("");
    setConfirmError("");

    if (!email) {
      setFormError("Missing email. Please go back and request a new code.");
      return;
    }

    if (code.length !== 6) {
      setCodeError("Enter the 6-digit verification code.");
      return;
    }

    const pErr = validatePassword(newPassword);
    if (pErr) {
      setPasswordError(pErr);
      return;
    }

    if (newPassword !== confirmPassword) {
      setConfirmError("Passwords do not match.");
      return;
    }

    setIsLoading(true);

    try {
      setState("exchanging");
      const { data: exchangeData, error: exchangeError } = await exchangeResetPasswordTokenAction(email, code);

      if (exchangeError) {
        const errObj = exchangeError as { error?: string; message?: string };
        const errCode = errObj.error || "";
        if (errCode === "AUTH_INVALID_CREDENTIALS" || errCode === "AUTH_USER_NOT_FOUND") {
          setCodeError("Invalid verification code. Please try again.");
        } else if (errCode === "AUTH_TOKEN_EXPIRED") {
          setState("expired");
        } else {
          setFormError(errObj.message || "Failed to verify the code. Please try again.");
        }
        setIsLoading(false);
        setState("code");
        return;
      }

      const token = exchangeData?.token;
      if (!token) {
        setFormError("Failed to verify the code. Please try again.");
        setIsLoading(false);
        setState("code");
        return;
      }

      setState("resetting");
      const { data: resetData, error: resetError } = await resetPasswordAction(newPassword, token);

      if (resetError) {
        const errObj = resetError as { error?: string; message?: string };
        const errCode = errObj.error || "";
        if (errCode === "AUTH_TOKEN_EXPIRED" || errCode === "AUTH_INVALID_CREDENTIALS" || errCode === "AUTH_USER_NOT_FOUND") {
          setState("expired");
        } else if (errCode === "AUTH_WEAK_PASSWORD") {
          setPasswordError("Password does not meet the requirements.");
        } else {
          setFormError(errObj.message || "Failed to reset password. Please try again.");
        }
        setIsLoading(false);
        setState("code");
        return;
      }

      if (resetData) {
        setState("success");
      } else {
        setFormError("Something went wrong. Please try again.");
        setIsLoading(false);
        setState("code");
      }
    } catch (err: unknown) {
      const errorObj = err as { message?: string };
      console.error("resetPasswordCodeAction threw:", errorObj);
      setFormError("Network error. Please check your connection and try again.");
      setIsLoading(false);
      setState("code");
    }
  };

  if (state === "success") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f3f3fd] p-4 font-sans">
        <Card className="w-full max-w-md p-8 text-center">
          <div className="mb-6">
            <div className="w-14 h-14 mx-auto rounded-full bg-green-50 flex items-center justify-center mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h1 className="font-display font-bold text-[24px] text-secondary tracking-tight">
              Password updated
            </h1>
            <p className="text-text-slate text-[14px] mt-2 font-medium">
              Your password has been changed successfully. Redirecting to sign in...
            </p>
          </div>

          <Button onClick={() => router.push("/sign-in?reset=success")} className="w-full">
            Back to sign in
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </Card>
      </div>
    );
  }

  if (state === "expired") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f3f3fd] p-4 font-sans">
        <Card className="w-full max-w-md p-8 text-center">
          <div className="mb-6">
            <div className="w-14 h-14 mx-auto rounded-full bg-error-bg flex items-center justify-center mb-4">
              <AlertCircle className="w-8 h-8 text-error" />
            </div>
            <h1 className="font-display font-bold text-[24px] text-secondary tracking-tight">
              Code expired
            </h1>
            <p className="text-text-slate text-[14px] mt-2 font-medium">
              This verification code has expired. Request a new one to continue.
            </p>
          </div>

          <Button onClick={() => router.push(`/forgot-password`)} className="w-full">
            Request a new code
          </Button>

          <p className="text-center text-[14px] font-medium text-slate-500 mt-6">
            <Link href="/sign-in" className="font-bold text-[#4f46e5] hover:underline">
              Back to sign in
            </Link>
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
            Enter verification code
          </h1>
          <p className="text-text-slate text-[14px] mt-1 font-medium">
            We sent a 6-digit code to{" "}
            <span className="font-bold text-secondary">{email}</span>.
          </p>
        </div>

        {formError && (
          <div role="alert" aria-live="polite" className="mb-4 p-4 bg-error-bg border-[2.5px] border-error rounded-xl flex items-start gap-3 text-error text-[14px] font-semibold">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <p>{formError}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          <div className="space-y-1.5">
            <label htmlFor="code" className="block text-[14px] font-bold text-secondary">
              Verification code
            </label>
            <div className="relative">
              <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                id="code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="000000"
                maxLength={6}
                value={code}
                onChange={(e) => {
                  const v = e.target.value.replace(/[^0-9]/g, "");
                  setCode(v);
                  setCodeError("");
                }}
                disabled={isLoading}
                aria-invalid={!!codeError}
                aria-describedby={codeError ? "code-error" : undefined}
                className={`w-full pl-12 pr-4 py-3 rounded-xl border font-medium outline-none bg-surface-white text-secondary transition-all duration-200 tracking-[0.3em] ${codeError ? "border-error focus:border-error" : "border-slate-200 focus:border-[#4f46e5]"}`}
              />
            </div>
            {codeError && (
              <p id="code-error" className="text-[13px] font-semibold text-error flex items-center gap-1.5 mt-1">
                <AlertCircle className="w-4 h-4" />
                {codeError}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="new-password" className="block text-[14px] font-bold text-secondary">
              New password
            </label>
            <div className="relative">
              <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                id="new-password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder="At least 8 characters"
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value);
                  setPasswordError("");
                  setConfirmError("");
                }}
                disabled={isLoading}
                aria-invalid={!!passwordError}
                aria-describedby={passwordError ? "password-error" : undefined}
                className={`w-full pl-12 pr-12 py-3 rounded-xl border font-medium outline-none bg-surface-white text-secondary transition-all duration-200 ${passwordError ? "border-error focus:border-error" : "border-slate-200 focus:border-[#4f46e5]"}`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-4 flex items-center text-text-slate hover:text-secondary focus:outline-none"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            {passwordError && (
              <p id="password-error" className="text-[13px] font-semibold text-error flex items-center gap-1.5 mt-1">
                <AlertCircle className="w-4 h-4" />
                {passwordError}
              </p>
            )}

            {newPassword && (
              <ul className="mt-2 space-y-1">
                {PASSWORD_REQUIREMENTS.map((req) => {
                  const met = req.test(newPassword);
                  return (
                    <li key={req.key} className={`text-[12px] font-semibold flex items-center gap-1.5 ${met ? "text-green-600" : "text-slate-400"}`}>
                      {met ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                      {req.label}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="confirm-password" className="block text-[14px] font-bold text-secondary">
              Confirm new password
            </label>
            <div className="relative">
              <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                id="confirm-password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder="Re-enter your new password"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  setConfirmError("");
                }}
                disabled={isLoading}
                className={`w-full pl-12 pr-4 py-3 rounded-xl border font-medium outline-none bg-surface-white text-secondary transition-all duration-200 ${confirmError ? "border-error focus:border-error" : "border-slate-200 focus:border-[#4f46e5]"}`}
              />
            </div>
            {confirmError && (
              <p className="text-[13px] font-semibold text-error flex items-center gap-1.5 mt-1">
                <AlertCircle className="w-4 h-4" />
                {confirmError}
              </p>
            )}
          </div>

          <Button type="submit" disabled={!canSubmit} className="w-full">
            {isLoading && state === "exchanging"
              ? "Verifying code..."
              : isLoading && state === "resetting"
              ? "Resetting password..."
              : "Reset password"}
            {!isLoading && <ArrowRight className="w-5 h-5" />}
          </Button>
        </form>

        <p className="text-center text-[14px] font-medium text-slate-500 mt-6">
          <Link href="/forgot-password" className="font-bold text-[#4f46e5] hover:underline">
            Back to email entry
          </Link>
        </p>
      </Card>
    </div>
  );
}

export default function ResetPasswordCodePage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-[#f3f3fd] p-4 font-sans">Loading...</div>}>
      <ResetPasswordCodeForm />
    </Suspense>
  );
}