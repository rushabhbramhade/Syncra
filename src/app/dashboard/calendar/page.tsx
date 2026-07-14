import { ComingSoon } from "@/components/dashboard/coming-soon";
import { CalendarDays } from "lucide-react";

export default function CalendarPage() {
  return (
    <ComingSoon
      title="Calendar"
      description="Upcoming meetings, deadlines, and AI-suggested time blocks based on your workspace activity will be displayed here."
      icon={<CalendarDays className="w-10 h-10" />}
    />
  );
}
