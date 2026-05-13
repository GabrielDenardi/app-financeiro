import { useQuery } from '@tanstack/react-query';

import { financeQueryKeys } from '../../finance/queryKeys';
import { getAboutContent } from '../services/aboutService';

export function useAboutContent() {
  return useQuery({
    queryKey: financeQueryKeys.about.content(),
    queryFn: getAboutContent,
  });
}
