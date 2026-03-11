import { requireCurrentUserId } from '../../../lib/auth';
import { supabase } from '../../../lib/supabase';
import { formatShortDate } from '../../../utils/format';
import { endOfMonth, formatInstallmentLabel, groupTransactionsByDate, startOfMonth, toNumber } from '../../finance/utils';
import type {
  CreateTransactionInput,
  FinanceCategory,
  TransactionFeedItem,
  TransactionFilters,
  TransactionSection,
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
    paymentMethod: row.payment_method,
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
  const occurredOn = row.invoice_month;

  return {
    id: `installment-${row.installment_id}`,
    title: row.title,
    notes: row.notes ?? '',
    amount: toNumber(row.amount),
    type: 'expense',
    category: row.category_label ?? 'Sem categoria',
    categoryId: row.category_id,
    categoryColor: row.category_color ?? '#94A3B8',
    paymentMethod: 'Cartao de credito',
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

  const [{ data: personalData, error: personalError }, { data: installmentData, error: installmentError }] =
    await Promise.all([personalQuery, installmentsQuery]);

  if (personalError || installmentError) {
    throw new Error(personalError?.message ?? installmentError?.message ?? 'Nao foi possivel carregar as transacoes.');
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
  const userId = await requireCurrentUserId();
  const occurredAt = input.occurredAt || new Date().toISOString();

  const { data, error } = await supabase
    .from('personal_transactions')
    .insert({
      user_id: userId,
      account_id: input.accountId,
      category_id: input.categoryId,
      type: input.type,
      title: input.title.trim(),
      amount: Number(input.amount.toFixed(2)),
      payment_method: input.paymentMethod,
      occurred_at: occurredAt,
      occurred_on: occurredAt.slice(0, 10),
      notes: input.notes?.trim() ?? '',
      description: input.notes?.trim() ?? '',
      source_type: 'manual',
      include_in_reports: true,
    })
    .select('id')
    .single();

  if (error) {
    throw new Error(error.message);
  }

  if (input.isRecurring) {
    const date = new Date(occurredAt);
    const { error: recurringError } = await supabase.from('recurring_transaction_rules').insert({
      user_id: userId,
      account_id: input.accountId,
      category_id: input.categoryId,
      type: input.type,
      title: input.title.trim(),
      notes: input.notes?.trim() ?? '',
      payment_method: input.paymentMethod,
      amount: Number(input.amount.toFixed(2)),
      day_of_month: date.getDate(),
      cadence: 'monthly',
      is_active: true,
    });

    if (recurringError) {
      throw new Error(recurringError.message);
    }
  }

  return (data as { id: string }).id;
}

export function summarizeTransactions(items: TransactionFeedItem[]) {
  return items.reduce(
    (accumulator, item) => {
      if (item.type === 'income') {
        accumulator.income += item.amount;
      } else {
        accumulator.expense += item.amount;
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
