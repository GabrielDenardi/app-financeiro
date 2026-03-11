import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { financeQueryKeys } from '../../finance/queryKeys';
import { addGoalContribution, createGoal, deleteGoal, listGoals, updateGoal } from '../services/goalsService';
import type { CreateGoalInput, GoalContributionInput, UpdateGoalInput } from '../types';

export function useGoals(userId?: string | null) {
  return useQuery({
    queryKey: financeQueryKeys.goals.list(userId),
    queryFn: listGoals,
    enabled: Boolean(userId),
  });
}

export function useCreateGoalMutation(userId?: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateGoalInput) => createGoal(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: financeQueryKeys.root });
      queryClient.invalidateQueries({ queryKey: financeQueryKeys.goals.all });
      queryClient.invalidateQueries({ queryKey: financeQueryKeys.dashboard.all });
    },
  });
}

export function useUpdateGoalMutation(userId?: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateGoalInput) => updateGoal(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: financeQueryKeys.root });
      queryClient.invalidateQueries({ queryKey: financeQueryKeys.goals.all });
    },
  });
}

export function useDeleteGoalMutation(userId?: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (goalId: string) => deleteGoal(goalId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: financeQueryKeys.root });
      queryClient.invalidateQueries({ queryKey: financeQueryKeys.goals.all });
      queryClient.invalidateQueries({ queryKey: financeQueryKeys.dashboard.all });
    },
  });
}

export function useGoalContributionMutation(userId?: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: GoalContributionInput) => addGoalContribution(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: financeQueryKeys.root });
      queryClient.invalidateQueries({ queryKey: financeQueryKeys.goals.all });
      queryClient.invalidateQueries({ queryKey: financeQueryKeys.accounts.all });
      queryClient.invalidateQueries({ queryKey: financeQueryKeys.transactions.all });
      queryClient.invalidateQueries({ queryKey: financeQueryKeys.dashboard.all });
    },
  });
}
