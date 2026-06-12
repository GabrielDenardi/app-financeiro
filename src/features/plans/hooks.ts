import { useMemo } from 'react';

import { useProfile } from '../profile/hooks/useProfile';
import { getPlan, getPlanEntitlements } from './plans';

export function useCurrentPlan(userId?: string | null) {
  const profileQuery = useProfile(userId);
  const plan = useMemo(() => getPlan(profileQuery.data?.subscriptionPlan), [profileQuery.data?.subscriptionPlan]);
  const entitlements = useMemo(
    () => getPlanEntitlements(profileQuery.data?.subscriptionPlan),
    [profileQuery.data?.subscriptionPlan],
  );

  return {
    plan,
    entitlements,
    // isPending cobre também a query desabilitada (userId ainda não resolvido),
    // evitando que o plano caia no default 'free' antes do perfil carregar.
    isLoading: profileQuery.isPending,
    isError: profileQuery.isError,
    refetch: profileQuery.refetch,
  };
}
