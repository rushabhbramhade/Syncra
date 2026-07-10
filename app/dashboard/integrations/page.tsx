"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { insforge } from "@/lib/insforge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PLATFORM_MCP_TOOLS, MCPTool } from "@/constants/mcp-tools";
import {
  Mail,
  MessageSquare,
  MessageCircle,
  Settings,
  ShieldCheck,
  CheckCircle2,
  Power,
  Terminal,
  Sliders,
  Search,
  ArrowRight,
  CornerDownRight,
  AlertCircle,
  X,
  RefreshCw,
  Send,
  Plus,
  FileText,
  Check,
  Loader2,
  ExternalLink,
  Lock,
  Unlock,
  AlertTriangle,
  Info
} from "lucide-react";

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
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Connection states (persistent via localStorage)
  const [connectedPlatforms, setConnectedPlatforms] = useState<string[]>([]);
  
  // Gmail Inbox States
  const [gmailQuery, setGmailQuery] = useState("is:unread");
  const [gmailLimit, setGmailLimit] = useState(5);
  const [gmailInboxData, setGmailInboxData] = useState<any>(null);
  const [selectedInboxEmail, setSelectedInboxEmail] = useState<any>(null);
  const [emailDetailLoading, setEmailDetailLoading] = useState(false);
  const [emailDetails, setEmailDetails] = useState<any>(null);

  // Modal / Dialog States
  const [showOAuthModal, setShowOAuthModal] = useState(false);
  const [oauthPlatform, setOauthPlatform] = useState<any>(null);
  const [isOauthConnecting, setIsOauthConnecting] = useState(false);
  const [oauthStep, setOauthStep] = useState(1); // 1 = scope consent, 2 = connection progress

  // Settings Modal / MCP Explorer States
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [settingsPlatform, setSettingsPlatform] = useState<any>(null);
  const [selectedTool, setSelectedTool] = useState<MCPTool | null>(null);
  const [toolArguments, setToolArguments] = useState<Record<string, any>>({});
  const [toolMcpRequest, setToolMcpRequest] = useState<string>("");
  const [toolMcpResponse, setToolMcpResponse] = useState<string>("");
  const [isExecutingTool, setIsExecutingTool] = useState(false);
  const [execStatusMsg, setExecStatusMsg] = useState("");

  // Gmail Compose Mock States
  const [showComposeModal, setShowComposeModal] = useState(false);
  const [composeTo, setComposeTo] = useState("");
  const [composeSubject, setComposeSubject] = useState("");
  const [composeBody, setComposeBody] = useState("");
  const [isSendingEmail, setIsSendingEmail] = useState(false);

  // Authenticate user session
  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data, error } = await insforge.auth.getCurrentUser();
        if (error || !data?.user) {
          router.push("/sign-in");
          return;
        }
        setUser(data.user);

        // Load connections from localStorage
        const stored = localStorage.getItem("syncra-connected-platforms");
        if (stored) {
          try {
            setConnectedPlatforms(JSON.parse(stored));
          } catch (e) {
            console.error("Failed to parse connected platforms:", e);
          }
        } else {
          // Default mock connections matching Dashboard page
          const defaults = ["gmail", "slack"];
          setConnectedPlatforms(defaults);
          localStorage.setItem("syncra-connected-platforms", JSON.stringify(defaults));
        }
      } catch (err) {
        console.error(err);
        router.push("/sign-in");
      } finally {
        setIsLoading(false);
      }
    };
    checkSession();
  }, [router]);

  // Handle Gmail Inbox updates when Gmail is connected
  useEffect(() => {
    if (connectedPlatforms.includes("gmail")) {
      fetchGmailInbox();
    } else {
      setGmailInboxData(null);
    }
  }, [connectedPlatforms, gmailQuery, gmailLimit]);

  const fetchGmailInbox = () => {
    try {
      const tool = PLATFORM_MCP_TOOLS.gmail.find(t => t.name === "gmail_search_emails");
      if (tool) {
        const result = tool.execute({ query: gmailQuery, limit: gmailLimit });
        setGmailInboxData(result);
      }
    } catch (e) {
      console.error("Failed to search Gmail emails:", e);
    }
  };

  const handleFetchEmailDetail = (id: string) => {
    setSelectedInboxEmail(id);
    setEmailDetailLoading(true);
    setTimeout(() => {
      try {
        const tool = PLATFORM_MCP_TOOLS.gmail.find(t => t.name === "gmail_get_email");
        if (tool) {
          const result = tool.execute({ messageId: id });
          if (result.status === "success") {
            setEmailDetails(result.message);
          } else {
            setEmailDetails(null);
          }
        }
      } catch (e) {
        console.error(e);
      } finally {
        setEmailDetailLoading(false);
      }
    }, 400);
  };

  // Connect/Disconnect flow
  const handleConnectClick = (platform: any) => {
    setOauthPlatform(platform);
    setOauthStep(1);
    setShowOAuthModal(true);
  };

  const handleConfirmConnection = () => {
    setIsOauthConnecting(true);
    setOauthStep(2);
    
    // Simulate MCP authentication handshake
    setTimeout(() => {
      const nextList = [...connectedPlatforms, oauthPlatform.id];
      setConnectedPlatforms(nextList);
      localStorage.setItem("syncra-connected-platforms", JSON.stringify(nextList));
      setIsOauthConnecting(false);
      setShowOAuthModal(false);
    }, 2000);
  };

  const handleDisconnectPlatform = (platformId: string) => {
    const nextList = connectedPlatforms.filter(id => id !== platformId);
    setConnectedPlatforms(nextList);
    localStorage.setItem("syncra-connected-platforms", JSON.stringify(nextList));
    
    if (platformId === "gmail") {
      setGmailInboxData(null);
    }
  };

  // Settings modal / MCP Tool execution
  const handleSettingsClick = (platform: any) => {
    setSettingsPlatform(platform);
    const tools = PLATFORM_MCP_TOOLS[platform.id] || [];
    const firstTool = tools[0] || null;
    setSelectedTool(firstTool);
    
    // Initialize tool arguments
    if (firstTool) {
      const initialArgs: Record<string, any> = {};
      firstTool.arguments.forEach(arg => {
        initialArgs[arg.name] = arg.defaultValue !== undefined ? arg.defaultValue : "";
      });
      setToolArguments(initialArgs);
      setToolMcpRequest("");
      setToolMcpResponse("");
      setExecStatusMsg("");
    }
    
    setShowSettingsModal(true);
  };

  const handleSelectTool = (tool: MCPTool) => {
    setSelectedTool(tool);
    const initialArgs: Record<string, any> = {};
    tool.arguments.forEach(arg => {
      initialArgs[arg.name] = arg.defaultValue !== undefined ? arg.defaultValue : "";
    });
    setToolArguments(initialArgs);
    setToolMcpRequest("");
    setToolMcpResponse("");
    setExecStatusMsg("");
  };

  const handleArgChange = (name: string, value: any) => {
    setToolArguments(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleExecuteMCPTool = () => {
    if (!selectedTool) return;
    setIsExecutingTool(true);
    setExecStatusMsg("Initializing JSON-RPC payload over stdio transport...");

    // Format request JSON
    const requestPayload = {
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        name: selectedTool.name,
        arguments: toolArguments,
      },
      id: Math.floor(Math.random() * 1000) + 1,
    };
    setToolMcpRequest(JSON.stringify(requestPayload, null, 2));
    setToolMcpResponse("");

    // Simulate execution latency
    setTimeout(() => {
      setExecStatusMsg("Sending payload to MCP server process...");
      setTimeout(() => {
        setExecStatusMsg("Parsing Response stream...");
        try {
          const result = selectedTool.execute(toolArguments);
          const responsePayload = {
            jsonrpc: "2.0",
            result: result,
            id: requestPayload.id,
          };
          setToolMcpResponse(JSON.stringify(responsePayload, null, 2));
          
          // If we run Gmail tools, refresh inbox UI reactively
          if (settingsPlatform?.id === "gmail") {
            fetchGmailInbox();
          }
        } catch (err: any) {
          setToolMcpResponse(JSON.stringify({
            jsonrpc: "2.0",
            error: {
              code: -32003,
              message: err.message || "MCP tool execution failed.",
            },
            id: requestPayload.id,
          }, null, 2));
        } finally {
          setIsExecutingTool(false);
          setExecStatusMsg("");
        }
      }, 600);
    }, 600);
  };

  // Sent mail tool mock execution
  const handleSendCompose = () => {
    if (!composeTo || !composeSubject || !composeBody) return;
    setIsSendingEmail(true);
    
    setTimeout(() => {
      const tool = PLATFORM_MCP_TOOLS.gmail.find(t => t.name === "gmail_send_email");
      if (tool) {
        tool.execute({ to: composeTo, subject: composeSubject, body: composeBody });
        fetchGmailInbox();
      }
      setIsSendingEmail(false);
      setShowComposeModal(false);
      
      // Clear inputs
      setComposeTo("");
      setComposeSubject("");
      setComposeBody("");
    }, 1200);
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
          <p className="font-bold text-secondary text-lg">Initializing Integrations Page...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-16 font-sans">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-10 gap-4">
        <div>
          <h1 className="font-display font-black text-4xl text-secondary mb-2 tracking-tight">
            Integrations Workspace
          </h1>
          <p className="text-text-slate text-[16px] font-medium max-w-2xl leading-relaxed">
            Configure automated sync endpoints. Once linked, you can use the Model Context Protocol (MCP) console explorer to search, fetch, and trigger actions.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-4 py-2 bg-success-bg border-[2.5px] border-success text-success font-black text-[14px] rounded-xl shadow-flat-sm">
            <ShieldCheck className="w-5 h-5" />
            <span>MCP Hub Secure</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Left 2 Columns: Integrations Grid */}
        <div className="lg:col-span-2 space-y-8">
          <Card className="neo-border neo-shadow-md bg-surface-white">
            <div className="border-b-[2.5px] border-border-mist pb-6 mb-6">
              <h2 className="font-display font-black text-2xl text-secondary mb-1">
                Communication & Mail Channels
              </h2>
              <p className="text-text-slate text-[15px] font-medium">
                Connect external accounts. Hover to reveal card elevation controls.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {PLATFORMS.map((platform) => {
                const isConnected = connectedPlatforms.includes(platform.id);
                return (
                  <div
                    key={platform.id}
                    className={`relative p-6 rounded-[22px] border-[2.5px] bg-surface-white flex flex-col justify-between min-h-[260px] transition-all ${
                      isConnected
                        ? "border-secondary dark:border-white shadow-flat-md"
                        : "border-border-mist opacity-70 hover:opacity-100 hover:border-text-fog"
                    }`}
                  >
                    {/* Header */}
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <div className="w-14 h-14 rounded-2xl bg-background-mist border-[1.5px] border-border-mist flex items-center justify-center overflow-hidden">
                          {platform.icon ? (
                            <img
                              src={platform.icon}
                              alt={platform.name}
                              className="w-9 h-9 object-contain"
                            />
                          ) : platform.id === "linkedin" ? (
                            renderLinkedInIcon()
                          ) : (
                            renderGitHubIcon()
                          )}
                        </div>

                        {isConnected ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-success-bg border-[1.5px] border-success text-success text-[12px] font-bold rounded-lg">
                            <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                            Connected
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-background-mist border-[1.5px] border-border-mist text-text-slate text-[12px] font-medium rounded-lg">
                            Offline
                          </span>
                        )}
                      </div>

                      <h3 className="font-display font-black text-xl text-secondary mb-2">
                        {platform.name}
                      </h3>
                      
                      {/* Two-line description limitation */}
                      <p className="text-text-slate text-[13px] font-medium leading-relaxed line-clamp-2 mb-4">
                        {platform.description}
                      </p>
                    </div>

                    {/* Buttons */}
                    <div className="flex items-center gap-2.5 mt-auto">
                      {isConnected ? (
                        <>
                          <button
                            onClick={() => handleDisconnectPlatform(platform.id)}
                            className="flex-1 min-h-[40px] px-4 py-2 bg-error-bg border-[2px] border-error text-error font-bold text-[14px] rounded-xl hover:bg-error hover:text-white transition-all duration-200 cursor-pointer"
                          >
                            Disconnect
                          </button>
                          
                          <button
                            onClick={() => handleSettingsClick(platform)}
                            title="MCP Tools & Settings"
                            className="min-h-[40px] px-3 bg-surface-white border-[2px] border-secondary text-secondary font-bold text-[14px] rounded-xl hover:bg-background-mist transition-all duration-200 cursor-pointer flex items-center justify-center"
                          >
                            <Settings className="w-4.5 h-4.5" />
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => handleConnectClick(platform)}
                          className="w-full min-h-[40px] px-4 py-2 bg-primary text-white border-[2px] border-primary font-bold text-[14px] rounded-xl hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-flat-sm active:translate-x-0 active:translate-y-0 active:shadow-none transition-all duration-200 cursor-pointer"
                        >
                          Connect Platform
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        {/* Right 1 Column: Gmail Live Stream (Functional using MCP Simulation) */}
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
              <span className="text-[10px] font-mono font-bold bg-primary/10 border-[1.5px] border-primary text-primary px-2 py-0.5 rounded-full">
                MCP CLIENT
              </span>
            </div>

            {connectedPlatforms.includes("gmail") ? (
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

                {/* Unread & Query badges */}
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
                {gmailInboxData && gmailInboxData.messages && gmailInboxData.messages.length > 0 ? (
                  <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
                    {gmailInboxData.messages.map((email: any) => (
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
                            {email.from.split(" <")[0]}
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

                        {email.labels.includes("UNREAD") && (
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
                      No emails match the current search query.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-8 border-[2.5px] border-dashed border-border-mist rounded-[18px] text-center space-y-4 bg-background-mist/30">
                <Lock className="w-9 h-9 text-text-fog mx-auto" />
                <div>
                  <h3 className="font-bold text-secondary text-[15px]">Gmail Disconnected</h3>
                  <p className="text-text-slate text-[12px] max-w-[200px] mx-auto mt-1 leading-relaxed">
                    Connect Gmail to activate the live inbox stream fetched via Gmail MCP.
                  </p>
                </div>
                <Button
                  onClick={() => {
                    const gmail = PLATFORMS.find(p => p.id === "gmail");
                    handleConnectClick(gmail);
                  }}
                  variant="secondary"
                  size="sm"
                  className="w-full text-[13px] min-h-[38px] py-2 border-[2px] border-secondary"
                >
                  Connect Gmail Now
                </Button>
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* ── Modal: OAuth Google Consent Mock ── */}
      {showOAuthModal && oauthPlatform && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface-white neo-border rounded-[28px] max-w-md w-full overflow-hidden neo-shadow-lg animate-in fade-in zoom-in duration-200">
            {/* Modal Header */}
            <div className="p-6 border-b-[2.5px] border-border-mist bg-background-mist flex items-center justify-between">
              <div className="flex items-center gap-3">
                <img src="/logo.png" alt="Syncra" className="w-6 h-6 object-contain" />
                <span className="font-display font-black text-[18px] text-secondary">
                  Authorize Syncra Integration
                </span>
              </div>
              <button
                onClick={() => setShowOAuthModal(false)}
                className="p-1.5 hover:bg-black/5 rounded-lg text-text-slate transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {oauthStep === 1 ? (
              <div className="p-6 space-y-6">
                <div className="text-center space-y-3">
                  <div className="w-16 h-16 rounded-2xl bg-background-mist border-[1.5px] border-border-mist flex items-center justify-center mx-auto shadow-flat-sm">
                    {oauthPlatform.icon ? (
                      <img src={oauthPlatform.icon} alt={oauthPlatform.name} className="w-10 h-10 object-contain" />
                    ) : oauthPlatform.id === "linkedin" ? (
                      renderLinkedInIcon()
                    ) : (
                      renderGitHubIcon()
                    )}
                  </div>
                  <div>
                    <h3 className="font-display font-black text-xl text-secondary">
                      Connect {oauthPlatform.name}
                    </h3>
                    <p className="text-text-slate text-[13px] font-medium mt-1">
                      via standard secure Model Context Protocol gateway.
                    </p>
                  </div>
                </div>

                <div className="p-4 bg-info-bg border-[1.5px] border-info rounded-xl text-left space-y-2.5">
                  <div className="flex gap-2 text-info">
                    <ShieldCheck className="w-5 h-5 shrink-0 mt-0.5" />
                    <span className="font-bold text-[13px]">Requested Security Permissions</span>
                  </div>
                  <ul className="text-[12px] font-medium text-text-ink space-y-2 pl-6 list-disc">
                    <li>Read your personal profile and primary email logs.</li>
                    {oauthPlatform.id === "gmail" && (
                      <>
                        <li>Access your inbox feed & emails via Gmail MCP endpoints.</li>
                        <li>Create draft responses and send mails.</li>
                      </>
                    )}
                    {oauthPlatform.id === "slack" && (
                      <>
                        <li>Access public channels metadata & read channel histories.</li>
                        <li>Post text payloads as integration webhook.</li>
                      </>
                    )}
                    {oauthPlatform.id !== "gmail" && oauthPlatform.id !== "slack" && (
                      <li>Read active chat streams and trigger response nodes.</li>
                    )}
                  </ul>
                </div>

                {/* Transport selector explanation */}
                <div className="text-left">
                  <label className="block text-[12px] font-black text-secondary uppercase tracking-wider mb-1.5">
                    MCP Integration Protocol
                  </label>
                  <div className="p-3 bg-background-mist border-[2px] border-secondary dark:border-white rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-2 font-mono text-[12px] text-secondary font-bold">
                      <Terminal className="w-4 h-4 text-primary" />
                      <span>stdio_transport_client</span>
                    </div>
                    <span className="text-[10px] font-bold text-success bg-success-bg px-2 py-0.5 border border-success rounded">
                      ACTIVE
                    </span>
                  </div>
                </div>

                {/* Consent actions */}
                <div className="flex gap-3 pt-2">
                  <Button
                    onClick={() => setShowOAuthModal(false)}
                    variant="secondary"
                    className="flex-1 min-h-[44px] py-2 border-[2px] border-secondary"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleConfirmConnection}
                    className="flex-1 min-h-[44px] py-2 bg-primary text-white"
                  >
                    Authorize Access
                  </Button>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center space-y-6">
                {/* Connecting feedback */}
                <div className="relative w-20 h-20 mx-auto">
                  <div className="absolute inset-0 rounded-full border-[4px] border-primary/20 border-t-primary animate-spin" />
                  <div className="absolute inset-2 bg-background-mist border-[1.5px] border-border-mist rounded-full flex items-center justify-center">
                    <Power className="w-6 h-6 text-primary animate-pulse" />
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="font-display font-black text-lg text-secondary">
                    Linking with {oauthPlatform.name} MCP Server
                  </h3>
                  <div className="flex flex-col items-center gap-1.5">
                    <span className="text-text-slate font-mono text-[12px] animate-pulse">
                      Initializing stdio pipeline...
                    </span>
                    <span className="text-[11px] text-text-fog font-medium">
                      Establishing connection to local tools registry
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Modal: Gmail Email Content Viewer ── */}
      {selectedInboxEmail && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
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
                    Running `gmail_get_email` MCP tool query...
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
                    <span>Protocol: jsonrpc-stdio-2.0</span>
                    <span className="text-success font-bold">Status: OK</span>
                  </div>
                </div>
              ) : (
                <div className="py-6 text-center text-error space-y-2">
                  <AlertCircle className="w-8 h-8 mx-auto" />
                  <p className="font-bold">Failed to load email details.</p>
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
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface-white neo-border rounded-[28px] max-w-lg w-full overflow-hidden neo-shadow-lg animate-in fade-in zoom-in duration-200">
            {/* Header */}
            <div className="p-6 border-b-[2.5px] border-border-mist bg-background-mist flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mail className="w-5 h-5 text-primary" />
                <span className="font-display font-black text-[18px] text-secondary">
                  Compose Email (via Gmail MCP)
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
                  To Recipient
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

      {/* ── Modal: Settings / MCP Explorer ── */}
      {showSettingsModal && settingsPlatform && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface-white neo-border rounded-[28px] max-w-4xl w-full overflow-hidden neo-shadow-lg flex flex-col md:flex-row h-[90vh] md:h-[680px] animate-in fade-in zoom-in duration-200 text-left">
            
            {/* Left sidebar: MCP tools selector list */}
            <div className="w-full md:w-[280px] border-b-[2.5px] md:border-b-0 md:border-r-[2.5px] border-border-mist bg-background-mist flex flex-col">
              {/* Header */}
              <div className="p-5 border-b-[2px] border-border-mist flex items-center gap-3">
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
                    {settingsPlatform.name} MCP
                  </h3>
                  <span className="text-[10px] font-bold text-success flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                    Protocol Connected
                  </span>
                </div>
              </div>

              {/* Tools list */}
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                <span className="block text-[11px] font-black text-text-slate uppercase tracking-wider mb-2">
                  Exposed MCP Tools
                </span>
                {(PLATFORM_MCP_TOOLS[settingsPlatform.id] || []).map((tool) => (
                  <button
                    key={tool.name}
                    onClick={() => handleSelectTool(tool)}
                    className={`w-full p-3 text-left rounded-xl border-[2px] transition-all cursor-pointer font-mono text-[12px] flex items-center gap-2 ${
                      selectedTool?.name === tool.name
                        ? "border-primary bg-primary/5 text-primary font-bold"
                        : "border-transparent text-text-slate hover:bg-black/5"
                    }`}
                  >
                    <Sliders className="w-3.5 h-3.5" />
                    <span className="truncate">{tool.name}</span>
                  </button>
                ))}
                {(PLATFORM_MCP_TOOLS[settingsPlatform.id] || []).length === 0 && (
                  <p className="text-[12px] text-text-slate italic p-4">No tools registered.</p>
                )}
              </div>
            </div>

            {/* Right side: Tool details & console execution */}
            <div className="flex-1 flex flex-col overflow-hidden bg-surface-white">
              {/* Tool top header */}
              <div className="p-5 border-b-[2px] border-border-mist flex justify-between items-center">
                <div>
                  <h3 className="font-mono font-bold text-[16px] text-secondary">
                    {selectedTool?.name || "Select a tool"}
                  </h3>
                  <p className="text-text-slate text-[13px] font-medium mt-1">
                    {selectedTool?.description || "Select an MCP tool from the sidebar to inspect its JSON schema and execute it."}
                  </p>
                </div>
                <button
                  onClick={() => setShowSettingsModal(false)}
                  className="p-1.5 hover:bg-black/5 rounded-lg text-text-slate transition-all shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {selectedTool ? (
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  {/* JSON Schema */}
                  <div className="space-y-2">
                    <span className="block text-[11px] font-black text-secondary uppercase tracking-wider">
                      Input Argument Schema
                    </span>
                    <pre className="p-4 bg-background-mist border-[2.5px] border-secondary dark:border-white rounded-xl text-[12px] font-mono text-secondary overflow-x-auto max-h-[120px] scrollbar-hide">
                      {JSON.stringify(selectedTool.inputSchema, null, 2)}
                    </pre>
                  </div>

                  {/* Input Arguments Form */}
                  {selectedTool.arguments.length > 0 && (
                    <div className="space-y-4">
                      <span className="block text-[11px] font-black text-secondary uppercase tracking-wider">
                        Configure Arguments
                      </span>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {selectedTool.arguments.map((arg) => (
                          <div key={arg.name} className="space-y-1.5 col-span-1 md:col-span-2">
                            <label className="block text-[12px] font-bold text-secondary">
                              {arg.label} <span className="font-mono text-[11px] text-text-slate">({arg.name})</span>
                              {arg.required && <span className="text-error ml-1">*</span>}
                            </label>
                            {arg.type === "textarea" ? (
                              <textarea
                                value={toolArguments[arg.name] || ""}
                                onChange={(e) => handleArgChange(arg.name, e.target.value)}
                                placeholder={arg.placeholder}
                                rows={3}
                                className="w-full p-3 bg-background-mist border-[2px] border-secondary dark:border-white rounded-xl text-[13px] outline-none"
                              />
                            ) : arg.type === "number" ? (
                              <input
                                type="number"
                                value={toolArguments[arg.name] || ""}
                                onChange={(e) => handleArgChange(arg.name, Number(e.target.value))}
                                placeholder={arg.placeholder}
                                className="w-full h-11 px-4 bg-background-mist border-[2px] border-secondary dark:border-white rounded-xl text-[13px] outline-none"
                              />
                            ) : arg.type === "boolean" ? (
                              <div className="flex items-center gap-2 py-2">
                                <input
                                  type="checkbox"
                                  checked={!!toolArguments[arg.name]}
                                  onChange={(e) => handleArgChange(arg.name, e.target.checked)}
                                  className="w-5 h-5 accent-primary cursor-pointer border-[2px] border-secondary rounded"
                                />
                                <span className="text-[13px] text-secondary">Enable flag</span>
                              </div>
                            ) : (
                              <input
                                type="text"
                                value={toolArguments[arg.name] || ""}
                                onChange={(e) => handleArgChange(arg.name, e.target.value)}
                                placeholder={arg.placeholder}
                                className="w-full h-11 px-4 bg-background-mist border-[2px] border-secondary dark:border-white rounded-xl text-[13px] outline-none"
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Execution Action */}
                  <div className="pt-2 flex justify-start">
                    <Button
                      onClick={handleExecuteMCPTool}
                      isLoading={isExecutingTool}
                      className="min-h-[44px] px-8 bg-primary text-white flex gap-2 items-center text-[15px]"
                    >
                      <Terminal className="w-4.5 h-4.5" />
                      <span>Execute Tool via MCP</span>
                    </Button>
                  </div>

                  {/* Terminal Console log / Outputs */}
                  {(isExecutingTool || execStatusMsg || toolMcpRequest || toolMcpResponse) && (
                    <div className="space-y-4">
                      <span className="block text-[11px] font-black text-secondary uppercase tracking-wider">
                        MCP JSON-RPC Console Output
                      </span>
                      
                      <div className="bg-[#0f172a] text-white p-5 rounded-2xl font-mono text-[12px] space-y-4 overflow-hidden border-[2.5px] border-[#0f172a] shadow-inner">
                        {execStatusMsg && (
                          <div className="flex items-center gap-2 text-primary">
                            <span className="w-2 h-2 rounded-full bg-primary animate-ping" />
                            <span>{execStatusMsg}</span>
                          </div>
                        )}

                        {toolMcpRequest && (
                          <div className="space-y-1 text-left">
                            <span className="text-[#a78bfa] font-bold block">// client --&gt; server (request)</span>
                            <pre className="bg-[#1e293b] p-3 rounded-lg overflow-x-auto text-[11px]">
                              {toolMcpRequest}
                            </pre>
                          </div>
                        )}

                        {toolMcpResponse && (
                          <div className="space-y-1 text-left">
                            <span className="text-[#34d399] font-bold block">// client &lt;-- server (response)</span>
                            <pre className="bg-[#1e293b] p-3 rounded-lg overflow-x-auto text-[11px]">
                              {toolMcpResponse}
                            </pre>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-text-slate p-6">
                  <Terminal className="w-12 h-12 text-text-fog mb-2" />
                  <p className="font-bold">No tool selected</p>
                </div>
              )}
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
