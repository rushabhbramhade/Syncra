export interface ProviderMeta {
  id: string;
  name: string;
  icon: string;
  description: string;
  hasOAuth: boolean;
  permissions: string[];
  gradient: string;
  accent: string;
  badgeBg: string;
}

export const PROVIDER_META: ProviderMeta[] = [
  {
    id: "gmail",
    name: "Gmail",
    icon: "/gmail.png",
    description: "Sync your inbox, fetch unread emails, manage drafts, and run Gmail searches.",
    hasOAuth: true,
    permissions: ["Read & send email", "Modify labels", "Search inbox"],
    gradient: "from-[#EA4335] to-[#FBBC05]",
    accent: "text-[#EA4335]",
    badgeBg: "bg-[#FEE9E7]",
  },
  {
    id: "whatsapp",
    name: "WhatsApp",
    icon: "/whatsapp.png",
    description: "Sync chat threads, retrieve contacts, and send WhatsApp messages.",
    hasOAuth: false,
    permissions: ["Read chats", "Send messages", "Search conversations"],
    gradient: "from-[#25D366] to-[#128C7E]",
    accent: "text-[#128C7E]",
    badgeBg: "bg-[#E6F9EE]",
  },
  {
    id: "slack",
    name: "Slack",
    icon: "/slack.png",
    description: "Sync channels, retrieve workspace messages, and post updates to conversations.",
    hasOAuth: true,
    permissions: ["Read channels", "Post messages", "List workspaces"],
    gradient: "from-[#4A154B] to-[#ECB22E]",
    accent: "text-[#4A154B]",
    badgeBg: "bg-[#F1E6F1]",
  },
  {
    id: "github",
    name: "GitHub",
    icon: "/github.svg",
    description: "Monitor issues, review PRs, track repositories, and trigger workflow actions.",
    hasOAuth: true,
    permissions: ["Read repos", "Read notifications", "Search issues"],
    gradient: "from-[#24292E] to-[#6E5494]",
    accent: "text-secondary",
    badgeBg: "bg-background-mist",
  },
  {
    id: "discord",
    name: "Discord",
    icon: "/discord.png",
    description: "Monitor guild servers, list channels, and post automatic webhooks.",
    hasOAuth: false,
    permissions: ["Read channels", "Send messages", "List guilds"],
    gradient: "from-[#5865F2] to-[#99AAB5]",
    accent: "text-[#5865F2]",
    badgeBg: "bg-[#EAEEFE]",
  },
  {
    id: "telegram",
    name: "Telegram",
    icon: "/telegram.png",
    description: "Connect to bot clients, read incoming chat updates, and broadcast alerts.",
    hasOAuth: false,
    permissions: ["Read messages", "Send messages", "Broadcast alerts"],
    gradient: "from-[#229ED9] to-[#2AABEE]",
    accent: "text-[#229ED9]",
    badgeBg: "bg-[#E6F4FC]",
  },
  {
    id: "linkedin",
    name: "LinkedIn",
    icon: "/linkedin.svg",
    description: "Share feed posts, sync user profiles, and retrieve connection stats.",
    hasOAuth: true,
    permissions: ["Read profile", "Post updates", "Read connections"],
    gradient: "from-[#0A66C2] to-[#0E76A8]",
    accent: "text-[#0A66C2]",
    badgeBg: "bg-[#E7F1FA]",
  },
  {
    id: "outlook",
    name: "Outlook",
    icon: "/outlook.png",
    description: "Search and send email through Microsoft Graph. (Coming soon)",
    hasOAuth: true,
    permissions: ["Read mail", "Send mail", "Read profile"],
    gradient: "from-[#0078D4] to-[#0F6CBD]",
    accent: "text-[#0078D4]",
    badgeBg: "bg-[#E6F2FB]",
  },
  {
    id: "notion",
    name: "Notion",
    icon: "/notion.png",
    description: "Search pages, read content, and manage your workspace. (Coming soon)",
    hasOAuth: true,
    permissions: ["Read pages", "Search workspace"],
    gradient: "from-[#000000] to-[#555555]",
    accent: "text-secondary",
    badgeBg: "bg-background-mist",
  },
  {
    id: "linear",
    name: "Linear",
    icon: "/linear.png",
    description: "List and read issues across your team's workspaces. (Coming soon)",
    hasOAuth: true,
    permissions: ["Read issues", "Read projects"],
    gradient: "from-[#5E6AD2] to-[#7A86F2]",
    accent: "text-[#5E6AD2]",
    badgeBg: "bg-[#ECEFFE]",
  },
];

export const PROVIDER_META_MAP: Record<string, ProviderMeta> = Object.fromEntries(
  PROVIDER_META.map((p) => [p.id, p])
);

export const ACTIVE_PROVIDERS = PROVIDER_META.filter((p) =>
  ["gmail", "whatsapp", "slack", "github", "discord", "telegram", "linkedin"].includes(p.id)
);

export function getProviderMeta(id: string): ProviderMeta {
  return PROVIDER_META_MAP[id] || {
    id,
    name: id,
    icon: "",
    description: "",
    hasOAuth: false,
    permissions: [],
    gradient: "from-slate-500 to-slate-600",
    accent: "text-secondary",
    badgeBg: "bg-background-mist",
  };
}
