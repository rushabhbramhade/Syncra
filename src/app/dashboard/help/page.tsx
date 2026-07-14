import { ComingSoon } from "@/components/dashboard/coming-soon";
import { LifeBuoy } from "lucide-react";

export default function HelpPage() {
  return (
    <ComingSoon
      title="Help Center"
      description="Documentation, tutorials, and live support for getting the most out of your Syncra workspace."
      icon={<LifeBuoy className="w-10 h-10" />}
    />
  );
}
