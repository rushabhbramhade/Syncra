export type PlatformType = "gmail" | "slack" | "whatsapp" | "telegram" | "discord" | "calendar" | "github" | "tasks" | "alerts";

export type EventCategory = "email" | "message" | "meeting" | "task" | "alert" | "code" | "deployment";

export type PriorityLevel = "critical" | "high" | "medium" | "low" | "informational";

export interface Contact {
  id: string;
  name: string;
  email?: string;
  avatarUrl?: string;
  isVIP?: boolean;
  isStarred?: boolean;
  domain?: string;
  role?: string;
  isClient?: boolean;
}

export interface PlatformMetadata {
  gmail?: {
    threadId: string;
    messageId: string;
    snippet: string;
    hasAttachments: boolean;
    isImportant: boolean;
    isPromo: boolean;
    labels: string[];
  };
  slack?: {
    channelId: string;
    channelName: string;
    isMention: boolean;
    isDM: boolean;
    reactionCount: number;
    threadTs?: string;
  };
  whatsapp?: {
    chatId: string;
    chatName: string;
    isGroup: boolean;
    isBusiness: boolean;
  };
  telegram?: {
    chatId: string;
    chatTitle: string;
    isGroup: boolean;
    isBot: boolean;
  };
  github?: {
    repo: string;
    owner: string;
    prNumber?: number;
    issueNumber?: number;
    isReviewRequested: boolean;
    isReviewedByMe: boolean;
    status: string;
  };
  calendar?: {
    meetingId: string;
    startTime: string;
    endTime: string;
    attendees: string[];
    meetingUrl?: string;
    isRecurring: boolean;
    hasActionItems: boolean;
  };
  discord?: {
    channelId: string;
    channelName: string;
    isMention: boolean;
    isDM: boolean;
    serverName: string;
  };
}

export interface NormalizedEvent {
  id: string;
  sourceEventId: string;
  platform: PlatformType;
  category: EventCategory;
  title: string;
  summary: string;
  fullContent: string;
  sender: Contact;
  recipients: Contact[];
  timestamp: string;
  receivedAt: string;
  isUnread: boolean;
  isStarred: boolean;
  labels: string[];
  priority: PriorityLevel;
  score: number;
  confidence: number;
  rulesMatched: string[];
  explanation: string;
  metadata: PlatformMetadata;
  crossRefs: string[];
  dedupHash: string;
}

export interface EventCluster {
  id: string;
  primaryEventId: string;
  relatedEventIds: string[];
  correlationType: "meeting-email" | "pr-slack" | "deployment-ticket" | "thread" | "contact";
  confidence: number;
  title: string;
}
