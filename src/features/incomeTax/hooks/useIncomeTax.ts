import { useMutation, useQuery } from '@tanstack/react-query';

import { financeQueryKeys } from '../../finance/queryKeys';
import {
  generateIncomeTaxPdf,
  generateIncomeTaxXlsx,
  getIncomeTaxReport,
  shareFile,
} from '../services/incomeTaxService';
import type { IncomeTaxReport } from '../types';

export function useIncomeTaxReport(userId?: string | null, year?: number, enabled = true) {
  return useQuery({
    queryKey: financeQueryKeys.incomeTax.report(userId, year),
    queryFn: () => getIncomeTaxReport(year as number),
    enabled: Boolean(userId && year && enabled),
  });
}

export function useExportIncomeTax() {
  return useMutation({
    mutationFn: async ({ report, format }: { report: IncomeTaxReport; format: 'pdf' | 'xlsx' }) => {
      const uri = format === 'pdf' ? await generateIncomeTaxPdf(report) : await generateIncomeTaxXlsx(report);
      await shareFile(uri);
      return uri;
    },
  });
}
