import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { financeQueryKeys } from '../finance/queryKeys';
import { profileQueryKeys, useProfile } from '../profile/hooks/useProfile';
import { getEffectivePlanId, getPlanEntitlements, isTrialActive, SUBSCRIPTION_PLANS } from './plans';
import { getPaywallStats, startIntermediateTrial } from './services/plansService';

const DAY_MS = 24 * 60 * 60 * 1000;

export function useCurrentPlan(userId?: string | null) {
  const profileQuery = useProfile(userId);
  const subscriptionPlan = profileQuery.data?.subscriptionPlan;
  const trialStartedAt = profileQuery.data?.trialStartedAt ?? null;
  const trialEndsAt = profileQuery.data?.trialEndsAt ?? null;

  const plan = useMemo(
    () => SUBSCRIPTION_PLANS[getEffectivePlanId(subscriptionPlan, trialEndsAt)],
    [subscriptionPlan, trialEndsAt],
  );
  const entitlements = useMemo(
    () => getPlanEntitlements(subscriptionPlan, trialEndsAt),
    [subscriptionPlan, trialEndsAt],
  );
  const trial = useMemo(() => {
    const active = isTrialActive(trialEndsAt);
    const hasUsed = Boolean(trialStartedAt);
    const daysLeft = active && trialEndsAt
      ? Math.max(1, Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / DAY_MS))
      : 0;

    return {
      isActive: active,
      hasUsed,
      endsAt: trialEndsAt,
      daysLeft,
      // Elegivel: nunca usou o trial e o plano base nao cobre o Intermediario.
      isEligible:
        Boolean(profileQuery.data) &&
        !hasUsed &&
        subscriptionPlan !== 'intermediate' &&
        subscriptionPlan !== 'pro',
    };
  }, [profileQuery.data, subscriptionPlan, trialStartedAt, trialEndsAt]);

  return {
    plan,
    basePlanId: subscriptionPlan,
    trial,
    entitlements,
    // isPending cobre também a query desabilitada (userId ainda não resolvido),
    // evitando que o plano caia no default 'free' antes do perfil carregar.
    isLoading: profileQuery.isPending,
    isError: profileQuery.isError,
    refetch: profileQuery.refetch,
  };
}

export function useStartTrialMutation(userId?: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => startIntermediateTrial(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: profileQueryKeys.all });
      if (userId) {
        queryClient.invalidateQueries({ queryKey: profileQueryKeys.detail(userId) });
      }
    },
  });
}

export function usePaywallStats(userId?: string | null, enabled = true) {
  return useQuery({
    queryKey: financeQueryKeys.plans.paywallStats(userId),
    queryFn: () => {
      if (!userId) throw new Error('userId is required');
      return getPaywallStats(userId);
    },
    enabled: Boolean(userId) && enabled,
    staleTime: 60 * 1000,
  });
}
