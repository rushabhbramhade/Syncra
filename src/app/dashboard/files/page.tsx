import { ComingSoon } from "@/components/dashboard/coming-soon";
import { FolderOpen } from "lucide-react";

export default function FilesPage() {
  return (
    <ComingSoon
      title="Files"
      description="Shared documents, attachments, and AI-indexed files from across your connected platforms will be searchable here."
      icon={<FolderOpen className="w-10 h-10" />}
    />
  );
}
