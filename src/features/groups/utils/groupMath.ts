import type {
  CreateGroupSplitInput,
  GroupBalanceRow,
  GroupDetailsData,
  GroupListItem,
  GroupMember,
  GroupSettlement,
  GroupSplit,
  GroupSummary,
  SplitParticipantInput,
} from '../../../types/groups';

function toCents(value: number): number {
  return Math.round(value * 100);
}

function fromCents(value: number): number {
  return value / 100;
}

function sortByRemainderDescending<T extends { remainder: number }>(items: T[]): T[] {
  return [...items].sort((left, right) => right.remainder - left.remainder);
}

type DirectedDebtMap = Map<string, number>;

function buildDirectedKey(debtorId: string, creditorId: string) {
  return `${debtorId}::${creditorId}`;
}

function getDirectedAmount(map: DirectedDebtMap, debtorId: string, creditorId: string) {
  return map.get(buildDirectedKey(debtorId, creditorId)) ?? 0;
}

function setDirectedAmount(map: DirectedDebtMap, debtorId: string, creditorId: string, amount: number) {
  const key = buildDirectedKey(debtorId, creditorId);

  if (amount === 0) {
    map.delete(key);
    return;
  }

  map.set(key, amount);
}

function addDirectedAmount(map: DirectedDebtMap, debtorId: string, creditorId: string, amount: number) {
  if (debtorId === creditorId || amount === 0) {
    return;
  }

  const nextAmount = getDirectedAmount(map, debtorId, creditorId) + amount;
  setDirectedAmount(map, debtorId, creditorId, nextAmount);
}

export function createEqualShares(totalAmount: number, userIds: string[]): SplitParticipantInput[] {
  const totalCents = toCents(totalAmount);

  if (totalCents <= 0) {
    throw new Error('O valor total precisa ser maior que zero.');
  }

  if (userIds.length === 0) {
    throw new Error('Selecione ao menos um participante.');
  }

  const baseAmount = Math.floor(totalCents / userIds.length);
  const remainder = totalCents % userIds.length;

  return userIds.map((userId, index) => ({
    userId,
    amount: fromCents(baseAmount + (index < remainder ? 1 : 0)),
    percentage: Number((100 / userIds.length).toFixed(4)),
  }));
}

export function createPercentageShares(
  totalAmount: number,
  participants: Array<{ userId: string; percentage: number }>,
): SplitParticipantInput[] {
  const totalCents = toCents(totalAmount);

  if (participants.length === 0) {
    throw new Error('Selecione ao menos um participante.');
  }

  const totalPercentage = participants.reduce((sum, participant) => sum + participant.percentage, 0);
  if (Math.abs(totalPercentage - 100) > 0.05) {
    throw new Error('As porcentagens devem somar 100.');
  }

  const calculated = participants.map((participant) => {
    const exactCents = (totalCents * participant.percentage) / 100;
    const cents = Math.floor(exactCents);
    return {
      ...participant,
      cents,
      remainder: exactCents - cents,
    };
  });

  let distributedCents = calculated.reduce((sum, participant) => sum + participant.cents, 0);
  const byRemainder = sortByRemainderDescending(calculated);

  for (let index = 0; distributedCents < totalCents; index += 1) {
    byRemainder[index % byRemainder.length].cents += 1;
    distributedCents += 1;
  }

  return participants.map((participant) => {
    const found = byRemainder.find((item) => item.userId === participant.userId);
    return {
      userId: participant.userId,
      percentage: participant.percentage,
      amount: fromCents(found?.cents ?? 0),
    };
  });
}

export function validateCustomShares(
  totalAmount: number,
  participants: Array<{ userId: string; amount: number }>,
): SplitParticipantInput[] {
  const totalCents = toCents(totalAmount);
  const distributed = participants.reduce((sum, participant) => sum + toCents(participant.amount), 0);

  if (participants.length === 0) {
    throw new Error('Selecione ao menos um participante.');
  }

  if (distributed !== totalCents) {
    throw new Error('A soma dos valores personalizados deve ser igual ao total.');
  }

  return participants.map((participant) => ({
    userId: participant.userId,
    amount: participant.amount,
    percentage: Number(((toCents(participant.amount) / totalCents) * 100).toFixed(4)),
  }));
}

export function buildPairwiseDebts(
  splits: GroupSplit[],
  settlements: GroupSettlement[],
): DirectedDebtMap {
  const rawMap: DirectedDebtMap = new Map();

  splits.forEach((split) => {
    split.shares.forEach((share) => {
      const amount = toCents(share.amount);
      if (amount === 0 || share.userId === split.ownerUserId) {
        return;
      }

      if (split.kind === 'expense') {
        addDirectedAmount(rawMap, share.userId, split.ownerUserId, amount);
        return;
      }

      addDirectedAmount(rawMap, split.ownerUserId, share.userId, amount);
    });
  });

  settlements
    .filter((settlement) => settlement.status === 'confirmed')
    .forEach((settlement) => {
      addDirectedAmount(
        rawMap,
        settlement.fromUserId,
        settlement.toUserId,
        -toCents(settlement.amount),
      );
    });

  const normalizedMap: DirectedDebtMap = new Map();
  const participants = new Set<string>();

  rawMap.forEach((_value, key) => {
    const [debtorId, creditorId] = key.split('::');
    participants.add(debtorId);
    participants.add(creditorId);
  });

  const ids = [...participants];
  ids.forEach((leftId) => {
    ids.forEach((rightId) => {
      if (leftId >= rightId) {
        return;
      }

      const forward = getDirectedAmount(rawMap, leftId, rightId);
      const reverse = getDirectedAmount(rawMap, rightId, leftId);
      const net = forward - reverse;

      if (net > 0) {
        setDirectedAmount(normalizedMap, leftId, rightId, net);
      } else if (net < 0) {
        setDirectedAmount(normalizedMap, rightId, leftId, Math.abs(net));
      }
    });
  });

  return normalizedMap;
}

export function computeGroupSummary(
  splits: GroupSplit[],
  settlements: GroupSettlement[],
): GroupSummary {
  const pairwiseDebts = buildPairwiseDebts(splits, settlements);

  return {
    totalDivided: splits.reduce((sum, split) => sum + split.totalAmount, 0),
    settled: settlements
      .filter((settlement) => settlement.status === 'confirmed')
      .reduce((sum, settlement) => sum + settlement.amount, 0),
    pending: [...pairwiseDebts.values()].reduce((sum, cents) => sum + fromCents(cents), 0),
  };
}

export function computeCurrentUserBalances(
  members: GroupMember[],
  splits: GroupSplit[],
  settlements: GroupSettlement[],
  currentUserId: string,
): { balances: GroupBalanceRow[]; currentUserNet: number } {
  const pairwiseDebts = buildPairwiseDebts(splits, settlements);

  const balances = members
    .filter((member) => member.userId !== currentUserId && member.removedAt === null)
    .map((member) => {
      const owesCurrent = getDirectedAmount(pairwiseDebts, member.userId, currentUserId);
      const currentOwes = getDirectedAmount(pairwiseDebts, currentUserId, member.userId);
      return {
        userId: member.userId,
        fullName: member.fullName,
        amount: fromCents(owesCurrent - currentOwes),
      };
    })
    .sort((left, right) => left.fullName.localeCompare(right.fullName));

  const currentUserNet = balances.reduce((sum, balance) => sum + balance.amount, 0);

  return {
    balances,
    currentUserNet,
  };
}

export function buildGroupDetailsData(
  group: GroupListItem['group'],
  currentUserRole: GroupListItem['currentUserRole'],
  members: GroupMember[],
  splits: GroupSplit[],
  settlements: GroupSettlement[],
  currentUserId: string,
): GroupDetailsData {
  const { balances, currentUserNet } = computeCurrentUserBalances(
    members,
    splits,
    settlements,
    currentUserId,
  );

  return {
    group,
    currentUserRole,
    members,
    splits,
    settlements,
    summary: computeGroupSummary(splits, settlements),
    balances,
    currentUserNet,
  };
}

export function buildGroupListItem(
  group: GroupListItem['group'],
  members: GroupMember[],
  splits: GroupSplit[],
  settlements: GroupSettlement[],
  currentUserId: string,
  currentUserRole: GroupListItem['currentUserRole'],
): GroupListItem {
  const { currentUserNet } = computeCurrentUserBalances(members, splits, settlements, currentUserId);

  return {
    group,
    members,
    currentUserRole,
    currentUserNet,
    summary: computeGroupSummary(splits, settlements),
  };
}

export function serializeSplitPayload(input: CreateGroupSplitInput) {
  return {
    title: input.title.trim(),
    description: input.description.trim(),
    kind: input.kind,
    split_mode: input.splitMode,
    total_amount: Number(input.totalAmount.toFixed(2)),
    owner_user_id: input.ownerUserId,
    occurred_at: input.occurredAt,
    shares: input.shares.map((share) => ({
      user_id: share.userId,
      amount: Number(share.amount.toFixed(2)),
      percentage:
        typeof share.percentage === 'number' ? Number(share.percentage.toFixed(4)) : null,
    })),
  };
}
