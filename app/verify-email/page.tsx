"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { insforge } from "@/lib/insforge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowRight, Mail, AlertCircle, CheckCircle, RefreshCw } from "lucide-react";

function VerifyEmailForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email") || "";

  const [otp, setOtp] = useState("");
  const [otpError, setOtpError] = useState("");
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  
  // Timer for resend button
  const [countdown, setCountdown] = useState(30);

  useEffect(() => {
    if (!email) {
      router.push("/sign-up");
    }
  }, [email, router]);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleOtpChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, ""); // Allow only digits
    if (val.length <= 6) {
      setOtp(val);
      setOtpError("");
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setFormSuccess("");

    if (otp.length !== 6) {
      setOtpError("Please enter the complete 6-digit code.");
      return;
    }

    setIsLoading(true);

    try {
      const { data, error } = await insforge.auth.verifyEmail({
        email,
        otp,
      });

      if (error) {
        const errObj = error as any;
        setFormError(errObj.message || "Invalid or expired verification code.");
      } else if (data?.accessToken) {
        setFormSuccess("Email verified successfully! Redirecting...");
        setTimeout(() => {
          router.push("/dashboard");
        }, 1500);
      } else {
        setFormError("Verification failed. Please try again.");
      }
    } catch (err: any) {
      setFormError(err.message || "An error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (countdown > 0) return;
    
    setFormError("");
    setFormSuccess("");
    setIsResending(true);

    try {
      const redirectUrl = window.location.origin + "/sign-in";
      const { data, error } = await insforge.auth.resendVerificationEmail({
        email,
        redirectTo: redirectUrl,
      });

      if (error) {
        setFormError(error.message || "Failed to resend verification code.");
      } else if (data?.success) {
        setFormSuccess("A new verification code has been sent to your email.");
        setCountdown(60); // Reset timer to 60s
      }
    } catch (err: any) {
      setFormError(err.message || "An error occurred. Please try again.");
    } finally {
      setIsResending(false);
    }
  };

  return (
    <Card className="neo-border neo-shadow-lg bg-surface-white p-8 md:p-10">
      <div className="mb-8 text-center">
        <div className="w-12 h-12 bg-accent-purple/10 border-[2.5px] border-accent-purple rounded-[18px] flex items-center justify-center mx-auto mb-4 text-accent-purple">
          <Mail className="w-6 h-6" />
        </div>
        <h1 className="font-display font-black text-3xl text-secondary mb-2">
          Verify Email
        </h1>
        <p className="text-text-slate font-medium">
          We sent a 6-digit verification code to
        </p>
        <p className="font-bold text-secondary mt-1">{email}</p>
      </div>

      {/* Form-level Success Banner */}
      {formSuccess && (
        <div className="mb-6 p-4 bg-success-bg border-[2.5px] border-success rounded-[18px] flex items-start gap-3 text-success text-[15px] font-semibold animate-in fade-in duration-200">
          <CheckCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <p>{formSuccess}</p>
          </div>
        </div>
      )}

      {/* Form-level Error Banner */}
      {formError && (
        <div className="mb-6 p-4 bg-error-bg border-[2.5px] border-error rounded-[18px] flex items-start gap-3 text-error text-[15px] font-semibold animate-in fade-in duration-200">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <p>{formError}</p>
          </div>
        </div>
      )}

      <form onSubmit={handleVerify} className="space-y-6">
        {/* OTP Input */}
        <div className="space-y-3">
          <label htmlFor="otp" className="block text-center text-[15px] font-bold text-secondary">
            Enter 6-Digit Code
          </label>
          <div className="flex justify-center">
            <input
              id="otp"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              placeholder="000000"
              value={otp}
              onChange={handleOtpChange}
              disabled={isLoading || isResending}
              className={`w-full max-w-[200px] tracking-[0.75em] text-center text-2xl font-mono font-bold py-3.5 px-4 rounded-[18px] border-[2.5px] outline-none bg-surface-white text-secondary transition-all duration-200 ${
                otpError
                  ? "border-error focus:border-error"
                  : otp.length === 6
                  ? "border-success focus:border-success"
                  : "border-border-mist focus:border-primary"
              }`}
            />
          </div>
          {otpError && (
            <p className="text-[13px] font-semibold text-error text-center flex items-center justify-center gap-1.5 mt-1 animate-in fade-in duration-150">
              <AlertCircle className="w-4 h-4" />
              {otpError}
            </p>
          )}
        </div>

        {/* Verify Button */}
        <Button
          type="submit"
          variant="primary"
          size="lg"
          isLoading={isLoading}
          disabled={isLoading || isResending}
          className="w-full flex items-center justify-center gap-2 group"
        >
          <span>Verify & Sign In</span>
          {!isLoading && (
            <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
          )}
        </Button>
      </form>

      {/* Resend Action */}
      <div className="mt-8 text-center">
        <button
          type="button"
          onClick={handleResend}
          disabled={countdown > 0 || isResending || isLoading}
          className="text-[15px] font-bold text-primary disabled:text-text-fog outline-none hover:underline focus-visible:ring-2 focus-visible:ring-primary rounded py-1 px-2 inline-flex items-center gap-2 cursor-pointer disabled:pointer-events-none"
        >
          {isResending ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          <span>
            {countdown > 0
              ? `Resend code in ${countdown}s`
              : "Resend verification code"}
          </span>
        </button>
      </div>
    </Card>
  );
}

export default function VerifyEmail() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background-mist p-6 relative overflow-hidden font-sans">
      {/* Background Surrealist Motifs */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-accent-purple/10 blur-[120px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[45%] h-[45%] rounded-full bg-primary/10 blur-[150px]" />

      <div className="w-full max-w-[440px] z-10 font-sans">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="relative w-10 h-10 rounded-xl bg-primary neo-border flex items-center justify-center text-white font-black text-2xl neo-shadow-sm">
            S
          </div>
          <span className="font-display font-black text-3xl tracking-tight text-secondary">
            Syncar
          </span>
        </div>

        <Suspense fallback={
          <Card className="neo-border neo-shadow-lg bg-surface-white p-8 text-center">
            <svg className="animate-spin h-8 w-8 text-primary mx-auto" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <p className="mt-4 font-bold text-secondary">Loading verification form...</p>
          </Card>
        }>
          <VerifyEmailForm />
        </Suspense>
      </div>
    </div>
  );
}
