import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { financeQueryKeys } from '../../finance/queryKeys';
import { createTransaction, listCategories, listTransactionFeed, listTransactionSections } from '../services/transactionsService';
import type { CreateTransactionInput, TransactionFilters } from '../types';

export function useFinanceCategories(userId?: string | null) {
  return useQuery({
    queryKey: financeQueryKeys.categories.list(userId),
    queryFn: listCategories,
    enabled: Boolean(userId),
  });
}

export function useTransactionFeed(userId?: string | null, filters: TransactionFilters = {}) {
  return useQuery({
    queryKey: financeQueryKeys.transactions.feed(userId, filters),
    queryFn: () => listTransactionFeed(userId as string, filters),
    enabled: Boolean(userId),
  });
}

export function useTransactionSections(userId?: string | null, filters: TransactionFilters = {}) {
  return useQuery({
    queryKey: [...financeQueryKeys.transactions.feed(userId, filters), 'sections'] as const,
    queryFn: () => listTransactionSections(userId as string, filters),
    enabled: Boolean(userId),
  });
}

export function useCreateTransactionMutation(userId?: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateTransactionInput) => createTransaction(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: financeQueryKeys.root });
      queryClient.invalidateQueries({ queryKey: financeQueryKeys.transactions.all });
      queryClient.invalidateQueries({ queryKey: financeQueryKeys.dashboard.all });
      queryClient.invalidateQueries({ queryKey: financeQueryKeys.accounts.all });
      queryClient.invalidateQueries({ queryKey: financeQueryKeys.budgets.all });
      queryClient.invalidateQueries({ queryKey: financeQueryKeys.reports.all });
    },
  });
}
