import { ComingSoon } from "@/components/dashboard/coming-soon";
import { Bot } from "lucide-react";

export default function AIAgentPage() {
  return (
    <ComingSoon
      title="AI Agent"
      description="Your intelligent workspace agent is being trained. It will summarize threads, draft replies, and surface action items across all your connected platforms."
      icon={<Bot className="w-10 h-10" />}
    />
  );
}
