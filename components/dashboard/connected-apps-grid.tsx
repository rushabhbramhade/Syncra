"use client";
import React from "react";
import { useRouter } from "next/navigation";
import { Settings } from "lucide-react";

interface ConnectedApp {
  id: string;
  name: string;
  icon: string;
  connected: boolean;
}

interface ConnectedAppsGridProps {
  connectedApps: ConnectedApp[];
}

export function ConnectedAppsGrid({ connectedApps }: ConnectedAppsGridProps) {
  const router = useRouter();

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {connectedApps.slice(0, 4).map((app) => (
        <div key={app.id} className="p-5 rounded-2xl bg-surface-white border-[2.5px] border-border-mist flex items-center justify-between hover:border-text-fog hover:shadow-flat-sm transition-all">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-background-mist border-[1.5px] border-border-mist flex items-center justify-center">
              <img src={app.icon} alt={app.name} className="w-6 h-6 object-contain" />
            </div>
            <div>
              <h4 className="font-bold text-secondary">{app.name}</h4>
              <span className={`text-[12px] font-semibold flex items-center gap-1 mt-0.5 ${app.connected ? "text-success" : "text-text-fog"}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${app.connected ? "bg-success" : "bg-text-fog"}`}></span>
                {app.connected ? "Connected" : "Disconnected"}
              </span>
            </div>
          </div>
          <button
            onClick={() => router.push("/dashboard/integrations")}
            className="p-2 text-text-slate hover:text-secondary bg-background-mist hover:bg-slate-100 rounded-lg transition-colors border border-transparent hover:border-border-mist"
            title="Manage Integration"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}

export default ConnectedAppsGrid;
