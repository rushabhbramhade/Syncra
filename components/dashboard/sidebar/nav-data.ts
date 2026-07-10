import {
  LayoutDashboard,
  Bot,
  Newspaper,
  Inbox,
  ListTodo,
  CalendarDays,
  Plug2,
  FolderOpen,
  Bell,
  BarChart3,
  CreditCard,
  MessageSquareHeart,
  LifeBuoy,
  Settings,
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
    iconBg: "bg-blue-500",
  },
  {
    label: "AI Agent",
    href: "/dashboard/ai-agent",
    icon: Bot,
    iconBg: "bg-violet-500",
  },
  {
    label: "Briefing",
    href: "/dashboard/briefing",
    icon: Newspaper,
    iconBg: "bg-amber-500",
  },
  {
    label: "Inbox",
    href: "/dashboard/inbox",
    icon: Inbox,
    iconBg: "bg-sky-500",
    badge: 12,
  },
  {
    label: "Tasks",
    href: "/dashboard/tasks",
    icon: ListTodo,
    iconBg: "bg-emerald-500",
  },
  {
    label: "Calendar",
    href: "/dashboard/calendar",
    icon: CalendarDays,
    iconBg: "bg-pink-500",
  },
  {
    label: "Integrations",
    href: "/dashboard/integrations",
    icon: Plug2,
    iconBg: "bg-teal-500",
  },
  {
    label: "Files",
    href: "/dashboard/files",
    icon: FolderOpen,
    iconBg: "bg-orange-500",
  },
  {
    label: "Alerts",
    href: "/dashboard/alerts",
    icon: Bell,
    iconBg: "bg-rose-500",
    badge: 3,
  },
  {
    label: "Analytics",
    href: "/dashboard/analytics",
    icon: BarChart3,
    iconBg: "bg-indigo-500",
  },
];

export const SECONDARY_NAV: NavItem[] = [
  {
    label: "Pricing",
    href: "/dashboard/pricing",
    icon: CreditCard,
    iconBg: "bg-cyan-500",
  },
  {
    label: "Feedback",
    href: "/dashboard/feedback",
    icon: MessageSquareHeart,
    iconBg: "bg-fuchsia-500",
  },
  {
    label: "Help Center",
    href: "/dashboard/help",
    icon: LifeBuoy,
    iconBg: "bg-lime-600",
  },
  {
    label: "Settings",
    href: "/dashboard/settings",
    icon: Settings,
    iconBg: "bg-slate-600",
  },
];
