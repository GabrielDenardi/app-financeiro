import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { financeQueryKeys } from '../finance/queryKeys';
import { profileQueryKeys } from '../profile/hooks/useProfile';
import {
  ensureRevenueCatConfigured,
  listRevenueCatPlanPackages,
  purchaseRevenueCatPlan,
  restoreRevenueCatPurchases,
  syncRevenueCatSubscription,
  type RevenueCatPlanPackage,
} from './revenuecatService';

export function useRevenueCatBootstrap(userId?: string | null) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId || Platform.OS !== 'android') {
      return;
    }

    let syncInProgress = false;
    const syncSubscription = async () => {
      if (syncInProgress) {
        return;
      }

      syncInProgress = true;
      try {
        await ensureRevenueCatConfigured(userId);
        await syncRevenueCatSubscription();
        await queryClient.invalidateQueries({
          queryKey: profileQueryKeys.detail(userId),
        });
      } catch (error) {
        if (__DEV__) {
          console.warn('[Billing] Nao foi possivel sincronizar a assinatura.', error);
        }
      } finally {
        syncInProgress = false;
      }
    };

    void syncSubscription();
    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void syncSubscription();
      }
    });

    return () => {
      appStateSubscription.remove();
    };
  }, [queryClient, userId]);
}

export function useRevenueCatPlanPackages(userId?: string | null) {
  return useQuery({
    queryKey: financeQueryKeys.plans.storeOfferings(userId),
    queryFn: () => {
      if (!userId) {
        throw new Error('Usuario nao autenticado.');
      }
      return listRevenueCatPlanPackages(userId);
    },
    enabled: Boolean(userId) && Platform.OS === 'android',
    staleTime: 5 * 60 * 1000,
  });
}

export function usePurchaseRevenueCatPlanMutation(userId?: string | null) {
  return useMutation({
    mutationFn: (selectedPackage: RevenueCatPlanPackage) => {
      if (!userId) {
        throw new Error('Usuario nao autenticado.');
      }
      return purchaseRevenueCatPlan(userId, selectedPackage);
    },
  });
}

export function useRestoreRevenueCatPurchasesMutation(userId?: string | null) {
  return useMutation({
    mutationFn: () => {
      if (!userId) {
        throw new Error('Usuario nao autenticado.');
      }
      return restoreRevenueCatPurchases(userId);
    },
  });
}
