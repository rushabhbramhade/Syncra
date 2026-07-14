import { ComingSoon } from "@/components/dashboard/coming-soon";
import { ListTodo } from "lucide-react";

export default function TasksPage() {
  return (
    <ComingSoon
      title="Tasks"
      description="AI-extracted action items from your communications will surface here as trackable tasks with context, deadlines, and assignees."
      icon={<ListTodo className="w-10 h-10" />}
    />
  );
}
