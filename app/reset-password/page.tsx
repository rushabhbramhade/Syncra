"use client";

import React, { useState, Suspense, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { resetPasswordAction } from "@/app/actions";
import { validatePassword, PASSWORD_REQUIREMENTS } from "@/lib/validation/auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowRight, AlertCircle, CheckCircle, KeyRound, Eye, EyeOff, Check } from "lucide-react";

type ResetState = "form" | "expired" | "success";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [formError, setFormError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [state, setState] = useState<ResetState>("form");

  useEffect(() => {
    if (!token) {
      router.replace("/forgot-password");
    }
  }, [token, router]);

  if (!token) {
    return <div className="min-h-screen flex items-center justify-center bg-[#f3f3fd] p-4 font-sans">Loading...</div>;
  }

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    const pErr = validatePassword(newPassword);
    setPasswordError(pErr);
    if (pErr) return;
    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match.");
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await resetPasswordAction(newPassword, token);
      if (error) {
        const errObj = error as { error?: string; message?: string };
        const code = errObj.error || "";
        if (
          code === "AUTH_TOKEN_EXPIRED" ||
          code === "AUTH_INVALID_EMAIL" ||
          code === "AUTH_INVALID_CREDENTIALS" ||
          code === "AUTH_UNAUTHORIZED" ||
          code === "AUTH_USER_NOT_FOUND" ||
          code === "INVALID_INPUT"
        ) {
          setState("expired");
        } else if (code === "AUTH_WEAK_PASSWORD") {
          setFormError("Password does not meet the requirements. Try again.");
        } else {
          setFormError(errObj.message || "Failed to reset password. The link may have expired.");
        }
      } else if (data) {
        setState("success");
      } else {
        setState("expired");
      }
    } catch (err: unknown) {
      const errorObj = err as { message?: string };
      console.error("resetPasswordAction threw:", errorObj);
      setState("expired");
    } finally {
      setIsLoading(false);
    }
  };

  if (state === "expired") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f3f3fd] p-4 font-sans">
        <Card className="w-full max-w-md p-8 text-center">
          <div className="mb-6">
            <div className="w-14 h-14 mx-auto rounded-full bg-error-bg flex items-center justify-center mb-4">
              <AlertCircle className="w-8 h-8 text-error" />
            </div>
            <h1 className="font-display font-bold text-[24px] text-secondary tracking-tight">
              Reset link expired
            </h1>
            <p className="text-text-slate text-[14px] mt-2 font-medium">
              This reset link is invalid or has expired. Request a new one to continue.
            </p>
          </div>

          <Button onClick={() => router.push("/forgot-password")} className="w-full">
            Request a new link
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
              Your password has been reset. Redirecting to sign in...
            </p>
          </div>

          <Button
            onClick={() => router.push("/sign-in")}
            className="w-full"
          >
            Back to sign in
            <ArrowRight className="w-5 h-5" />
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f3f3fd] p-4 font-sans">
      <Card className="w-full max-w-md p-8">
        <div className="mb-6">
          <img src="/logo.png" alt="Syncra Logo" className="w-8 h-8 object-contain mb-4" />
          <h1 className="font-display font-bold text-[24px] text-secondary tracking-tight">
            Set a new password
          </h1>
          <p className="text-text-slate text-[14px] mt-1 font-medium">
            Choose a new password for your account.
          </p>
        </div>

        {formError && (
          <div aria-live="polite" className="mb-4 p-4 bg-error-bg border-[2.5px] border-error rounded-xl flex items-start gap-3 text-error text-[14px] font-semibold">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <p>{formError}</p>
          </div>
        )}

        <form onSubmit={handleResetPassword} className="space-y-5" noValidate>
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
                    <li
                      key={req.key}
                      className={`text-[12px] font-semibold flex items-center gap-1.5 ${met ? "text-green-600" : "text-slate-400"}`}
                    >
                      <Check className="w-3.5 h-3.5" />
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
                  setPasswordError("");
                }}
                disabled={isLoading}
                className={`w-full pl-12 pr-4 py-3 rounded-xl border font-medium outline-none bg-surface-white text-secondary transition-all duration-200 ${passwordError ? "border-error focus:border-error" : "border-slate-200 focus:border-[#4f46e5]"}`}
              />
            </div>
          </div>

          <Button type="submit" disabled={isLoading} className="w-full">
            {isLoading ? "Resetting..." : "Reset password"}
            {!isLoading && <ArrowRight className="w-5 h-5" />}
          </Button>
        </form>

        <p className="text-center text-[14px] font-medium text-slate-500 mt-6">
          <Link href="/sign-in" className="font-bold text-[#4f46e5] hover:underline">
            Back to sign in
          </Link>
        </p>
      </Card>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-[#f3f3fd] p-4 font-sans">Loading...</div>}>
      <ResetPasswordForm />
    </Suspense>
  );
}
