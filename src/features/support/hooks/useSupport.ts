import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { financeQueryKeys } from '../../finance/queryKeys';
import {
  createSupportConversation,
  listSupportConversations,
  listSupportMessages,
  markSupportConversationRead,
  sendSupportMessage,
} from '../services/supportService';
import type { CreateSupportConversationInput, SendSupportMessageInput } from '../types';

export function useSupportConversations(userId?: string | null) {
  return useQuery({
    queryKey: financeQueryKeys.support.conversations(userId),
    queryFn: listSupportConversations,
    enabled: Boolean(userId),
  });
}

export function useSupportMessages(userId?: string | null, conversationId?: string | null) {
  return useQuery({
    queryKey: financeQueryKeys.support.messages(userId, conversationId),
    queryFn: () => listSupportMessages(conversationId as string),
    enabled: Boolean(userId && conversationId),
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
