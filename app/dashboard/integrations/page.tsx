"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PLATFORM_MCP_TOOLS, MCPTool } from "@/constants/mcp-tools";
import {
  getGmailConnectionStatus,
  disconnectGmailConnection,
  checkGoogleApiConfig,
  getProviderTools,
  ConnectionStatus
} from "@/app/actions/integrations";
import {
  requestWhatsAppPairingCodeAction,
  getWhatsAppStatusAction,
  disconnectWhatsAppAction
} from "@/app/actions/whatsapp";
import {
  Mail,
  Settings,
  ShieldCheck,
  CheckCircle2,
  Sliders,
  Search,
  AlertCircle,
  X,
  Send,
  FileText,
  Loader2,
  AlertTriangle,
  Trash2,
  Archive,
  CornerUpLeft,
  Paperclip,
  ExternalLink,
  Smartphone,
  Link,
  ChevronDown
} from "lucide-react";

function flagEmoji(iso: string): string {
  if (!iso || iso.length !== 2) return "";
  const codePoints = iso
    .toUpperCase()
    .split("")
    .map((c) => 127397 + c.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

const COUNTRIES = [
  { code: "+1", iso: "US", name: "United States" },
  { code: "+91", iso: "IN", name: "India" },
  { code: "+44", iso: "GB", name: "United Kingdom" },
  { code: "+49", iso: "DE", name: "Germany" },
  { code: "+33", iso: "FR", name: "France" },
  { code: "+61", iso: "AU", name: "Australia" },
  { code: "+55", iso: "BR", name: "Brazil" },
  { code: "+81", iso: "JP", name: "Japan" },
  { code: "+65", iso: "SG", name: "Singapore" },
  { code: "+971", iso: "AE", name: "UAE" },
  { code: "+86", iso: "CN", name: "China" },
  { code: "+7", iso: "RU", name: "Russia" },
  { code: "+27", iso: "ZA", name: "South Africa" },
  { code: "+234", iso: "NG", name: "Nigeria" },
  { code: "+52", iso: "MX", name: "Mexico" },
  { code: "+62", iso: "ID", name: "Indonesia" },
  { code: "+39", iso: "IT", name: "Italy" },
  { code: "+34", iso: "ES", name: "Spain" },
  { code: "+31", iso: "NL", name: "Netherlands" },
  { code: "+41", iso: "CH", name: "Switzerland" },
  { code: "+46", iso: "SE", name: "Sweden" },
  { code: "+47", iso: "NO", name: "Norway" },
  { code: "+48", iso: "PL", name: "Poland" },
  { code: "+90", iso: "TR", name: "Turkey" },
  { code: "+966", iso: "SA", name: "Saudi Arabia" },
  { code: "+54", iso: "AR", name: "Argentina" },
  { code: "+64", iso: "NZ", name: "New Zealand" }
];

interface CountryDropdownPortalProps {
  selectedCountry: typeof COUNTRIES[0];
  countrySearch: string;
  setCountrySearch: (value: string) => void;
  setSelectedCountry: (country: typeof COUNTRIES[0]) => void;
  setShowCountryDropdown: (show: boolean) => void;
  triggerRef: React.RefObject<HTMLElement | null>;
  whatsappPhoneInputId: string;
}

function CountryDropdownPortal({
  selectedCountry,
  countrySearch,
  setCountrySearch,
  setSelectedCountry,
  setShowCountryDropdown,
  triggerRef,
  whatsappPhoneInputId,
}: CountryDropdownPortalProps) {
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const updatePosition = () => {
      const trigger = triggerRef.current;
      if (!trigger || !dropdownRef.current) return;

      const triggerRect = trigger.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;

      const spaceBelow = viewportHeight - triggerRect.bottom;
      const spaceAbove = triggerRect.top;

      const preferredHeight = 280;
      const dropdownWidth = triggerRect.width;

      let top: number;
      let left = triggerRect.left;

      if (spaceBelow < preferredHeight && spaceAbove > spaceBelow) {
        top = triggerRect.top - preferredHeight - 6;
      } else {
        top = triggerRect.bottom + 6;
      }

      if (left + dropdownWidth > viewportWidth - 16) {
        left = viewportWidth - dropdownWidth - 16;
      }
      if (left < 16) left = 16;

      setDropdownStyle({
        position: 'fixed',
        top: `${top}px`,
        left: `${left}px`,
        width: `${dropdownWidth}px`,
        maxHeight: `${preferredHeight}px`,
        zIndex: 9999,
      });
    };

    updatePosition();
    window.addEventListener('scroll', updatePosition, { passive: true });
    window.addEventListener('resize', updatePosition);
    return () => {
      window.removeEventListener('scroll', updatePosition);
      window.removeEventListener('resize', updatePosition);
    };
  }, [triggerRef]);

  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  const handleClickOutside = useCallback((event: MouseEvent) => {
    if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
      const trigger = triggerRef.current;
      if (trigger && !trigger.contains(event.target as Node)) {
        setShowCountryDropdown(false);
        setCountrySearch("");
      }
    }
  }, [setShowCountryDropdown, setCountrySearch, triggerRef]);

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [handleClickOutside]);

  const filteredCountries = COUNTRIES.filter(c =>
    c.name.toLowerCase().includes(countrySearch.toLowerCase()) ||
    c.code.includes(countrySearch)
  );

  return (
    <div
      ref={dropdownRef}
      style={dropdownStyle}
      className="bg-white dark:bg-[#0B1120] border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl animate-in fade-in-50 slide-in-from-top-1 duration-150 flex flex-col"
      role="listbox"
    >
      {/* Sticky Search box */}
      <div className="shrink-0 bg-white dark:bg-[#0B1120] px-2 pt-2 pb-1.5 border-b border-slate-100 dark:border-slate-800/80 rounded-t-xl">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 dark:text-slate-450 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            ref={searchInputRef}
            type="text"
            value={countrySearch}
            onChange={(e) => setCountrySearch(e.target.value)}
            placeholder="Search country or code..."
            className="w-full h-10 pl-9 pr-8 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 text-[13px] font-medium rounded-lg outline-none focus:border-slate-300 dark:focus:border-slate-600 focus:ring-1 focus:ring-slate-300 dark:focus:ring-slate-600 transition-all text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500"
            autoFocus
          />
          {countrySearch && (
            <button
              type="button"
              onClick={() => setCountrySearch("")}
              className="p-1 absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-md transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Scrollable Country List */}
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-1 space-y-0.5" role="listbox">
        {filteredCountries.length > 0 ? (
          filteredCountries.map((country) => {
            const isSelected = country.code === selectedCountry.code;
            return (
              <button
                key={country.name + country.code}
                type="button"
                onClick={() => {
                  setSelectedCountry(country);
                  setShowCountryDropdown(false);
                  setCountrySearch("");
                  document.getElementById(whatsappPhoneInputId)?.focus();
                }}
                role="option"
                aria-selected={isSelected}
                className={`
                  w-full flex items-center justify-between px-3 py-2.5 text-[14px] font-medium rounded-lg transition-all duration-150 cursor-pointer text-left
                  ${isSelected
                    ? "bg-[#25D366]/10 text-[#128C7E] dark:bg-[#25D366]/20 dark:text-[#25D366]"
                    : "hover:bg-slate-100 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300"
                  }
                `}
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl leading-none">{flagEmoji(country.iso)}</span>
                  <span className="truncate font-semibold">{country.name}</span>
                </div>
                <span className="text-[13px] font-bold text-slate-500 dark:text-slate-400 font-mono">{country.code}</span>
              </button>
            );
          })
        ) : (
          <div className="py-5 text-center text-[12.5px] text-slate-500 dark:text-slate-500 font-medium">
            No countries found
          </div>
        )}
      </div>
    </div>
  );
}

interface Platform {
  id: string;
  name: string;
  icon: string;
  description: string;
  hasOAuth: boolean;
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

  // WhatsApp Integration states
  const [whatsappStatus, setWhatsAppStatus] = useState<ConnectionStatus | null>(null);
  const [showWhatsAppConnectModal, setShowWhatsAppConnectModal] = useState(false);
  const [whatsappPhoneNumber, setWhatsAppPhoneNumber] = useState("");
  const [selectedCountry, setSelectedCountry] = useState(COUNTRIES[0]);
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);
  const [countrySearch, setCountrySearch] = useState("");
  const [whatsappPairingCode, setWhatsAppPairingCode] = useState("");
  const [isGeneratingPairingCode, setIsGeneratingPairingCode] = useState(false);
  const pollingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const countryTriggerRef = useRef<HTMLButtonElement>(null);
  const phoneInputRef = useRef<HTMLDivElement>(null);

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

  // Fetch page data â€” failures here show inline errors, never redirect
  const fetchPageData = useCallback(async (userId: string) => {
    if (typeof window === "undefined") return;
    if (!isMounted.current) return;
    setIsDataLoading(true);
    try {
      try {
        const timeout = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("DATA_FETCH_TIMEOUT")), 8000)
        );
        const [gmailConn, whatsappConnResult, isConfigured] = await Promise.race([
          Promise.all([
            getGmailConnectionStatus(userId),
            getWhatsAppStatusAction(userId),
            checkGoogleApiConfig(),
          ]),
          timeout.then(() => { throw new Error("DATA_FETCH_TIMEOUT"); })
        ]) as [ConnectionStatus | null, { success: boolean; status: ConnectionStatus | null; error?: string }, boolean];
        if (!isMounted.current) return;
        setGmailStatus(gmailConn);
        if (whatsappConnResult && whatsappConnResult.success) {
          setWhatsAppStatus(whatsappConnResult.status);
          if (whatsappConnResult.status?.status === "pairing") {
            startWhatsAppPolling(userId);
          }
        }
        setIsGoogleConfiguredOnServer(isConfigured);
      } catch (dataErr: unknown) {
        // Data load failed â€” log it but do NOT redirect
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

  // Gmail OAuth Connect Click
  const handleGmailConnect = async () => {
    if (!user) return;
    if (!isGoogleConfiguredOnServer) {
      setShowConfigAlertModal(true);
      return;
    }
    
    // Redirect browser to the OAuth API initiator route with userId parameter
    window.location.assign(`/api/google?userId=${user.id}`);
  };

  // Gmail Disconnect Click
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

      {/* Main Layout Stack */}
      <div className="space-y-8 max-w-5xl mx-auto">
        
        {/* Workspace Channels */}
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
              // Determine connection state (Gmail & WhatsApp check real state, others check mock list)
              const isGmail = platform.id === "gmail";
              const isWhatsApp = platform.id === "whatsapp";
              const isConnected = isGmail
                ? !!gmailStatus
                : isWhatsApp
                ? (!!whatsappStatus && whatsappStatus.status === "active")
                : mockConnectedList.includes(platform.id);
              
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
                      ) : isWhatsApp && whatsappStatus ? (
                        <>
                          <div className="flex justify-between">
                            <span>Account:</span>
                            <span className="font-bold text-secondary truncate max-w-[130px]">{whatsappStatus.email}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Linked On:</span>
                            <span className="font-bold text-secondary">{formatConnectedDate(whatsappStatus.connectedAt)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Last Sync:</span>
                            <span className="font-bold text-secondary">{formatLastSyncTime(whatsappStatus.lastSyncAt) || "Never"}</span>
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

                  {/* âš ï¸ Flag missing asset warnings to meet prompt requirements */}
                  {platform.id === "outlook" && (
                    <div className="text-[10px] text-warning font-bold mb-3.5 bg-warning-bg border border-warning/20 px-2.5 py-1 rounded-md shrink-0">
                      âš ï¸ missing outlook.png (using email.png)
                    </div>
                  )}
                  {platform.id === "linkedin" && (
                    <div className="text-[10px] text-warning font-bold mb-3.5 bg-warning-bg border border-warning/20 px-2.5 py-1 rounded-md shrink-0">
                      âš ï¸ missing linkedin.png (using inline SVG)
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
                            } else if (isWhatsApp) {
                              handleWhatsAppDisconnect();
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
                          } else if (isWhatsApp) {
                            handleWhatsAppConnectClick();
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


      {/* â”€â”€ Modal: WhatsApp Connection (Pairing Code Flow) â”€â”€ */}
      {showWhatsAppConnectModal && (
        <div 
          role="dialog" 
          aria-modal="true" 
          className="fixed inset-0 bg-slate-950/40 dark:bg-black/60 backdrop-blur-[4px] z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
        >
          <div 
            className="bg-white dark:bg-[#0B1120] border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl shadow-slate-950/10 dark:shadow-black/50 animate-in fade-in zoom-in duration-200"
          >
            {/* Header */}
            <div className="px-6 py-4.5 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/[0.3] dark:bg-slate-900/[0.15] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-[#25D366]/10 dark:bg-[#25D366]/20 text-[#128C7E] dark:text-[#25D366] rounded-xl flex items-center justify-center shrink-0">
                  <Smartphone className="w-5 h-5" />
                </div>
                <span className="font-sans font-semibold text-[17px] text-slate-900 dark:text-slate-100 tracking-tight">
                  Link WhatsApp Channel
                </span>
              </div>
              <button
                onClick={() => {
                  stopWhatsAppPolling();
                  setShowWhatsAppConnectModal(false);
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-slate-400/20"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6 text-left">
              {/* Step 1: Input Phone Number */}
              {!whatsappPairingCode ? (
                <form onSubmit={handleGenerateWhatsAppPairingCode} className="space-y-6">
                  <div className="space-y-2.5 text-slate-600 dark:text-slate-400">
                    <p className="text-[13.5px] font-medium text-slate-750 dark:text-slate-300">
                      Enter the WhatsApp number you want to connect. We&apos;ll send a pairing code to link it.
                    </p>
                    <ul className="space-y-1.5 text-[12.5px] font-medium text-slate-500 dark:text-slate-400 pl-1 ml-1 list-disc marker:text-[#25D366]">
                      <li className="pl-1">Include your country code.</li>
                      <li className="pl-1">
                        Example: <span className="font-semibold text-slate-755 dark:text-slate-300 font-mono">+1 234 567 8900</span>
                      </li>
                      <li className="pl-1">The pairing code is generated securely and expires after a few minutes.</li>
                    </ul>
                  </div>
                  
                  <div className="relative w-full">
                    <div className="flex justify-between items-center mb-1.5">
                      <label htmlFor="whatsapp-phone-input" className="block text-[12.5px] font-semibold text-slate-700 dark:text-slate-400">
                        Phone number
                      </label>
                      {whatsappPhoneNumber && (
                        <span className="text-[11px] font-medium text-slate-450 dark:text-slate-505 transition-all animate-in fade-in duration-200">
                          {selectedCountry.name}
                        </span>
                      )}
                    </div>
                    
                    <div ref={phoneInputRef} className={`
                      relative flex items-center w-full h-11 rounded-xl bg-slate-50 dark:bg-black/10 border transition-all duration-200
                      ${isGeneratingPairingCode ? "opacity-60 cursor-not-allowed" : ""}
                      ${showCountryDropdown 
                        ? "border-[#25D366] ring-2 ring-[#25D366]/10" 
                        : "border-slate-200 dark:border-slate-800 hover:border-slate-350 dark:hover:border-slate-750"
                      }
                    `}>
                      {/* Country Selector Button */}
                      <button
                        ref={countryTriggerRef}
                        type="button"
                        disabled={isGeneratingPairingCode}
                        onClick={() => setShowCountryDropdown(!showCountryDropdown)}
                        aria-haspopup="listbox"
                        aria-expanded={showCountryDropdown}
                        aria-label="Select country code"
                        className="flex items-center justify-between min-w-[110px] h-full pl-3.5 pr-3 hover:bg-slate-100 dark:hover:bg-slate-800/40 rounded-l-xl transition-colors cursor-pointer text-sm font-semibold text-slate-700 dark:text-slate-300"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-xl leading-none">{flagEmoji(selectedCountry.iso)}</span>
                          <span className="text-[14px] font-bold font-mono text-slate-800 dark:text-slate-200">{selectedCountry.code}</span>
                        </div>
                        <ChevronDown className={`w-4 h-4 ml-1 text-slate-400 transition-transform duration-200 ${showCountryDropdown ? "rotate-180" : ""}`} />
                      </button>

                      {/* Visual Separator */}
                      <div className="w-[1.5px] h-5 bg-slate-200 dark:bg-slate-800 shrink-0" />

                      {/* Text Input */}
                      <input
                        id="whatsapp-phone-input"
                        type="tel"
                        required
                        disabled={isGeneratingPairingCode}
                        value={whatsappPhoneNumber}
                        onChange={(e) => {
                          const val = e.target.value.replace(/[^\d\s\-\(\)\+]/g, "");
                          setWhatsAppPhoneNumber(val);
                        }}
                        placeholder={selectedCountry.code === "+1" ? "(201) 555-0123" : selectedCountry.code === "+91" ? "98765 43210" : "Enter phone number"}
                        className="flex-1 h-full px-3.5 bg-transparent border-0 outline-none focus:outline-none focus:ring-0 text-[14px] font-semibold text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500"
                      />

                      {/* Loading State inline */}
                      {isGeneratingPairingCode && (
                        <div className="pr-3.5 flex items-center">
                          <Loader2 className="w-4 h-4 animate-spin text-[#25D366]" />
                        </div>
                      )}
                    </div>

                  </div>

                  <div className="pt-2 flex gap-3">
                    <button
                      type="button"
                      onClick={() => setShowWhatsAppConnectModal(false)}
                      className="flex-1 inline-flex items-center justify-center font-medium text-[13.5px] rounded-xl h-10 min-h-[40px] bg-transparent hover:bg-slate-50 dark:hover:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 transition-all duration-200 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-slate-400/20 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isGeneratingPairingCode}
                      className="flex-1 inline-flex items-center justify-center font-medium text-[13.5px] rounded-xl h-10 min-h-[40px] bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-slate-200 text-white dark:text-slate-950 transition-all duration-200 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-slate-400/20 disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
                    >
                      {isGeneratingPairingCode ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : null}
                      Generate Code
                    </button>
                  </div>
                </form>
              ) : (
                /* Step 2: Show Pairing Code & Wait */
                <div className="space-y-6">
                  <div className="text-center space-y-3.5">
                    <p className="text-[13.5px] text-slate-600 dark:text-slate-400 font-medium">
                      Enter this pairing code on your mobile device to authorize:
                    </p>
                    
                    {/* High-Fidelity Code Badge */}
                    <div className="inline-flex items-center justify-center px-10 py-4.5 bg-[#25D366]/[0.06] dark:bg-[#25D366]/10 border border-[#25D366]/30 dark:border-[#25D366]/40 rounded-2xl shadow-sm shadow-[#25D366]/5">
                      <span className="font-mono font-bold text-3xl tracking-[0.2em] text-[#128C7E] dark:text-[#25D366] select-all leading-none">
                        {whatsappPairingCode}
                      </span>
                    </div>
                  </div>

                  {/* Device linking instructions */}
                  <div className="bg-slate-50 dark:bg-slate-900/40 p-5 rounded-2xl border border-slate-100 dark:border-slate-800/80 space-y-3">
                    <h4 className="font-semibold text-[13px] text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <Link className="w-3.5 h-3.5 text-[#25D366]" /> Instructions:
                    </h4>
                    <ol className="text-[12.5px] font-medium text-slate-600 dark:text-slate-400 space-y-2 list-decimal pl-4 leading-relaxed">
                      <li>Open <strong className="text-slate-900 dark:text-slate-200 font-semibold">WhatsApp</strong> on your phone.</li>
                      <li>Go to <strong className="text-slate-900 dark:text-slate-200 font-semibold">Settings</strong> / <strong className="text-slate-900 dark:text-slate-200 font-semibold">Menu</strong> &gt; <strong className="text-slate-900 dark:text-slate-200 font-semibold">Linked Devices</strong>.</li>
                      <li>Select <strong className="text-slate-900 dark:text-slate-200 font-semibold">Link a Device</strong>.</li>
                      <li>Choose <strong className="text-slate-900 dark:text-slate-200 font-semibold">Link with phone number instead</strong>.</li>
                      <li>Type the 8-character code shown above.</li>
                    </ol>
                  </div>

                  {/* Pulsing connection listener */}
                  <div className="flex items-center justify-center gap-2 py-1 text-[#25D366] font-semibold text-[13px]">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="animate-pulse">Waiting for WhatsApp authorization...</span>
                  </div>

                  <div className="flex justify-end pt-1">
                    <button
                      onClick={() => {
                        stopWhatsAppPolling();
                        setShowWhatsAppConnectModal(false);
                      }}
                      className="w-full inline-flex items-center justify-center font-medium text-[13.5px] rounded-xl h-10 min-h-[40px] bg-transparent hover:bg-slate-50 dark:hover:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 transition-all duration-200 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-slate-400/20 cursor-pointer"
                    >
                      Cancel & Close
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}


      {/* â”€â”€ Modal: Developer Config Setup Guide â”€â”€ */}
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

      {/* â”€â”€ Modal: Redesigned Settings dialog â”€â”€ */}
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

      {/* Country Dropdown Portal - rendered at body level to escape modal clipping */}
      {showCountryDropdown && createPortal(
        <CountryDropdownPortal
          selectedCountry={selectedCountry}
          countrySearch={countrySearch}
          setCountrySearch={setCountrySearch}
          setSelectedCountry={setSelectedCountry}
          setShowCountryDropdown={setShowCountryDropdown}
          triggerRef={phoneInputRef}
          whatsappPhoneInputId="whatsapp-phone-input"
        />,
        document.body
      )}

    </div>
  );
}
