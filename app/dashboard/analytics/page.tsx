import { ComingSoon } from "@/components/dashboard/coming-soon";
import { BarChart3 } from "lucide-react";

export default function AnalyticsPage() {
  return (
    <ComingSoon
      title="Analytics"
      description="Workspace productivity metrics, message volume trends, response time analytics, and AI-generated insights."
      icon={<BarChart3 className="w-10 h-10" />}
    />
  );
}
