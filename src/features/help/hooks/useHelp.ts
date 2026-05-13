import { useQuery } from '@tanstack/react-query';

import { financeQueryKeys } from '../../finance/queryKeys';
import { listHelpArticles, listHelpCategories } from '../services/helpService';

export function useHelpCategories() {
  return useQuery({
    queryKey: financeQueryKeys.help.categories(),
    queryFn: listHelpCategories,
  });
}

export function useHelpArticles(search?: string | null, categoryCode?: string | null) {
  return useQuery({
    queryKey: financeQueryKeys.help.articles(search, categoryCode),
    queryFn: () => listHelpArticles(search, categoryCode),
  });
}
