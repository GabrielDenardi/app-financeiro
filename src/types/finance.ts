import type { LucideIcon } from 'lucide-react-native';

export type { AccountType } from '../features/accounts/types';
export type { BudgetProgress } from '../features/budgets/types';
export type { CreditCard } from '../features/cards/types';
export type { DashboardData as HomeDashboardData, WeeklyFlowPoint } from '../features/dashboard/types';
export type { FinancialGoal } from '../features/goals/types';
export type { ImportBatch, ImportPreviewRow } from '../features/imports/types';
export type { ReportCategoryStat, ReportsSummary } from '../features/reports/types';
export type {
  CreateTransactionInput,
  EntryType,
  FinanceCategory,
  PaymentMethod,
  TransactionFeedItem as RecentTransaction,
  TransactionFeedItem as Transaction,
  TransactionSection as DailyTransactions,
} from '../features/transactions/types';

export interface SummaryStats {
  monthLabel: string;
  balance: number;
  income: number;
  expense: number;
  updatedAtLabel?: string;
}

export interface AccountConfig {
  label: string;
  icon: LucideIcon;
  gradient: string[];
  light: string;
}

export interface Account {
  id: string;
  name: string;
  type: import('../features/accounts/types').AccountType;
  balance: number;
  institution?: string;
  color?: string;
  is_active: boolean;
}

export interface MenuItem {
  icon: LucideIcon;
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

export type HelpCategory =
  | 'Transacoes'
  | 'Transações'
  | 'TransaÃ§Ãµes'
  | 'Cartoes'
  | 'Cartões'
  | 'CartÃµes'
  | 'Metas'
  | 'Grupos'
  | 'Orcamentos'
  | 'Orçamentos'
  | 'OrÃ§amentos'
  | 'Contas'
  | 'Voz'
  | 'Relatorios'
  | 'Relatórios'
  | 'RelatÃ³rios';

export interface ArticleHelp {
  id: string;
  category: HelpCategory;
  title: string;
  level: string;
  popular: boolean;
  steps: { id: number; text: string }[];
  tip: string;
}
