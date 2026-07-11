import { ComingSoon } from "@/components/dashboard/coming-soon";
import { Newspaper } from "lucide-react";

export default function BriefingPage() {
  return (
    <ComingSoon
      title="Daily Briefing"
      description="AI-generated morning briefings across your Slack, Gmail, Telegram, and WhatsApp will appear here — summarized, prioritized, and ready to act on."
      icon={<Newspaper className="w-10 h-10" />}
    />
  );
}
