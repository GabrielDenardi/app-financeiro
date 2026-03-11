import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { financeQueryKeys } from '../../finance/queryKeys';
import { deleteBudget, listBudgets, upsertBudget } from '../services/budgetsService';
import type { UpsertBudgetInput } from '../types';

export function useBudgets(userId?: string | null, monthDate?: string | null) {
  return useQuery({
    queryKey: financeQueryKeys.budgets.list(userId, monthDate),
    queryFn: () => listBudgets(monthDate ?? undefined),
    enabled: Boolean(userId),
  });
}

export function useUpsertBudgetMutation(userId?: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpsertBudgetInput) => upsertBudget(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: financeQueryKeys.root });
      queryClient.invalidateQueries({ queryKey: financeQueryKeys.budgets.all });
      queryClient.invalidateQueries({ queryKey: financeQueryKeys.dashboard.all });
      queryClient.invalidateQueries({ queryKey: financeQueryKeys.reports.all });
    },
  });
}

export function useDeleteBudgetMutation(userId?: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteBudget(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: financeQueryKeys.root });
      queryClient.invalidateQueries({ queryKey: financeQueryKeys.budgets.all });
    },
  });
}
