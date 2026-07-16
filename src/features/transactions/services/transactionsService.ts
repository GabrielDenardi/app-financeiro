import { requireCurrentUserId } from '../../../lib/auth';
import { supabase } from '../../../lib/supabase';
import { formatShortDate } from '../../../utils/format';
import { endOfMonth, formatInstallmentLabel, groupTransactionsByDate, roundCurrency, startOfMonth, toNumber } from '../../finance/utils';
import type {
  CreateTransactionInput,
  FinanceCategory,
  TransactionFeedItem,
  TransactionFilters,
  TransactionSection,
  UpdateTransactionInput,
} from '../types';

type CategoryRow = {
  id: string;
  code: string;
  label: string;
  kind: FinanceCategory['kind'];
  color: string;
  icon: string;
};

type PersonalTransactionRow = {
  id: string;
  title: string;
  notes: string;
  description: string;
  amount: number | string;
  type: TransactionFeedItem['type'];
  payment_method: string;
  source_type: TransactionFeedItem['sourceType'];
  occurred_at: string;
  occurred_on: string;
  group_id: string | null;
  personal_accounts?: { name: string } | Array<{ name: string }> | null;
  financial_categories?: { id: string; label: string; color: string } | Array<{ id: string; label: string; color: string }> | null;
  credit_cards?: { name: string } | Array<{ name: string }> | null;
};

type CardInstallmentRow = {
  installment_id: string;
  title: string;
  notes: string;
  amount: number | string;
  invoice_month: string;
  due_date: string;
  card_name: string;
  category_id: string | null;
  category_label: string | null;
  category_color: string | null;
  installment_number: number;
  total_installments: number;
};

function applyMonthFilter(filters: TransactionFilters) {
  if (typeof filters.month !== 'number') {
    return null;
  }

  const currentYear = new Date().getFullYear();
  return {
    from: new Date(currentYear, filters.month, 1),
    to: new Date(currentYear, filters.month + 1, 0, 23, 59, 59, 999),
  };
}

function resolveDateRange(filters: TransactionFilters) {
  const explicitRange =
    filters.from && filters.to
      ? {
          from: new Date(filters.from),
          to: new Date(filters.to),
        }
      : null;

  if (explicitRange) {
    return explicitRange;
  }

  return applyMonthFilter(filters);
}

function matchesSearch(item: TransactionFeedItem, search: string) {
  const normalizedSearch = search.trim().toLowerCase();
  if (!normalizedSearch) {
    return true;
  }

  return (
    item.title.toLowerCase().includes(normalizedSearch) ||
    item.category.toLowerCase().includes(normalizedSearch) ||
    item.paymentMethod.toLowerCase().includes(normalizedSearch) ||
    (item.notes ?? '').toLowerCase().includes(normalizedSearch)
  );
}

function formatPaymentMethodLabel(paymentMethod: string) {
  switch (paymentMethod) {
    case 'Transferencia':
      return 'Transferência';
    case 'Cartao de credito':
      return 'Cartão de crédito';
    case 'Cartao de debito':
      return 'Cartão de débito';
    default:
      return paymentMethod;
  }
}

function mapPersonalTransaction(row: PersonalTransactionRow): TransactionFeedItem {
  const occurredOn = row.occurred_on ?? row.occurred_at.slice(0, 10);
  const account = Array.isArray(row.personal_accounts) ? row.personal_accounts[0] : row.personal_accounts;
  const categoryRow = Array.isArray(row.financial_categories)
    ? row.financial_categories[0]
    : row.financial_categories;
  const card = Array.isArray(row.credit_cards) ? row.credit_cards[0] : row.credit_cards;
  const category = categoryRow?.label ?? 'Sem categoria';

  return {
    id: row.id,
    title: row.title,
    notes: row.notes || row.description || '',
    amount: toNumber(row.amount),
    type: row.type,
    category,
    categoryId: categoryRow?.id ?? null,
    categoryColor: categoryRow?.color ?? '#94A3B8',
    paymentMethod: formatPaymentMethodLabel(row.payment_method),
    sourceType: row.source_type,
    occurredAt: row.occurred_at,
    occurredOn,
    dateLabel: formatShortDate(occurredOn),
    date: formatShortDate(occurredOn),
    dateISO: occurredOn,
    accountName: account?.name ?? undefined,
    cardName: card?.name ?? undefined,
    groupId: row.group_id,
  };
}

function mapCardInstallment(row: CardInstallmentRow): TransactionFeedItem {
  // Agrupar/ordenar pela mesma data exibida no card (vencimento), não pelo mês
  // da fatura — caso contrário o cabeçalho da seção não bate com a data do card.
  const occurredOn = row.due_date;

  return {
    id: `installment-${row.installment_id}`,
    title: row.title,
    notes: row.notes ?? '',
    amount: toNumber(row.amount),
    type: 'expense',
    category: row.category_label ?? 'Sem categoria',
    categoryId: row.category_id,
    categoryColor: row.category_color ?? '#94A3B8',
    paymentMethod: 'Cartão de crédito',
    sourceType: 'card_installment',
    occurredAt: row.due_date,
    occurredOn,
    dateLabel: formatShortDate(row.due_date),
    date: formatShortDate(row.due_date),
    dateISO: row.due_date,
    cardName: row.card_name,
    installmentLabel: formatInstallmentLabel(row.installment_number, row.total_installments),
  };
}

export async function listCategories(): Promise<FinanceCategory[]> {
  const { data, error } = await supabase
    .from('financial_categories')
    .select('id, code, label, kind, color, icon')
    .order('display_order', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return ((data as CategoryRow[] | null) ?? []).map((row) => ({
    id: row.id,
    code: row.code,
    label: row.label,
    kind: row.kind,
    color: row.color,
    icon: row.icon,
  }));
}

export async function listTransactionFeed(
  userId: string,
  filters: TransactionFilters = {},
): Promise<TransactionFeedItem[]> {
  const range = resolveDateRange(filters);

  let personalQuery = supabase
    .from('personal_transactions')
    .select(
      `
        id,
        title,
        notes,
        description,
        amount,
        type,
        payment_method,
        source_type,
        occurred_at,
        occurred_on,
        group_id,
        personal_accounts(name),
        financial_categories(id, label, color),
        credit_cards(name)
      `,
    )
    .eq('user_id', userId)
    .order('occurred_on', { ascending: false });

  let installmentsQuery = supabase
    .from('v_card_installment_feed')
    .select(
      'installment_id, title, notes, amount, invoice_month, due_date, card_name, category_id, category_label, category_color, installment_number, total_installments',
    )
    .eq('user_id', userId)
    .order('invoice_month', { ascending: false });

  if (range) {
    const fromDate = range.from.toISOString().slice(0, 10);
    const toDate = range.to.toISOString().slice(0, 10);

    personalQuery = personalQuery.gte('occurred_on', fromDate).lte('occurred_on', toDate);
    installmentsQuery = installmentsQuery.gte('invoice_month', fromDate).lte('invoice_month', toDate);
  }

  if (filters.accountId) {
    personalQuery = personalQuery.eq('account_id', filters.accountId);
  }

  // Parcelas de cartão não pertencem a uma conta (só o pagamento da fatura
  // debita a conta) — com filtro de conta ativo, ficam de fora do feed.
  const installmentsPromise = filters.accountId
    ? Promise.resolve({ data: [] as CardInstallmentRow[] | null, error: null })
    : installmentsQuery;

  const [{ data: personalData, error: personalError }, { data: installmentData, error: installmentError }] =
    await Promise.all([personalQuery, installmentsPromise]);

  if (personalError || installmentError) {
    throw new Error(personalError?.message ?? installmentError?.message ?? 'Não foi possível carregar as transações.');
  }

  const feed = [
    ...(((personalData as PersonalTransactionRow[] | null) ?? []).map(mapPersonalTransaction)),
    ...(((installmentData as CardInstallmentRow[] | null) ?? []).map(mapCardInstallment)),
  ]
    .filter((item) => (filters.type ? filters.type === 'all' || item.type === filters.type : true))
    .filter((item) => (filters.paymentMethod ? item.paymentMethod === filters.paymentMethod : true))
    .filter((item) => matchesSearch(item, filters.search ?? ''))
    .sort((left, right) => {
      const leftOccurredOn = left.occurredOn ?? left.dateISO ?? '';
      const rightOccurredOn = right.occurredOn ?? right.dateISO ?? '';
      const leftOccurredAt = left.occurredAt ?? left.dateISO ?? leftOccurredOn;
      const rightOccurredAt = right.occurredAt ?? right.dateISO ?? rightOccurredOn;

      if (leftOccurredOn === rightOccurredOn) {
        return leftOccurredAt < rightOccurredAt ? 1 : -1;
      }

      return leftOccurredOn < rightOccurredOn ? 1 : -1;
    });

  return feed;
}

export async function listTransactionSections(
  userId: string,
  filters: TransactionFilters = {},
): Promise<TransactionSection[]> {
  const feed = await listTransactionFeed(userId, filters);
  return groupTransactionsByDate(feed);
}

export async function createTransaction(input: CreateTransactionInput): Promise<string> {
  await requireCurrentUserId();
  const occurredAt = input.occurredAt || new Date().toISOString();
  const { data, error } = await supabase.rpc('create_personal_transaction', {
    p_payload: {
      account_id: input.accountId,
      category_id: input.categoryId,
      type: input.type,
      title: input.title.trim(),
      amount: Number(input.amount.toFixed(2)),
      payment_method: input.paymentMethod,
      occurred_at: occurredAt,
      notes: input.notes?.trim() ?? '',
      is_recurring: Boolean(input.isRecurring),
      source_type: input.sourceType ?? 'manual',
      attachment_id: input.attachmentId ?? null,
      capture_metadata: {
        ...(input.captureMetadata?.transcript ? { transcript: input.captureMetadata.transcript } : {}),
        ...(input.captureMetadata?.ocrText ? { ocrText: input.captureMetadata.ocrText } : {}),
        ...(input.captureMetadata?.warnings ? { warnings: input.captureMetadata.warnings } : {}),
        ...(typeof input.captureMetadata?.confidence !== 'undefined'
          ? { confidence: input.captureMetadata.confidence }
          : {}),
        ...(input.captureMetadata?.merchantOrIssuer
          ? { merchantOrIssuer: input.captureMetadata.merchantOrIssuer }
          : {}),
        ...(input.captureMetadata?.documentNumber
          ? { documentNumber: input.captureMetadata.documentNumber }
          : {}),
        provider: input.captureMetadata?.provider ?? 'openai',
      },
    },
  });

  if (error) {
    throw new Error(error.message);
  }

  return data as string;
}

export async function updateTransaction(id: string, input: UpdateTransactionInput): Promise<void> {
  const userId = await requireCurrentUserId();
  const update: Record<string, unknown> = {};
  if (input.title !== undefined) update.title = input.title.trim();
  if (input.amount !== undefined) update.amount = Number(input.amount.toFixed(2));
  if (input.type !== undefined) update.type = input.type;
  if (input.paymentMethod !== undefined) update.payment_method = input.paymentMethod;
  if (input.occurredAt !== undefined) {
    update.occurred_at = input.occurredAt;
    update.occurred_on = input.occurredAt.slice(0, 10);
  }
  if (input.notes !== undefined) update.notes = input.notes.trim();
  if ('categoryId' in input) update.category_id = input.categoryId;

  const { error } = await supabase
    .from('personal_transactions')
    .update(update)
    .eq('id', id)
    .eq('user_id', userId);

  if (error) throw new Error('Não foi possível atualizar a transação.');
}

export async function deleteTransaction(id: string): Promise<void> {
  const userId = await requireCurrentUserId();

  // Se a transação veio de uma recorrência confirmada, localizar a execução ANTES
  // de excluir: o FK é "on delete set null", então depois o vínculo some e a
  // recorrência ficaria marcada como paga para sempre.
  const { data: executionsData, error: executionsError } = await supabase
    .from('recurring_transaction_executions')
    .select('id')
    .eq('user_id', userId)
    .eq('transaction_id', id);

  if (executionsError) throw new Error('Não foi possível excluir a transação.');

  const { error } = await supabase
    .from('personal_transactions')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);
  if (error) throw new Error('Não foi possível excluir a transação.');

  const executionIds = ((executionsData as Array<{ id: string }> | null) ?? []).map((row) => row.id);
  if (executionIds.length > 0) {
    const { error: cleanupError } = await supabase
      .from('recurring_transaction_executions')
      .delete()
      .in('id', executionIds)
      .eq('user_id', userId);
    if (cleanupError) throw new Error('Não foi possível atualizar a recorrência vinculada.');
  }
}

export async function deleteTransfer(transactionId: string): Promise<void> {
  const userId = await requireCurrentUserId();
  const { data, error } = await supabase
    .from('account_transfers')
    .select('from_transaction_id, to_transaction_id')
    .or(`from_transaction_id.eq.${transactionId},to_transaction_id.eq.${transactionId}`)
    .eq('user_id', userId)
    .single();

  if (error || !data) throw new Error('Não foi possível encontrar a transferência.');

  const transfer = data as { from_transaction_id: string; to_transaction_id: string };
  const { error: delError } = await supabase
    .from('personal_transactions')
    .delete()
    .in('id', [transfer.from_transaction_id, transfer.to_transaction_id])
    .eq('user_id', userId);

  if (delError) throw new Error('Não foi possível excluir a transferência.');
}

export async function reverseCardPayment(transactionId: string): Promise<void> {
  const userId = await requireCurrentUserId();
  const { error } = await supabase
    .from('personal_transactions')
    .delete()
    .eq('id', transactionId)
    .eq('user_id', userId)
    .eq('source_type', 'card_payment');
  if (error) throw new Error('Não foi possível desfazer o pagamento.');
}

export function summarizeTransactions(items: TransactionFeedItem[]) {
  return items.reduce(
    (accumulator, item) => {
      if (item.type === 'income') {
        accumulator.income = roundCurrency(accumulator.income + item.amount);
      } else {
        accumulator.expense = roundCurrency(accumulator.expense + item.amount);
      }

      return accumulator;
    },
    { income: 0, expense: 0 },
  );
}

export function defaultMonthRange() {
  const now = new Date();
  return {
    from: startOfMonth(now),
    to: endOfMonth(now),
  };
}
