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
  date: string;
  dateISO: string;
  amount: number;
  category: string;
  paymentMethod: string;
  type: EntryType;
}

export interface HomeDashboardData {
  summary: SummaryStats;
  weeklyFlow: WeeklyFlowPoint[];
  recentTransactions: RecentTransaction[];
}


export type TransactionType = 'income' | 'expense';

export interface Transaction {
  id: string;
  title: string;
  date: string;       // Ex: "17 fev"
  dateISO: string;    // Ex: "2026-02-17T00:00:00Z" 
  amount: number;
  category: string;
  paymentMethod: string;
  type: 'income' | 'expense';
}

export interface DailyTransactions {
  date: string;
  data: Transaction[];
}

export interface MenuItem {
  icon: any;
  label: string;
  page?: string;
  toggle?: boolean;
  disabled?: boolean;
  value?: string;
}

export interface MenuSections {
  title: string;
  items: MenuItem[];
}