export type EntryType = 'income' | 'expense';

export interface SummaryStats {
  monthLabel: string;
  balance: number;
  income: number;
  expense: number;
  updatedAtLabel: string;
}

export interface WeeklyFlowPoint {
  weekLabel: 'S1' | 'S2' | 'S3' | 'S4' | 'S5';
  income: number;
  expense: number;
}

export interface RecentTransaction {
  id: string;
  title: string;
  category: string;
  dateISO: string;
  type: EntryType;
  amount: number;
}

export interface HomeDashboardData {
  summary: SummaryStats;
  weeklyFlow: WeeklyFlowPoint[];
  recentTransactions: RecentTransaction[];
}
