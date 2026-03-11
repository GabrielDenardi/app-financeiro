import { requireCurrentUserId } from '../../../lib/auth';
import { supabase } from '../../../lib/supabase';
import { toNumber } from '../../finance/utils';
import type { CreateGoalInput, FinancialGoal, GoalContributionInput, UpdateGoalInput } from '../types';

type GoalProgressRow = {
  goal_id: string;
  title: string;
  target_amount: number | string;
  initial_amount: number | string;
  current_amount: number | string;
  contributed_amount: number | string;
  progress_percent: number | string;
  color: string;
  icon: string;
  target_date: string | null;
  status: FinancialGoal['status'];
};

function mapGoal(row: GoalProgressRow): FinancialGoal {
  return {
    id: row.goal_id,
    title: row.title,
    targetAmount: toNumber(row.target_amount),
    initialAmount: toNumber(row.initial_amount),
    currentAmount: toNumber(row.current_amount),
    contributedAmount: toNumber(row.contributed_amount),
    progressPercent: toNumber(row.progress_percent),
    color: row.color,
    icon: row.icon,
    targetDate: row.target_date,
    status: row.status,
  };
}

export async function listGoals(): Promise<FinancialGoal[]> {
  const userId = await requireCurrentUserId();
  const { data, error } = await supabase
    .from('v_goal_progress')
    .select('goal_id, title, target_amount, initial_amount, current_amount, contributed_amount, progress_percent, color, icon, target_date, status')
    .eq('user_id', userId)
    .order('target_date', { ascending: true, nullsFirst: false });

  if (error) {
    throw new Error(error.message);
  }

  return ((data as GoalProgressRow[] | null) ?? []).map(mapGoal);
}

export async function createGoal(input: CreateGoalInput): Promise<string> {
  const userId = await requireCurrentUserId();
  const initialAmount = Number(input.initialAmount.toFixed(2));

  const { data, error } = await supabase
    .from('financial_goals')
    .insert({
      user_id: userId,
      title: input.title.trim(),
      target_amount: Number(input.targetAmount.toFixed(2)),
      initial_amount: initialAmount,
      current_amount: initialAmount,
      color: input.color,
      icon: input.icon,
      target_date: input.targetDate,
      status: initialAmount >= input.targetAmount ? 'completed' : 'active',
    })
    .select('id')
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return (data as { id: string }).id;
}

export async function updateGoal(input: UpdateGoalInput): Promise<void> {
  const payload: Record<string, unknown> = {};

  if (typeof input.title === 'string') {
    payload.title = input.title.trim();
  }

  if (typeof input.color === 'string') {
    payload.color = input.color;
  }

  if (typeof input.icon === 'string') {
    payload.icon = input.icon;
  }

  if ('targetDate' in input) {
    payload.target_date = input.targetDate;
  }

  if (typeof input.status === 'string') {
    payload.status = input.status;
  }

  const { error } = await supabase.from('financial_goals').update(payload).eq('id', input.id);

  if (error) {
    throw new Error(error.message);
  }
}

export async function deleteGoal(goalId: string): Promise<void> {
  const { error } = await supabase.from('financial_goals').delete().eq('id', goalId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function addGoalContribution(input: GoalContributionInput): Promise<string> {
  const { data, error } = await supabase.rpc('add_goal_contribution', {
    p_goal_id: input.goalId,
    p_account_id: input.accountId,
    p_amount: Number(input.amount.toFixed(2)),
    p_note: input.note?.trim() ?? '',
    p_occurred_at: input.occurredAt ?? new Date().toISOString(),
  });

  if (error) {
    throw new Error(error.message);
  }

  return data as string;
}
