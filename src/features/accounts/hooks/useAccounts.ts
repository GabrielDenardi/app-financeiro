import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { financeQueryKeys } from '../../finance/queryKeys';
import { createAccount, createTransfer, getAccountsOverview, listAccounts } from '../services/accountsService';
import type { CreateAccountInput, CreateTransferInput } from '../types';

export function useAccounts(userId?: string | null) {
  return useQuery({
    queryKey: financeQueryKeys.accounts.list(userId),
    queryFn: listAccounts,
    enabled: Boolean(userId),
  });
}

export function useAccountsOverview(userId?: string | null) {
  return useQuery({
    queryKey: financeQueryKeys.accounts.overview(userId),
    queryFn: getAccountsOverview,
    enabled: Boolean(userId),
  });
}

export function useCreateAccountMutation(userId?: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateAccountInput) => createAccount(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: financeQueryKeys.root });
      queryClient.invalidateQueries({ queryKey: financeQueryKeys.accounts.all });
      queryClient.invalidateQueries({ queryKey: financeQueryKeys.dashboard.all });
    },
  });
}

export function useCreateTransferMutation(userId?: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateTransferInput) => createTransfer(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: financeQueryKeys.root });
      queryClient.invalidateQueries({ queryKey: financeQueryKeys.accounts.all });
      queryClient.invalidateQueries({ queryKey: financeQueryKeys.transactions.all });
      queryClient.invalidateQueries({ queryKey: financeQueryKeys.dashboard.all });
      queryClient.invalidateQueries({ queryKey: financeQueryKeys.reports.all });
    },
  });
}
