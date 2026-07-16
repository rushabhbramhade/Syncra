"use client";

import React from "react";
import { Settings } from "lucide-react";

export interface PlatformCardPlatform {
  id: string;
  name: string;
  icon: string;
  description: string;
  hasOAuth: boolean;
}

export interface PlatformCardConnectionDetails {
  email?: string;
  connectedAt?: string;
  lastSyncAt?: string;
}

export interface PlatformCardProps {
  platform: PlatformCardPlatform;
  isConnected: boolean;
  connectionDetails?: PlatformCardConnectionDetails | null;
  onConnect: () => void;
  onDisconnect: () => void;
  onSettings: () => void;
}

function renderLinkedInIcon() {
  return (
    <svg className="w-10 h-10 text-[#0A66C2]" viewBox="0 0 24 24" fill="currentColor">
      <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.32 1.3v-1.11h-2.8v8.37h2.8v-4.67c0-.25.02-.5.1-.68a1.14 1.14 0 0 1 1-.77c.76 0 1 .56 1 1.39v4.73h2.8m-11.23-9.5c-.94 0-1.7.76-1.7 1.7a1.71 1.71 0 0 0 1.7 1.71c.95 0 1.7-.77 1.7-1.71a1.71 1.71 0 0 0-1.7-1.7M5.7 18h2.8v-8.37H5.7V18z" />
    </svg>
  );
}

function renderGitHubIcon() {
  return (
    <svg className="w-10 h-10 text-secondary dark:text-white" viewBox="0 0 24 24" fill="currentColor">
      <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.167 6.839 9.49.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.577.688.479C19.138 20.164 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
    </svg>
  );
}

function formatConnectedDate(dateStr: string) {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return "";
  }
}

function formatLastSyncTime(dateStr: string) {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

function PlatformCard({
  platform,
  isConnected,
  connectionDetails,
  onConnect,
  onDisconnect,
  onSettings,
}: PlatformCardProps) {
  return (
    <div
      className={`relative p-6 rounded-[22px] border-[2.5px] bg-surface-white flex flex-col items-center text-center justify-between min-h-[350px] transition-all duration-300 ${
        isConnected
          ? "border-secondary dark:border-white shadow-flat-md"
          : "border-border-mist opacity-80 hover:opacity-100 hover:border-text-fog hover:shadow-flat-sm"
      }`}
    >
      <div className="w-16 h-16 rounded-2xl bg-background-mist border-[1.5px] border-border-mist flex items-center justify-center overflow-hidden mb-4 shrink-0 shadow-inner">
        {platform.icon ? (
          <img
            src={platform.icon}
            alt={platform.name}
            className="w-10 h-10 object-contain"
          />
        ) : platform.id === "linkedin" ? (
          renderLinkedInIcon()
        ) : (
          renderGitHubIcon()
        )}
      </div>

      <div className="space-y-1.5 mb-2.5 shrink-0">
        <h3 className="font-display font-black text-xl text-secondary">
          {platform.name}
        </h3>
        {isConnected ? (
          <div className="flex justify-center">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-success-bg border-[1.5px] border-success text-success text-[11px] font-bold rounded-lg">
              <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
              Connected
            </span>
          </div>
        ) : (
          <div className="flex justify-center">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-background-mist border-[1.5px] border-border-mist text-text-slate text-[11px] font-medium rounded-lg">
              Ready
            </span>
          </div>
        )}
      </div>

      <p className="text-text-slate text-[13px] font-medium leading-relaxed line-clamp-2 h-10 mb-4 overflow-hidden shrink-0">
        {platform.description}
      </p>

      {isConnected && (
        <div className="w-full mb-4 bg-background-mist border-[1.5px] border-border-mist rounded-xl p-3 text-[11px] font-semibold text-text-slate space-y-1 text-left shrink-0">
          {connectionDetails ? (
            <>
              <div className="flex justify-between">
                <span>Account:</span>
                <span className="font-bold text-secondary truncate max-w-[130px]">{connectionDetails.email}</span>
              </div>
              <div className="flex justify-between">
                <span>Linked On:</span>
                <span className="font-bold text-secondary">{formatConnectedDate(connectionDetails.connectedAt || "")}</span>
              </div>
              <div className="flex justify-between">
                <span>Last Sync:</span>
                <span className="font-bold text-secondary">{formatLastSyncTime(connectionDetails.lastSyncAt || "") || "Never"}</span>
              </div>
            </>
          ) : (
            <div className="flex justify-center">
              <span className="text-text-slate">Sync details unavailable</span>
            </div>
          )}
        </div>
      )}



      <div className="w-full flex items-center gap-2 mt-auto shrink-0">
        {isConnected ? (
          <>
            <button
              onClick={onDisconnect}
              className="flex-1 min-h-[42px] px-4 py-2 bg-error-bg border-[2px] border-error text-error font-bold text-[14px] rounded-xl hover:bg-error hover:text-white transition-all duration-200 cursor-pointer text-center"
            >
              Disconnect
            </button>

            <button
              onClick={onSettings}
              title={`${platform.name} Settings`}
              className="min-h-[42px] px-3.5 bg-surface-white border-[2px] border-secondary text-secondary font-bold text-[14px] rounded-xl hover:bg-background-mist transition-all duration-200 cursor-pointer flex items-center justify-center shrink-0"
            >
              <Settings className="w-[18px] h-[18px]" />
            </button>
          </>
        ) : (
          <button
            onClick={onConnect}
            className="w-full min-h-[42px] px-4 py-2 bg-primary text-white border-[2px] border-primary font-bold text-[14px] rounded-xl hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-flat-sm active:translate-x-0 active:translate-y-0 active:shadow-none transition-all duration-200 cursor-pointer text-center"
          >
            Connect
          </button>
        )}
      </div>
    </div>
  );
}

export { PlatformCard };
export default PlatformCard;
