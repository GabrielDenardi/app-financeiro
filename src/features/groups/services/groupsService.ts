import { hasSupabaseEnv } from '../../../config/env';
import { supabase } from '../../../lib/supabase';
import type {
  CreateGroupInput,
  CreateGroupSplitInput,
  Group,
  GroupDetailsData,
  GroupListItem,
  GroupMember,
  GroupRole,
  GroupSettlement,
  GroupSplit,
  GroupSplitShare,
  RequestSettlementInput,
} from '../../../types/groups';
import {
  buildGroupDetailsData,
  buildGroupListItem,
  serializeSplitPayload,
} from '../utils/groupMath';

type GroupRow = {
  id: string;
  title: string;
  description: string;
  share_code: string;
  created_by: string;
  created_at: string;
  updated_at: string;
};

type GroupMemberRow = {
  id: string;
  group_id: string;
  user_id: string;
  role: GroupRole;
  joined_at: string;
  removed_at: string | null;
};

type ProfileRow = {
  id: string;
  full_name: string;
  email: string;
};

type GroupSplitRow = {
  id: string;
  group_id: string;
  created_by: string;
  owner_user_id: string;
  title: string;
  description: string;
  kind: GroupSplit['kind'];
  split_mode: GroupSplit['splitMode'];
  total_amount: number | string;
  occurred_at: string;
  created_at: string;
};

type GroupSplitShareRow = {
  id: string;
  split_id: string;
  user_id: string;
  share_amount: number | string;
  share_percentage: number | string | null;
};

type GroupSettlementRow = {
  id: string;
  group_id: string;
  from_user_id: string;
  to_user_id: string;
  requested_by_user_id: string;
  confirmed_by_user_id: string | null;
  amount: number | string;
  payment_method: GroupSettlement['paymentMethod'];
  note: string;
  status: GroupSettlement['status'];
  created_at: string;
  confirmed_at: string | null;
};

type MembershipRoleRow = {
  group_id: string;
  role: GroupRole;
};

export type GroupsServiceErrorCode =
  | 'missing_env'
  | 'not_authenticated'
  | 'not_found'
  | 'unknown';

export class GroupsServiceError extends Error {
  code: GroupsServiceErrorCode;

  constructor(code: GroupsServiceErrorCode, message: string) {
    super(message);
    this.name = 'GroupsServiceError';
    this.code = code;
  }
}

function ensureSupabaseEnv() {
  if (!hasSupabaseEnv) {
    throw new GroupsServiceError(
      'missing_env',
      'Configure EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_ANON_KEY antes de usar grupos.',
    );
  }
}

function ensureCurrentUserId(currentUserId?: string | null): string {
  if (!currentUserId) {
    throw new GroupsServiceError('not_authenticated', 'Usuario nao autenticado.');
  }

  return currentUserId;
}

function mapGroup(row: GroupRow): Group {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? '',
    shareCode: row.share_code,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapGroupMember(row: GroupMemberRow, profilesById: Map<string, ProfileRow>): GroupMember {
  const profile = profilesById.get(row.user_id);

  return {
    id: row.id,
    groupId: row.group_id,
    userId: row.user_id,
    fullName: profile?.full_name?.trim() || 'Usuario',
    email: profile?.email?.trim() || '',
    role: row.role,
    joinedAt: row.joined_at,
    removedAt: row.removed_at,
  };
}

function mapGroupShare(row: GroupSplitShareRow): GroupSplitShare {
  return {
    id: row.id,
    splitId: row.split_id,
    userId: row.user_id,
    amount: Number(row.share_amount),
    percentage: row.share_percentage === null ? null : Number(row.share_percentage),
  };
}

function mapGroupSplit(row: GroupSplitRow, sharesBySplitId: Map<string, GroupSplitShare[]>): GroupSplit {
  return {
    id: row.id,
    groupId: row.group_id,
    createdBy: row.created_by,
    ownerUserId: row.owner_user_id,
    title: row.title,
    description: row.description ?? '',
    kind: row.kind,
    splitMode: row.split_mode,
    totalAmount: Number(row.total_amount),
    occurredAt: row.occurred_at,
    createdAt: row.created_at,
    shares: sharesBySplitId.get(row.id) ?? [],
  };
}

function mapGroupSettlement(row: GroupSettlementRow): GroupSettlement {
  return {
    id: row.id,
    groupId: row.group_id,
    fromUserId: row.from_user_id,
    toUserId: row.to_user_id,
    requestedByUserId: row.requested_by_user_id,
    confirmedByUserId: row.confirmed_by_user_id,
    amount: Number(row.amount),
    paymentMethod: row.payment_method,
    note: row.note ?? '',
    status: row.status,
    createdAt: row.created_at,
    confirmedAt: row.confirmed_at,
  };
}

async function runRpc<T>(functionName: string, params: Record<string, unknown>): Promise<T> {
  ensureSupabaseEnv();

  const { data, error } = await supabase.rpc(functionName, params);

  if (error) {
    throw new GroupsServiceError('unknown', error.message);
  }

  return data as T;
}

async function fetchProfiles(userIds: string[]) {
  if (userIds.length === 0) {
    return new Map<string, ProfileRow>();
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .in('id', userIds);

  if (error) {
    throw new GroupsServiceError('unknown', error.message);
  }

  return new Map((data as ProfileRow[]).map((profile) => [profile.id, profile]));
}

async function fetchGroupGraph(groupIds: string[]) {
  if (groupIds.length === 0) {
    return {
      groups: [] as Group[],
      membersByGroupId: new Map<string, GroupMember[]>(),
      splitsByGroupId: new Map<string, GroupSplit[]>(),
      settlementsByGroupId: new Map<string, GroupSettlement[]>(),
    };
  }

  const [{ data: groupsData, error: groupsError }, { data: membersData, error: membersError }, { data: splitsData, error: splitsError }, { data: settlementsData, error: settlementsError }] =
    await Promise.all([
      supabase
        .from('groups')
        .select('id, title, description, share_code, created_by, created_at, updated_at')
        .in('id', groupIds)
        .order('updated_at', { ascending: false }),
      supabase
        .from('group_members')
        .select('id, group_id, user_id, role, joined_at, removed_at')
        .in('group_id', groupIds)
        .is('removed_at', null)
        .order('joined_at', { ascending: true }),
      supabase
        .from('group_splits')
        .select(
          'id, group_id, created_by, owner_user_id, title, description, kind, split_mode, total_amount, occurred_at, created_at',
        )
        .in('group_id', groupIds)
        .order('occurred_at', { ascending: false }),
      supabase
        .from('group_settlements')
        .select(
          'id, group_id, from_user_id, to_user_id, requested_by_user_id, confirmed_by_user_id, amount, payment_method, note, status, created_at, confirmed_at',
        )
        .in('group_id', groupIds)
        .order('created_at', { ascending: false }),
    ]);

  if (groupsError || membersError || splitsError || settlementsError) {
    throw new GroupsServiceError(
      'unknown',
      groupsError?.message ||
        membersError?.message ||
        splitsError?.message ||
        settlementsError?.message ||
        'Nao foi possivel carregar os grupos.',
    );
  }

  const memberRows = (membersData as GroupMemberRow[]) ?? [];
  const splitRows = (splitsData as GroupSplitRow[]) ?? [];
  const splitIds = splitRows.map((split) => split.id);

  const { data: sharesData, error: sharesError } = splitIds.length
    ? await supabase
        .from('group_split_shares')
        .select('id, split_id, user_id, share_amount, share_percentage')
        .in('split_id', splitIds)
    : { data: [], error: null };

  if (sharesError) {
    throw new GroupsServiceError('unknown', sharesError.message);
  }

  const userIds = [...new Set(memberRows.map((row) => row.user_id))];
  const profilesById = await fetchProfiles(userIds);

  const membersByGroupId = new Map<string, GroupMember[]>();
  memberRows.forEach((row) => {
    const mapped = mapGroupMember(row, profilesById);
    const current = membersByGroupId.get(row.group_id) ?? [];
    current.push(mapped);
    membersByGroupId.set(row.group_id, current);
  });

  const sharesBySplitId = new Map<string, GroupSplitShare[]>();
  ((sharesData as GroupSplitShareRow[]) ?? []).forEach((row) => {
    const current = sharesBySplitId.get(row.split_id) ?? [];
    current.push(mapGroupShare(row));
    sharesBySplitId.set(row.split_id, current);
  });

  const splitsByGroupId = new Map<string, GroupSplit[]>();
  splitRows.forEach((row) => {
    const mapped = mapGroupSplit(row, sharesBySplitId);
    const current = splitsByGroupId.get(row.group_id) ?? [];
    current.push(mapped);
    splitsByGroupId.set(row.group_id, current);
  });

  const settlementsByGroupId = new Map<string, GroupSettlement[]>();
  ((settlementsData as GroupSettlementRow[]) ?? []).forEach((row) => {
    const mapped = mapGroupSettlement(row);
    const current = settlementsByGroupId.get(row.group_id) ?? [];
    current.push(mapped);
    settlementsByGroupId.set(row.group_id, current);
  });

  return {
    groups: ((groupsData as GroupRow[]) ?? []).map(mapGroup),
    membersByGroupId,
    splitsByGroupId,
    settlementsByGroupId,
  };
}

export async function listGroups(currentUserId?: string | null): Promise<GroupListItem[]> {
  ensureSupabaseEnv();
  const safeCurrentUserId = ensureCurrentUserId(currentUserId);

  const { data, error } = await supabase
    .from('group_members')
    .select('group_id, role')
    .eq('user_id', safeCurrentUserId)
    .is('removed_at', null);

  if (error) {
    throw new GroupsServiceError('unknown', error.message);
  }

  const memberships = (data as MembershipRoleRow[]) ?? [];
  const groupIds = memberships.map((membership) => membership.group_id);

  if (groupIds.length === 0) {
    return [];
  }

  const roleByGroupId = new Map(memberships.map((membership) => [membership.group_id, membership.role]));
  const graph = await fetchGroupGraph(groupIds);

  return graph.groups.map((group) =>
    buildGroupListItem(
      group,
      graph.membersByGroupId.get(group.id) ?? [],
      graph.splitsByGroupId.get(group.id) ?? [],
      graph.settlementsByGroupId.get(group.id) ?? [],
      safeCurrentUserId,
      roleByGroupId.get(group.id) ?? 'member',
    ),
  );
}

export async function getGroupDetails(
  currentUserId: string | null | undefined,
  groupId: string,
): Promise<GroupDetailsData> {
  ensureSupabaseEnv();
  const safeCurrentUserId = ensureCurrentUserId(currentUserId);

  const { data: membershipData, error: membershipError } = await supabase
    .from('group_members')
    .select('group_id, role')
    .eq('group_id', groupId)
    .eq('user_id', safeCurrentUserId)
    .is('removed_at', null)
    .maybeSingle();

  if (membershipError) {
    throw new GroupsServiceError('unknown', membershipError.message);
  }

  const membership = membershipData as MembershipRoleRow | null;
  if (!membership) {
    throw new GroupsServiceError('not_found', 'Grupo nao encontrado.');
  }

  const graph = await fetchGroupGraph([groupId]);
  const group = graph.groups[0];

  if (!group) {
    throw new GroupsServiceError('not_found', 'Grupo nao encontrado.');
  }

  return buildGroupDetailsData(
    group,
    membership.role,
    graph.membersByGroupId.get(groupId) ?? [],
    graph.splitsByGroupId.get(groupId) ?? [],
    graph.settlementsByGroupId.get(groupId) ?? [],
    safeCurrentUserId,
  );
}

export async function createGroup(input: CreateGroupInput): Promise<string> {
  return runRpc<string>('create_group', {
    p_title: input.title.trim(),
    p_description: input.description.trim(),
  });
}

export async function joinGroupByCode(code: string): Promise<string> {
  return runRpc<string>('join_group_by_code', {
    p_share_code: code.trim().toUpperCase(),
  });
}

export async function createGroupSplit(input: CreateGroupSplitInput): Promise<string> {
  return runRpc<string>('create_group_split', {
    p_group_id: input.groupId,
    p_payload: serializeSplitPayload(input),
  });
}

export async function requestGroupSettlement(input: RequestSettlementInput): Promise<string> {
  return runRpc<string>('request_group_settlement', {
    p_group_id: input.groupId,
    p_to_user_id: input.toUserId,
    p_amount: Number(input.amount.toFixed(2)),
    p_payment_method: input.paymentMethod,
    p_note: input.note.trim(),
  });
}

export async function confirmGroupSettlement(settlementId: string): Promise<string> {
  return runRpc<string>('confirm_group_settlement', {
    p_settlement_id: settlementId,
  });
}

export async function removeGroupMember(groupId: string, userId: string): Promise<boolean> {
  return runRpc<boolean>('remove_group_member', {
    p_group_id: groupId,
    p_user_id: userId,
  });
}
