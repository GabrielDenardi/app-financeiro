import { requireCurrentUserId } from '../../../lib/auth';
import { supabase } from '../../../lib/supabase';
import { endOfMonth, startOfMonth, toNumber } from '../../finance/utils';
import type {
  AccountBalanceSnapshot,
  AccountsOverview,
  CreateAccountInput,
  CreateTransferInput,
  UpdateAccountInput,
} from '../types';

type AccountRow = {
  id: string;
  name: string;
  type: AccountBalanceSnapshot['type'];
  institution: string;
  color: string;
  opening_balance: number | string;
  is_active: boolean;
  is_default: boolean;
  display_order: number;
};

type AccountBalanceRow = {
  account_id: string;
  current_balance: number | string;
};

type MonthlyTransactionRow = {
  type: 'income' | 'expense';
  amount: number | string;
};

function mapAccount(
  row: AccountRow,
  balanceById: Map<string, number>,
): AccountBalanceSnapshot {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    institution: row.institution ?? '',
    color: row.color ?? '#2563EB',
    openingBalance: toNumber(row.opening_balance),
    currentBalance: balanceById.get(row.id) ?? toNumber(row.opening_balance),
    isActive: Boolean(row.is_active),
    isDefault: Boolean(row.is_default),
    displayOrder: row.display_order ?? 0,
  };
}

export async function listAccounts(): Promise<AccountBalanceSnapshot[]> {
  const userId = await requireCurrentUserId();

  const [{ data: accountsData, error: accountsError }, { data: balancesData, error: balancesError }] =
    await Promise.all([
      supabase
        .from('personal_accounts')
        .select('id, name, type, institution, color, opening_balance, is_active, is_default, display_order')
        .eq('user_id', userId)
        .order('display_order', { ascending: true })
        .order('created_at', { ascending: true }),
      supabase
        .from('v_account_current_balance')
        .select('account_id, current_balance')
        .eq('user_id', userId),
    ]);

  if (accountsError || balancesError) {
    throw new Error(accountsError?.message ?? balancesError?.message ?? 'Nao foi possivel carregar as contas.');
  }

  const balanceById = new Map(
    ((balancesData as AccountBalanceRow[] | null) ?? []).map((row) => [
      row.account_id,
      toNumber(row.current_balance),
    ]),
  );

  return ((accountsData as AccountRow[] | null) ?? []).map((row) => mapAccount(row, balanceById));
}

export async function getAccountsOverview(): Promise<AccountsOverview> {
  const userId = await requireCurrentUserId();
  const accounts = await listAccounts();
  const now = new Date();
  const from = startOfMonth(now).toISOString().slice(0, 10);
  const to = endOfMonth(now).toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from('personal_transactions')
    .select('type, amount')
    .eq('user_id', userId)
    .eq('include_in_reports', true)
    .gte('occurred_on', from)
    .lte('occurred_on', to);

  if (error) {
    throw new Error(error.message);
  }

  const monthlyTotals = ((data as MonthlyTransactionRow[] | null) ?? []).reduce(
    (accumulator, item) => {
      if (item.type === 'income') {
        accumulator.monthlyIncome += toNumber(item.amount);
      } else {
        accumulator.monthlyExpense += toNumber(item.amount);
      }

      return accumulator;
    },
    { monthlyIncome: 0, monthlyExpense: 0 },
  );

  const totalBalance = accounts.reduce((sum, account) => sum + account.currentBalance, 0);
  const totalLiabilities = Math.abs(
    accounts.filter((account) => account.currentBalance < 0).reduce((sum, account) => sum + account.currentBalance, 0),
  );

  return {
    accounts,
    totalBalance,
    totalAssets: totalBalance + totalLiabilities,
    totalLiabilities,
    monthlyIncome: monthlyTotals.monthlyIncome,
    monthlyExpense: monthlyTotals.monthlyExpense,
  };
}

export async function createAccount(input: CreateAccountInput): Promise<string> {
  const userId = await requireCurrentUserId();
  const { data, error } = await supabase
    .from('personal_accounts')
    .insert({
      user_id: userId,
      name: input.name.trim(),
      type: input.type,
      institution: input.institution?.trim() ?? '',
      color: input.color ?? '#2563EB',
      opening_balance: Number(input.openingBalance.toFixed(2)),
      is_active: true,
    })
    .select('id')
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return (data as { id: string }).id;
}

export async function updateAccount(input: UpdateAccountInput): Promise<void> {
  const payload: Record<string, unknown> = {};

  if (typeof input.name === 'string') {
    payload.name = input.name.trim();
  }

  if (typeof input.type === 'string') {
    payload.type = input.type;
  }

  if (typeof input.institution === 'string') {
    payload.institution = input.institution.trim();
  }

  if (typeof input.color === 'string') {
    payload.color = input.color;
  }

  if (typeof input.openingBalance === 'number') {
    payload.opening_balance = Number(input.openingBalance.toFixed(2));
  }

  if (typeof input.isActive === 'boolean') {
    payload.is_active = input.isActive;
    payload.archived_at = input.isActive ? null : new Date().toISOString();
  }

  const { error } = await supabase.from('personal_accounts').update(payload).eq('id', input.id);

  if (error) {
    throw new Error(error.message);
  }
}

export async function archiveAccount(accountId: string): Promise<void> {
  await updateAccount({
    id: accountId,
    isActive: false,
  });
}

export async function createTransfer(input: CreateTransferInput): Promise<string> {
  const { data, error } = await supabase.rpc('create_account_transfer', {
    p_from_account_id: input.fromAccountId,
    p_to_account_id: input.toAccountId,
    p_amount: Number(input.amount.toFixed(2)),
    p_note: input.note?.trim() ?? '',
    p_occurred_at: input.occurredAt ?? new Date().toISOString(),
  });

  if (error) {
    throw new Error(error.message);
  }

  return data as string;
}
