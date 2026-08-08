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
      name: "slack_fetch_messages",
      displayName: "Fetch Messages",
      description: "Fetch recent messages from Slack channels the bot has access to.",
      inputSchema: {
        type: "object",
        properties: {
          limit: { type: "number", description: "Max number of messages to fetch (default: 5)." },
        },
      },
      arguments: [
        { name: "limit", label: "Limit Results", type: "number", defaultValue: 5 },
      ],
    },
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
      name: "whatsapp_fetch_messages",
      displayName: "Fetch Recent Messages",
      description: "Fetch a list of recent messages across all WhatsApp chats.",
      inputSchema: {
        type: "object",
        properties: {
          limit: { type: "number", description: "Max number of messages to fetch (default: 10)." },
        },
      },
      arguments: [
        { name: "limit", label: "Limit Results", type: "number", placeholder: "10", defaultValue: 10 },
      ],
    },
    {
      name: "whatsapp_read_chat",
      displayName: "Read Chat History",
      description: "Retrieve message history for a specific chat JID or contact.",
      inputSchema: {
        type: "object",
        properties: {
          chatId: { type: "string", description: "The WhatsApp JID of the chat (e.g. 1234567890@s.whatsapp.net)." },
          limit: { type: "number", description: "Max number of messages to fetch (default: 15)." },
        },
        required: ["chatId"],
      },
      arguments: [
        { name: "chatId", label: "Chat JID", type: "string", placeholder: "1234567890@s.whatsapp.net", required: true },
        { name: "limit", label: "Limit Results", type: "number", placeholder: "15", defaultValue: 15 },
      ],
    },
    {
      name: "whatsapp_send_message",
      displayName: "Send Message",
      description: "Send a text message to a specific WhatsApp number or JID.",
      inputSchema: {
        type: "object",
        properties: {
          to: { type: "string", description: "WhatsApp number in international format or JID." },
          message: { type: "string", description: "Body of the message." },
        },
        required: ["to", "message"],
      },
      arguments: [
        { name: "to", label: "WhatsApp Number/JID", type: "string", placeholder: "1234567890", required: true },
        { name: "message", label: "Message", type: "textarea", placeholder: "Hi! Sent from Syncra.", required: true },
      ],
    },
    {
      name: "whatsapp_search_chats",
      displayName: "Search Chats",
      description: "Search for chats or messages matching a query.",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "Term or keyword to search for." },
        },
        required: ["query"],
      },
      arguments: [
        { name: "query", label: "Search Term", type: "string", placeholder: "meeting", required: true },
      ],
    },
    {
      name: "whatsapp_summarize_chat",
      displayName: "Summarize Conversation",
      description: "Generate an AI summary of recent messages in a chat.",
      inputSchema: {
        type: "object",
        properties: {
          chatId: { type: "string", description: "The WhatsApp JID of the chat to summarize." },
        },
        required: ["chatId"],
      },
      arguments: [
        { name: "chatId", label: "Chat JID", type: "string", placeholder: "1234567890@s.whatsapp.net", required: true },
      ],
    },
    {
      name: "whatsapp_get_contact",
      displayName: "Get Contact Details",
      description: "Retrieve profile and contact details for a specific WhatsApp JID.",
      inputSchema: {
        type: "object",
        properties: {
          jid: { type: "string", description: "WhatsApp JID to inspect." },
        },
        required: ["jid"],
      },
      arguments: [
        { name: "jid", label: "Contact JID", type: "string", placeholder: "1234567890@s.whatsapp.net", required: true },
      ],
    },
    {
      name: "whatsapp_list_groups",
      displayName: "List Groups",
      description: "Retrieve a list of all participating WhatsApp group chats.",
      inputSchema: {
        type: "object",
        properties: {},
      },
      arguments: [],
    },
    {
      name: "whatsapp_fetch_group_messages",
      displayName: "Fetch Group Messages",
      description: "Fetch recent messages from a specific WhatsApp group JID.",
      inputSchema: {
        type: "object",
        properties: {
          groupId: { type: "string", description: "The JID of the group (e.g. 1112223333@g.us)." },
          limit: { type: "number", description: "Max number of messages to fetch (default: 10)." },
        },
        required: ["groupId"],
      },
      arguments: [
        { name: "groupId", label: "Group JID", type: "string", placeholder: "1112223333@g.us", required: true },
        { name: "limit", label: "Limit Results", type: "number", placeholder: "10", defaultValue: 10 },
      ],
    },
    {
      name: "whatsapp_send_group_message",
      displayName: "Send Group Message",
      description: "Send a text message to a WhatsApp group JID.",
      inputSchema: {
        type: "object",
        properties: {
          groupId: { type: "string", description: "The JID of the group (e.g. 1112223333@g.us)." },
          message: { type: "string", description: "Body of the message." },
        },
        required: ["groupId", "message"],
      },
      arguments: [
        { name: "groupId", label: "Group JID", type: "string", placeholder: "1112223333@g.us", required: true },
        { name: "message", label: "Message", type: "textarea", placeholder: "Hello group!", required: true },
      ],
    },
    {
      name: "whatsapp_reply_message",
      displayName: "Reply to Message",
      description: "Reply to a specific WhatsApp message.",
      inputSchema: {
        type: "object",
        properties: {
          to: { type: "string", description: "WhatsApp JID of the chat." },
          messageId: { type: "string", description: "ID of the message to reply to." },
          message: { type: "string", description: "Reply text." },
        },
        required: ["to", "messageId", "message"],
      },
      arguments: [
        { name: "to", label: "Chat JID", type: "string", placeholder: "1234567890@s.whatsapp.net", required: true },
        { name: "messageId", label: "Message ID", type: "string", placeholder: "BAE5...", required: true },
        { name: "message", label: "Reply Text", type: "textarea", placeholder: "Thanks for your message!", required: true },
      ],
    },
    {
      name: "whatsapp_list_contacts",
      displayName: "List Contacts",
      description: "Retrieve all WhatsApp contacts.",
      inputSchema: { type: "object", properties: {} },
      arguments: [],
    },
    {
      name: "whatsapp_create_group",
      displayName: "Create Group",
      description: "Create a new WhatsApp group.",
      inputSchema: {
        type: "object",
        properties: {
          name: { type: "string", description: "Group name." },
          participants: { type: "array", items: { type: "string" }, description: "List of JIDs to add." },
        },
        required: ["name", "participants"],
      },
      arguments: [
        { name: "name", label: "Group Name", type: "string", placeholder: "My Group", required: true },
        { name: "participants", label: "Participants", type: "textarea", placeholder: "1234567890@s.whatsapp.net,0987654321@s.whatsapp.net", required: true },
      ],
    },
    {
      name: "whatsapp_manage_group_participants",
      displayName: "Manage Group Participants",
      description: "Add or remove participants from a WhatsApp group.",
      inputSchema: {
        type: "object",
        properties: {
          groupId: { type: "string", description: "Group JID." },
          action: { type: "string", enum: ["add", "remove"], description: "Action to perform." },
          participants: { type: "array", items: { type: "string" }, description: "List of JIDs." },
        },
        required: ["groupId", "action", "participants"],
      },
      arguments: [
        { name: "groupId", label: "Group JID", type: "string", placeholder: "1112223333@g.us", required: true },
        { name: "action", label: "Action", type: "string", placeholder: "add or remove", required: true },
        { name: "participants", label: "Participants", type: "textarea", placeholder: "1234567890@s.whatsapp.net", required: true },
      ],
    },
    {
      name: "whatsapp_retrieve_media",
      displayName: "Retrieve Media",
      description: "Get media content from a WhatsApp message.",
      inputSchema: {
        type: "object",
        properties: {
          messageId: { type: "string", description: "Message ID containing media." },
          chatId: { type: "string", description: "Chat JID." },
        },
        required: ["messageId", "chatId"],
      },
      arguments: [
        { name: "messageId", label: "Message ID", type: "string", placeholder: "BAE5...", required: true },
        { name: "chatId", label: "Chat JID", type: "string", placeholder: "1234567890@s.whatsapp.net", required: true },
      ],
    },
    {
      name: "whatsapp_download_attachment",
      displayName: "Download Attachment",
      description: "Download an attachment from a WhatsApp message.",
      inputSchema: {
        type: "object",
        properties: {
          messageId: { type: "string", description: "Message ID." },
          chatId: { type: "string", description: "Chat JID." },
        },
        required: ["messageId", "chatId"],
      },
      arguments: [
        { name: "messageId", label: "Message ID", type: "string", placeholder: "BAE5...", required: true },
        { name: "chatId", label: "Chat JID", type: "string", placeholder: "1234567890@s.whatsapp.net", required: true },
      ],
    },
    {
      name: "whatsapp_send_image",
      displayName: "Send Image",
      description: "Send an image message to a WhatsApp chat.",
      inputSchema: {
        type: "object",
        properties: {
          to: { type: "string", description: "WhatsApp JID." },
          imageUrl: { type: "string", description: "URL of the image." },
          caption: { type: "string", description: "Image caption." },
        },
        required: ["to", "imageUrl"],
      },
      arguments: [
        { name: "to", label: "Chat JID", type: "string", placeholder: "1234567890@s.whatsapp.net", required: true },
        { name: "imageUrl", label: "Image URL", type: "string", placeholder: "https://example.com/image.jpg", required: true },
        { name: "caption", label: "Caption", type: "textarea", placeholder: "Check this out!" },
      ],
    },
    {
      name: "whatsapp_send_document",
      displayName: "Send Document",
      description: "Send a document file to a WhatsApp chat.",
      inputSchema: {
        type: "object",
        properties: {
          to: { type: "string", description: "WhatsApp JID." },
          documentUrl: { type: "string", description: "URL of the document." },
          fileName: { type: "string", description: "File name." },
        },
        required: ["to", "documentUrl", "fileName"],
      },
      arguments: [
        { name: "to", label: "Chat JID", type: "string", placeholder: "1234567890@s.whatsapp.net", required: true },
        { name: "documentUrl", label: "Document URL", type: "string", placeholder: "https://example.com/file.pdf", required: true },
        { name: "fileName", label: "File Name", type: "string", placeholder: "document.pdf", required: true },
      ],
    },
    {
      name: "whatsapp_send_audio",
      displayName: "Send Audio",
      description: "Send an audio message to a WhatsApp chat.",
      inputSchema: {
        type: "object",
        properties: {
          to: { type: "string", description: "WhatsApp JID." },
          audioUrl: { type: "string", description: "URL of the audio file." },
        },
        required: ["to", "audioUrl"],
      },
      arguments: [
        { name: "to", label: "Chat JID", type: "string", placeholder: "1234567890@s.whatsapp.net", required: true },
        { name: "audioUrl", label: "Audio URL", type: "string", placeholder: "https://example.com/audio.mp3", required: true },
      ],
    },
    {
      name: "whatsapp_send_video",
      displayName: "Send Video",
      description: "Send a video message to a WhatsApp chat.",
      inputSchema: {
        type: "object",
        properties: {
          to: { type: "string", description: "WhatsApp JID." },
          videoUrl: { type: "string", description: "URL of the video." },
          caption: { type: "string", description: "Video caption." },
        },
        required: ["to", "videoUrl"],
      },
      arguments: [
        { name: "to", label: "Chat JID", type: "string", placeholder: "1234567890@s.whatsapp.net", required: true },
        { name: "videoUrl", label: "Video URL", type: "string", placeholder: "https://example.com/video.mp4", required: true },
        { name: "caption", label: "Caption", type: "textarea", placeholder: "Check this video!" },
      ],
    },
    {
      name: "whatsapp_search_messages",
      displayName: "Search Messages",
      description: "Search for messages across all WhatsApp chats.",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search term." },
          chatId: { type: "string", description: "Optional: limit to specific chat." },
        },
        required: ["query"],
      },
      arguments: [
        { name: "query", label: "Search Term", type: "string", placeholder: "meeting", required: true },
        { name: "chatId", label: "Chat JID (optional)", type: "string", placeholder: "1234567890@s.whatsapp.net" },
      ],
    },
    {
      name: "whatsapp_get_unread_chats",
      displayName: "Get Unread Chats",
      description: "Retrieve all WhatsApp chats with unread messages.",
      inputSchema: { type: "object", properties: {} },
      arguments: [],
    },
    {
      name: "whatsapp_mark_chat_read",
      displayName: "Mark Chat as Read",
      description: "Mark a WhatsApp chat as read.",
      inputSchema: {
        type: "object",
        properties: {
          chatId: { type: "string", description: "Chat JID to mark as read." },
        },
        required: ["chatId"],
      },
      arguments: [
        { name: "chatId", label: "Chat JID", type: "string", placeholder: "1234567890@s.whatsapp.net", required: true },
      ],
    },
    {
      name: "whatsapp_archive_chat",
      displayName: "Archive Chat",
      description: "Archive a WhatsApp chat.",
      inputSchema: {
        type: "object",
        properties: {
          chatId: { type: "string", description: "Chat JID to archive." },
        },
        required: ["chatId"],
      },
      arguments: [
        { name: "chatId", label: "Chat JID", type: "string", placeholder: "1234567890@s.whatsapp.net", required: true },
      ],
    },
    {
      name: "whatsapp_pin_chat",
      displayName: "Pin Chat",
      description: "Pin a WhatsApp chat to the top.",
      inputSchema: {
        type: "object",
        properties: {
          chatId: { type: "string", description: "Chat JID to pin." },
        },
        required: ["chatId"],
      },
      arguments: [
        { name: "chatId", label: "Chat JID", type: "string", placeholder: "1234567890@s.whatsapp.net", required: true },
      ],
    },
    {
      name: "whatsapp_unpin_chat",
      displayName: "Unpin Chat",
      description: "Unpin a WhatsApp chat.",
      inputSchema: {
        type: "object",
        properties: {
          chatId: { type: "string", description: "Chat JID to unpin." },
        },
        required: ["chatId"],
      },
      arguments: [
        { name: "chatId", label: "Chat JID", type: "string", placeholder: "1234567890@s.whatsapp.net", required: true },
      ],
    },
    {
      name: "whatsapp_get_chat_metadata",
      displayName: "Get Chat Metadata",
      description: "Retrieve metadata for a WhatsApp chat.",
      inputSchema: {
        type: "object",
        properties: {
          chatId: { type: "string", description: "Chat JID." },
        },
        required: ["chatId"],
      },
      arguments: [
        { name: "chatId", label: "Chat JID", type: "string", placeholder: "1234567890@s.whatsapp.net", required: true },
      ],
    },
    {
      name: "whatsapp_monitor_messages",
      displayName: "Monitor Messages",
      description: "Set up real-time monitoring for new incoming WhatsApp messages.",
      inputSchema: { type: "object", properties: {} },
      arguments: [],
    },
  ],
  discord: [
    {
      name: "discord_fetch_recent_messages",
      displayName: "Fetch Recent Messages",
      description: "Discover all accessible Discord channels and fetch recent messages from each one.",
      inputSchema: {
        type: "object",
        properties: {
          limit: { type: "number", description: "Max messages per channel (default: 3)." },
        },
      },
      arguments: [
        { name: "limit", label: "Limit per Channel", type: "number", defaultValue: 3 },
      ],
    },
    {
      name: "discord_list_guilds",
      displayName: "List Guilds",
      description: "List all Discord servers (guilds) the bot is a member of.",
      inputSchema: { type: "object", properties: {} },
      arguments: [],
    },
    {
      name: "discord_list_channels",
      displayName: "List Channels",
      description: "List text channels in a specific Discord guild.",
      inputSchema: {
        type: "object",
        properties: {
          guildId: { type: "string", description: "The Discord guild/server ID." },
        },
        required: ["guildId"],
      },
      arguments: [
        { name: "guildId", label: "Guild ID", type: "string", placeholder: "1029384756", required: true },
      ],
    },
    {
      name: "discord_fetch_messages",
      displayName: "Fetch Messages",
      description: "Fetch recent messages from a specific Discord channel.",
      inputSchema: {
        type: "object",
        properties: {
          channelId: { type: "string", description: "The Discord channel ID." },
          limit: { type: "number", description: "Max number of messages to fetch (default: 5, max: 100)." },
        },
        required: ["channelId"],
      },
      arguments: [
        { name: "channelId", label: "Channel ID", type: "string", placeholder: "1029384756", required: true },
        { name: "limit", label: "Limit Results", type: "number", defaultValue: 5 },
      ],
    },
    {
      name: "discord_send_message",
      displayName: "Send Message",
      description: "Send a text message to a specific Discord channel.",
      inputSchema: {
        type: "object",
        properties: {
          channelId: { type: "string", description: "The Discord channel ID." },
          content: { type: "string", description: "The message content to send." },
        },
        required: ["channelId", "content"],
      },
      arguments: [
        { name: "channelId", label: "Channel ID", type: "string", placeholder: "1029384756", required: true },
        { name: "content", label: "Content", type: "textarea", placeholder: "Sending alerts from Syncra!", required: true },
      ],
    },
  ],
  telegram: [
    {
      name: "telegram_fetch_messages",
      displayName: "Fetch Messages",
      description: "Fetch recent messages sent to the Telegram bot.",
      inputSchema: {
        type: "object",
        properties: {
          limit: { type: "number", description: "Max number of messages to fetch (default: 5)." },
        },
      },
      arguments: [
        { name: "limit", label: "Limit Results", type: "number", defaultValue: 5 },
      ],
    },
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
  github: [
    {
      name: "github_get_profile",
      displayName: "Get Profile",
      description: "Retrieve the authenticated GitHub user's profile (login, name, email, avatar, bio).",
      inputSchema: { type: "object", properties: {} },
      arguments: [],
    },
    {
      name: "github_list_repos",
      displayName: "List Repositories",
      description: "List repositories for the authenticated user, sorted by most recently updated.",
      inputSchema: { type: "object", properties: {} },
      arguments: [],
    },
    {
      name: "github_list_issues",
      displayName: "List Issues",
      description: "List all open issues across repositories for the authenticated user.",
      inputSchema: { type: "object", properties: {} },
      arguments: [],
    },
    {
      name: "github_search_issues",
      displayName: "Search Issues",
      description: "Search for issues and pull requests by query (supports GitHub search syntax). Note: search API has its own rate limit (~30 req/min).",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "GitHub search query (e.g. is:open is:issue label:bug)." },
        },
        required: ["query"],
      },
      arguments: [
        { name: "query", label: "Search Query", type: "string", placeholder: "is:open is:issue label:bug", required: true },
      ],
    },
    {
      name: "github_get_notifications",
      displayName: "Get Notifications",
      description: "Retrieve unread notifications for the authenticated user (PR reviews, issue mentions, etc.).",
      inputSchema: { type: "object", properties: {} },
      arguments: [],
    },
    {
      name: "github_get_recent_activity",
      displayName: "Recent Activity",
      description: "Fetch the user's most recent real development activity — commits pushed to their repositories. Use when issues and notifications are empty to surface actual progress.",
      inputSchema: {
        type: "object",
        properties: {
          limit: { type: "number", description: "Max recent commits to return (default: 24)." },
        },
      },
      arguments: [
        { name: "limit", label: "Limit", type: "number", defaultValue: 24 },
      ],
    },
  ],
  linkedin: [
    {
      name: "linkedin_get_profile",
      displayName: "Get Profile",
      description: "Retrieve the connected LinkedIn user's profile data (name, headline, photo, email).",
      inputSchema: { type: "object", properties: {} },
      arguments: [],
    },
    {
      name: "linkedin_post_update",
      displayName: "Post Update",
      description: "Share a text post to the connected user's LinkedIn feed.",
      inputSchema: {
        type: "object",
        properties: {
          text: { type: "string", description: "The post content." },
          visibility: { type: "string", description: "PUBLIC or CONNECTIONS (default: PUBLIC)." },
        },
        required: ["text"],
      },
      arguments: [
        { name: "text", label: "Post Content", type: "textarea", placeholder: "Excited to share what we're building at Syncra!", required: true },
        { name: "visibility", label: "Visibility", type: "string", defaultValue: "PUBLIC" },
      ],
    },
  ],
  calendar: [
    {
      name: "calendar_list_events",
      displayName: "List Events",
      description: "List upcoming events from a Google Calendar with optional time range filters.",
      inputSchema: {
        type: "object",
        properties: {
          calendarId: { type: "string", description: "Calendar ID (defaults to primary)." },
          timeMin: { type: "string", description: "ISO 8601 start time filter." },
          timeMax: { type: "string", description: "ISO 8601 end time filter." },
          limit: { type: "number", description: "Max events to return (default: 20)." },
        },
      },
      arguments: [
        { name: "calendarId", label: "Calendar ID", type: "string", placeholder: "primary" },
        { name: "timeMin", label: "Start Time", type: "string", placeholder: "2026-01-01T00:00:00Z" },
        { name: "timeMax", label: "End Time", type: "string", placeholder: "2026-12-31T23:59:59Z" },
        { name: "limit", label: "Limit", type: "number", defaultValue: 20 },
      ],
    },
    {
      name: "calendar_get_event",
      displayName: "Get Event",
      description: "Retrieve full details of a specific calendar event by ID.",
      inputSchema: {
        type: "object",
        properties: {
          calendarId: { type: "string", description: "Calendar ID (defaults to primary)." },
          eventId: { type: "string", description: "The event ID to fetch." },
        },
        required: ["eventId"],
      },
      arguments: [
        { name: "calendarId", label: "Calendar ID", type: "string", placeholder: "primary" },
        { name: "eventId", label: "Event ID", type: "string", placeholder: "abc123def456", required: true },
      ],
    },
  ],
};
