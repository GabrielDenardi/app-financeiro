import type { EntryType, PaymentMethod } from '../../transactions/types';

export type RecurringTransaction = {
  id: string;
  accountId: string;
  accountName: string;
  categoryId: string | null;
  categoryLabel: string;
  title: string;
  notes: string;
  amount: number;
  type: EntryType;
  paymentMethod: PaymentMethod;
  dayOfMonth: number;
  isActive: boolean;
  isVariable: boolean;
  lastExecutionMonth: string | null;
};

export type CreateRecurringTransactionInput = {
  accountId: string;
  categoryId: string | null;
  title: string;
  notes?: string;
  amount: number;
  type: EntryType;
  paymentMethod: PaymentMethod;
  dayOfMonth: number;
  isVariable: boolean;
};

export type UpdateRecurringTransactionInput = Partial<CreateRecurringTransactionInput> & {
  id: string;
  isActive?: boolean;
};

export type ConfirmRecurringTransactionInput = {
  ruleId: string;
  amount: number;
  note?: string;
  executionMonth?: string | null;
};
