import { ComingSoon } from "@/components/dashboard/coming-soon";
import { MessageSquareHeart } from "lucide-react";

export default function FeedbackPage() {
  return (
    <ComingSoon
      title="Feedback"
      description="Share your feedback, feature requests, and bug reports directly with the Syncra team."
      icon={<MessageSquareHeart className="w-10 h-10" />}
    />
  );
}
