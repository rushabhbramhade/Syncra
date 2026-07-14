import Link from "next/link";
import { LayoutDashboard, SearchX } from "lucide-react";

export default function DashboardNotFound() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-8 font-sans">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="flex justify-center">
          <div className="p-5 bg-warning-bg border-[2.5px] border-warning rounded-2xl text-warning">
            <SearchX className="w-10 h-10" />
          </div>
        </div>
        <div className="space-y-2">
          <h1 className="font-display font-black text-3xl text-secondary">
            Page Not Found
          </h1>
          <p className="text-text-slate text-[15px] font-medium leading-relaxed">
            This workspace route doesn&apos;t exist yet. Head back to your
            dashboard to navigate to an active section.
          </p>
        </div>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-white font-bold rounded-xl hover:opacity-90 transition-opacity"
        >
          <LayoutDashboard className="w-4 h-4" />
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
