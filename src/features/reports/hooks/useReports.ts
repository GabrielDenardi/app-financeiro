import { useQuery } from '@tanstack/react-query';

import { financeQueryKeys } from '../../finance/queryKeys';
import { getReportsSummary } from '../services/reportsService';
import type { ReportRange } from '../types';

export function useReports(userId?: string | null, range?: ReportRange) {
  const rangeKey = range ? `${range.from}:${range.to}` : null;

  return useQuery({
    queryKey: financeQueryKeys.reports.summary(userId, rangeKey),
    queryFn: () => getReportsSummary(range as ReportRange),
    enabled: Boolean(userId && range),
  });
}
