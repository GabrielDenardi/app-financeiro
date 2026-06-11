import { requireCurrentUserId } from '../../../lib/auth';
import { supabase } from '../../../lib/supabase';
import { getPlanEntitlements, getUpgradeMessage, normalizePlanId } from '../../plans/plans';
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
  read_at: string | null;
  created_at: string;
};

type ProfilePlanRow = {
  subscription_plan: string | null;
  trial_ends_at: string | null;
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
    .select('id, conversation_id, sender_user_id, sender_role, body, read_at, created_at')
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
  const userId = await requireCurrentUserId();
  await ensureSupportChatAllowed(userId);
  const { data, error } = await supabase
    .from('support_conversations')
    .insert({
      user_id: userId,
      title: input.title.trim(),
      status: 'active',
    })
    .select('id')
    .single();

  if (error) {
    throw new Error(error.message);
  }

  const conversationId = (data as { id: string }).id;
  const { error: messageError } = await supabase.from('support_messages').insert({
    conversation_id: conversationId,
    sender_user_id: userId,
    sender_role: 'user',
    body: input.message.trim(),
  });

  if (messageError) {
    throw new Error(messageError.message);
  }

  return conversationId;
}

export async function sendSupportMessage(input: SendSupportMessageInput): Promise<string> {
  const userId = await requireCurrentUserId();
  await ensureSupportChatAllowed(userId);
  const { data, error } = await supabase
    .from('support_messages')
    .insert({
      conversation_id: input.conversationId,
      sender_user_id: userId,
      sender_role: 'user',
      body: input.body.trim(),
    })
    .select('id')
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return (data as { id: string }).id;
}

export async function markSupportConversationRead(conversationId: string): Promise<void> {
  const userId = await requireCurrentUserId();
  await ensureSupportChatAllowed(userId);
  const { error } = await supabase
    .from('support_messages')
    .update({ read_at: new Date().toISOString() })
    .eq('conversation_id', conversationId)
    .neq('sender_role', 'user')
    .is('read_at', null);

  if (error) {
    throw new Error(error.message);
  }
}
