export type FinancialGoal = {
  id: string;
  title: string;
  targetAmount: number;
  initialAmount: number;
  currentAmount: number;
  contributedAmount: number;
  progressPercent: number;
  color: string;
  icon: string;
  targetDate: string | null;
  status: 'active' | 'completed' | 'archived';
};

export type CreateGoalInput = {
  title: string;
  targetAmount: number;
  initialAmount: number;
  color: string;
  icon: string;
  targetDate: string | null;
};

export type GoalContributionInput = {
  goalId: string;
  accountId: string;
  amount: number;
  note?: string;
  occurredAt?: string;
};

export type UpdateGoalInput = {
  id: string;
  title?: string;
  color?: string;
  icon?: string;
  targetDate?: string | null;
  status?: 'active' | 'completed' | 'archived';
};
