import type { TransactionFeedItem } from '../../transactions/types';

export type DashboardSummary = {
  monthLabel: string;
  balance: number;
  income: number;
  expense: number;
  netWorth?: number;
  accountsCount?: number;
  goalsCount?: number;
  groupsCount?: number;
  updatedAtLabel?: string;
};

export type DashboardCategoryBreakdown = {
  category: string;
  amount: number;
  color: string;
  share: number;
};

export type WeeklyFlowPoint = {
  weekLabel: 'S1' | 'S2' | 'S3' | 'S4' | 'S5';
  income: number;
  expense: number;
};

export type DashboardData = {
  summary: DashboardSummary;
  weeklyFlow: WeeklyFlowPoint[];
  recentTransactions: TransactionFeedItem[];
  categorySpending?: DashboardCategoryBreakdown[];
};
