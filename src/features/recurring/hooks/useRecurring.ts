import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { financeQueryKeys } from '../../finance/queryKeys';
import {
  confirmRecurringTransaction,
  createRecurringTransaction,
  deleteRecurringTransaction,
  listRecurringTransactions,
  updateRecurringTransaction,
} from '../services/recurringService';
import type {
  ConfirmRecurringTransactionInput,
  CreateRecurringTransactionInput,
  UpdateRecurringTransactionInput,
} from '../types';

export function useRecurringTransactions(userId?: string | null) {
  return useQuery({
    queryKey: financeQueryKeys.recurring.list(userId),
    queryFn: listRecurringTransactions,
    enabled: Boolean(userId),
  });
}

function invalidateRecurringQueries(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: financeQueryKeys.root });
  queryClient.invalidateQueries({ queryKey: financeQueryKeys.recurring.all });
  queryClient.invalidateQueries({ queryKey: financeQueryKeys.transactions.all });
  queryClient.invalidateQueries({ queryKey: financeQueryKeys.dashboard.all });
  queryClient.invalidateQueries({ queryKey: financeQueryKeys.accounts.all });
}

export function useCreateRecurringTransactionMutation(userId?: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateRecurringTransactionInput) => createRecurringTransaction(input),
    onSuccess: () => invalidateRecurringQueries(queryClient),
  });
}

export function useUpdateRecurringTransactionMutation(userId?: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateRecurringTransactionInput) => updateRecurringTransaction(input),
    onSuccess: () => invalidateRecurringQueries(queryClient),
  });
}

export function useDeleteRecurringTransactionMutation(userId?: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (ruleId: string) => deleteRecurringTransaction(ruleId),
    onSuccess: () => invalidateRecurringQueries(queryClient),
  });
}

export function useConfirmRecurringTransactionMutation(userId?: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: ConfirmRecurringTransactionInput) => confirmRecurringTransaction(input),
    onSuccess: () => invalidateRecurringQueries(queryClient),
  });
}
