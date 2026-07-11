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
  displayName: string;
  description: string;
  inputSchema: {
    type: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    properties: Record<string, any>;
    required?: string[];
  };
  arguments: ToolArgument[];
}

export const PLATFORM_MCP_TOOLS: Record<string, MCPTool[]> = {
  gmail: [
    {
      name: "gmail_search_emails",
      displayName: "Search Emails",
      description: "Search emails in the inbox using Gmail query syntax (e.g., is:unread, from:google).",
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
    },
    {
      name: "gmail_get_email",
      displayName: "Read Email",
      description: "Retrieve full content, headers, and body for a specific email message ID.",
      inputSchema: {
        type: "object",
        properties: {
          messageId: { type: "string", description: "The unique Gmail message ID." },
        },
        required: ["messageId"],
      },
      arguments: [
        { name: "messageId", label: "Message ID", type: "string", placeholder: "msg_101", required: true },
      ],
    },
    {
      name: "gmail_send_email",
      displayName: "Send Email",
      description: "Send a new email message to a specified recipient with subject and body.",
      inputSchema: {
        type: "object",
        properties: {
          to: { type: "string", description: "Email address of the recipient." },
          subject: { type: "string", description: "Subject of the email." },
          body: { type: "string", description: "Plain-text email body content." },
          threadId: { type: "string", description: "Thread ID if replying to a thread (optional)." },
        },
        required: ["to", "subject", "body"],
      },
      arguments: [
        { name: "to", label: "Recipient Email", type: "string", placeholder: "colleague@company.com", required: true },
        { name: "subject", label: "Subject", type: "string", placeholder: "Status Update", required: true },
        { name: "body", label: "Message Body", type: "textarea", placeholder: "Write your message here...", required: true },
        { name: "threadId", label: "Thread ID (Optional)", type: "string", placeholder: "thread_123" },
      ],
    },
    {
      name: "gmail_list_labels",
      displayName: "Manage Labels",
      description: "List all standard system and user-defined Gmail labels.",
      inputSchema: {
        type: "object",
        properties: {},
      },
      arguments: [],
    },
    {
      name: "gmail_archive_message",
      displayName: "Archive Email",
      description: "Archive an email by removing it from the INBOX folder.",
      inputSchema: {
        type: "object",
        properties: {
          messageId: { type: "string", description: "The unique Gmail message ID to archive." },
        },
        required: ["messageId"],
      },
      arguments: [
        { name: "messageId", label: "Message ID", type: "string", placeholder: "msg_101", required: true },
      ],
    },
    {
      name: "gmail_delete_message",
      displayName: "Delete Email",
      description: "Trash an email by moving it to the system TRASH folder.",
      inputSchema: {
        type: "object",
        properties: {
          messageId: { type: "string", description: "The unique Gmail message ID to delete." },
        },
        required: ["messageId"],
      },
      arguments: [
        { name: "messageId", label: "Message ID", type: "string", placeholder: "msg_101", required: true },
      ],
    },
    {
      name: "gmail_mark_read",
      displayName: "Mark as Read",
      description: "Mark an email as read by removing the UNREAD label.",
      inputSchema: {
        type: "object",
        properties: {
          messageId: { type: "string", description: "The unique Gmail message ID." },
        },
        required: ["messageId"],
      },
      arguments: [
        { name: "messageId", label: "Message ID", type: "string", placeholder: "msg_101", required: true },
      ],
    },
    {
      name: "gmail_mark_unread",
      displayName: "Mark as Unread",
      description: "Mark an email as unread by adding the UNREAD label.",
      inputSchema: {
        type: "object",
        properties: {
          messageId: { type: "string", description: "The unique Gmail message ID." },
        },
        required: ["messageId"],
      },
      arguments: [
        { name: "messageId", label: "Message ID", type: "string", placeholder: "msg_101", required: true },
      ],
    },
  ],
  slack: [
    {
      name: "slack_post_message",
      displayName: "Post Message",
      description: "Post a message to a channel or direct message in the Slack workspace.",
      inputSchema: {
        type: "object",
        properties: {
          channel: { type: "string", description: "Channel name or ID (e.g. #general)." },
          text: { type: "string", description: "The message text to send." },
        },
        required: ["channel", "text"],
      },
      arguments: [
        { name: "channel", label: "Slack Channel", type: "string", placeholder: "#general", defaultValue: "#general", required: true },
        { name: "text", label: "Message", type: "textarea", placeholder: "Hello from Syncra!", required: true },
      ],
    },
    {
      name: "slack_list_channels",
      displayName: "List Channels",
      description: "List all public channels available in the Slack workspace.",
      inputSchema: { type: "object", properties: {} },
      arguments: [],
    },
  ],
  whatsapp: [
    {
      name: "whatsapp_send_message",
      displayName: "Send Message",
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
    },
  ],
  outlook: [
    {
      name: "outlook_list_messages",
      displayName: "List Messages",
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
    },
  ],
  discord: [
    {
      name: "discord_post_message",
      displayName: "Post Message",
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
    },
  ],
  telegram: [
    {
      name: "telegram_send_message",
      displayName: "Send Message",
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
    },
  ],
  linkedin: [
    {
      name: "linkedin_post_update",
      displayName: "Post Update",
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
    },
  ],
};
