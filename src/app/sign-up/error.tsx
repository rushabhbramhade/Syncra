"use client";

export default function SignUpError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background-mist font-sans p-6">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="p-5 bg-error/10 border-[2.5px] border-error rounded-2xl text-error inline-flex mx-auto">
          <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
        </div>
        <h1 className="font-display font-black text-3xl text-secondary">Something went wrong</h1>
        <p className="text-text-slate text-[15px] font-medium">An unexpected error occurred on the sign-up page.</p>
        <button
          onClick={reset}
          className="px-7 py-3.5 bg-primary text-white font-bold rounded-[18px] neo-border hover:-translate-x-[3px] hover:-translate-y-[3px] transition-all"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}
