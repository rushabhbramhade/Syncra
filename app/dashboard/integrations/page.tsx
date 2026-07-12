"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PLATFORM_MCP_TOOLS, MCPTool } from "@/constants/mcp-tools";
import {
  getGmailConnectionStatus,
  disconnectGmailConnection,
  executeGmailMCPAction,
  checkGoogleApiConfig,
  getProviderTools,
  ConnectionStatus
} from "@/app/actions/integrations";
import {
  Mail,
  Settings,
  ShieldCheck,
  CheckCircle2,
  Sliders,
  Search,
  AlertCircle,
  X,
  RefreshCw,
  Send,
  Plus,
  FileText,
  Loader2,
  Lock,
  AlertTriangle,
  Info,
  Trash2,
  Archive,
  CornerUpLeft,
  Paperclip,
  ExternalLink
} from "lucide-react";


interface Platform {
  id: string;
  name: string;
  icon: string;
  description: string;
  hasOAuth: boolean;
}

interface GmailInboxEmail {
  id: string;
  threadId?: string;
  from: string;
  to: string;
  subject: string;
  date: string;
  snippet: string;
  unread: boolean;
}

interface GmailEmailDetails {
  from: string;
  to: string;
  date: string;
  subject: string;
  body: string;
  
}

// Platforms list with details
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
    id: "outlook",
    name: "Outlook",
    icon: "/email.png",
    description: "Access Microsoft Outlook inbox messages, folders, calendars, and send mail drafts.",
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
    icon: "", // Will render inline custom SVG
    description: "Share professional feed posts, sync user profiles, and retrieve basic connection stats.",
    hasOAuth: true,
  },
  {
    id: "github",
    name: "GitHub",
    icon: "", // Will render inline custom SVG
    description: "Monitor issue updates, repository activities, and trigger workflow actions.",
    hasOAuth: true,
  }
];

export default function IntegrationsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoading: authLoading } = useAuth();
  const [isDataLoading, setIsDataLoading] = useState(true);

  const isLoading = authLoading || isDataLoading;

  // Track mount status so we never call setState after unmount.
  const isMounted = useRef(true);

  // Connection metadata loaded from DB
  const [gmailStatus, setGmailStatus] = useState<ConnectionStatus | null>(null);
  
  // Non-Gmail mock connections (loaded from localStorage for prototype integration)
  const [mockConnectedList, setMockConnectedList] = useState<string[]>([]);
  
  // Gmail Inbox States
  const [gmailQuery, setGmailQuery] = useState("is:unread");
  const [gmailLimit] = useState(5);
  const [gmailInboxData, setGmailInboxData] = useState<GmailInboxEmail[] | null>(null);
  const [selectedInboxEmail, setSelectedInboxEmail] = useState<string | null>(null);
  const [emailDetailLoading, setEmailDetailLoading] = useState(false);
  const [emailDetails, setEmailDetails] = useState<GmailEmailDetails | null>(null);
  const [isInboxRefreshing, setIsInboxRefreshing] = useState(false);

  // Settings / MCP Explorer States
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [settingsPlatform, setSettingsPlatform] = useState<Platform | null>(null);
  const [settingsTools, setSettingsTools] = useState<MCPTool[] | null>(null);
  const [enabledTools, setEnabledTools] = useState<Record<string, boolean>>({});

  // Developer Alert State
  const [isGoogleConfiguredOnServer, setIsGoogleConfiguredOnServer] = useState(true);
  const [showConfigAlertModal, setShowConfigAlertModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Gmail Compose Mock States
  const [showComposeModal, setShowComposeModal] = useState(false);
  const [composeTo, setComposeTo] = useState("");
  const [composeSubject, setComposeSubject] = useState("");
  const [composeBody, setComposeBody] = useState("");
  const [isSendingEmail, setIsSendingEmail] = useState(false);

  // Fetch page data — failures here show inline errors, never redirect
  const fetchPageData = useCallback(async (userId: string) => {
    if (typeof window === "undefined") return;
    if (!isMounted.current) return;
    setIsDataLoading(true);
    try {
      try {
        const timeout = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("DATA_FETCH_TIMEOUT")), 8000)
        );
        const [gmailConn, isConfigured] = await Promise.race([
          Promise.all([
            getGmailConnectionStatus(userId),
            checkGoogleApiConfig(),
          ]),
          timeout.then(() => { throw new Error("DATA_FETCH_TIMEOUT"); })
        ]) as [ConnectionStatus | null, boolean];
        if (!isMounted.current) return;
        setGmailStatus(gmailConn);
        setIsGoogleConfiguredOnServer(isConfigured);
      } catch (dataErr: unknown) {
        // Data load failed — log it but do NOT redirect
        const errObj = dataErr as { message?: string };
        if (errObj?.message === "DATA_FETCH_TIMEOUT") {
          console.warn("[Integrations] Page data fetch timed out, showing page without connection status.");
        } else {
          console.error("[Integrations] Failed to load connection data:", dataErr);
        }
      }

      // Load mock integration list from localStorage
      if (!isMounted.current) return;
      const stored = localStorage.getItem("syncra-mock-connected-platforms");
      if (stored) {
        try {
          setMockConnectedList(JSON.parse(stored));
        } catch {
          const defaults = ["slack"];
          setMockConnectedList(defaults);
          localStorage.setItem("syncra-mock-connected-platforms", JSON.stringify(defaults));
        }
      } else {
        const defaults = ["slack"];
        setMockConnectedList(defaults);
        localStorage.setItem("syncra-mock-connected-platforms", JSON.stringify(defaults));
      }

      // Load enabled/disabled tools toggles
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
  }, []);

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

  // Redirect backstop: if user is not present and loading has finished, redirect to /sign-in
  useEffect(() => {
    if (!authLoading && !user) {
      window.location.href = "/sign-in";
    }
  }, [authLoading, user]);

  // Handle URL query parameters for callback notifications
  useEffect(() => {
    const success = searchParams.get("success");
    const error = searchParams.get("error");
    
    if (success === "gmail") {
      const timer = setTimeout(() => {
        setSuccessMessage("Gmail connected successfully using Google OAuth 2.0!");
        router.replace("/dashboard/integrations");
      }, 0);
      return () => clearTimeout(timer);
    } else if (error) {
      const timer = setTimeout(() => {
        if (error === "missing_credentials") {
          setErrorMessage("Google OAuth credentials are not configured on the server. Please check .env.local.");
        } else {
          setErrorMessage(`OAuth authentication failed: ${decodeURIComponent(error)}`);
        }
        router.replace("/dashboard/integrations");
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [searchParams, router]);

  // Fetch Gmail inbox via MCP
  const loadGmailInbox = useCallback(async () => {
    if (!user || !gmailStatus) return;
    setIsInboxRefreshing(true);
    try {
      const response = await executeGmailMCPAction(user.id, "gmail_search_emails", {
        query: gmailQuery,
        limit: gmailLimit
      });
      if (response.status === "success") {
        setGmailInboxData(response.result);
      } else {
        console.error("Gmail MCP search failed:", response.error);
        setGmailInboxData(null);
      }
    } catch (e) {
      console.error(e);
      setGmailInboxData(null);
    } finally {
      setIsInboxRefreshing(false);
    }
  }, [user, gmailStatus, gmailQuery, gmailLimit]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (gmailStatus) {
        loadGmailInbox();
      } else {
        setGmailInboxData(null);
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [gmailStatus, loadGmailInbox]);

  // Fetch Gmail single email detail
  const handleFetchEmailDetail = async (id: string) => {
    if (!user) return;
    setSelectedInboxEmail(id);
    setEmailDetailLoading(true);
    setEmailDetails(null);
    try {
      const response = await executeGmailMCPAction(user.id, "gmail_get_email", { messageId: id });
      if (response.status === "success") {
        setEmailDetails(response.result);
      } else {
        setErrorMessage("Failed to retrieve email detail: " + (response.error?.message || "Unknown error"));
        setSelectedInboxEmail(null);
      }
    } catch (e) {
      console.error(e);
      setSelectedInboxEmail(null);
    } finally {
      setEmailDetailLoading(false);
    }
  };

  // Gmail OAuth Connect Click
  const handleGmailConnect = async () => {
    if (!user) return;
    if (!isGoogleConfiguredOnServer) {
      setShowConfigAlertModal(true);
      return;
    }
    
    // Redirect browser to the OAuth API initiator route with userId parameter
    window.location.assign(`/api/auth/google?userId=${user.id}`);
  };

  // Gmail Disconnect Click
  const handleGmailDisconnect = async () => {
    if (!user) return;
    setIsDataLoading(true);
    try {
      await disconnectGmailConnection(user.id);
      setGmailStatus(null);
      setGmailInboxData(null);
      setSuccessMessage("Gmail connection has been successfully disconnected and tokens revoked.");
    } catch (e: unknown) {
      const errorObj = e as { message?: string };
      setErrorMessage("Failed to disconnect Gmail: " + (errorObj.message || "Unknown error"));
    } finally {
      setIsDataLoading(false);
    }
  };

  // Compose Email (Mock/Send)
  const handleSendCompose = async () => {
    if (!user) return;
    if (!composeTo || !composeSubject || !composeBody) {
      setErrorMessage("Please fill in all fields (recipient, subject, and message body).");
      return;
    }
    setIsSendingEmail(true);
    try {
      const response = await executeGmailMCPAction(user.id, "gmail_send_email", {
        to: composeTo,
        subject: composeSubject,
        body: composeBody
      });
      if (response.status === "success") {
        setSuccessMessage(`Email successfully sent to ${composeTo}!`);
        setShowComposeModal(false);
        // Refresh inbox
        loadGmailInbox();
        // Clear
        setComposeTo("");
        setComposeSubject("");
        setComposeBody("");
      } else {
        setErrorMessage("Failed to send email: " + (response.error?.message || "Unknown error"));
      }
    } catch (e: unknown) {
      const errorObj = e as { message?: string };
      setErrorMessage("Failed to send email: " + (errorObj.message || "Unknown error"));
    } finally {
      setIsSendingEmail(false);
    }
  };

  // Sync controls for non-Gmail channels
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


  // Tool toggle switches inside Settings Dialog
  const handleToggleTool = (toolName: string) => {
    const nextTools = {
      ...enabledTools,
      [toolName]: !enabledTools[toolName]
    };
    setEnabledTools(nextTools);
    localStorage.setItem("syncra-enabled-mcp-tools", JSON.stringify(nextTools));
  };

  // Tool mapping icon helper
  const getToolIcon = (toolName: string) => {
    if (toolName.includes("search")) return <Search className="w-4 h-4" />;
    if (toolName.includes("send")) return <Send className="w-4 h-4" />;
    if (toolName.includes("get") || toolName.includes("read")) return <Mail className="w-4 h-4" />;
    if (toolName.includes("list") || toolName.includes("label")) return <Sliders className="w-4 h-4" />;
    if (toolName.includes("archive")) return <Archive className="w-4 h-4" />;
    if (toolName.includes("delete") || toolName.includes("trash")) return <Trash2 className="w-4 h-4" />;
    if (toolName.includes("reply")) return <CornerUpLeft className="w-4 h-4" />;
    if (toolName.includes("attachment")) return <Paperclip className="w-4 h-4" />;
    return <FileText className="w-4 h-4" />;
  };

  // Format date helper
  const formatConnectedDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return "";
      return d.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
    } catch {
      return "";
    }
  };

  const formatLastSyncTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return "";
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch {
      return "";
    }
  };

  // Rendering Helper: LinkedIn Custom SVG
  const renderLinkedInIcon = () => (
    <svg className="w-10 h-10 text-[#0A66C2]" viewBox="0 0 24 24" fill="currentColor">
      <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.32 1.3v-1.11h-2.8v8.37h2.8v-4.67c0-.25.02-.5.1-.68a1.14 1.14 0 0 1 1-.77c.76 0 1 .56 1 1.39v4.73h2.8m-11.23-9.5c-.94 0-1.7.76-1.7 1.7a1.71 1.71 0 0 0 1.7 1.71c.95 0 1.7-.77 1.7-1.71a1.71 1.71 0 0 0-1.7-1.7M5.7 18h2.8v-8.37H5.7V18z" />
    </svg>
  );

  // Rendering Helper: GitHub Custom SVG
  const renderGitHubIcon = () => (
    <svg className="w-10 h-10 text-secondary dark:text-white" viewBox="0 0 24 24" fill="currentColor">
      <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.167 6.839 9.49.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.577.688.479C19.138 20.164 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
    </svg>
  );

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
      {/* Header section */}
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

      {/* Success/Error Alerts */}
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

      {/* Developer Setup Alert Banner */}
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

      {/* Main Layout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        
        {/* Left 2 Columns: Platforms Grid */}
        <div className="lg:col-span-2 space-y-8">
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
                // Determine connection state (Gmail checks real state, others check mock list)
                const isGmail = platform.id === "gmail";
                const isConnected = isGmail ? !!gmailStatus : mockConnectedList.includes(platform.id);
                
                return (
                  <div
                    key={platform.id}
                    className={`relative p-6 rounded-[22px] border-[2.5px] bg-surface-white flex flex-col items-center text-center justify-between min-h-[350px] transition-all duration-300 ${
                      isConnected
                        ? "border-secondary dark:border-white shadow-flat-md"
                        : "border-border-mist opacity-80 hover:opacity-100 hover:border-text-fog hover:shadow-flat-sm"
                    }`}
                  >
                    {/* 1. Platform logo, centered in the card */}
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

                    {/* 2. Platform name, below the logo */}
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

                    {/* 3. A two-line description of what the integration does */}
                    <p className="text-text-slate text-[13px] font-medium leading-relaxed line-clamp-2 h-10 mb-4 overflow-hidden shrink-0">
                      {platform.description}
                    </p>

                    {/* Platform connection details if connected */}
                    {isConnected && (
                      <div className="w-full mb-4 bg-background-mist border-[1.5px] border-border-mist rounded-xl p-3 text-[11px] font-semibold text-text-slate space-y-1 text-left shrink-0">
                        {isGmail && gmailStatus ? (
                          <>
                            <div className="flex justify-between">
                              <span>Account:</span>
                              <span className="font-bold text-secondary truncate max-w-[130px]">{gmailStatus.email}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Linked On:</span>
                              <span className="font-bold text-secondary">{formatConnectedDate(gmailStatus.connectedAt)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Last Sync:</span>
                              <span className="font-bold text-secondary">{formatLastSyncTime(gmailStatus.lastSyncAt) || "Never"}</span>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="flex justify-between">
                              <span>Sync Mode:</span>
                              <span className="font-bold text-secondary">Sandbox Simulation</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Status:</span>
                              <span className="font-bold text-success">Active</span>
                            </div>
                          </>
                        )}
                      </div>
                    )}

                    {/* ⚠️ Flag missing asset warnings to meet prompt requirements */}
                    {platform.id === "outlook" && (
                      <div className="text-[10px] text-warning font-bold mb-3.5 bg-warning-bg border border-warning/20 px-2.5 py-1 rounded-md shrink-0">
                        ⚠️ missing outlook.png (using email.png)
                      </div>
                    )}
                    {platform.id === "linkedin" && (
                      <div className="text-[10px] text-warning font-bold mb-3.5 bg-warning-bg border border-warning/20 px-2.5 py-1 rounded-md shrink-0">
                        ⚠️ missing linkedin.png (using inline SVG)
                      </div>
                    )}

                    {/* 4. A Connect / Disconnect button (and Settings button if connected) */}
                    <div className="w-full flex items-center gap-2 mt-auto shrink-0">
                      {isConnected ? (
                        <>
                          <button
                            onClick={() => {
                              if (isGmail) {
                                handleGmailDisconnect();
                              } else {
                                handleDisconnectMockPlatform(platform.id);
                              }
                            }}
                            className="flex-1 min-h-[42px] px-4 py-2 bg-error-bg border-[2px] border-error text-error font-bold text-[14px] rounded-xl hover:bg-error hover:text-white transition-all duration-200 cursor-pointer text-center"
                          >
                            Disconnect
                          </button>
                          
                          <button
                            onClick={() => handleSettingsClick(platform)}
                            title={`${platform.name} Settings`}
                            className="min-h-[42px] px-3.5 bg-surface-white border-[2px] border-secondary text-secondary font-bold text-[14px] rounded-xl hover:bg-background-mist transition-all duration-200 cursor-pointer flex items-center justify-center shrink-0"
                          >
                            <Settings className="w-[18px] h-[18px]" />
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => {
                            if (isGmail) {
                              handleGmailConnect();
                            } else {
                              handleConnectMockPlatform(platform.id);
                            }
                          }}
                          className="w-full min-h-[42px] px-4 py-2 bg-primary text-white border-[2px] border-primary font-bold text-[14px] rounded-xl hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-flat-sm active:translate-x-0 active:translate-y-0 active:shadow-none transition-all duration-200 cursor-pointer text-center"
                        >
                          Connect
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        {/* Right Column: Gmail Live Stream (Functional using REST endpoints) */}
        <div className="space-y-8">
          <Card className="neo-border neo-shadow-md bg-surface-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full blur-2xl pointer-events-none" />
            
            <div className="border-b-[2.5px] border-border-mist pb-5 mb-5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mail className="w-5 h-5 text-primary" />
                <h2 className="font-display font-black text-xl text-secondary">
                  Gmail Live Stream
                </h2>
              </div>
              <button 
                onClick={loadGmailInbox}
                disabled={!gmailStatus || isInboxRefreshing}
                className="p-1 hover:bg-black/5 rounded text-text-slate disabled:opacity-40 disabled:pointer-events-none"
              >
                <RefreshCw className={`w-4 h-4 ${isInboxRefreshing ? "animate-spin" : ""}`} />
              </button>
            </div>

            {gmailStatus ? (
              <div className="space-y-4">
                {/* Search Inbox Controls */}
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-text-fog absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={gmailQuery}
                      onChange={(e) => setGmailQuery(e.target.value)}
                      placeholder="Search mail: is:unread..."
                      className="w-full h-11 pl-10 pr-4 bg-background-mist border-[2px] border-secondary dark:border-white font-mono text-[13px] rounded-xl outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 transition-all"
                    />
                  </div>
                  <button
                    onClick={() => setShowComposeModal(true)}
                    title="Compose Email"
                    className="h-11 px-3.5 bg-secondary text-white border-[2px] border-secondary rounded-xl hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-flat-sm active:translate-x-0 active:translate-y-0 active:shadow-none transition-all cursor-pointer flex items-center justify-center"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>

                {/* Filter tags */}
                <div className="flex flex-wrap gap-1.5 items-center">
                  <button
                    onClick={() => setGmailQuery("is:unread")}
                    className={`px-2.5 py-1 text-[11px] font-bold rounded-lg border-[1.5px] transition-all cursor-pointer ${
                      gmailQuery === "is:unread"
                        ? "bg-secondary text-white border-secondary"
                        : "bg-background-mist border-border-mist text-text-slate hover:border-text-fog"
                    }`}
                  >
                    Unread
                  </button>
                  <button
                    onClick={() => setGmailQuery("from:google")}
                    className={`px-2.5 py-1 text-[11px] font-bold rounded-lg border-[1.5px] transition-all cursor-pointer ${
                      gmailQuery === "from:google"
                        ? "bg-secondary text-white border-secondary"
                        : "bg-background-mist border-border-mist text-text-slate hover:border-text-fog"
                    }`}
                  >
                    Google Alerts
                  </button>
                  <button
                    onClick={() => setGmailQuery("")}
                    className={`px-2.5 py-1 text-[11px] font-bold rounded-lg border-[1.5px] transition-all cursor-pointer ${
                      gmailQuery === ""
                        ? "bg-secondary text-white border-secondary"
                        : "bg-background-mist border-border-mist text-text-slate hover:border-text-fog"
                    }`}
                  >
                    All Inbox
                  </button>
                </div>

                {/* Inbox Emails List */}
                {isInboxRefreshing ? (
                  <div className="py-16 text-center space-y-3">
                    <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto" />
                    <p className="text-[13px] text-text-slate font-bold">Fetching live emails from Google API...</p>
                  </div>
                ) : gmailInboxData && gmailInboxData.length > 0 ? (
                  <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
                    {gmailInboxData.map((email: GmailInboxEmail) => (
                      <div
                        key={email.id}
                        onClick={() => handleFetchEmailDetail(email.id)}
                        className={`p-3.5 rounded-xl border-[2px] text-left transition-all hover:bg-background-mist cursor-pointer ${
                          selectedInboxEmail === email.id
                            ? "border-primary bg-primary/5"
                            : "border-border-mist bg-surface-white"
                        }`}
                      >
                        <div className="flex justify-between items-start gap-2 mb-1.5">
                          <span className="font-bold text-secondary text-[12px] truncate max-w-[140px]">
                            {(email.from || "Unknown").split(" <")[0]}
                          </span>
                          <span className="text-[10px] text-text-fog font-medium whitespace-nowrap">
                            {email.date}
                          </span>
                        </div>
                        
                        <h4 className="font-bold text-secondary text-[13px] line-clamp-1 mb-1">
                          {email.subject}
                        </h4>
                        
                        <p className="text-[11px] text-text-slate line-clamp-2 leading-relaxed">
                          {email.snippet}
                        </p>

                        {email.unread && (
                          <div className="mt-2 flex">
                            <span className="w-2 h-2 rounded-full bg-primary" />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 border-[2px] border-dashed border-border-mist rounded-xl text-center">
                    <Info className="w-8 h-8 text-text-fog mx-auto mb-2" />
                    <p className="text-[13px] text-text-slate font-medium">
                      No emails found.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-8 border-[2.5px] border-dashed border-border-mist rounded-[18px] text-center space-y-4 bg-background-mist/30">
                <Lock className="w-9 h-9 text-text-fog mx-auto" />
                <div>
                  <h3 className="font-bold text-secondary text-[15px]">Gmail Offline</h3>
                  <p className="text-text-slate text-[12px] max-w-[200px] mx-auto mt-1 leading-relaxed">
                    Connect your real Google account using OAuth to fetch live emails and run MCP tools.
                  </p>
                </div>
                <Button
                  onClick={handleGmailConnect}
                  variant="secondary"
                  size="sm"
                  className="w-full text-[13px] min-h-[38px] py-2 border-[2px] border-secondary"
                >
                  Connect Gmail
                </Button>
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* ── Modal: Gmail Email Content Viewer ── */}
      {selectedInboxEmail && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface-white neo-border rounded-[28px] max-w-lg w-full overflow-hidden neo-shadow-lg animate-in fade-in zoom-in duration-200">
            {/* Header */}
            <div className="p-6 border-b-[2.5px] border-border-mist bg-background-mist flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mail className="w-5 h-5 text-primary" />
                <span className="font-display font-black text-[18px] text-secondary">
                  Gmail Message Detail
                </span>
              </div>
              <button
                onClick={() => {
                  setSelectedInboxEmail(null);
                  setEmailDetails(null);
                }}
                className="p-1.5 hover:bg-black/5 rounded-lg text-text-slate transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Email details loader / body */}
            <div className="p-6 space-y-4">
              {emailDetailLoading ? (
                <div className="py-12 text-center space-y-3">
                  <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto" />
                  <p className="text-[13px] text-text-slate font-bold">
                    Running `gmail_get_email` MCP tool...
                  </p>
                </div>
              ) : emailDetails ? (
                <div className="space-y-4 text-left">
                  <div className="space-y-2 border-b-[2px] border-border-mist pb-4">
                    <div className="flex justify-between text-[12px] font-medium text-text-slate">
                      <span>Sender:</span>
                      <span className="font-bold text-secondary">{emailDetails.from}</span>
                    </div>
                    <div className="flex justify-between text-[12px] font-medium text-text-slate">
                      <span>Recipient:</span>
                      <span className="font-bold text-secondary">{emailDetails.to}</span>
                    </div>
                    <div className="flex justify-between text-[12px] font-medium text-text-slate">
                      <span>Date:</span>
                      <span className="font-bold text-secondary">{emailDetails.date}</span>
                    </div>
                    <div className="flex justify-between text-[12px] font-medium text-text-slate pt-1">
                      <span>Subject:</span>
                      <span className="font-bold text-secondary text-[14px]">{emailDetails.subject}</span>
                    </div>
                  </div>

                  <div className="bg-background-mist border-[2px] border-border-mist rounded-xl p-4 max-h-[260px] overflow-y-auto">
                    <p className="font-mono text-[13px] text-secondary leading-relaxed whitespace-pre-wrap">
                      {emailDetails.body}
                    </p>
                  </div>
                  
                  <div className="flex justify-between items-center text-[11px] text-text-slate font-mono">
                    <span>Protocol: Google Gmail API (Direct Link)</span>
                    <span className="text-success font-bold">Status: OK</span>
                  </div>
                </div>
              ) : (
                <div className="py-6 text-center text-error space-y-2">
                  <AlertCircle className="w-8 h-8 mx-auto" />
                  <p className="font-bold">Failed to load email details from Gmail API.</p>
                </div>
              )}

              <div className="pt-2 flex justify-end">
                <Button
                  onClick={() => {
                    setSelectedInboxEmail(null);
                    setEmailDetails(null);
                  }}
                  variant="primary"
                  className="min-h-[40px] px-6 text-[14px]"
                >
                  Close Message
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Compose Email ── */}
      {showComposeModal && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface-white neo-border rounded-[28px] max-w-lg w-full overflow-hidden neo-shadow-lg animate-in fade-in zoom-in duration-200">
            {/* Header */}
            <div className="p-6 border-b-[2.5px] border-border-mist bg-background-mist flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mail className="w-5 h-5 text-primary" />
                <span className="font-display font-black text-[18px] text-secondary">
                  New Message (Gmail MCP)
                </span>
              </div>
              <button
                onClick={() => setShowComposeModal(false)}
                className="p-1.5 hover:bg-black/5 rounded-lg text-text-slate transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Compose Form */}
            <div className="p-6 space-y-4 text-left">
              <div className="space-y-1">
                <label className="block text-[12px] font-black text-secondary uppercase tracking-wider">
                  Recipient Email
                </label>
                <input
                  type="email"
                  value={composeTo}
                  onChange={(e) => setComposeTo(e.target.value)}
                  placeholder="colleague@example.com"
                  className="w-full h-11 px-4 bg-background-mist border-[2px] border-secondary dark:border-white rounded-xl outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 text-[13px] font-bold"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[12px] font-black text-secondary uppercase tracking-wider">
                  Subject Line
                </label>
                <input
                  type="text"
                  value={composeSubject}
                  onChange={(e) => setComposeSubject(e.target.value)}
                  placeholder="Updates on Syncra project integrations"
                  className="w-full h-11 px-4 bg-background-mist border-[2px] border-secondary dark:border-white rounded-xl outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 text-[13px] font-bold"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[12px] font-black text-secondary uppercase tracking-wider">
                  Message Body
                </label>
                <textarea
                  value={composeBody}
                  onChange={(e) => setComposeBody(e.target.value)}
                  placeholder="Write message content..."
                  rows={6}
                  className="w-full p-4 bg-background-mist border-[2px] border-secondary dark:border-white rounded-xl outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 text-[13px] font-medium resize-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  onClick={() => setShowComposeModal(false)}
                  variant="secondary"
                  className="flex-1 min-h-[44px] py-2 border-[2px] border-secondary"
                >
                  Cancel Draft
                </Button>
                <Button
                  onClick={handleSendCompose}
                  isLoading={isSendingEmail}
                  className="flex-1 min-h-[44px] py-2 bg-primary text-white"
                >
                  Send Email (MCP)
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Developer Config Setup Guide ── */}
      {showConfigAlertModal && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface-white neo-border rounded-[28px] max-w-lg w-full overflow-hidden neo-shadow-lg animate-in fade-in zoom-in duration-200">
            {/* Header */}
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

            {/* Guide Body */}
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
                      {`${typeof window !== "undefined" ? window.location.origin : "http://localhost:3000"}/api/auth/callback/google`}
                    </div>
                  </li>
                  <li className="mt-1">
                    <strong>For Testing (Error 403: access_denied):</strong> If your OAuth app's Publishing Status is set to <em>Testing</em>, you must add the email address of the account you want to connect to the <strong>Test Users</strong> list under the <em>OAuth consent screen</em> tab in your Google Console.
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

      {/* ── Modal: Redesigned Settings dialog ── */}
      {showSettingsModal && settingsPlatform && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface-white neo-border rounded-[28px] max-w-md w-full overflow-hidden neo-shadow-lg flex flex-col max-h-[85vh] animate-in fade-in zoom-in duration-200 text-left">
            
            {/* Redesigned Dialog Header */}
            <div className="p-6 border-b-[2.5px] border-border-mist bg-background-mist flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-surface-white border border-border-mist shrink-0">
                  {settingsPlatform.icon ? (
                    <img src={settingsPlatform.icon} alt={settingsPlatform.name} className="w-6 h-6 object-contain" />
                  ) : settingsPlatform.id === "linkedin" ? (
                    renderLinkedInIcon()
                  ) : (
                    renderGitHubIcon()
                  )}
                </div>
                <div>
                  <h3 className="font-display font-black text-lg text-secondary">
                    {settingsPlatform.name} MCP Tools
                  </h3>
                  <p className="text-text-slate text-[12px] font-medium mt-0.5">
                    Toggle active tools inside the AI context window.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowSettingsModal(false)}
                className="p-1.5 hover:bg-black/5 rounded-lg text-text-slate transition-all shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Redesigned Dialog Body: Only Displays MCP Tools list */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="divide-y-[2px] divide-border-mist">
                {settingsTools === null ? (
                  <div className="py-8 text-center text-text-slate italic">
                    Loading MCP tools dynamically...
                  </div>
                ) : settingsTools.length > 0 ? (
                  settingsTools.map((tool) => {
                    const isActive = enabledTools[tool.name] !== false;
                    
                    return (
                      <div
                        key={tool.name}
                        className="py-4 first:pt-0 last:pb-0 flex items-center justify-between gap-4"
                      >
                        {/* Tool description left */}
                        <div className="flex gap-3 items-start min-w-0">
                          <div className={`p-2.5 rounded-xl border-[1.5px] shrink-0 mt-0.5 ${
                            isActive
                              ? "bg-primary/10 border-primary text-primary"
                              : "bg-background-mist border-border-mist text-text-slate"
                          }`}>
                            {getToolIcon(tool.name)}
                          </div>
                          <div className="min-w-0">
                            <h4 className="font-mono font-bold text-[13px] text-secondary truncate">
                              {tool.displayName}
                            </h4>
                            <p className="text-text-slate text-[12px] leading-relaxed mt-0.5 font-medium">
                              {tool.description}
                            </p>
                          </div>
                        </div>

                        {/* Tool Toggle Switch right */}
                        <button
                          role="switch"
                          aria-checked={isActive}
                          onClick={() => handleToggleTool(tool.name)}
                          className={`w-12 h-[26px] rounded-full p-1 flex items-center cursor-pointer transition-all duration-300 shrink-0 ${
                            isActive ? "bg-success border-[2px] border-secondary justify-end" : "bg-text-fog border-[2px] border-border-mist justify-start"
                          }`}
                        >
                          <span className="w-4 h-4 bg-white rounded-full shadow-inner border border-secondary/25" />
                        </button>
                      </div>
                    );
                  })
                ) : (
                  <div className="py-8 text-center text-text-slate italic">
                    No MCP tools exposed for this channel.
                  </div>
                )}
              </div>
            </div>

            {/* Redesigned Dialog Footer */}
            <div className="p-6 border-t-[2.5px] border-border-mist bg-background-mist flex justify-end shrink-0">
              <Button
                onClick={() => setShowSettingsModal(false)}
                variant="primary"
                className="min-h-[44px] px-8 text-[14px]"
              >
                Save Settings
              </Button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
