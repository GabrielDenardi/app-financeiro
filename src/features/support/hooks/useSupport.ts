import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { supabase } from '../../../lib/supabase';

import { financeQueryKeys } from '../../finance/queryKeys';
import {
  createSupportConversation,
  listSupportConversations,
  listSupportMessages,
  markSupportConversationRead,
  sendSupportMessage,
} from '../services/supportService';
import type { CreateSupportConversationInput, SendSupportMessageInput } from '../types';

export function useSupportRealtime(userId?: string | null, conversationId?: string | null, enabled = true) {
  const client = useQueryClient();
  useEffect(() => {
    if (!userId || !enabled) return;
    const refresh = () => { void client.invalidateQueries({ queryKey: financeQueryKeys.support.all }); };
    const channel = supabase.channel(`support:${userId}:${conversationId ?? 'inbox'}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'support_messages',
        ...(conversationId ? { filter: `conversation_id=eq.${conversationId}` } : {}),
      }, refresh)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'support_conversations', filter: `user_id=eq.${userId}` }, refresh)
      .subscribe((status) => { if (status === 'SUBSCRIBED') refresh(); });
    const appState = AppState.addEventListener('change', (state) => { if (state === 'active') refresh(); });
    return () => { void supabase.removeChannel(channel); appState.remove(); };
  }, [userId, conversationId, enabled, client]);
}

export function useSupportConversations(userId?: string | null, enabled = true) {
  return useQuery({
    queryKey: financeQueryKeys.support.conversations(userId),
    queryFn: listSupportConversations,
    enabled: Boolean(userId && enabled),
    refetchInterval: 15000,
  });
}

export function useSupportMessages(userId?: string | null, conversationId?: string | null, enabled = true) {
  return useQuery({
    queryKey: financeQueryKeys.support.messages(userId, conversationId),
    queryFn: () => listSupportMessages(conversationId as string),
    enabled: Boolean(userId && conversationId && enabled),
    refetchInterval: 15000,
  });
}

export function useCreateSupportConversationMutation(userId?: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateSupportConversationInput) => createSupportConversation(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: financeQueryKeys.support.all });
    },
  });
}

export function useSendSupportMessageMutation(userId?: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: SendSupportMessageInput) => sendSupportMessage(input),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: financeQueryKeys.support.conversations(userId) });
      queryClient.invalidateQueries({
        queryKey: financeQueryKeys.support.messages(userId, variables.conversationId),
      });
    },
  });
}

export function useMarkSupportConversationReadMutation(userId?: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (conversationId: string) => markSupportConversationRead(conversationId),
    onSuccess: (_data, conversationId) => {
      queryClient.invalidateQueries({ queryKey: financeQueryKeys.support.conversations(userId) });
      queryClient.invalidateQueries({
        queryKey: financeQueryKeys.support.messages(userId, conversationId),
      });
    },
  });
}
