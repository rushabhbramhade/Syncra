import {
  LayoutDashboard,
  Bot,
  Newspaper,
  Plug2,
  Bell,
  Settings,
  CreditCard,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  iconBg: string;
  badge?: number;
}

export const PRIMARY_NAV: NavItem[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    iconBg: "bg-indigo-600",
  },
  {
    label: "AI Agent",
    href: "/dashboard/ai-agent",
    icon: Bot,
    iconBg: "bg-purple-600",
  },
  {
    label: "Briefing",
    href: "/dashboard/briefing",
    icon: Newspaper,
    iconBg: "bg-amber-600",
  },
  {
    label: "Integrations",
    href: "/dashboard/integrations",
    icon: Plug2,
    iconBg: "bg-emerald-600",
  },
  {
    label: "Alerts",
    href: "/dashboard/alerts",
    icon: Bell,
    iconBg: "bg-rose-600",
    badge: 3,
  },
  {
    label: "Settings",
    href: "/dashboard/settings",
    icon: Settings,
    iconBg: "bg-slate-600",
  },
];

export const SECONDARY_NAV: NavItem[] = [
  {
    label: "Pricing Settings",
    href: "/dashboard/pricing",
    icon: CreditCard,
    iconBg: "bg-cyan-600",
  },
];
