import { ComingSoon } from "@/components/dashboard/coming-soon";
import { CreditCard } from "lucide-react";

export default function PricingPage() {
  return (
    <ComingSoon
      title="Pricing & Plans"
      description="Upgrade your Syncra plan to unlock advanced AI capabilities, higher message limits, and priority support."
      icon={<CreditCard className="w-10 h-10" />}
    />
  );
}
