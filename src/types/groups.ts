export type GroupRole = 'admin' | 'member';
export type GroupSplitKind = 'income' | 'expense';
export type SplitMode = 'equal' | 'percentage' | 'custom';
export type GroupSettlementStatus = 'pending' | 'confirmed';
export type SettlementPaymentMethod = 'PIX' | 'Dinheiro' | 'Transferencia';

export interface Group {
  id: string;
  title: string;
  description: string;
  shareCode: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface GroupMember {
  id: string;
  groupId: string;
  userId: string;
  fullName: string;
  email: string;
  role: GroupRole;
  joinedAt: string;
  removedAt: string | null;
}

export interface GroupSplitShare {
  id: string;
  splitId: string;
  userId: string;
  amount: number;
  percentage: number | null;
}

export interface GroupSplit {
  id: string;
  groupId: string;
  createdBy: string;
  ownerUserId: string;
  title: string;
  description: string;
  kind: GroupSplitKind;
  splitMode: SplitMode;
  totalAmount: number;
  occurredAt: string;
  createdAt: string;
  shares: GroupSplitShare[];
}

export interface GroupSettlement {
  id: string;
  groupId: string;
  fromUserId: string;
  toUserId: string;
  requestedByUserId: string;
  confirmedByUserId: string | null;
  amount: number;
  paymentMethod: SettlementPaymentMethod;
  note: string;
  status: GroupSettlementStatus;
  createdAt: string;
  confirmedAt: string | null;
}

export interface GroupBalanceRow {
  userId: string;
  fullName: string;
  amount: number;
}

export interface GroupSummary {
  totalDivided: number;
  settled: number;
  pending: number;
}

export interface GroupDetailsData {
  group: Group;
  currentUserRole: GroupRole;
  members: GroupMember[];
  splits: GroupSplit[];
  settlements: GroupSettlement[];
  summary: GroupSummary;
  balances: GroupBalanceRow[];
  currentUserNet: number;
}

export interface GroupListItem {
  group: Group;
  currentUserRole: GroupRole;
  members: GroupMember[];
  summary: GroupSummary;
  currentUserNet: number;
}

export interface CreateGroupInput {
  title: string;
  description: string;
}

export interface SplitParticipantInput {
  userId: string;
  amount: number;
  percentage?: number | null;
}

export interface CreateGroupSplitInput {
  groupId: string;
  title: string;
  description: string;
  kind: GroupSplitKind;
  splitMode: SplitMode;
  totalAmount: number;
  ownerUserId: string;
  occurredAt: string;
  shares: SplitParticipantInput[];
}

export interface RequestSettlementInput {
  groupId: string;
  toUserId: string;
  amount: number;
  paymentMethod: SettlementPaymentMethod;
  note: string;
}
