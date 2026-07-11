"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { signInAction, signInWithGoogleAction } from "@/app/actions";
import { ArrowRight, AlertCircle, Eye, EyeOff } from "lucide-react";

export default function SignIn() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Field states (touched & errors)
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [emailTouched, setEmailTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);

  // Form-wide state
  const [formError, setFormError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isOAuthLoading, setIsOAuthLoading] = useState(false);

  // Middleware handles redirection if the user is already authenticated.

  // Client-side validations
  const validateEmail = (val: string) => {
    if (!val) {
      return "Email is required";
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(val)) {
      return "Please enter a valid email address";
    }
    return "";
  };

  const validatePassword = (val: string) => {
    if (!val) {
      return "Password is required";
    }
    if (val.length < 6) {
      return "Password must be at least 6 characters";
    }
    return "";
  };

  // Blur handlers
  const handleEmailBlur = () => {
    setEmailTouched(true);
    setEmailError(validateEmail(email));
  };

  const handlePasswordBlur = () => {
    setPasswordTouched(true);
    setPasswordError(validatePassword(password));
  };

  // Input change handlers (clear errors dynamically)
  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setEmail(val);
    if (emailTouched) {
      setEmailError(validateEmail(val));
    }
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setPassword(val);
    if (passwordTouched) {
      setPasswordError(validatePassword(val));
    }
  };

  // Handle Credentials Sign In
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    // Force validation on all fields
    const eErr = validateEmail(email);
    const pErr = validatePassword(password);
    setEmailError(eErr);
    setPasswordError(pErr);
    setEmailTouched(true);
    setPasswordTouched(true);

    if (eErr || pErr) {
      setFormError("Please fix the validation errors below.");
      return;
    }

    setIsLoading(true);

    try {
      const { data, error } = await signInAction(email, password);

      if (error) {
        // Look for structured error details from the InsForge SDK
        const errObj = error as { error?: string; message?: string };
        if (errObj.error === "AUTH_NEED_VERIFICATION") {
          setFormError("Your email is not verified yet. Redirecting to verification page...");
          setTimeout(() => {
            router.push(`/verify-email?email=${encodeURIComponent(email)}`);
          }, 2000);
        } else {
          setFormError(errObj.message || "Invalid login credentials. Please try again.");
        }
      } else if (data?.user) {
        if (typeof window !== "undefined") {
          localStorage.setItem("syncra-user-session", JSON.stringify(data.user));
        }
        router.push("/dashboard");
      } else {
        setFormError("An unexpected error occurred during sign in.");
      }
    } catch (err: unknown) {
      const errorObj = err as { message?: string };
      setFormError(errorObj.message || "Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Google OAuth Sign In
  const handleGoogleSignIn = async () => {
    setFormError("");
    setIsOAuthLoading(true);

    try {
      const redirectUrl = window.location.origin + "/api/auth/callback";
      const result = await signInWithGoogleAction(redirectUrl);

      if (result && result.error) {
        setFormError(result.error.message || "Failed to initialize Google Sign-In.");
        setIsOAuthLoading(false);
      }
    } catch (err: unknown) {
      const errorObj = err as { message?: string; digest?: string };
      if (errorObj.message?.includes("NEXT_REDIRECT") || errorObj.digest?.startsWith("NEXT_REDIRECT")) {
        throw err;
      }
      setFormError(errorObj.message || "Failed to redirect to Google.");
      setIsOAuthLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f3f3fd] p-4 md:p-8 font-sans">
      <div className="w-full max-w-[1000px] bg-white rounded-[32px] p-4 md:p-6 flex flex-col md:flex-row gap-6 md:gap-12 shadow-[0_20px_50px_rgba(79,70,229,0.08)] border border-slate-100">
        
        {/* Left Panel: Image Background */}
        <div 
          className="w-full md:w-[42%] shrink-0 min-h-[380px] md:min-h-[520px] rounded-[24px] p-8 md:p-10 flex flex-col justify-between text-white relative overflow-hidden bg-cover bg-center"
          style={{
            backgroundImage: "linear-gradient(rgba(15, 23, 42, 0.1), rgba(15, 23, 42, 0.4)), url('/auth-bg.png')"
          }}
        >
          {/* Syncra Logo in white */}
          <div>
            <img src="/logo.png" alt="Syncra Logo" className="w-8 h-8 object-contain" />
          </div>
        </div>

        {/* Right Panel: Form */}
        <div className="flex-1 py-4 md:py-6 px-2 md:px-8 flex flex-col justify-center">
          
          {/* Syncra Logo */}
          <div className="mb-4">
            <img src="/logo.png" alt="Syncra Logo" className="w-8 h-8 object-contain" />
          </div>

          <h1 className="font-display font-bold text-[28px] text-secondary tracking-tight mb-2">
            Sign in to account
          </h1>
          
          <p className="text-text-slate text-[14px] leading-relaxed mb-6 font-medium">
            Access your tasks, notes, and projects anytime, anywhere - and keep everything flowing in one place.
          </p>

          {/* Form-level Error Banner */}
          {formError && (
            <div className="mb-6 p-4 bg-error-bg border-[2.5px] border-error rounded-xl flex items-start gap-3 text-error text-[15px] font-semibold animate-in fade-in duration-200">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <p>{formError}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            {/* Email Field */}
            <div className="space-y-1.5">
              <label htmlFor="email" className="block text-[14px] font-bold text-secondary">
                Your email
              </label>
              <input
                id="email"
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={handleEmailChange}
                onBlur={handleEmailBlur}
                disabled={isLoading || isOAuthLoading}
                className={`w-full px-4 py-3 rounded-xl border font-medium outline-none bg-surface-white text-secondary transition-all duration-200 ${
                  emailError
                    ? "border-error focus:border-error"
                    : emailTouched && !emailError
                    ? "border-secondary focus:border-[#4f46e5]"
                    : "border-slate-200 focus:border-[#4f46e5]"
                }`}
              />
              {emailError && (
                <p className="text-[13px] font-semibold text-error flex items-center gap-1.5 mt-1 animate-in fade-in duration-150">
                  <AlertCircle className="w-4 h-4" />
                  {emailError}
                </p>
              )}
            </div>

            {/* Password Field */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label htmlFor="password" className="block text-[14px] font-bold text-secondary">
                  Password
                </label>
                <Link
                  href="/reset-password"
                  className="text-[13px] font-bold text-[#4f46e5] hover:underline outline-none"
                >
                  Forgot?
                </Link>
              </div>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={handlePasswordChange}
                  onBlur={handlePasswordBlur}
                  disabled={isLoading || isOAuthLoading}
                  className={`w-full pl-4 pr-12 py-3 rounded-xl border font-medium outline-none bg-surface-white text-secondary transition-all duration-200 ${
                    passwordError
                      ? "border-error focus:border-error"
                      : passwordTouched && !passwordError
                      ? "border-secondary focus:border-[#4f46e5]"
                      : "border-slate-200 focus:border-[#4f46e5]"
                  }`}
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
                <p className="text-[13px] font-semibold text-error flex items-center gap-1.5 mt-1 animate-in fade-in duration-150">
                  <AlertCircle className="w-4 h-4" />
                  {passwordError}
                </p>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading || isOAuthLoading}
              className="w-full bg-[#4f46e5] hover:bg-[#4338ca] text-white text-[15px] font-bold py-3.5 px-6 rounded-xl transition-all shadow-[0_8px_30px_rgba(79,70,229,0.25)] hover:shadow-[0_8px_30px_rgba(79,70,229,0.35)] hover:-translate-y-[1px] active:translate-y-0 disabled:opacity-50 disabled:pointer-events-none mt-2 flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Get Started</span>
              {isLoading ? (
                <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <ArrowRight className="w-5 h-5" />
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-4 my-6">
            <div className="h-[1px] bg-slate-100 flex-grow" />
            <span className="text-[12px] font-bold text-slate-400 uppercase tracking-wider">
              or continue with
            </span>
            <div className="h-[1px] bg-slate-100 flex-grow" />
          </div>

          {/* Social Row */}
          <div className="mb-6 grid grid-cols-1 gap-3">
            <button 
              type="button"
              onClick={handleGoogleSignIn}
              disabled={isOAuthLoading || isLoading}
              className="w-full py-3 rounded-xl bg-white border-2 border-slate-200 flex items-center justify-center gap-3 hover:bg-slate-50 hover:border-slate-300 transition-all text-[15px] font-bold text-slate-700 disabled:opacity-50 cursor-pointer shadow-sm"
            >
              {isOAuthLoading ? (
                <svg className="animate-spin h-5 w-5 text-slate-500" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="#EA4335"
                    d="M12.24 10.285V14.4h6.887c-.275 1.565-1.88 4.604-6.887 4.604-4.33 0-7.859-3.578-7.859-8s3.529-8 7.86-8c2.46 0 4.108 1.025 5.048 1.926l3.243-3.123C18.257 1.83 15.427 1 12.24 1 6.06 1 1 6.06 1 12.24s5.06 11.24 11.24 11.24c6.458 0 10.766-4.537 10.766-10.958 0-.742-.08-1.306-.176-1.86H12.24Z"
                  />
                </svg>
              )}
              <span>Continue with Google</span>
            </button>
          </div>

          <p className="text-center text-[14px] font-medium text-slate-500">
            Don&apos;t have an account?{" "}
            <Link
              href="/sign-up"
              className="font-bold text-[#4f46e5] hover:underline outline-none"
            >
              Sign up
            </Link>
          </p>
        </div>

      </div>
    </div>
  );
}
