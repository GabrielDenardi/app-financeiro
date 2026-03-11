export type EntryType = 'income' | 'expense';

export type PaymentMethod =
  | 'Pix'
  | 'Transferencia'
  | 'Dinheiro'
  | 'Cartao de credito'
  | 'Cartao de debito'
  | 'Boleto';

export type TransactionSourceType =
  | 'manual'
  | 'transfer'
  | 'group_split'
  | 'group_settlement'
  | 'goal_contribution'
  | 'imported'
  | 'card_payment'
  | 'card_installment';

export type FinanceCategory = {
  id: string;
  code: string;
  label: string;
  kind: 'income' | 'expense' | 'both';
  color: string;
  icon: string;
};

export type TransactionFeedItem = {
  id: string;
  title: string;
  notes?: string;
  amount: number;
  type: EntryType;
  category: string;
  categoryId?: string | null;
  categoryColor?: string;
  paymentMethod: string;
  sourceType?: TransactionSourceType;
  occurredAt?: string;
  occurredOn?: string;
  dateLabel?: string;
  date?: string;
  dateISO?: string;
  accountName?: string;
  cardName?: string;
  installmentLabel?: string;
  groupId?: string | null;
};

export type TransactionSection = {
  date: string;
  data: TransactionFeedItem[];
};

export type TransactionFilters = {
  search?: string;
  type?: 'all' | EntryType;
  month?: number | null;
  paymentMethod?: string | null;
  from?: string | null;
  to?: string | null;
};

export type CreateTransactionInput = {
  accountId: string;
  categoryId: string | null;
  title: string;
  amount: number;
  type: EntryType;
  paymentMethod: string;
  occurredAt: string;
  notes?: string;
  isRecurring?: boolean;
};
