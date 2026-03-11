import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { financeQueryKeys } from '../../finance/queryKeys';
import { getHomeDashboard } from '../services/dashboardService';

export function useHomeDashboard(userId?: string | null, monthDate?: string | null) {
  return useQuery({
    queryKey: financeQueryKeys.dashboard.detail(userId, monthDate),
    queryFn: () => getHomeDashboard(monthDate ?? undefined),
    enabled: Boolean(userId),
  });
}
