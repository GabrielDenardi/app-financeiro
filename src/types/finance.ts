import { LucideIcon } from 'lucide-react-native';

//Dashboard
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

//Transaction
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

//Menu
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


//Account 
export type AccountType = 'checking' | 'savings' | 'credit_card' | 'investment' | 'cash' | 'other';

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  balance: number;
  institution?: string;
  color?: string;
  is_active: boolean;
}

export interface AccountConfig {
  label: string;
  icon: LucideIcon;
  gradient: string[];
  light: string;
}

//Card 
export interface ExpenseData {
  description: string;
  card: string;
  category: string;
  amount: number;
  installments: string;
  date: string;
}

export interface Props {
  visible: boolean;
  onClose: () => void;
  onSave?: (data: ExpenseData) => void;
}