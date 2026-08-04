"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { PLATFORM_MCP_TOOLS, MCPTool } from "@/constants/mcp-tools";
import {
  disconnectGmailConnection,
  disconnectIntegration,
  checkGoogleApiConfig,
  getProviderTools,
  connectTelegramAction,
  disconnectTelegramWebhookAction,
  connectDiscordAction,
  getDiscordInviteUrlAction,
  disconnectLinkedinAction,
  disconnectGithubAction,
} from "@/app/actions/integrations";
import {
  requestWhatsAppPairingCodeAction,
  getWhatsAppStatusAction,
  disconnectWhatsAppAction,
} from "@/app/actions/whatsapp";
import { useIntegrations } from "@/hooks/useIntegrations";
import { ACTIVE_PROVIDERS, getProviderMeta } from "@/features/integrations/constants/providers";
import { IntegrationCard } from "@/features/integrations/components/integration-card";
import { IntegrationDrawer } from "@/features/integrations/components/integration-drawer";
import { IntegrationSummaryStats } from "@/features/integrations/components/integration-summary-stats";
import { IntegrationCardSkeleton, IntegrationSummarySkeleton } from "@/features/integrations/components/integration-skeletons";
import { IntegrationSearch } from "@/features/integrations/components/search/integration-search";
import { Search, ShieldCheck, CheckCircle2, AlertCircle, X, AlertTriangle, ExternalLink, Command, Settings } from "lucide-react";
import dynamic from "next/dynamic";
import type { WorkspaceIntegration } from "@/app/actions/integrations";
import type { IntegrationSettingsPatch } from "@/hooks/useIntegrations";
import { COUNTRIES } from "@/components/dashboard/integrations/country-dropdown-portal";

const WhatsAppConnectionModal = dynamic(() => import("@/components/dashboard/integrations/whatsapp-connection-modal").then(mod => mod.WhatsAppConnectionModal), { ssr: false });
const TelegramConnectionModal = dynamic(() => import("@/components/dashboard/integrations/telegram-connection-modal").then(mod => mod.TelegramConnectionModal), { ssr: false });
const DiscordConnectionModal = dynamic(() => import("@/components/dashboard/integrations/discord-connection-modal").then(mod => mod.DiscordConnectionModal), { ssr: false });
const MCPSettingsModal = dynamic(() => import("@/components/dashboard/integrations/mcp-settings-modal").then(mod => mod.MCPSettingsModal), { ssr: false });

export default function IntegrationsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoading: authLoading } = useAuth();

  const {
    integrations,
    isLoading: hookLoading,
    lastSync,
    runSync,
    runRefreshToken,
    disconnect: hookDisconnect,
    reconnect,
    updateSettings,
  } = useIntegrations(user?.id);

  const isLoading = authLoading || hookLoading;

  const [showSearch, setShowSearch] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<WorkspaceIntegration | null>(null);
  const [isDrawerOperating, setIsDrawerOperating] = useState(false);
  const [drawerOperatingAction, setDrawerOperatingAction] = useState<"sync" | "refresh" | null>(null);
  const [isSyncing, setIsSyncing] = useState<Record<string, boolean>>({});

  const [isGoogleConfiguredOnServer, setIsGoogleConfiguredOnServer] = useState(true);
  const [showConfigAlertModal, setShowConfigAlertModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [showMCPSettingsModal, setShowMCPSettingsModal] = useState(false);
  const [mcpSettingsPlatform, setMcpSettingsPlatform] = useState<{ id: string; name: string; icon: string } | null>(null);
  const [mcpSettingsTools, setMcpSettingsTools] = useState<MCPTool[] | null>(null);
  const [enabledTools, setEnabledTools] = useState<Record<string, boolean>>(() => {
    if (typeof window === "undefined") return {};
    const storedTools = localStorage.getItem("syncra-enabled-mcp-tools");
    if (storedTools) {
      try { return JSON.parse(storedTools) as Record<string, boolean>; } catch {}
    }
    const defaults: Record<string, boolean> = {};
    Object.values(PLATFORM_MCP_TOOLS).flat().forEach(t => { defaults[t.name] = true; });
    localStorage.setItem("syncra-enabled-mcp-tools", JSON.stringify(defaults));
    return defaults;
  });

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

  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    checkGoogleApiConfig().then(setIsGoogleConfiguredOnServer);
    return () => { isMounted.current = false; };
  }, []);

  // ── WhatsApp polling ──
  const stopWhatsAppPolling = useCallback(() => {
    if (pollingTimerRef.current) { clearInterval(pollingTimerRef.current); pollingTimerRef.current = null; }
  }, []);

  const startWhatsAppPolling = useCallback((userId: string) => {
    stopWhatsAppPolling();
    pollingTimerRef.current = setInterval(async () => {
      try {
        const res = await getWhatsAppStatusAction(userId);
        if (res.success && res.status?.status === "active") {
          stopWhatsAppPolling();
          setSuccessMessage("WhatsApp connected successfully!");
          setShowWhatsAppConnectModal(false);
          setWhatsAppPairingCode("");
          setWhatsAppPhoneNumber("");
        }
      } catch {}
    }, 3000);
  }, [stopWhatsAppPolling]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setShowSearch((s) => !s);
        return;
      }
      if (e.key === "Escape") {
        if (showSearch) { setShowSearch(false); return; }
        if (showWhatsAppConnectModal) { stopWhatsAppPolling(); setShowWhatsAppConnectModal(false); }
        if (selectedProvider) setSelectedProvider(null);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showWhatsAppConnectModal, selectedProvider, showSearch, stopWhatsAppPolling]);

  useEffect(() => {
    return () => { if (pollingTimerRef.current) clearInterval(pollingTimerRef.current); };
  }, []);

  useEffect(() => {
    const success = searchParams.get("success");
    const error = searchParams.get("error");
    if (success) {
      const timer = setTimeout(() => {
        setSuccessMessage(`${success.charAt(0).toUpperCase() + success.slice(1)} connected successfully!`);
        router.replace("/dashboard/integrations");
      }, 0);
      return () => clearTimeout(timer);
    }
    if (error) {
      const timer = setTimeout(() => {
        setErrorMessage(error === "missing_credentials" ? "OAuth credentials are not configured on the server." : `OAuth authentication failed: ${decodeURIComponent(error)}`);
        router.replace("/dashboard/integrations");
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [searchParams, router]);

  // ── Connect handlers ──
  const handleGmailConnect = useCallback(() => {
    if (!user) return;
    if (!isGoogleConfiguredOnServer) { setShowConfigAlertModal(true); return; }
    window.location.assign("/api/google");
  }, [user, isGoogleConfiguredOnServer]);

  const handleOAuthConnect = useCallback((provider: string) => {
    if (!user) return;
    window.location.assign(`/api/${provider}`);
  }, [user]);

  const handleTelegramConnect = useCallback(async (botToken: string) => {
    if (!user) return { success: false, error: "Not authenticated" };
    const res = await connectTelegramAction(user.id, botToken);
    if (res.success) setSuccessMessage("Telegram connected successfully!");
    return res;
  }, [user]);

  const handleDiscordConnect = useCallback(async () => {
    if (!user) return { success: false, error: "Not authenticated" };
    const res = await connectDiscordAction(user.id);
    if (res.success) setSuccessMessage("Discord connected successfully!");
    return res;
  }, [user]);

  const handleWhatsAppGenerateCode = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!whatsappPhoneNumber.trim() || !user) return;
    setIsGeneratingPairingCode(true);
    setErrorMessage(null);
    try {
      let cleanInput = whatsappPhoneNumber.trim().replace(/\D/g, "");
      const countryDigits = selectedCountry.code.replace(/\D/g, "");
      if (cleanInput.startsWith(countryDigits)) cleanInput = cleanInput.substring(countryDigits.length);
      const fullNumber = `${countryDigits}${cleanInput}`;
      const res = await requestWhatsAppPairingCodeAction(user.id, fullNumber);
      if (res.success && res.pairingCode) {
        setWhatsAppPairingCode(res.pairingCode);
        startWhatsAppPolling(user.id);
      } else {
        setErrorMessage(res.error || "Failed to generate pairing code.");
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "An unexpected error occurred.");
    } finally {
      setIsGeneratingPairingCode(false);
    }
  }, [whatsappPhoneNumber, user, selectedCountry, startWhatsAppPolling]);

  // ── Disconnect handlers ──
  const handleDisconnect = useCallback(async (provider: string) => {
    if (!user) return;
    try {
      if (provider === "gmail") {
        await disconnectGmailConnection(user.id);
      } else if (provider === "whatsapp") {
        stopWhatsAppPolling();
        await disconnectWhatsAppAction(user.id);
      } else if (provider === "telegram") {
        await disconnectTelegramWebhookAction(user.id);
        await disconnectIntegration(user.id, "telegram");
      } else if (provider === "linkedin") {
        await disconnectLinkedinAction(user.id);
      } else if (provider === "github") {
        await disconnectGithubAction(user.id);
      } else {
        await hookDisconnect(provider);
      }
      setSuccessMessage(`${getProviderMeta(provider).name} disconnected.`);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Disconnect failed.");
    }
  }, [user, hookDisconnect, stopWhatsAppPolling]);

  // ── Card action handlers ──
  const handleCardConnect = useCallback((integration: WorkspaceIntegration) => {
    const provider = integration.provider;
    if (provider === "gmail") handleGmailConnect();
    else if (provider === "whatsapp") { setWhatsAppPhoneNumber(""); setSelectedCountry(COUNTRIES[0]); setShowWhatsAppConnectModal(true); }
    else if (provider === "telegram") setShowTelegramConnectModal(true);
    else if (provider === "discord") setShowDiscordConnectModal(true);
    else handleOAuthConnect(provider);
  }, [handleGmailConnect, handleOAuthConnect]);

  const handleCardSync = useCallback(async (integration: WorkspaceIntegration) => {
    setIsSyncing(prev => ({ ...prev, [integration.provider]: true }));
    await runSync(integration.provider);
    setIsSyncing(prev => ({ ...prev, [integration.provider]: false }));
  }, [runSync]);

  const handleCardDisconnect = useCallback((integration: WorkspaceIntegration) => {
    handleDisconnect(integration.provider);
  }, [handleDisconnect]);

  const handleOpenDetails = useCallback((integration: WorkspaceIntegration) => {
    setSelectedProvider(integration);
  }, []);

  // ── Drawer handlers ──
  const handleDrawerSync = useCallback(async () => {
    if (!selectedProvider) return;
    setIsDrawerOperating(true);
    setDrawerOperatingAction("sync");
    await runSync(selectedProvider.provider);
    setIsDrawerOperating(false);
    setDrawerOperatingAction(null);
    setSelectedProvider(prev => prev ? { ...prev, sync_status: "success", last_sync_at: new Date().toISOString() } : null);
  }, [selectedProvider, runSync]);

  const handleDrawerRefreshToken = useCallback(async () => {
    if (!selectedProvider) return;
    setIsDrawerOperating(true);
    setDrawerOperatingAction("refresh");
    await runRefreshToken(selectedProvider.provider);
    setIsDrawerOperating(false);
    setDrawerOperatingAction(null);
  }, [selectedProvider, runRefreshToken]);

  const handleDrawerDisconnect = useCallback(() => {
    if (!selectedProvider) return;
    handleDisconnect(selectedProvider.provider);
    setSelectedProvider(null);
  }, [selectedProvider, handleDisconnect]);

  const handleDrawerReconnect = useCallback(async () => {
    if (!selectedProvider) return;
    await reconnect(selectedProvider.provider);
    setSelectedProvider(null);
    handleCardConnect(selectedProvider);
  }, [selectedProvider, reconnect, handleCardConnect]);

  const handleDrawerToggleSetting = useCallback((key: keyof IntegrationSettingsPatch, value: boolean) => {
    if (!selectedProvider) return;
    updateSettings(selectedProvider.provider, { [key]: value });
    setSelectedProvider(prev => prev ? { ...prev, settings: { ...prev.settings, [key]: value } } : null);
  }, [selectedProvider, updateSettings]);

  // ── MCP Settings ──
  const handleOpenMCPSettings = useCallback(async (platform: { id: string; name: string; icon: string }) => {
    setMcpSettingsPlatform(platform);
    setShowMCPSettingsModal(true);
    try {
      const tools = await getProviderTools(platform.id);
      setMcpSettingsTools(tools);
    } catch {
      setMcpSettingsTools([]);
    }
  }, []);

  const handleToggleTool = useCallback((toolName: string) => {
    setEnabledTools(prev => {
      const next = { ...prev, [toolName]: !prev[toolName] };
      localStorage.setItem("syncra-enabled-mcp-tools", JSON.stringify(next));
      return next;
    });
  }, []);

  // ── Loading state ──
  if (isLoading || !user) {
    return (
      <div className="pb-16 font-sans">
        <div className="mb-8">
          <h1 className="font-display font-black text-4xl text-secondary mb-2 tracking-tight">Integrations Workspace</h1>
          <p className="text-text-slate text-[16px] font-medium">Loading integrations...</p>
        </div>
        <IntegrationSummarySkeleton />
        <IntegrationCardSkeleton count={7} />
      </div>
    );
  }

  const aiHealth = integrations.some(i => i.connected && i.sync_status === "error") ? "degraded"
    : integrations.some(i => i.connected) ? "healthy"
    : "unavailable";

  return (
    <div className="pb-16 font-sans">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="font-display font-black text-4xl text-secondary mb-2 tracking-tight">
            Integrations Workspace
          </h1>
          <p className="text-text-slate text-[16px] font-medium max-w-2xl leading-relaxed">
            Connect external platforms. AI gets live access to your inbox, messages, repos, and notifications.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <a
            href="/dashboard/integrations/settings"
            className="flex items-center gap-2 px-4 py-2 bg-surface-white border-[2px] border-secondary text-secondary font-black text-[14px] rounded-xl hover:bg-background-mist transition-all shadow-flat-sm"
          >
            <Settings className="w-4 h-4" /> Settings
          </a>
          <div className="flex items-center gap-2 px-4 py-2 bg-success-bg border-[2.5px] border-success text-success font-black text-[14px] rounded-xl shadow-flat-sm">
            <ShieldCheck className="w-5 h-5" />
            <span>OAuth 2.0 Verified</span>
          </div>
        </div>
      </div>

      {/* Toasts */}
      {successMessage && (
        <div className="mb-6 p-4 bg-success-bg border-[2.5px] border-success rounded-[24px] flex items-center justify-between gap-3 text-success font-bold neo-shadow-sm">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-6 h-6 shrink-0" />
            <p>{successMessage}</p>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="p-1 hover:bg-black/5 rounded"><X className="w-4 h-4" /></button>
        </div>
      )}
      {errorMessage && (
        <div className="mb-6 p-4 bg-error-bg border-[2.5px] border-error rounded-[24px] flex items-center justify-between gap-3 text-error font-bold neo-shadow-sm">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-6 h-6 shrink-0" />
            <p>{errorMessage}</p>
          </div>
          <button onClick={() => setErrorMessage(null)} className="p-1 hover:bg-black/5 rounded"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Google config warning */}
      {!isGoogleConfiguredOnServer && (
        <div className="mb-6 p-5 bg-warning-bg border-[2.5px] border-warning rounded-[24px] neo-shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-warning font-black text-[16px]">
              <AlertTriangle className="w-5 h-5" />
              <span>Google API Credentials Required</span>
            </div>
            <p className="text-[13px] text-text-ink font-semibold leading-relaxed max-w-2xl">
              OAuth credentials missing from environment. Gmail integration won&apos;t work until configured in <code className="font-mono text-xs bg-black/5 px-1.5 py-0.5 rounded border border-secondary/20">.env.local</code>.
            </p>
          </div>
          <button onClick={() => setShowConfigAlertModal(true)} className="min-h-[40px] px-4 py-2 bg-surface-white border-[2px] border-secondary text-secondary font-bold text-[13px] rounded-xl hover:bg-background-mist transition-all cursor-pointer shrink-0">
            Setup Guide
          </button>
        </div>
      )}

      {/* Summary Stats */}
      {hookLoading ? <IntegrationSummarySkeleton /> : (
        <IntegrationSummaryStats integrations={integrations} lastSync={lastSync} aiHealth={aiHealth} />
      )}

      {/* Search */}
      <div className="mb-6 flex items-center gap-3">
        <button
          onClick={() => setShowSearch(true)}
          className="flex items-center gap-3 w-full max-w-md px-4 py-2.5 bg-surface-white border-[2px] border-border-mist rounded-xl text-[14px] font-medium text-text-fog hover:border-secondary hover:text-text-slate transition-colors cursor-pointer"
        >
          <Search className="w-4 h-4" />
          <span>Search integrations...</span>
          <span className="ml-auto inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-background-mist border border-border-mist rounded-md text-[10px] font-black">
            <Command className="w-3 h-3" /> K
          </span>
        </button>
      </div>

      {/* Cards Grid */}
      {hookLoading ? (
        <IntegrationCardSkeleton count={7} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {ACTIVE_PROVIDERS.map((meta) => {
            const integration = integrations.find(i => i.provider === meta.id);
            const fallbackIntegration: WorkspaceIntegration = integration || {
              id: `fallback_${meta.id}`,
              provider: meta.id,
              name: meta.name,
              email: "",
              connected: false,
              has_refresh_token: false,
              status: "disconnected",
              sync_status: "idle",
              last_error: null,
              scopes: "",
              last_sync_at: "",
              connected_at: "",
              expires_at: "",
              metadata: {},
              settings: { auto_sync: true, notifications: true, background_sync: true, token_refresh: true },
            };

            return (
              <IntegrationCard
                key={meta.id}
                integration={fallbackIntegration}
                onConnect={() => handleCardConnect(fallbackIntegration)}
                onDisconnect={() => handleCardDisconnect(fallbackIntegration)}
                onSync={() => handleCardSync(fallbackIntegration)}
                onOpenDetails={() => handleOpenDetails(fallbackIntegration)}
                isSyncing={isSyncing[meta.id]}
              />
            );
          })}
        </div>
      )}

      {/* Detail Drawer */}
      <IntegrationDrawer
        integration={selectedProvider}
        userId={user?.id}
        isOperating={isDrawerOperating}
        operatingAction={drawerOperatingAction}
        onClose={() => setSelectedProvider(null)}
        onSync={handleDrawerSync}
        onRefreshToken={handleDrawerRefreshToken}
        onDisconnect={handleDrawerDisconnect}
        onReconnect={handleDrawerReconnect}
        onToggleSetting={handleDrawerToggleSetting}
        onOpenMCPSettings={handleOpenMCPSettings}
      />

      {/* Global Search */}
      <IntegrationSearch
        open={showSearch}
        onClose={() => setShowSearch(false)}
        integrations={integrations}
        onSelect={(integration) => {
          setShowSearch(false);
          setSelectedProvider(integrations.find(i => i.provider === integration.provider) || integration);
        }}
        onConnect={handleCardConnect}
      />

      {/* Modals */}
      <TelegramConnectionModal
        isOpen={showTelegramConnectModal}
        onClose={() => setShowTelegramConnectModal(false)}
        onConnect={handleTelegramConnect}
      />
      <DiscordConnectionModal
        isOpen={showDiscordConnectModal}
        onClose={() => setShowDiscordConnectModal(false)}
        onConnect={handleDiscordConnect}
        getInviteUrl={getDiscordInviteUrlAction}
      />
      <WhatsAppConnectionModal
        isOpen={showWhatsAppConnectModal}
        onClose={() => { stopWhatsAppPolling(); setShowWhatsAppConnectModal(false); }}
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
        onGeneratePairingCode={handleWhatsAppGenerateCode}
        onStopPolling={stopWhatsAppPolling}
      />

      {/* Config Alert Modal */}
      {showConfigAlertModal && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface-white neo-border rounded-[28px] max-w-lg w-full overflow-hidden neo-shadow-lg animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b-[2.5px] border-border-mist bg-background-mist flex items-center justify-between">
              <div className="flex items-center gap-2 text-warning">
                <AlertTriangle className="w-5 h-5 animate-pulse" />
                <span className="font-display font-black text-[18px] text-secondary">Developer Setup Required</span>
              </div>
              <button onClick={() => setShowConfigAlertModal(false)} className="p-1.5 hover:bg-black/5 rounded-lg text-text-slate transition-all">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4 text-left">
              <p className="text-[13px] text-text-slate font-medium leading-relaxed">
                Configure Google Client ID and Secret in your environment file.
              </p>
              <div className="space-y-3 bg-background-mist border-[2px] border-secondary p-4 rounded-2xl">
                <h4 className="font-bold text-[12px] uppercase tracking-wider text-secondary">Steps:</h4>
                <ol className="text-[12px] font-medium text-text-ink space-y-2 list-decimal pl-4">
                  <li>Go to <a href="https://console.cloud.google.com" target="_blank" rel="noreferrer" className="text-primary font-bold hover:underline inline-flex items-center gap-0.5">Google Cloud Console <ExternalLink className="w-3 h-3 inline" /></a></li>
                  <li>Create project, enable <strong>Gmail API</strong></li>
                  <li>Configure OAuth Consent Screen</li>
                  <li>Create <strong>OAuth 2.0 Client ID</strong> (Web Application)</li>
                  <li>Set Redirect URI to:
                    <div className="mt-1 p-2 bg-secondary text-white font-mono text-[11px] rounded overflow-x-auto select-all">
                      {`${typeof window !== "undefined" ? window.location.origin : "http://localhost:3000"}/api/gmail-callback`}
                    </div>
                  </li>
                  <li className="mt-1"><strong>Testing:</strong> Add test user emails under OAuth consent screen tab.</li>
                </ol>
              </div>
              <div className="space-y-1">
                <label className="block text-[11px] font-black text-secondary uppercase tracking-wider">.env.local:</label>
                <pre className="p-3.5 bg-secondary text-white border-[2px] border-secondary rounded-xl text-[11px] font-mono select-all overflow-x-auto">
{`GOOGLE_CLIENT_ID="your-client-id"
GOOGLE_CLIENT_SECRET="your-client-secret"
NEXT_PUBLIC_APP_URL="http://localhost:3000"`}
                </pre>
              </div>
              <div className="pt-2 flex justify-end">
                <button onClick={() => setShowConfigAlertModal(false)} className="min-h-[44px] px-8 py-2.5 bg-primary text-white border-[2px] border-primary font-bold text-[14px] rounded-xl hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-flat-sm transition-all cursor-pointer">
                  Got It
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MCP Settings Modal */}
      <MCPSettingsModal
        isOpen={showMCPSettingsModal}
        onClose={() => setShowMCPSettingsModal(false)}
        platform={mcpSettingsPlatform!}
        mcpTools={mcpSettingsTools}
        enabledTools={enabledTools}
        onToggleTool={handleToggleTool}
      />
    </div>
  );
}
