import { requireCurrentUserId } from '../../../lib/auth';
import { supabase } from '../../../lib/supabase';
import type {
  ConfirmRecurringTransactionInput,
  CreateRecurringTransactionInput,
  RecurringTransaction,
  UndoRecurringConfirmationInput,
  UpdateRecurringTransactionInput,
} from '../types';

type RecurringRuleRow = {
  id: string;
  account_id: string;
  category_id: string | null;
  title: string;
  notes: string;
  amount: number | string;
  type: RecurringTransaction['type'];
  payment_method: RecurringTransaction['paymentMethod'];
  day_of_month: number;
  is_active: boolean;
  is_variable: boolean;
  personal_accounts?: { name: string } | Array<{ name: string }> | null;
  financial_categories?: { label: string; color: string } | Array<{ label: string; color: string }> | null;
};

type RecurringExecutionRow = {
  rule_id: string;
  execution_month: string;
};

function toNumber(value: number | string) {
  return typeof value === 'number' ? value : Number(value ?? 0);
}

function mapRule(
  row: RecurringRuleRow,
  executionByRuleId: Map<string, string>,
): RecurringTransaction {
  const account = Array.isArray(row.personal_accounts) ? row.personal_accounts[0] : row.personal_accounts;
  const category = Array.isArray(row.financial_categories)
    ? row.financial_categories[0]
    : row.financial_categories;

  return {
    id: row.id,
    accountId: row.account_id,
    accountName: account?.name ?? 'Conta',
    categoryId: row.category_id,
    categoryLabel: category?.label ?? 'Sem categoria',
    categoryColor: category?.color ?? '#94A3B8',
    title: row.title,
    notes: row.notes ?? '',
    amount: toNumber(row.amount),
    type: row.type,
    paymentMethod: row.payment_method,
    dayOfMonth: row.day_of_month,
    isActive: Boolean(row.is_active),
    isVariable: Boolean(row.is_variable),
    lastExecutionMonth: executionByRuleId.get(row.id) ?? null,
  };
}

export async function listRecurringTransactions(): Promise<RecurringTransaction[]> {
  const userId = await requireCurrentUserId();
  const [{ data: rulesData, error: rulesError }, { data: executionsData, error: executionsError }] =
    await Promise.all([
      supabase
        .from('recurring_transaction_rules')
        .select(
          `
            id,
            account_id,
            category_id,
            title,
            notes,
            amount,
            type,
            payment_method,
            day_of_month,
            is_active,
            is_variable,
            personal_accounts(name),
            financial_categories(label, color)
          `,
        )
        .eq('user_id', userId)
        .order('created_at', { ascending: false }),
      supabase
        .from('recurring_transaction_executions')
        .select('rule_id, execution_month')
        .eq('user_id', userId)
        .order('execution_month', { ascending: false }),
    ]);

  if (rulesError || executionsError) {
    throw new Error(rulesError?.message ?? executionsError?.message ?? 'Não foi possível carregar as recorrências.');
  }

  const executionByRuleId = new Map<string, string>();
  ((executionsData as RecurringExecutionRow[] | null) ?? []).forEach((row) => {
    if (!executionByRuleId.has(row.rule_id)) {
      executionByRuleId.set(row.rule_id, row.execution_month);
    }
  });

  return ((rulesData as RecurringRuleRow[] | null) ?? []).map((row) =>
    mapRule(row, executionByRuleId),
  );
}

export async function createRecurringTransaction(input: CreateRecurringTransactionInput): Promise<string> {
  const userId = await requireCurrentUserId();
  const { data, error } = await supabase
    .from('recurring_transaction_rules')
    .insert({
      user_id: userId,
      account_id: input.accountId,
      category_id: input.categoryId,
      title: input.title.trim(),
      notes: input.notes?.trim() ?? '',
      amount: Number(input.amount.toFixed(2)),
      type: input.type,
      payment_method: input.paymentMethod,
      cadence: 'monthly',
      day_of_month: input.dayOfMonth,
      is_active: true,
      is_variable: input.isVariable,
    })
    .select('id')
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return (data as { id: string }).id;
}

export async function updateRecurringTransaction(input: UpdateRecurringTransactionInput): Promise<void> {
  const payload: Record<string, unknown> = {};

  if (typeof input.accountId === 'string') payload.account_id = input.accountId;
  if ('categoryId' in input) payload.category_id = input.categoryId;
  if (typeof input.title === 'string') payload.title = input.title.trim();
  if (typeof input.notes === 'string') payload.notes = input.notes.trim();
  if (typeof input.amount === 'number') payload.amount = Number(input.amount.toFixed(2));
  if (typeof input.type === 'string') payload.type = input.type;
  if (typeof input.paymentMethod === 'string') payload.payment_method = input.paymentMethod;
  if (typeof input.dayOfMonth === 'number') payload.day_of_month = input.dayOfMonth;
  if (typeof input.isActive === 'boolean') payload.is_active = input.isActive;
  if (typeof input.isVariable === 'boolean') payload.is_variable = input.isVariable;

  const { error } = await supabase.from('recurring_transaction_rules').update(payload).eq('id', input.id);

  if (error) {
    throw new Error(error.message);
  }
}

export async function deleteRecurringTransaction(ruleId: string): Promise<void> {
  const { error } = await supabase.from('recurring_transaction_rules').delete().eq('id', ruleId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function confirmRecurringTransaction(input: ConfirmRecurringTransactionInput): Promise<string> {
  const { data, error } = await supabase.rpc('confirm_recurring_transaction', {
    p_rule_id: input.ruleId,
    p_amount: Number(input.amount.toFixed(2)),
    p_note: input.note?.trim() ?? '',
    p_execution_month: input.executionMonth ?? null,
  });

  if (error) {
    throw new Error(error.message);
  }

  return data as string;
}

export async function undoRecurringConfirmation(input: UndoRecurringConfirmationInput): Promise<void> {
  const userId = await requireCurrentUserId();

  const { data, error } = await supabase
    .from('recurring_transaction_executions')
    .select('id, transaction_id')
    .eq('user_id', userId)
    .eq('rule_id', input.ruleId)
    .eq('execution_month', input.executionMonth)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error('Confirmação deste mês não encontrada.');
  }

  const execution = data as { id: string; transaction_id: string | null };

  const { error: deleteExecutionError } = await supabase
    .from('recurring_transaction_executions')
    .delete()
    .eq('id', execution.id)
    .eq('user_id', userId);

  if (deleteExecutionError) {
    throw new Error(deleteExecutionError.message);
  }

  if (execution.transaction_id) {
    const { error: deleteTransactionError } = await supabase
      .from('personal_transactions')
      .delete()
      .eq('id', execution.transaction_id)
      .eq('user_id', userId);

    if (deleteTransactionError) {
      throw new Error(deleteTransactionError.message);
    }
  }
}
