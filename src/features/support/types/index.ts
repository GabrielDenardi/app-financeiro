export type SupportConversationStatus = 'active' | 'working' | 'done';

export type SupportConversation = {
  id: string;
  title: string;
  status: SupportConversationStatus;
  lastMessage: string;
  unreadCount: number;
  updatedAt: string;
};

export type SupportMessage = {
  id: string;
  conversationId: string;
  senderUserId: string | null;
  senderRole: 'user' | 'support' | 'system';
  body: string;
  createdAt: string;
  readAt: string | null;
};

export type CreateSupportConversationInput = {
  title: string;
  message: string;
};

export type SendSupportMessageInput = {
  conversationId: string;
  body: string;
};
