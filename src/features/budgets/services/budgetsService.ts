import { requireCurrentUserId } from '../../../lib/auth';
import { supabase } from '../../../lib/supabase';
import { formatMonthDate, toNumber } from '../../finance/utils';
import type { BudgetProgress, UpsertBudgetInput } from '../types';

type BudgetProgressRow = {
  budget_id: string;
  category_id: string;
  category_code: string;
  category_label: string;
  category_color: string;
  month_date: string;
  limit_amount: number | string;
  spent_amount: number | string;
};

export async function listBudgets(monthDate = formatMonthDate()): Promise<BudgetProgress[]> {
  const userId = await requireCurrentUserId();
  const { data, error } = await supabase
    .from('v_budget_progress')
    .select('budget_id, category_id, category_code, category_label, category_color, month_date, limit_amount, spent_amount')
    .eq('user_id', userId)
    .eq('month_date', monthDate)
    .order('category_label', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return ((data as BudgetProgressRow[] | null) ?? []).map((row) => {
    const limitAmount = toNumber(row.limit_amount);
    const spentAmount = toNumber(row.spent_amount);

    return {
      id: row.budget_id,
      categoryId: row.category_id,
      categoryCode: row.category_code,
      categoryLabel: row.category_label,
      categoryColor: row.category_color,
      monthDate: row.month_date,
      limitAmount,
      spentAmount,
      remainingAmount: Number((limitAmount - spentAmount).toFixed(2)),
      progressPercent: limitAmount > 0 ? Number(((spentAmount / limitAmount) * 100).toFixed(1)) : 0,
    };
  });
}

export async function upsertBudget(input: UpsertBudgetInput): Promise<string> {
  const userId = await requireCurrentUserId();
  const payload = {
    user_id: userId,
    category_id: input.categoryId,
    month_date: input.monthDate,
    limit_amount: Number(input.limitAmount.toFixed(2)),
  };

  const query = input.id
    ? supabase.from('budget_plans').update(payload).eq('id', input.id).select('id').single()
    : supabase.from('budget_plans').upsert(payload, { onConflict: 'user_id,category_id,month_date' }).select('id').single();

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return (data as { id: string }).id;
}

export async function deleteBudget(id: string): Promise<void> {
  const { error } = await supabase.from('budget_plans').delete().eq('id', id);

  if (error) {
    throw new Error(error.message);
  }
}
