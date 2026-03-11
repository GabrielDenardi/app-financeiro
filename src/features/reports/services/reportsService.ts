import { requireCurrentUserId } from '../../../lib/auth';
import { listTransactionFeed } from '../../transactions/services/transactionsService';
import type { TransactionFeedItem } from '../../transactions/types';
import type { ReportCategoryStat, ReportPaymentMethodStat, ReportRange, ReportsSummary } from '../types';

const EXCLUDED_REPORT_SOURCES = new Set([
  'transfer',
  'group_settlement',
  'goal_contribution',
  'card_payment',
]);

function buildTopCategories(items: TransactionFeedItem[]): ReportCategoryStat[] {
  const totals = new Map<string, ReportCategoryStat>();
  const totalExpense = items
    .filter((item) => item.type === 'expense')
    .reduce((sum, item) => sum + item.amount, 0);

  items.forEach((item) => {
    if (item.type !== 'expense') {
      return;
    }

    const current = totals.get(item.category) ?? {
      category: item.category,
      amount: 0,
      share: 0,
      color: item.categoryColor ?? '#94A3B8',
    };

    current.amount += item.amount;
    totals.set(item.category, current);
  });

  return [...totals.values()]
    .sort((left, right) => right.amount - left.amount)
    .slice(0, 5)
    .map((item) => ({
      ...item,
      share: totalExpense > 0 ? Number(((item.amount / totalExpense) * 100).toFixed(1)) : 0,
    }));
}

function buildPaymentMethods(items: TransactionFeedItem[]): ReportPaymentMethodStat[] {
  const totals = new Map<string, number>();

  items.forEach((item) => {
    if (item.type !== 'expense') {
      return;
    }

    totals.set(item.paymentMethod, (totals.get(item.paymentMethod) ?? 0) + item.amount);
  });

  return [...totals.entries()]
    .map(([label, amount]) => ({ label, amount }))
    .sort((left, right) => right.amount - left.amount);
}

function buildSeries(items: TransactionFeedItem[]) {
  const chunks = [0, 0, 0, 0];
  const incomeBar = items.filter((item) => item.type === 'income').reduce((sum, item) => sum + item.amount, 0);
  const expenseBar = items.filter((item) => item.type === 'expense').reduce((sum, item) => sum + item.amount, 0);

  items.forEach((item) => {
    const occurredOn = item.occurredOn ?? item.dateISO ?? new Date().toISOString();
    const day = new Date(occurredOn).getDate();
    const index = Math.min(3, Math.floor((day - 1) / 8));
    chunks[index] += item.type === 'expense' ? item.amount : -item.amount;
  });

  return {
    lineSeries: chunks.map((value) => ({ value: Math.abs(Number(value.toFixed(2))) })),
    barSeries: [
      { value: Number(incomeBar.toFixed(2)), label: 'Rec', frontColor: '#10B981' },
      { value: Number(expenseBar.toFixed(2)), label: 'Des', frontColor: '#F43F5E' },
    ],
  };
}

export async function getReportsSummary(range: ReportRange): Promise<ReportsSummary> {
  const userId = await requireCurrentUserId();
  const feed = await listTransactionFeed(userId, {
    from: range.from,
    to: range.to,
  });

  const reportableItems = feed.filter((item) => !EXCLUDED_REPORT_SOURCES.has(item.sourceType ?? 'manual'));
  const income = reportableItems
    .filter((item) => item.type === 'income')
    .reduce((sum, item) => sum + item.amount, 0);
  const expense = reportableItems
    .filter((item) => item.type === 'expense')
    .reduce((sum, item) => sum + item.amount, 0);
  const balance = income - expense;
  const savingsRate = income > 0 ? Number(((balance / income) * 100).toFixed(1)) : 0;
  const series = buildSeries(reportableItems);

  return {
    income,
    expense,
    balance,
    savingsRate,
    topCategories: buildTopCategories(reportableItems),
    paymentMethods: buildPaymentMethods(reportableItems),
    lineSeries: series.lineSeries,
    barSeries: series.barSeries,
  };
}
