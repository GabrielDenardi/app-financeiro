import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { financeQueryKeys } from '../../finance/queryKeys';
import { importTransactionsFromAsset, listImportBatches } from '../services/importService';

export function useImportBatches(userId?: string | null) {
  return useQuery({
    queryKey: financeQueryKeys.imports.list(userId),
    queryFn: listImportBatches,
    enabled: Boolean(userId),
  });
}

export function useImportTransactionsMutation(userId?: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: importTransactionsFromAsset,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: financeQueryKeys.root });
      queryClient.invalidateQueries({ queryKey: financeQueryKeys.imports.all });
      queryClient.invalidateQueries({ queryKey: financeQueryKeys.transactions.all });
      queryClient.invalidateQueries({ queryKey: financeQueryKeys.dashboard.all });
      queryClient.invalidateQueries({ queryKey: financeQueryKeys.accounts.all });
      queryClient.invalidateQueries({ queryKey: financeQueryKeys.budgets.all });
      queryClient.invalidateQueries({ queryKey: financeQueryKeys.reports.all });
    },
  });
}
