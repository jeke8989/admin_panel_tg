export interface Tag {
  id: string;
  name: string;
  tagType: 'hot' | 'warm' | 'cold';
  color: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface User {
  id: string;
  telegramId: number;
  username: string | null;
  firstName: string;
  lastName: string | null;
  startParam?: string | null;
}

export interface Chat {
  id: string;
  name: string;
  avatar: string;
  lastMessage: string;
  unreadCount: number;
  lastMessageTime?: Date | null;
  botId?: string;
  botUsername?: string | null;
  telegramChatId?: number;
  isBotBlocked?: boolean;
  tags?: Tag[];
  user?: User; // Добавляем пользователя в интерфейс чата
}

export const MessageType = {
  TEXT: 'text',
  PHOTO: 'photo',
  VIDEO: 'video',
  VOICE: 'voice',
  DOCUMENT: 'document',
  AUDIO: 'audio',
  STICKER: 'sticker',
  VIDEO_NOTE: 'video_note',
  ANIMATION: 'animation',
  LOCATION: 'location',
  CONTACT: 'contact',
} as const;

export type MessageType = typeof MessageType[keyof typeof MessageType];

export interface MessageReaction {
  id: string;
  messageId: string;
  emoji: string;
  adminId: string;
  isFromTelegram: boolean;
  createdAt: Date;
}

export interface Message {
  id: string;
  chatId: string;
  text: string | null;
  senderId: string;
  timestamp: Date;
  isRead: boolean;
  isDelivered?: boolean;
  messageType: MessageType;
  fileId?: string | null;
  fileUrl?: string | null;
  filePath?: string | null;
  fileName?: string | null;
  caption?: string | null;
  isFromAdmin?: boolean;
  reactions?: MessageReaction[];
  replyToMessageId?: string | null;
  replyToMessage?: Message | null;
}

// Доступные реакции (максимум 5 самых популярных)
export const AVAILABLE_REACTIONS = ['👍', '❤️', '😂', '🔥', '👏'] as const;
export type AvailableReaction = typeof AVAILABLE_REACTIONS[number];

export interface Bot {
  id: string;
  token: string;
  username: string | null;
  firstName: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface BotStatistics {
  totalUsers: number;
  totalMessages: number;
  activeUsers: number;
  blockedUsers: number;
}

export interface TemplateFile {
  id: string;
  templateId: string;
  fileName: string;
  filePath: string;
  fileType: string;
  fileSize: number;
  createdAt: Date;
}

export interface Template {
  id: string;
  name: string;
  text: string | null;
  adminId: string | null;
  files: TemplateFile[];
  createdAt: Date;
  updatedAt: Date;
}

export const CURRENT_USER_ID = 'current-user';

// Workflow Types

export interface BotWorkflow {
  id: string;
  botId: string;
  name: string;
  description: string | null;
  isActive: boolean;
  nodes: WorkflowNode[];
  connections: WorkflowConnection[];
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkflowNode {
  id: string;
  workflowId: string;
  type: string; // Changed from NodeType to string to allow flexibility/mapping
  position: { x: number; y: number };
  config: any;
  createdAt: Date;
  updatedAt: Date;
  // ReactFlow specific (mapped)
  data?: any; 
}

export interface WorkflowConnection {
  id: string;
  workflowId: string;
  sourceNodeId: string;
  targetNodeId: string;
  sourceHandle: string | null;
  targetHandle: string | null;
  createdAt: Date;
}

export type NodeType = 
  | 'trigger-command' 
  | 'trigger-text' 
  | 'trigger-callback'
  | 'trigger-button' // Legacy alias for trigger-callback
  | 'action-message'
  | 'action-media'
  | 'action-keyboard'
  | 'action-delay'
  | 'condition-if';

// Broadcast Types
export const BroadcastStatus = {
  DRAFT: 'draft',
  SCHEDULED: 'scheduled',
  SENDING: 'sending',
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const;

export type BroadcastStatus = typeof BroadcastStatus[keyof typeof BroadcastStatus];

export const BroadcastRecipientStatus = {
  PENDING: 'pending',
  SENT: 'sent',
  DELIVERED: 'delivered',
  READ: 'read',
  FAILED: 'failed',
} as const;

export type BroadcastRecipientStatus = typeof BroadcastRecipientStatus[keyof typeof BroadcastRecipientStatus];

export interface BroadcastSegments {
  startParams?: string[];
  botIds?: string[];
  lastInteractionAfter?: string;
  lastInteractionBefore?: string;
}

export interface Broadcast {
  id: string;
  name: string;
  text: string | null;
  messageType: MessageType;
  fileId: string | null;
  fileUrl: string | null;
  caption: string | null;
  segments: BroadcastSegments | null;
  status: BroadcastStatus;
  createdById: string;
  scheduledAt: Date | null;
  sentAt: Date | null;
  totalRecipients: number;
  sentCount: number;
  deliveredCount: number;
  readCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface BroadcastRecipient {
  id: string;
  broadcastId: string;
  userId: string;
  chatId: string;
  botId: string;
  status: BroadcastRecipientStatus;
  telegramMessageId: number | null;
  sentAt: Date | null;
  deliveredAt: Date | null;
  readAt: Date | null;
  errorMessage: string | null;
  createdAt: Date;
  user?: User;
  chat?: Chat;
  bot?: Bot;
}

export interface BroadcastStatistics {
  total: number;
  sent: number;
  delivered: number;
  read: number;
  failed: number;
  readPercentage: number;
  recipients: Array<{
    id: string;
    user: {
      id: string;
      firstName: string;
      lastName: string | null;
      username: string | null;
      startParam: string | null;
    };
    status: BroadcastRecipientStatus;
    sentAt: Date | null;
    deliveredAt: Date | null;
    readAt: Date | null;
    errorMessage: string | null;
  }>;
}
