import React from "react";
import {
  LayoutDashboard,
  Bot,
  NotebookPen,
  Blocks,
  BellDot,
  Settings2,
  Gem,
} from "lucide-react";

type IconProps = {
  className?: string;
};

export function DashboardIcon({ className }: IconProps) {
  return (
    <LayoutDashboard
      className={className}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
}

export function AIAgentIcon({ className }: IconProps) {
  return (
    <Bot
      className={className}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
}

export function BriefingIcon({ className }: IconProps) {
  return (
    <NotebookPen
      className={className}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
}

export function IntegrationsIcon({ className }: IconProps) {
  return (
    <Blocks
      className={className}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
}

export function AlertsIcon({ className }: IconProps) {
  return (
    <BellDot
      className={className}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
}

export function SettingsIcon({ className }: IconProps) {
  return (
    <Settings2
      className={className}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
}

export function PricingIcon({ className }: IconProps) {
  return (
    <Gem
      className={className}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
}