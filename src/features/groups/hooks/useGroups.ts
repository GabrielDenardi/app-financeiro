import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { financeQueryKeys } from '../../finance/queryKeys';
import type { CreateGroupInput, CreateGroupSplitInput, RequestSettlementInput } from '../../../types/groups';
import {
  confirmGroupSettlement,
  createGroup,
  createGroupSplit,
  getGroupDetails,
  joinGroupByCode,
  listGroups,
  removeGroupMember,
  requestGroupSettlement,
} from '../services/groupsService';

export const groupsQueryKeys = {
  all: ['groups'] as const,
  list: (currentUserId?: string | null) => [...groupsQueryKeys.all, 'list', currentUserId] as const,
  detail: (currentUserId: string | null | undefined, groupId: string) =>
    [...groupsQueryKeys.all, 'detail', currentUserId, groupId] as const,
};

export function useGroups(currentUserId?: string | null) {
  return useQuery({
    queryKey: groupsQueryKeys.list(currentUserId),
    queryFn: () => listGroups(currentUserId),
    enabled: Boolean(currentUserId),
  });
}

export function useGroupDetails(currentUserId: string | null | undefined, groupId: string) {
  return useQuery({
    queryKey: groupsQueryKeys.detail(currentUserId, groupId),
    queryFn: () => getGroupDetails(currentUserId, groupId),
    enabled: Boolean(currentUserId && groupId),
  });
}

export function useCreateGroupMutation(currentUserId?: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateGroupInput) => createGroup(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: groupsQueryKeys.list(currentUserId) });
    },
  });
}

export function useJoinGroupMutation(currentUserId?: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (code: string) => joinGroupByCode(code),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: groupsQueryKeys.list(currentUserId) });
    },
  });
}

export function useCreateGroupSplitMutation(currentUserId: string | null | undefined, groupId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateGroupSplitInput) => createGroupSplit(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: groupsQueryKeys.list(currentUserId) });
      queryClient.invalidateQueries({ queryKey: groupsQueryKeys.detail(currentUserId, groupId) });
      queryClient.invalidateQueries({ queryKey: financeQueryKeys.root });
    },
  });
}

export function useRequestSettlementMutation(
  currentUserId: string | null | undefined,
  groupId: string,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: RequestSettlementInput) => requestGroupSettlement(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: groupsQueryKeys.list(currentUserId) });
      queryClient.invalidateQueries({ queryKey: groupsQueryKeys.detail(currentUserId, groupId) });
      queryClient.invalidateQueries({ queryKey: financeQueryKeys.root });
    },
  });
}

export function useConfirmSettlementMutation(
  currentUserId: string | null | undefined,
  groupId: string,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (settlementId: string) => confirmGroupSettlement(settlementId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: groupsQueryKeys.list(currentUserId) });
      queryClient.invalidateQueries({ queryKey: groupsQueryKeys.detail(currentUserId, groupId) });
      queryClient.invalidateQueries({ queryKey: financeQueryKeys.root });
    },
  });
}

export function useRemoveGroupMemberMutation(
  currentUserId: string | null | undefined,
  groupId: string,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: string) => removeGroupMember(groupId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: groupsQueryKeys.list(currentUserId) });
      queryClient.invalidateQueries({ queryKey: groupsQueryKeys.detail(currentUserId, groupId) });
    },
  });
}
