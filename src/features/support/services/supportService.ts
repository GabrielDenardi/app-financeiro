import { requireCurrentUserId } from '../../../lib/auth';
import { supabase } from '../../../lib/supabase';
import { getPlanEntitlements, getUpgradeMessage, normalizePlanId } from '../../plans/plans';
import type { ProfilePlanRow } from '../../plans/types';
import type {
  CreateSupportConversationInput,
  SendSupportMessageInput,
  SupportConversation,
  SupportMessage,
} from '../types';

type ConversationRow = {
  id: string;
  title: string;
  status: SupportConversation['status'];
  updated_at: string;
};

type MessageRow = {
  id: string;
  conversation_id: string;
  sender_user_id: string | null;
  sender_role: SupportMessage['senderRole'];
  body: string;
  sender_name: string | null;
  read_at: string | null;
  created_at: string;
};


async function ensureSupportChatAllowed(userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('subscription_plan, trial_ends_at')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  const entitlements = getPlanEntitlements(
    normalizePlanId((data as ProfilePlanRow | null)?.subscription_plan),
    (data as ProfilePlanRow | null)?.trial_ends_at,
  );
  if (!entitlements.supportChat) {
    throw new Error(getUpgradeMessage('Chat de suporte'));
  }
}

function mapMessage(row: MessageRow): SupportMessage {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    senderUserId: row.sender_user_id,
    senderRole: row.sender_role,
    body: row.body,
    senderName: row.sender_name,
    createdAt: row.created_at,
    readAt: row.read_at,
  };
}

export async function listSupportConversations(): Promise<SupportConversation[]> {
  const userId = await requireCurrentUserId();
  await ensureSupportChatAllowed(userId);
  const { data: conversationsData, error: conversationsError } = await supabase
    .from('support_conversations')
    .select('id, title, status, updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });

  if (conversationsError) {
    throw new Error(conversationsError.message);
  }

  const conversations = (conversationsData as ConversationRow[] | null) ?? [];
  if (conversations.length === 0) {
    return [];
  }

  const conversationIds = conversations.map((conversation) => conversation.id);
  const { data: messagesData, error: messagesError } = await supabase
    .from('support_messages')
    .select('id, conversation_id, sender_user_id, sender_role, sender_name, body, read_at, created_at')
    .in('conversation_id', conversationIds)
    .order('created_at', { ascending: false });

  if (messagesError) {
    throw new Error(messagesError.message);
  }

  const messages = ((messagesData as MessageRow[] | null) ?? []).map(mapMessage);

  return conversations.map((conversation) => {
    const relatedMessages = messages.filter((message) => message.conversationId === conversation.id);
    const lastMessage = relatedMessages[0];

    return {
      id: conversation.id,
      title: conversation.title,
      status: conversation.status,
      lastMessage: lastMessage?.body ?? 'Conversa iniciada',
      unreadCount: relatedMessages.filter(
        (message) => message.senderRole !== 'user' && !message.readAt,
      ).length,
      updatedAt: conversation.updated_at,
    };
  });
}

export async function listSupportMessages(conversationId: string): Promise<SupportMessage[]> {
  const userId = await requireCurrentUserId();
  await ensureSupportChatAllowed(userId);
  const { data, error } = await supabase
    .from('support_messages')
    .select(
      `
        id,
        conversation_id,
        sender_user_id,
        sender_role,
        sender_name,
        body,
        read_at,
        created_at,
        support_conversations!inner(user_id)
      `,
    )
    .eq('conversation_id', conversationId)
    .eq('support_conversations.user_id', userId)
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return ((data as MessageRow[] | null) ?? []).map(mapMessage);
}

export async function createSupportConversation(input: CreateSupportConversationInput): Promise<string> {
  const { data, error } = await supabase.rpc("create_support_conversation", {
    p_title: input.title.trim(), p_body: input.message.trim(), p_request_id: input.requestId,
  });
  if (error) throw new Error(error.message);
  return data as string;
}

export async function sendSupportMessage(input: SendSupportMessageInput): Promise<string> {
  const { data, error } = await supabase.rpc("send_support_message", {
    p_conversation_id: input.conversationId, p_body: input.body.trim(), p_request_id: input.requestId,
  });
  if (error) throw new Error(error.message);
  return data as string;
}

export async function markSupportConversationRead(conversationId: string): Promise<void> {
  const { error } = await supabase.rpc("mark_support_read", { p_conversation_id: conversationId });
  if (error) throw new Error(error.message);
}
