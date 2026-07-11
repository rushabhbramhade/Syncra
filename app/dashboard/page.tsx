"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { signOutAction } from "@/app/actions";
import {
  LogOut,
  User as UserIcon,
  CheckCircle,
  Database,
  RefreshCw,
  CloudLightning,
  Sparkles,
} from "lucide-react";

// InsforgeUser and DatabaseUser types are provided by useAuth() from auth-provider

import { useAuth } from "@/components/auth-provider";

export default function Dashboard() {
  const router = useRouter();
  
  // Get centralized auth state
  const { user, dbUser, isLoading, clearSession, refreshSession } = useAuth();

  // Redirect backstop: if user is not present and loading has finished, do a hard redirect to /sign-in
  React.useEffect(() => {
    if (!isLoading && !user) {
      window.location.href = "/sign-in";
    }
  }, [user, isLoading]);
  
  const [isSignOutLoading, setIsSignOutLoading] = useState(false);

  // Integrations state
  const [integrations, setIntegrations] = useState<{
    id: string;
    name: string;
    icon: string;
    connected: boolean;
    unread: number;
  }[]>([]);

  // Load real integration statuses
  useEffect(() => {
    if (!user) return;
    const loadIntegrations = async () => {
      try {
        const { getGmailConnectionStatus } = await import("@/app/actions/integrations");
        const gmailConn = await getGmailConnectionStatus(user.id);
        
        setIntegrations([
          { id: "gmail", name: "Gmail", icon: "/gmail.png", connected: !!gmailConn, unread: 0 },
          { id: "slack", name: "Slack", icon: "/slack.png", connected: false, unread: 0 },
          { id: "telegram", name: "Telegram", icon: "/telegram.png", connected: false, unread: 0 },
          { id: "whatsapp", name: "WhatsApp", icon: "/whatsapp.png", connected: false, unread: 0 },
          { id: "outlook", name: "Outlook", icon: "/email.png", connected: false, unread: 0 },
        ]);
      } catch (e) {
        console.error("Failed to load integration status:", e);
        setIntegrations([
          { id: "gmail", name: "Gmail", icon: "/gmail.png", connected: false, unread: 0 },
          { id: "slack", name: "Slack", icon: "/slack.png", connected: false, unread: 0 },
          { id: "telegram", name: "Telegram", icon: "/telegram.png", connected: false, unread: 0 },
          { id: "whatsapp", name: "WhatsApp", icon: "/whatsapp.png", connected: false, unread: 0 },
          { id: "outlook", name: "Outlook", icon: "/email.png", connected: false, unread: 0 },
        ]);
      }
    };
    loadIntegrations();
  }, [user]);

  // Handle Log Out
  const handleSignOut = async () => {
    setIsSignOutLoading(true);
    try {
      clearSession();
      const { error } = await signOutAction();
      if (error) {
        console.error("Sign out action error:", error);
      }
      // Hard redirect to clear router cache and state
      window.location.href = "/sign-in";
    } catch (err) {
      console.error(err);
      window.location.href = "/sign-in";
    } finally {
      setIsSignOutLoading(false);
    }
  };

  // Redirect to integrations page instead of fake local toggle
  const toggleIntegration = (_id: string) => {
    router.push("/dashboard/integrations");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background-mist font-sans">
        <div className="text-center space-y-4 max-w-sm px-6">
          <svg className="animate-spin h-10 w-10 text-primary mx-auto" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="font-bold text-secondary text-lg">Loading your workspace...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null; // redirect handled by useEffect above
  }


  return (
    <div className="pb-10">
      {/* Sign-out + Error Banner */}
      <div className="flex items-center justify-between mb-8">
        <div />
        <Button
          variant="ghost"
          size="sm"
          isLoading={isSignOutLoading}
          onClick={handleSignOut}
          className="text-text-slate hover:text-error hover:bg-error-bg font-bold flex items-center gap-2 px-3 py-1.5 border-[2px] border-transparent hover:border-error rounded-[14px]"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </Button>
      </div>

      {/* Bento Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* Column 1 & 2: User Status & Database Sync Proof */}
        <div className="lg:col-span-2 space-y-8">

          {/* Sync Verification Panel */}
          <Card className="neo-border neo-shadow-md bg-surface-white">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b-[2.5px] border-border-mist pb-6 mb-6 gap-4">
              <div className="flex items-center gap-3.5">
                <div className="p-3 bg-primary/10 border-[2px] border-primary rounded-2xl text-primary">
                  <CloudLightning className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="font-display font-black text-2xl text-secondary">
                    Database Provisioning & Sync
                  </h2>
                  <p className="text-text-slate text-[15px] font-medium">
                    Realtime validation of first-time sign-in replication.
                  </p>
                </div>
              </div>

              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-success-bg border-[2px] border-success text-success text-sm font-black rounded-xl">
                <CheckCircle className="w-4 h-4" />
                <span>Sync Active</span>
              </div>
            </div>

            {dbUser ? (
              <div className="space-y-6">
                <div className="p-4 bg-success-bg/30 border-[2px] border-dashed border-success/40 rounded-2xl text-secondary text-[15px] font-medium leading-relaxed">
                  <span className="font-bold text-success">✓ Verified.</span> Upon user registration, a row was automatically provisioned in the <strong>public.users</strong> schema table via Postgres trigger. Below is the active record fetched from the database.
                </div>

                {/* Synced Schema Table View */}
                <div className="border-[2.5px] border-secondary rounded-[18px] overflow-hidden bg-background-mist">
                  <div className="grid grid-cols-2 md:grid-cols-4 bg-secondary text-white text-xs font-bold uppercase tracking-wider p-3.5 border-b-[2.5px] border-secondary gap-4">
                    <div>Field</div>
                    <div className="col-span-3">Value (Fetched via InsForge DB Client)</div>
                  </div>

                  <div className="divide-y-[2px] divide-border-mist font-mono text-[14px]">
                    <div className="grid grid-cols-2 md:grid-cols-4 p-3.5 gap-4">
                      <div className="font-bold text-secondary">user_id (PK)</div>
                      <div className="col-span-3 text-text-slate break-all">{dbUser.id}</div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 p-3.5 gap-4">
                      <div className="font-bold text-secondary">auth_user_id</div>
                      <div className="col-span-3 text-text-slate break-all">{dbUser.auth_user_id}</div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 p-3.5 gap-4">
                      <div className="font-bold text-secondary">email</div>
                      <div className="col-span-3 text-text-slate break-all">{dbUser.email}</div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 p-3.5 gap-4">
                      <div className="font-bold text-secondary">full_name</div>
                      <div className="col-span-3 text-text-slate">{dbUser.full_name}</div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 p-3.5 gap-4">
                      <div className="font-bold text-secondary">auth_provider</div>
                      <div className="col-span-3 text-text-slate uppercase font-bold">{dbUser.auth_provider}</div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 p-3.5 gap-4">
                      <div className="font-bold text-secondary">email_verified</div>
                      <div className="col-span-3 text-text-slate">
                        {dbUser.email_verified ? (
                          <span className="text-success font-bold">TRUE</span>
                        ) : (
                          <span className="text-error font-bold">FALSE</span>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 p-3.5 gap-4">
                      <div className="font-bold text-secondary">created_at</div>
                      <div className="col-span-3 text-text-slate">{dbUser.created_at ? new Date(dbUser.created_at).toLocaleString() : "N/A"}</div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 p-3.5 gap-4">
                      <div className="font-bold text-secondary">last_login_at</div>
                      <div className="col-span-3 text-text-slate">{dbUser.last_login_at ? new Date(dbUser.last_login_at).toLocaleString() : "N/A"}</div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-6 bg-warning-bg border-[2px] border-dashed border-warning rounded-2xl text-center space-y-4">
                <Database className="w-10 h-10 text-warning mx-auto" />
                <div>
                  <h3 className="font-bold text-secondary text-lg">No Database Row Synced</h3>
                  <p className="text-text-slate text-[15px] max-w-md mx-auto mt-1">
                    No matching user row was found in the public schema `users` table. Try refreshing or signing in again.
                  </p>
                </div>
                <Button variant="secondary" size="sm" onClick={() => refreshSession()} className="inline-flex gap-2">
                  <RefreshCw className="w-4 h-4" />
                  <span>Retry Sync</span>
                </Button>
              </div>
            )}
          </Card>

          {/* Mock Integration Controls */}
          <Card className="neo-border neo-shadow-md bg-surface-white">
            <div className="mb-6">
              <h2 className="font-display font-black text-2xl text-secondary mb-1">
                Connected Platforms
              </h2>
              <p className="text-text-slate text-[15px] font-medium">
                Syncar monitors these communication hubs for automated summarization.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {integrations.map((platform) => {
                return (
                  <div
                    key={platform.id}
                    className={`p-5 rounded-[18px] border-[2px] neo-shadow-sm flex items-center justify-between transition-all bg-surface-white ${
                      platform.connected ? "border-secondary" : "border-border-mist opacity-60"
                    }`}
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="p-2.5 rounded-xl bg-background-mist border-[1.5px] border-border-mist">
                        <img src={platform.icon} alt={platform.name} className="w-6 h-6 object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                      </div>
                      <div>
                        <h3 className="font-bold text-secondary text-[16px]">{platform.name}</h3>
                        {platform.connected ? (
                          <span className="text-[13px] font-semibold text-success flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-success" />
                            Synced ({platform.unread} unread)
                          </span>
                        ) : (
                          <span className="text-[13px] font-medium text-text-slate">Disconnected</span>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => toggleIntegration(platform.id)}
                      className={`px-3 py-1.5 font-bold text-xs rounded-xl border-[2px] transition-all cursor-pointer ${
                        platform.connected
                          ? "bg-error-bg border-error text-error hover:bg-error hover:text-white"
                          : "bg-surface-white border-secondary text-secondary hover:bg-secondary hover:text-white"
                      }`}
                    >
                      {platform.connected ? "Disconnect" : "Connect"}
                    </button>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        {/* Column 3: Profile Panel */}
        <div className="space-y-8">
          {/* User Details */}
          <Card className="neo-border neo-shadow-md bg-surface-white text-center">
            <div className="relative w-24 h-24 mx-auto mb-6 rounded-full border-[3px] border-secondary overflow-hidden bg-background-mist flex items-center justify-center text-secondary">
              {user.profile?.avatar_url ? (
                <img
                  src={user.profile.avatar_url}
                  alt={user.profile.name || user.email}
                  className="w-full h-full object-cover"
                />
              ) : (
                <UserIcon className="w-12 h-12 text-text-fog" />
              )}
            </div>

            <h2 className="font-display font-black text-2xl text-secondary mb-1">
              {user.profile?.name || "Member User"}
            </h2>
            <p className="text-text-slate font-medium text-[15px] break-all">{user.email}</p>

            <div className="mt-6 flex flex-wrap gap-2 justify-center">
              <span className="px-3 py-1 bg-primary/10 border-[1.5px] border-primary text-primary text-[13px] font-bold rounded-full uppercase">
                {user.providers?.[0] || "Email"} User
              </span>
              {user.emailVerified && (
                <span className="px-3 py-1 bg-success/10 border-[1.5px] border-success text-success text-[13px] font-bold rounded-full flex items-center gap-1">
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>Verified</span>
                </span>
              )}
            </div>            <div className="mt-8 pt-6 border-t-[2px] border-border-mist text-left space-y-4 text-[13px] font-medium text-text-slate">
              <div className="flex justify-between">
                <span>User ID:</span>
                <span className="font-bold text-secondary font-mono break-all max-w-[150px]">{user.id}</span>
              </div>
              <div className="flex justify-between">
                <span>Created:</span>
                <span className="font-bold text-secondary">
                  {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "N/A"}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Last Login:</span>
                <span className="font-bold text-secondary">
                  {user.updatedAt ? new Date(user.updatedAt).toLocaleDateString() : "N/A"}
                </span>
              </div>
            </div>
          </Card>
 
          {/* AI Assistant Quick Summary Card */}
          <Card className="neo-border neo-shadow-md bg-accent-purple/10 border-accent-purple text-secondary relative overflow-hidden">
            <div className="absolute top-[-20%] right-[-20%] w-24 h-24 rounded-full bg-accent-purple/20 blur-xl" />
            <div className="flex items-center gap-2 mb-4 text-accent-purple">
              <Sparkles className="w-5 h-5" />
              <span className="font-display font-black text-lg">AI Assistant Summary</span>
            </div>
            <p className="text-[14px] leading-relaxed font-semibold">
              &quot;Welcome to Syncra! Connect your communication platforms from the{" "}
              <span className="text-primary font-bold">Integrations</span> page to enable AI-powered summaries and insights across your workspace.&quot;
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
