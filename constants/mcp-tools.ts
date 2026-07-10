export interface ToolArgument {
  name: string;
  label: string;
  type: "string" | "number" | "boolean" | "textarea";
  placeholder?: string;
  defaultValue?: string | number | boolean;
  required?: boolean;
}

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, any>;
    required?: string[];
  };
  arguments: ToolArgument[];
  execute: (args: Record<string, any>) => any;
}

export const PLATFORM_MCP_TOOLS: Record<string, MCPTool[]> = {
  gmail: [
    {
      name: "gmail_search_emails",
      description: "Search emails in the inbox using Gmail query syntax (e.g., is:unread, from:boss).",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query syntax matching Gmail filters." },
          limit: { type: "number", description: "Max number of messages to fetch (default: 10)." },
        },
        required: ["query"],
      },
      arguments: [
        { name: "query", label: "Search Query", type: "string", placeholder: "is:unread from:google", defaultValue: "is:unread", required: true },
        { name: "limit", label: "Limit Results", type: "number", placeholder: "5", defaultValue: 5 },
      ],
      execute: (args) => {
        const query = (args.query || "").toLowerCase();
        const limit = Number(args.limit || 5);
        
        // Mock database of emails
        const emails = [
          { id: "msg_101", from: "google-security@google.com", subject: "Critical security alert for Syncra workspace", date: "Today, 10:45 AM", snippet: "We detected a login to your synced account from a new browser session.", unread: true },
          { id: "msg_102", from: "alex.d@company.com", subject: "Urgent: Project timeline adjustments for Q3", date: "Today, 9:15 AM", snippet: "Hi team, we need to push back the integrations page deploy by 2 days.", unread: true },
          { id: "msg_103", from: "notifications@github.com", subject: "[GitHub] Pull Request #42 merged: feat/theme-toggle", date: "Yesterday, 6:02 PM", snippet: "User rushabhb merged commit ae82fd into main.", unread: false },
          { id: "msg_104", from: "newsletter@sub-stack.com", subject: "The Future of AI Agent Interfaces and MCP Protocol", date: "Yesterday, 3:30 PM", snippet: "How Model Context Protocol is changing backend engineering forever.", unread: true },
          { id: "msg_105", from: "billing@insforge.app", subject: "Your InsForge Invoice for June 2026 is ready", date: "July 2, 2026", snippet: "Thank you for using InsForge. Your credit card ending in 4242 was charged $15.00.", unread: false },
          { id: "msg_106", from: "sarah.m@company.com", subject: "Syncra weekly design sync review notes", date: "July 1, 2026", snippet: "Attached are the wireframes and Figma specs for the new integration grid layout.", unread: false },
        ];

        let filtered = emails;
        if (query) {
          if (query.includes("is:unread")) {
            filtered = filtered.filter(e => e.unread);
          }
          if (query.includes("from:")) {
            const sender = query.split("from:")[1]?.split(" ")[0] || "";
            filtered = filtered.filter(e => e.from.toLowerCase().includes(sender));
          }
          if (query.includes("subject:")) {
            const subj = query.split("subject:")[1]?.split(" ")[0] || "";
            filtered = filtered.filter(e => e.subject.toLowerCase().includes(subj));
          }
        }

        return {
          status: "success",
          count: Math.min(filtered.length, limit),
          messages: filtered.slice(0, limit).map(m => ({
            id: m.id,
            threadId: `thread_${m.id.split("_")[1]}`,
            from: m.from,
            subject: m.subject,
            snippet: m.snippet,
            date: m.date,
            labels: m.unread ? ["INBOX", "UNREAD"] : ["INBOX"],
          })),
        };
      },
    },
    {
      name: "gmail_get_email",
      description: "Retrieve full content, headers, and metadata for a specific email message ID.",
      inputSchema: {
        type: "object",
        properties: {
          messageId: { type: "string", description: "The unique Gmail message ID." },
        },
        required: ["messageId"],
      },
      arguments: [
        { name: "messageId", label: "Message ID", type: "string", placeholder: "msg_101", defaultValue: "msg_101", required: true },
      ],
      execute: (args) => {
        const id = args.messageId;
        const detailsMap: Record<string, any> = {
          msg_101: {
            id: "msg_101",
            from: "Google Security <google-security@google.com>",
            to: "user@syncra.io",
            subject: "Critical security alert for Syncra workspace",
            date: "Friday, Jul 10, 2026 at 10:45 AM",
            body: "Hello User,\n\nWe detected a login attempt to your Syncra Google Workspace account from a new Windows device near Pune, India.\n\nIf this was you, no action is required. If you do not recognize this activity, please secure your credentials immediately.\n\nBest,\nGoogle Security Team",
          },
          msg_102: {
            id: "msg_102",
            from: "Alex Dev <alex.d@company.com>",
            to: "team@syncra.io",
            subject: "Urgent: Project timeline adjustments for Q3",
            date: "Friday, Jul 10, 2026 at 9:15 AM",
            body: "Hi team,\n\nWe've hit a small snag with the OAuth redirect configuration. I need to make some updates to the redirect URL handlers inside InsForge backend. \n\nI suggest pushing the Integrations page deployment back by 2 days. Let me know if that blocks anyone.\n\nThanks,\nAlex",
          },
        };

        if (detailsMap[id]) {
          return {
            status: "success",
            message: detailsMap[id],
          };
        }

        return {
          status: "error",
          code: "NOT_FOUND",
          message: `Gmail message with ID "${id}" could not be retrieved.`,
        };
      },
    },
    {
      name: "gmail_send_email",
      description: "Send a new email message to a specified recipient with subject and body.",
      inputSchema: {
        type: "object",
        properties: {
          to: { type: "string", description: "Email address of the recipient." },
          subject: { type: "string", description: "Subject of the email." },
          body: { type: "string", description: "Plain-text or HTML email body content." },
        },
        required: ["to", "subject", "body"],
      },
      arguments: [
        { name: "to", label: "Recipient Email", type: "string", placeholder: "colleague@company.com", required: true },
        { name: "subject", label: "Subject", type: "string", placeholder: "Status Update", required: true },
        { name: "body", label: "Message Body", type: "textarea", placeholder: "Write your message here...", required: true },
      ],
      execute: (args) => {
        return {
          status: "success",
          messageId: `msg_${Math.floor(Math.random() * 90000) + 10000}`,
          info: {
            to: args.to,
            subject: args.subject,
            sentAt: new Date().toISOString(),
          },
        };
      },
    },
    {
      name: "gmail_create_draft",
      description: "Create a draft email in the user's Gmail account.",
      inputSchema: {
        type: "object",
        properties: {
          to: { type: "string" },
          subject: { type: "string" },
          body: { type: "string" },
        },
        required: ["to", "subject"],
      },
      arguments: [
        { name: "to", label: "Recipient Email", type: "string", placeholder: "client@example.com", required: true },
        { name: "subject", label: "Subject", type: "string", placeholder: "Quote Proposal", required: true },
        { name: "body", label: "Draft Content", type: "textarea", placeholder: "Write draft content..." },
      ],
      execute: (args) => {
        return {
          status: "success",
          draftId: `draft_${Math.floor(Math.random() * 90000) + 10000}`,
          message: "Draft saved successfully.",
        };
      },
    },
    {
      name: "gmail_list_labels",
      description: "List all standard system and user-defined Gmail labels.",
      inputSchema: {
        type: "object",
        properties: {},
      },
      arguments: [],
      execute: () => {
        return {
          status: "success",
          labels: [
            { id: "INBOX", name: "INBOX", type: "system" },
            { id: "UNREAD", name: "UNREAD", type: "system" },
            { id: "STARRED", name: "STARRED", type: "system" },
            { id: "IMPORTANT", name: "IMPORTANT", type: "system" },
            { id: "SENT", name: "SENT", type: "system" },
            { id: "DRAFT", name: "DRAFT", type: "system" },
            { id: "TRASH", name: "TRASH", type: "system" },
            { id: "SPAM", name: "SPAM", type: "system" },
            { id: "Label_1", name: "Syncra Projects", type: "user" },
            { id: "Label_2", name: "Invoices", type: "user" },
          ],
        };
      },
    },
  ],
  slack: [
    {
      name: "slack_post_message",
      description: "Post a message to a channel or direct message in the Slack workspace.",
      inputSchema: {
        type: "object",
        properties: {
          channel: { type: "string", description: "Channel name or ID (e.g. #general, C12345)." },
          text: { type: "string", description: "The message text to send." },
        },
        required: ["channel", "text"],
      },
      arguments: [
        { name: "channel", label: "Slack Channel", type: "string", placeholder: "#general", defaultValue: "#general", required: true },
        { name: "text", label: "Message", type: "textarea", placeholder: "Hello from Syncra!", required: true },
      ],
      execute: (args) => {
        return {
          status: "success",
          channel: args.channel,
          ts: `${Date.now() / 1000}.000100`,
          message: {
            text: args.text,
            username: "Syncra AI Integration",
            bot_id: "B012345",
          },
        };
      },
    },
    {
      name: "slack_list_channels",
      description: "List all public channels available in the Slack workspace.",
      inputSchema: { type: "object", properties: {} },
      arguments: [],
      execute: () => {
        return {
          status: "success",
          channels: [
            { id: "C101", name: "general", topic: "Workspace-wide announcements and work-based matters" },
            { id: "C102", name: "random", topic: "Non-work banter and water cooler chat" },
            { id: "C103", name: "syncra-dev", topic: "Development discussion for the Syncra app" },
            { id: "C104", name: "marketing", topic: "Brand guidelines and design assets discussions" },
          ],
        };
      },
    },
    {
      name: "slack_get_history",
      description: "Retrieve message history for a public channel or direct message thread.",
      inputSchema: {
        type: "object",
        properties: {
          channel: { type: "string" },
          limit: { type: "number" },
        },
        required: ["channel"],
      },
      arguments: [
        { name: "channel", label: "Channel ID or Name", type: "string", placeholder: "#syncra-dev", defaultValue: "#syncra-dev", required: true },
        { name: "limit", label: "Max Messages", type: "number", defaultValue: 5 },
      ],
      execute: (args) => {
        return {
          status: "success",
          channel: args.channel,
          messages: [
            { user: "U123", text: "Has anyone pushed the theme toggle fixes to the main branch?", ts: "1719398200.00" },
            { user: "U456", text: "Yes, I did that yesterday. Everything seems to be building fine on Vercel.", ts: "1719398250.00" },
            { user: "U123", text: "Awesome, thanks. Now we just need to get the Integrations screen completed.", ts: "1719398300.00" },
          ],
        };
      },
    },
  ],
  whatsapp: [
    {
      name: "whatsapp_send_message",
      description: "Send a text message to a WhatsApp number.",
      inputSchema: {
        type: "object",
        properties: {
          to: { type: "string", description: "WhatsApp number in international format." },
          message: { type: "string", description: "Body of the message." },
        },
        required: ["to", "message"],
      },
      arguments: [
        { name: "to", label: "WhatsApp Number", type: "string", placeholder: "+919876543210", required: true },
        { name: "message", label: "Message", type: "textarea", placeholder: "Hi! Sent from Syncra.", required: true },
      ],
      execute: (args) => {
        return {
          status: "success",
          to: args.to,
          messageId: `wamid.HBgLOTE5ODc2NTQzMjEwFQIAERg2REI3MzRFOEMzN0NEQzQwRDMA`,
          timestamp: new Date().toISOString(),
        };
      },
    },
    {
      name: "whatsapp_get_chats",
      description: "List recent active chat threads on WhatsApp.",
      inputSchema: { type: "object", properties: {} },
      arguments: [],
      execute: () => {
        return {
          status: "success",
          chats: [
            { id: "919876543210@c.us", name: "John Doe", lastMessage: "Are we meeting today?", unreadCount: 1 },
            { id: "918765432109@c.us", name: "Family Group", lastMessage: "Mom: Happy birthday!", unreadCount: 0 },
            { id: "917654321098@c.us", name: "Design Lead", lastMessage: "Please check the new icon files.", unreadCount: 3 },
          ],
        };
      },
    },
  ],
  outlook: [
    {
      name: "outlook_list_messages",
      description: "Retrieve a list of messages from Outlook inbox.",
      inputSchema: {
        type: "object",
        properties: {
          limit: { type: "number" },
        },
      },
      arguments: [
        { name: "limit", label: "Limit Results", type: "number", defaultValue: 5 },
      ],
      execute: (args) => {
        return {
          status: "success",
          value: [
            { id: "out_001", from: "microsoft-teams@microsoft.com", subject: "Weekly digest of channels activity", sentDateTime: new Date().toISOString() },
            { id: "out_002", from: "newsletter@techcrunch.com", subject: "Daily Crunch: Tech Funding Updates", sentDateTime: new Date().toISOString() },
          ],
        };
      },
    },
  ],
  discord: [
    {
      name: "discord_post_message",
      description: "Post a text message to a specific Discord channel ID via Webhook.",
      inputSchema: {
        type: "object",
        properties: {
          channelId: { type: "string" },
          content: { type: "string" },
        },
        required: ["channelId", "content"],
      },
      arguments: [
        { name: "channelId", label: "Discord Channel ID", type: "string", placeholder: "1029384756", required: true },
        { name: "content", label: "Content", type: "textarea", placeholder: "Sending alerts from Syncra!", required: true },
      ],
      execute: (args) => {
        return {
          status: "success",
          messageId: `11029384756182938`,
          channelId: args.channelId,
          content: args.content,
        };
      },
    },
  ],
  telegram: [
    {
      name: "telegram_send_message",
      description: "Send a message through the Bot API to a specific Chat ID.",
      inputSchema: {
        type: "object",
        properties: {
          chatId: { type: "string" },
          text: { type: "string" },
        },
        required: ["chatId", "text"],
      },
      arguments: [
        { name: "chatId", label: "Telegram Chat ID", type: "string", placeholder: "@syncra_alerts", required: true },
        { name: "text", label: "Message Text", type: "textarea", placeholder: "Hello Telegram!", required: true },
      ],
      execute: (args) => {
        return {
          ok: true,
          result: {
            message_id: 842,
            chat: { id: args.chatId, type: "channel", title: "Syncra Channel" },
            date: Math.floor(Date.now() / 1000),
            text: args.text,
          },
        };
      },
    },
  ],
  linkedin: [
    {
      name: "linkedin_post_update",
      description: "Share a text post or link update to your LinkedIn feed.",
      inputSchema: {
        type: "object",
        properties: {
          text: { type: "string" },
        },
        required: ["text"],
      },
      arguments: [
        { name: "text", label: "Post Update", type: "textarea", placeholder: "Proud to announce the integration of MCP in Syncra!", required: true },
      ],
      execute: (args) => {
        return {
          status: "success",
          urn: "urn:li:share:983749283749",
          updateUrl: "https://www.linkedin.com/feed/update/urn:li:share:983749283749",
        };
      },
    },
  ],
};
