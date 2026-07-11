import { ComingSoon } from "@/components/dashboard/coming-soon";
import { Inbox } from "lucide-react";

export default function InboxPage() {
  return (
    <ComingSoon
      title="Unified Inbox"
      description="All your messages from Gmail, Slack, WhatsApp, Telegram, and Outlook — unified in one smart inbox with AI triage."
      icon={<Inbox className="w-10 h-10" />}
    />
  );
}
