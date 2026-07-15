"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PLATFORM_MCP_TOOLS, MCPTool } from "@/constants/mcp-tools";
import {
  getGmailConnectionStatus,
  getConnectionStatus,
  disconnectGmailConnection,
  disconnectConnection,
  checkGoogleApiConfig,
  getProviderTools,
  connectTelegramAction,
  disconnectTelegramWebhookAction,
  connectDiscordAction,
  getDiscordInviteUrlAction,
  disconnectLinkedinAction,
  disconnectGithubAction,
  ConnectionStatus
} from "@/app/actions/integrations";
import {
  requestWhatsAppPairingCodeAction,
  getWhatsAppStatusAction,
  disconnectWhatsAppAction
} from "@/app/actions/whatsapp";
import {
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  X,
  AlertTriangle,
  ExternalLink,
} from "lucide-react";
import dynamic from "next/dynamic";
import { PlatformCard } from "@/components/dashboard/integrations/platform-card";
import type { PlatformCardConnectionDetails } from "@/components/dashboard/integrations/platform-card";
import { COUNTRIES } from "@/components/dashboard/integrations/country-dropdown-portal";

const WhatsAppConnectionModal = dynamic(() => import("@/components/dashboard/integrations/whatsapp-connection-modal").then(mod => mod.WhatsAppConnectionModal), { ssr: false });
const TelegramConnectionModal = dynamic(() => import("@/components/dashboard/integrations/telegram-connection-modal").then(mod => mod.TelegramConnectionModal), { ssr: false });
const DiscordConnectionModal = dynamic(() => import("@/components/dashboard/integrations/discord-connection-modal").then(mod => mod.DiscordConnectionModal), { ssr: false });
const MCPSettingsModal = dynamic(() => import("@/components/dashboard/integrations/mcp-settings-modal").then(mod => mod.MCPSettingsModal), { ssr: false });

interface Platform {
  id: string;
  name: string;
  icon: string;
  description: string;
  hasOAuth: boolean;
}

const PLATFORMS = [
  {
    id: "gmail",
    name: "Gmail",
    icon: "/gmail.png",
    description: "Sync your Google Workspace inbox, fetch unread emails, manage drafts, and run searches using Gmail MCP.",
    hasOAuth: true,
  },
  {
    id: "whatsapp",
    name: "WhatsApp",
    icon: "/whatsapp.png",
    description: "Sync WhatsApp chat threads, retrieve active contacts, and send messages through Meta Cloud API.",
    hasOAuth: false,
  },
  {
    id: "slack",
    name: "Slack",
    icon: "/slack.png",
    description: "Sync public Slack channels, retrieve team workspace messages, and post updates to conversation lists.",
    hasOAuth: true,
  },
  {
    id: "github",
    name: "GitHub",
    icon: "/github.svg",
    description: "Full-stack DevOps integration: monitor frontend/backend issues, track database migrations, review PRs, and trigger CI/CD workflow actions.",
    hasOAuth: true,
  },
  {
    id: "discord",
    name: "Discord",
    icon: "/discord.png",
    description: "Monitor Discord guild servers, list community channels, and post automatic rich webhooks.",
    hasOAuth: false,
  },
  {
    id: "telegram",
    name: "Telegram",
    icon: "/telegram.png",
    description: "Connect to Telegram bot clients, read incoming chat updates, and broadcast secure alerts.",
    hasOAuth: false,
  },
  {
    id: "linkedin",
    name: "LinkedIn",
    icon: "/linkedin.svg",
    description: "Share professional feed posts, sync user profiles, and retrieve basic connection stats.",
    hasOAuth: true,
  }
];

export default function IntegrationsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoading: authLoading } = useAuth();
  const [isDataLoading, setIsDataLoading] = useState(true);

  const isLoading = authLoading || isDataLoading;

  const isMounted = useRef(true);

  const [gmailStatus, setGmailStatus] = useState<ConnectionStatus | null>(null);
  const [slackStatus, setSlackStatus] = useState<ConnectionStatus | null>(null);
  const [telegramStatus, setTelegramStatus] = useState<ConnectionStatus | null>(null);
  const [discordStatus, setDiscordStatus] = useState<ConnectionStatus | null>(null);
  const [linkedinStatus, setLinkedinStatus] = useState<ConnectionStatus | null>(null);
  const [githubStatus, setGithubStatus] = useState<ConnectionStatus | null>(null);
  
  const [mockConnectedList, setMockConnectedList] = useState<string[]>([]);
  
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [settingsPlatform, setSettingsPlatform] = useState<Platform | null>(null);
  const [settingsTools, setSettingsTools] = useState<MCPTool[] | null>(null);
  const [enabledTools, setEnabledTools] = useState<Record<string, boolean>>({});

  const [isGoogleConfiguredOnServer, setIsGoogleConfiguredOnServer] = useState(true);
  const [showConfigAlertModal, setShowConfigAlertModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [whatsappStatus, setWhatsAppStatus] = useState<ConnectionStatus | null>(null);
  const [showTelegramConnectModal, setShowTelegramConnectModal] = useState(false);
  const [showDiscordConnectModal, setShowDiscordConnectModal] = useState(false);
  const [showWhatsAppConnectModal, setShowWhatsAppConnectModal] = useState(false);
  const [whatsappPhoneNumber, setWhatsAppPhoneNumber] = useState("");
  const [selectedCountry, setSelectedCountry] = useState(COUNTRIES[0]);
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);
  const [countrySearch, setCountrySearch] = useState("");
  const [whatsappPairingCode, setWhatsAppPairingCode] = useState("");
  const [isGeneratingPairingCode, setIsGeneratingPairingCode] = useState(false);
  const pollingTimerRef = useRef<NodeJS.Timeout | null>(null);

  const stopWhatsAppPolling = useCallback(() => {
    if (pollingTimerRef.current) {
      clearInterval(pollingTimerRef.current);
      pollingTimerRef.current = null;
    }
  }, []);

  const startWhatsAppPolling = useCallback((userId: string) => {
    stopWhatsAppPolling();

    pollingTimerRef.current = setInterval(async () => {
      try {
        const res = await getWhatsAppStatusAction(userId);
        if (res.success && res.status) {
          if (res.status.status === "active") {
            stopWhatsAppPolling();
            setWhatsAppStatus(res.status);
            setSuccessMessage("WhatsApp connected successfully!");
            setShowWhatsAppConnectModal(false);
            setWhatsAppPairingCode("");
            setWhatsAppPhoneNumber("");
            setSelectedCountry(COUNTRIES[0]);
            setShowCountryDropdown(false);
            setCountrySearch("");
          } else {
            setWhatsAppStatus(res.status);
          }
        }
      } catch (err) {
        console.error("Error polling WhatsApp connection status:", err);
      }
    }, 3000);
  }, [stopWhatsAppPolling]);

  const handleTelegramConnect = async (botToken: string) => {
    if (!user) return { success: false, error: "Not authenticated" };
    const res = await connectTelegramAction(user.id, botToken);
    if (res.success) {
      setTelegramStatus({ connected: true, email: res.username || "", connectedAt: "", lastSyncAt: "", provider: "telegram", status: "active" });
      setSuccessMessage("Telegram connected successfully!");
    }
    return res;
  };

  const handleDiscordConnect = async () => {
    if (!user) return { success: false, error: "Not authenticated" };
    const res = await connectDiscordAction(user.id);
    if (res.success) {
      setDiscordStatus({ connected: true, email: res.username || "", connectedAt: "", lastSyncAt: "", provider: "discord", status: "active" });
      setSuccessMessage("Discord connected successfully!");
    }
    return res;
  };

  const handleGetDiscordInviteUrl = async () => {
    return getDiscordInviteUrlAction();
  };

  const handleWhatsAppConnectClick = () => {
    setWhatsAppPhoneNumber("");
    setSelectedCountry(COUNTRIES[0]);
    setShowCountryDropdown(false);
    setCountrySearch("");
    setWhatsAppPairingCode("");
    setShowWhatsAppConnectModal(true);
  };

  const handleGenerateWhatsAppPairingCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!whatsappPhoneNumber.trim() || !user) return;
    setIsGeneratingPairingCode(true);
    setErrorMessage(null);
    try {
      let cleanInput = whatsappPhoneNumber.trim().replace(/\D/g, "");
      const countryDigits = selectedCountry.code.replace(/\D/g, "");
      if (cleanInput.startsWith(countryDigits)) {
        cleanInput = cleanInput.substring(countryDigits.length);
      }
      const fullNumber = `${countryDigits}${cleanInput}`;
      
      const res = await requestWhatsAppPairingCodeAction(user.id, fullNumber);
      if (res.success && res.pairingCode) {
        setWhatsAppPairingCode(res.pairingCode);
        startWhatsAppPolling(user.id);
      } else {
        setErrorMessage(res.error || "Failed to generate pairing code.");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "An unexpected error occurred.";
      setErrorMessage(msg);
    } finally {
      setIsGeneratingPairingCode(false);
    }
  };

  const handleWhatsAppDisconnect = async () => {
    if (!user) return;
    try {
      stopWhatsAppPolling();
      const res = await disconnectWhatsAppAction(user.id);
      if (res.success) {
        setWhatsAppStatus(null);
        setWhatsAppPairingCode("");
        setWhatsAppPhoneNumber("");
        setSelectedCountry(COUNTRIES[0]);
        setShowCountryDropdown(false);
        setCountrySearch("");
        setSuccessMessage("WhatsApp disconnected successfully.");
      } else {
        setErrorMessage(res.error || "Failed to disconnect WhatsApp.");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to disconnect WhatsApp.";
      setErrorMessage(msg);
    }
  };

  useEffect(() => {
    return () => {
      if (pollingTimerRef.current) {
        clearInterval(pollingTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && showWhatsAppConnectModal) {
        stopWhatsAppPolling();
        setShowWhatsAppConnectModal(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [showWhatsAppConnectModal, stopWhatsAppPolling]);

  const fetchPageData = useCallback(async (userId: string) => {
    if (typeof window === "undefined") return;
    if (!isMounted.current) return;
    setIsDataLoading(true);
    try {
      try {
        const timeout = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("DATA_FETCH_TIMEOUT")), 8000)
        );
        const [gmailConn, slackConn, telegramConn, discordConn, linkedinConn, githubConn, whatsappConnResult, isConfigured] = await Promise.race([
          Promise.all([
            getGmailConnectionStatus(userId),
            getConnectionStatus(userId, "slack"),
            getConnectionStatus(userId, "telegram"),
            getConnectionStatus(userId, "discord"),
            getConnectionStatus(userId, "linkedin"),
            getConnectionStatus(userId, "github"),
            getWhatsAppStatusAction(userId),
            checkGoogleApiConfig(),
          ]),
          timeout.then(() => { throw new Error("DATA_FETCH_TIMEOUT"); })
        ]) as [ConnectionStatus | null, ConnectionStatus | null, ConnectionStatus | null, ConnectionStatus | null, ConnectionStatus | null, ConnectionStatus | null, { success: boolean; status: ConnectionStatus | null; error?: string }, boolean];
        if (!isMounted.current) return;
        setGmailStatus(gmailConn);
        setSlackStatus(slackConn);
        setTelegramStatus(telegramConn);
        setDiscordStatus(discordConn);
        setLinkedinStatus(linkedinConn);
        setGithubStatus(githubConn);
        if (whatsappConnResult && whatsappConnResult.success) {
          setWhatsAppStatus(whatsappConnResult.status);
          if (whatsappConnResult.status?.status === "pairing") {
            startWhatsAppPolling(userId);
          }
        }
        setIsGoogleConfiguredOnServer(isConfigured);
      } catch (dataErr: unknown) {
        const errObj = dataErr as { message?: string };
        if (errObj?.message === "DATA_FETCH_TIMEOUT") {
          console.warn("[Integrations] Page data fetch timed out, showing page without connection status.");
        } else {
          console.error("[Integrations] Failed to load connection data:", dataErr);
        }
      }

      if (!isMounted.current) return;
      const stored = localStorage.getItem("syncra-mock-connected-platforms");
      if (stored) {
        try {
          setMockConnectedList(JSON.parse(stored));
        } catch {
          setMockConnectedList([]);
          localStorage.setItem("syncra-mock-connected-platforms", JSON.stringify([]));
        }
      } else {
        setMockConnectedList([]);
        localStorage.setItem("syncra-mock-connected-platforms", JSON.stringify([]));
      }

      const storedTools = localStorage.getItem("syncra-enabled-mcp-tools");
      if (storedTools) {
        try {
          setEnabledTools(JSON.parse(storedTools));
        } catch {
          const defaultTools: Record<string, boolean> = {};
          Object.values(PLATFORM_MCP_TOOLS).flat().forEach(t => { defaultTools[t.name] = true; });
          setEnabledTools(defaultTools);
          localStorage.setItem("syncra-enabled-mcp-tools", JSON.stringify(defaultTools));
        }
      } else {
        const defaultTools: Record<string, boolean> = {};
        Object.values(PLATFORM_MCP_TOOLS).flat().forEach(t => { defaultTools[t.name] = true; });
        setEnabledTools(defaultTools);
        localStorage.setItem("syncra-enabled-mcp-tools", JSON.stringify(defaultTools));
      }
    } catch (err) {
      console.error("[Integrations] Error loading page data:", err);
    } finally {
      if (isMounted.current) setIsDataLoading(false);
    }
  }, [startWhatsAppPolling]);

  const hasFetched = useRef(false);

  useEffect(() => {
    isMounted.current = true;
    if (!authLoading && user && !hasFetched.current) {
      hasFetched.current = true;
      fetchPageData(user.id);
    }
    return () => {
      isMounted.current = false;
    };
  }, [authLoading, user, fetchPageData]);

  useEffect(() => {
    if (!authLoading && !user) {
      window.location.href = "/sign-in";
    }
  }, [authLoading, user]);

  useEffect(() => {
    const success = searchParams.get("success");
    const error = searchParams.get("error");
    
    if (success === "gmail") {
      const timer = setTimeout(() => {
        setSuccessMessage("Gmail connected successfully using Google OAuth 2.0!");
        router.replace("/dashboard/integrations");
      }, 0);
      return () => clearTimeout(timer);
    } else if (success === "slack") {
      const timer = setTimeout(() => {
        setSuccessMessage("Slack connected successfully!");
        const list = mockConnectedList.filter(id => id !== "slack");
        setMockConnectedList(list);
        localStorage.setItem("syncra-mock-connected-platforms", JSON.stringify(list));
        setSlackStatus({ connected: true, email: "", connectedAt: "", lastSyncAt: "", provider: "slack", status: "active" });
        router.replace("/dashboard/integrations");
      }, 0);
      return () => clearTimeout(timer);
    } else if (success === "linkedin") {
      const timer = setTimeout(() => {
        setSuccessMessage("LinkedIn connected successfully!");
        const list = mockConnectedList.filter(id => id !== "linkedin");
        setMockConnectedList(list);
        localStorage.setItem("syncra-mock-connected-platforms", JSON.stringify(list));
        setLinkedinStatus({ connected: true, email: "", connectedAt: "", lastSyncAt: "", provider: "linkedin", status: "active" });
        router.replace("/dashboard/integrations");
      }, 0);
      return () => clearTimeout(timer);
    } else if (success === "github") {
      const timer = setTimeout(() => {
        setSuccessMessage("GitHub connected successfully!");
        const list = mockConnectedList.filter(id => id !== "github");
        setMockConnectedList(list);
        localStorage.setItem("syncra-mock-connected-platforms", JSON.stringify(list));
        setGithubStatus({ connected: true, email: "", connectedAt: "", lastSyncAt: "", provider: "github", status: "active" });
        router.replace("/dashboard/integrations");
      }, 0);
    } else if (error) {
      const timer = setTimeout(() => {
        if (error === "missing_credentials") {
          setErrorMessage("OAuth credentials are not configured on the server. Please check .env.local.");
        } else {
          setErrorMessage(`OAuth authentication failed: ${decodeURIComponent(error)}`);
        }
        router.replace("/dashboard/integrations");
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [searchParams, router]);

  const handleGmailConnect = async () => {
    if (!user) return;
    if (!isGoogleConfiguredOnServer) {
      setShowConfigAlertModal(true);
      return;
    }
    
    window.location.assign(`/api/google?userId=${user.id}`);
  };

  const handleGmailDisconnect = async () => {
    if (!user) return;
    setIsDataLoading(true);
    try {
      await disconnectGmailConnection(user.id);
      setGmailStatus(null);
      setSuccessMessage("Gmail connection has been successfully disconnected and tokens revoked.");
    } catch (e: unknown) {
      const errorObj = e as { message?: string };
      setErrorMessage("Failed to disconnect Gmail: " + (errorObj.message || "Unknown error"));
    } finally {
      setIsDataLoading(false);
    }
  };

  const handleConnectMockPlatform = (platformId: string) => {
    const list = [...mockConnectedList, platformId];
    setMockConnectedList(list);
    localStorage.setItem("syncra-mock-connected-platforms", JSON.stringify(list));
    setSuccessMessage(`${PLATFORMS.find(p => p.id === platformId)?.name} connected successfully.`);
  };

  const handleDisconnectMockPlatform = (platformId: string) => {
    const list = mockConnectedList.filter(id => id !== platformId);
    setMockConnectedList(list);
    localStorage.setItem("syncra-mock-connected-platforms", JSON.stringify(list));
    setSuccessMessage(`${PLATFORMS.find(p => p.id === platformId)?.name} disconnected.`);
  };

  const handleSettingsClick = async (platform: Platform) => {
    setSettingsPlatform(platform);
    setShowSettingsModal(true);
    setSettingsTools(null);
    try {
      const tools = await getProviderTools(platform.id);
      setSettingsTools(tools);
    } catch (e) {
      console.error("Failed to load provider tools:", e);
      setSettingsTools([]);
    }
  };

  const handleToggleTool = (toolName: string) => {
    const nextTools = {
      ...enabledTools,
      [toolName]: !enabledTools[toolName]
    };
    setEnabledTools(nextTools);
    localStorage.setItem("syncra-enabled-mcp-tools", JSON.stringify(nextTools));
  };

  if (isLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background-mist font-sans">
        <div className="text-center space-y-4">
          <svg className="animate-spin h-10 w-10 text-primary mx-auto" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="font-bold text-secondary text-lg">Loading secure dashboard integrations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-16 font-sans">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="font-display font-black text-4xl text-secondary mb-2 tracking-tight">
            Integrations Workspace
          </h1>
          <p className="text-text-slate text-[16px] font-medium max-w-2xl leading-relaxed">
            Connect external workspace endpoints. Securely exchange OAuth codes, check sync parameters, and toggle individual agent tools.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-4 py-2 bg-success-bg border-[2.5px] border-success text-success font-black text-[14px] rounded-xl shadow-flat-sm">
            <ShieldCheck className="w-5 h-5" />
            <span>OAuth 2.0 Verified</span>
          </div>
        </div>
      </div>

      {successMessage && (
        <div className="mb-8 p-4 bg-success-bg border-[2.5px] border-success rounded-[24px] flex items-center justify-between gap-3 text-success font-bold neo-shadow-sm">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-6 h-6 shrink-0" />
            <p>{successMessage}</p>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="p-1 hover:bg-black/5 rounded">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="mb-8 p-4 bg-error-bg border-[2.5px] border-error rounded-[24px] flex items-center justify-between gap-3 text-error font-bold neo-shadow-sm">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-6 h-6 shrink-0" />
            <p>{errorMessage}</p>
          </div>
          <button onClick={() => setErrorMessage(null)} className="p-1 hover:bg-black/5 rounded">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {!isGoogleConfiguredOnServer && (
        <div className="mb-8 p-5 bg-warning-bg border-[2.5px] border-warning rounded-[24px] neo-shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4 text-left">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-warning font-black text-[16px]">
              <AlertTriangle className="w-5 h-5" />
              <span>Google API Credentials Required</span>
            </div>
            <p className="text-[13px] text-text-ink font-semibold leading-relaxed max-w-2xl">
              OAuth credentials are missing from your environment. Google integration will run in sandbox mode until client ID and client secret keys are configured in your <code className="font-mono text-xs bg-black/5 px-1.5 py-0.5 rounded border border-secondary/20">.env.local</code> file.
            </p>
          </div>
          <Button
            onClick={() => setShowConfigAlertModal(true)}
            variant="secondary"
            size="sm"
            className="border-[2px] border-secondary text-secondary shrink-0"
          >
            Setup Guide
          </Button>
        </div>
      )}

      <div className="space-y-8 max-w-5xl mx-auto">
        
        <Card className="neo-border neo-shadow-md bg-surface-white">
          <div className="border-b-[2.5px] border-border-mist pb-6 mb-6">
            <h2 className="font-display font-black text-2xl text-secondary mb-1">
              Workspace Channels
            </h2>
            <p className="text-text-slate text-[15px] font-medium">
              Add platform connections to grant the Syncra AI Agent access.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {PLATFORMS.map((platform) => {
              const isGmail = platform.id === "gmail";
              const isSlack = platform.id === "slack";
              const isWhatsApp = platform.id === "whatsapp";
              const isTelegram = platform.id === "telegram";
              const isDiscord = platform.id === "discord";
              const isLinkedin = platform.id === "linkedin";
              const isGithub = platform.id === "github";
              const isConnected = isGmail
                ? !!gmailStatus
                : isSlack
                ? !!slackStatus
                : isWhatsApp
                ? (!!whatsappStatus && whatsappStatus.status === "active")
                : isTelegram
                ? !!telegramStatus
                : isDiscord
                ? !!discordStatus
                : isLinkedin
                ? !!linkedinStatus
                : isGithub
                ? !!githubStatus
                : mockConnectedList.includes(platform.id);

              const connectionDetails: PlatformCardConnectionDetails | undefined = !isConnected ? undefined
                : isGmail && gmailStatus ? {
                    email: gmailStatus.email,
                    connectedAt: gmailStatus.connectedAt,
                    lastSyncAt: gmailStatus.lastSyncAt,
                  }
                : isSlack && slackStatus ? {
                    email: slackStatus.email,
                    connectedAt: slackStatus.connectedAt,
                    lastSyncAt: slackStatus.lastSyncAt,
                  }
                : isWhatsApp && whatsappStatus ? {
                    email: whatsappStatus.email,
                    connectedAt: whatsappStatus.connectedAt,
                    lastSyncAt: whatsappStatus.lastSyncAt,
                  }
                : isTelegram && telegramStatus ? {
                    email: telegramStatus.email,
                    connectedAt: telegramStatus.connectedAt,
                    lastSyncAt: telegramStatus.lastSyncAt,
                  }
                : isDiscord && discordStatus ? {
                    email: discordStatus.email,
                    connectedAt: discordStatus.connectedAt,
                    lastSyncAt: discordStatus.lastSyncAt,
                  }
                : isLinkedin && linkedinStatus ? {
                    email: linkedinStatus.email,
                    connectedAt: linkedinStatus.connectedAt,
                    lastSyncAt: linkedinStatus.lastSyncAt,
                  }
                : isGithub && githubStatus ? {
                    email: githubStatus.email,
                    connectedAt: githubStatus.connectedAt,
                    lastSyncAt: githubStatus.lastSyncAt,
                  }
                : undefined;

              return (
                <PlatformCard
                  key={platform.id}
                  platform={platform}
                  isConnected={isConnected}
                  connectionDetails={connectionDetails}
                  onConnect={() => {
                    if (isGmail) {
                      handleGmailConnect();
                    } else if (isSlack) {
                      window.location.assign(`/api/slack?userId=${user?.id}`);
                    } else if (isWhatsApp) {
                      handleWhatsAppConnectClick();
                    } else if (isTelegram) {
                      setShowTelegramConnectModal(true);
                    } else if (isDiscord) {
                      setShowDiscordConnectModal(true);
                    } else if (isLinkedin) {
                      window.location.assign(`/api/linkedin?userId=${user?.id}`);
                    } else if (isGithub) {
                      window.location.assign(`/api/github?userId=${user?.id}`);
                    } else {
                      handleConnectMockPlatform(platform.id);
                    }
                  }}
                  onDisconnect={() => {
                    if (isGmail) {
                      handleGmailDisconnect();
                    } else if (isSlack && user) {
                      disconnectConnection(user.id, "slack").then(() => setSlackStatus(null));
                    } else if (isWhatsApp) {
                      handleWhatsAppDisconnect();
                    } else if (isTelegram && user) {
                      disconnectTelegramWebhookAction(user.id).then(() => {
                        disconnectConnection(user.id, "telegram").then(() => setTelegramStatus(null));
                      });
                    } else if (isDiscord && user) {
                      disconnectConnection(user.id, "discord").then(() => setDiscordStatus(null));
                    } else if (isLinkedin && user) {
                      disconnectLinkedinAction(user.id).then(() => setLinkedinStatus(null));
                    } else if (isGithub && user) {
                      disconnectGithubAction(user.id).then(() => setGithubStatus(null));
                    } else {
                      handleDisconnectMockPlatform(platform.id);
                    }
                  }}
                  onSettings={() => handleSettingsClick(platform)}
                />
              );
            })}
          </div>
        </Card>
      </div>

      <TelegramConnectionModal
        isOpen={showTelegramConnectModal}
        onClose={() => setShowTelegramConnectModal(false)}
        onConnect={handleTelegramConnect}
      />
      <DiscordConnectionModal
        isOpen={showDiscordConnectModal}
        onClose={() => setShowDiscordConnectModal(false)}
        onConnect={handleDiscordConnect}
        getInviteUrl={handleGetDiscordInviteUrl}
      />
      <WhatsAppConnectionModal
        isOpen={showWhatsAppConnectModal}
        onClose={() => {
          stopWhatsAppPolling();
          setShowWhatsAppConnectModal(false);
        }}
        pairingCode={whatsappPairingCode}
        phoneNumber={whatsappPhoneNumber}
        setPhoneNumber={setWhatsAppPhoneNumber}
        selectedCountry={selectedCountry}
        setSelectedCountry={setSelectedCountry}
        showCountryDropdown={showCountryDropdown}
        setShowCountryDropdown={setShowCountryDropdown}
        countrySearch={countrySearch}
        setCountrySearch={setCountrySearch}
        isGeneratingPairingCode={isGeneratingPairingCode}
        onGeneratePairingCode={handleGenerateWhatsAppPairingCode}
        onStopPolling={stopWhatsAppPolling}
      />

      {showConfigAlertModal && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface-white neo-border rounded-[28px] max-w-lg w-full overflow-hidden neo-shadow-lg animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b-[2.5px] border-border-mist bg-background-mist flex items-center justify-between">
              <div className="flex items-center gap-2 text-warning">
                <AlertTriangle className="w-5 h-5 animate-pulse" />
                <span className="font-display font-black text-[18px] text-secondary">
                  Developer Setup Required
                </span>
              </div>
              <button
                onClick={() => setShowConfigAlertModal(false)}
                className="p-1.5 hover:bg-black/5 rounded-lg text-text-slate transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-left">
              <p className="text-[13px] text-text-slate font-medium leading-relaxed">
                To connect a real Google account, you must configure Google Client ID and Secret in your environment file.
              </p>

              <div className="space-y-3 bg-background-mist border-[2px] border-secondary p-4 rounded-2xl">
                <h4 className="font-bold text-[12px] uppercase tracking-wider text-secondary">
                  Steps to obtain keys:
                </h4>
                <ol className="text-[12px] font-medium text-text-ink space-y-2 list-decimal pl-4">
                  <li>Go to the <a href="https://console.cloud.google.com" target="_blank" rel="noreferrer" className="text-primary font-bold hover:underline inline-flex items-center gap-0.5">Google Cloud Console <ExternalLink className="w-3 h-3 inline" /></a>.</li>
                  <li>Create a project and enable the <strong>Gmail API</strong>.</li>
                  <li>Configure your OAuth Consent Screen with standard scopes.</li>
                  <li>Create an <strong>OAuth 2.0 Client ID</strong> (Web Application).</li>
                  <li>Set the Authorized Redirect URI to:
                    <div className="mt-1 p-2 bg-secondary text-white font-mono text-[11px] rounded overflow-x-auto select-all">
                      {`${typeof window !== "undefined" ? window.location.origin : "http://localhost:3000"}/api/gmail-callback`}
                    </div>
                  </li>
                  <li className="mt-1">
                    <strong>For Testing (Error 403: access_denied):</strong> If your OAuth app&apos;s Publishing Status is set to <em>Testing</em>, you must add the email address of the account you want to connect to the <strong>Test Users</strong> list under the <em>OAuth consent screen</em> tab in your Google Console.
                  </li>
                </ol>
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-black text-secondary uppercase tracking-wider">
                  Paste values in .env.local:
                </label>
                <pre className="p-3.5 bg-secondary text-white border-[2px] border-secondary rounded-xl text-[11px] font-mono select-all overflow-x-auto">
{`GOOGLE_CLIENT_ID="your-client-id-here"
GOOGLE_CLIENT_SECRET="your-client-secret-here"
NEXT_PUBLIC_APP_URL="http://localhost:3000"`}
                </pre>
              </div>

              <div className="pt-2 flex justify-end">
                <Button
                  onClick={() => setShowConfigAlertModal(false)}
                  variant="primary"
                  className="min-h-[44px] px-8 text-[14px]"
                >
                  Got It
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <MCPSettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        platform={settingsPlatform!}
        mcpTools={settingsTools}
        enabledTools={enabledTools}
        onToggleTool={handleToggleTool}
      />

    </div>
  );
}
