import { ComingSoon } from "@/components/dashboard/coming-soon";
import { Settings } from "lucide-react";

export default function SettingsPage() {
  return (
    <ComingSoon
      title="Settings"
      description="Manage your account, notification preferences, connected integrations, security settings, and workspace configuration."
      icon={<Settings className="w-10 h-10" />}
    />
  );
}
