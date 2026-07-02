import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { financeQueryKeys } from '../../finance/queryKeys';
import {
  confirmRecurringTransaction,
  createRecurringTransaction,
  deleteRecurringTransaction,
  listRecurringTransactions,
  undoRecurringConfirmation,
  updateRecurringTransaction,
} from '../services/recurringService';
import type {
  ConfirmRecurringTransactionInput,
  CreateRecurringTransactionInput,
  RecurringTransaction,
  UndoRecurringConfirmationInput,
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
  const listKey = financeQueryKeys.recurring.list(userId);

  return useMutation({
    mutationFn: (input: UpdateRecurringTransactionInput) => updateRecurringTransaction(input),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: listKey });
      const previous = queryClient.getQueryData<RecurringTransaction[]>(listKey);
      queryClient.setQueryData<RecurringTransaction[]>(listKey, (old) =>
        old?.map((item) =>
          item.id === input.id
            ? {
                ...item,
                ...(typeof input.isActive === 'boolean' && { isActive: input.isActive }),
                ...(typeof input.isVariable === 'boolean' && { isVariable: input.isVariable }),
                ...(typeof input.amount === 'number' && { amount: input.amount }),
                ...(typeof input.title === 'string' && { title: input.title }),
                ...(typeof input.dayOfMonth === 'number' && { dayOfMonth: input.dayOfMonth }),
              }
            : item,
        ) ?? [],
      );
      return { previous };
    },
    onError: (_err, _input, context) => {
      if (context?.previous) {
        queryClient.setQueryData(listKey, context.previous);
      }
    },
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

export function useUndoRecurringConfirmationMutation(userId?: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UndoRecurringConfirmationInput) => undoRecurringConfirmation(input),
    onSuccess: () => invalidateRecurringQueries(queryClient),
  });
}
