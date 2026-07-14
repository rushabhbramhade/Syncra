import { ComingSoon } from "@/components/dashboard/coming-soon";
import { Bell } from "lucide-react";

export default function AlertsPage() {
  return (
    <ComingSoon
      title="Alerts"
      description="Smart alerts for urgent messages, unusual activity, and AI-flagged priority items across all your channels."
      icon={<Bell className="w-10 h-10" />}
    />
  );
}
