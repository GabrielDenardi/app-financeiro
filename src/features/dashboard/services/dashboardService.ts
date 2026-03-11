import { requireCurrentUserId } from '../../../lib/auth';
import { supabase } from '../../../lib/supabase';
import { formatMonthDate, monthLabel, weekBucket } from '../../finance/utils';
import { getAccountsOverview } from '../../accounts/services/accountsService';
import { listTransactionFeed, summarizeTransactions } from '../../transactions/services/transactionsService';
import type { DashboardCategoryBreakdown, DashboardData, WeeklyFlowPoint } from '../types';

type GoalCountRow = {
  id: string;
};

type GroupMembershipRow = {
  group_id: string;
};

function buildWeeklyFlow(items: DashboardData['recentTransactions']): WeeklyFlowPoint[] {
  const base: Record<WeeklyFlowPoint['weekLabel'], WeeklyFlowPoint> = {
    S1: { weekLabel: 'S1', income: 0, expense: 0 },
    S2: { weekLabel: 'S2', income: 0, expense: 0 },
    S3: { weekLabel: 'S3', income: 0, expense: 0 },
    S4: { weekLabel: 'S4', income: 0, expense: 0 },
    S5: { weekLabel: 'S5', income: 0, expense: 0 },
  };

  items.forEach((item) => {
    const bucket = weekBucket(item.occurredOn ?? new Date().toISOString());
    if (item.type === 'income') {
      base[bucket].income += item.amount;
    } else {
      base[bucket].expense += item.amount;
    }
  });

  return [base.S1, base.S2, base.S3, base.S4, base.S5];
}

function buildCategorySpending(items: DashboardData['recentTransactions']): DashboardCategoryBreakdown[] {
  const totals = new Map<string, DashboardCategoryBreakdown>();
  let totalExpense = 0;

  items.forEach((item) => {
    if (item.type !== 'expense') {
      return;
    }

    totalExpense += item.amount;
    const current = totals.get(item.category) ?? {
      category: item.category,
      amount: 0,
      color: item.categoryColor ?? '#94A3B8',
      share: 0,
    };

    current.amount += item.amount;
    totals.set(item.category, current);
  });

  return [...totals.values()]
    .sort((left, right) => right.amount - left.amount)
    .slice(0, 5)
    .map((item) => ({
      ...item,
      share: totalExpense > 0 ? Number(((item.amount / totalExpense) * 100).toFixed(1)) : 0,
    }));
}

export async function getHomeDashboard(monthDate = formatMonthDate()): Promise<DashboardData> {
  const userId = await requireCurrentUserId();
  const date = new Date(monthDate);
  const from = new Date(date.getFullYear(), date.getMonth(), 1).toISOString().slice(0, 10);
  const to = new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().slice(0, 10);

  const [accountsOverview, transactionFeed, goalsData, membershipsData] = await Promise.all([
    getAccountsOverview(),
    listTransactionFeed(userId, { from, to }),
    supabase.from('financial_goals').select('id').eq('user_id', userId).eq('status', 'active'),
    supabase.from('group_members').select('group_id').eq('user_id', userId).is('removed_at', null),
  ]);

  if (goalsData.error || membershipsData.error) {
    throw new Error(goalsData.error?.message ?? membershipsData.error?.message ?? 'Nao foi possivel carregar o dashboard.');
  }

  const totals = summarizeTransactions(transactionFeed);
  const goalsCount = ((goalsData.data as GoalCountRow[] | null) ?? []).length;
  const groupsCount = new Set(((membershipsData.data as GroupMembershipRow[] | null) ?? []).map((row) => row.group_id)).size;

  return {
    summary: {
      monthLabel: monthLabel(monthDate),
      balance: totals.income - totals.expense,
      income: totals.income,
      expense: totals.expense,
      netWorth: accountsOverview.totalBalance,
      accountsCount: accountsOverview.accounts.filter((account) => account.isActive).length,
      goalsCount,
      groupsCount,
    },
    weeklyFlow: buildWeeklyFlow(transactionFeed),
    recentTransactions: transactionFeed.slice(0, 5),
    categorySpending: buildCategorySpending(transactionFeed),
  };
}
