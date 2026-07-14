import React from "react";
import {
  DashboardIcon,
  AIAgentIcon,
  BriefingIcon,
  IntegrationsIcon,
  AlertsIcon,
  SettingsIcon,
  PricingIcon,
} from "./sidebar-icons";

export interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  iconBg: string;
  badge?: number;
}

export const PRIMARY_NAV: NavItem[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: DashboardIcon,
    iconBg: "bg-indigo-600",
  },
  {
    label: "AI Agent",
    href: "/dashboard/ai-agent",
    icon: AIAgentIcon,
    iconBg: "bg-purple-600",
  },
  {
    label: "Briefing",
    href: "/dashboard/briefing",
    icon: BriefingIcon,
    iconBg: "bg-amber-600",
  },
  {
    label: "Integrations",
    href: "/dashboard/integrations",
    icon: IntegrationsIcon,
    iconBg: "bg-emerald-600",
  },
  {
    label: "Alerts",
    href: "/dashboard/alerts",
    icon: AlertsIcon,
    iconBg: "bg-rose-600",
    badge: 3,
  },
  {
    label: "Settings",
    href: "/dashboard/settings",
    icon: SettingsIcon,
    iconBg: "bg-slate-600",
  },
];

export const SECONDARY_NAV: NavItem[] = [
  {
    label: "Pricing Settings",
    href: "/dashboard/pricing",
    icon: PricingIcon,
    iconBg: "bg-cyan-600",
  },
];
