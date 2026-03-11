export type BudgetProgress = {
  id: string;
  categoryId: string;
  categoryCode: string;
  categoryLabel: string;
  categoryColor: string;
  monthDate: string;
  limitAmount: number;
  spentAmount: number;
  remainingAmount: number;
  progressPercent: number;
};

export type UpsertBudgetInput = {
  id?: string;
  categoryId: string;
  monthDate: string;
  limitAmount: number;
};
