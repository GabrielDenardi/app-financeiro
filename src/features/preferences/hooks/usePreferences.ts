import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { financeQueryKeys } from '../../finance/queryKeys';
import {
  disableTotpFactor,
  enrollTotpFactor,
  getPreferences,
  listLoginEvents,
  listTotpFactors,
  requestAccountDeletion,
  requestDataExport,
  updatePreferences,
  verifyTotpFactor,
} from '../services/preferencesService';
import type { UserPreferences } from '../types';

export function usePreferences(userId?: string | null) {
  return useQuery({
    queryKey: financeQueryKeys.preferences.detail(userId),
    queryFn: getPreferences,
    enabled: Boolean(userId),
  });
}

export function useLoginEvents(userId?: string | null) {
  return useQuery({
    queryKey: financeQueryKeys.preferences.loginEvents(userId),
    queryFn: listLoginEvents,
    enabled: Boolean(userId),
  });
}

export function useMfaFactors(userId?: string | null) {
  return useQuery({
    queryKey: [...financeQueryKeys.preferences.detail(userId), 'mfa-factors'] as const,
    queryFn: listTotpFactors,
    enabled: Boolean(userId),
  });
}

export function useUpdatePreferencesMutation(userId?: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (patch: Partial<UserPreferences>) => updatePreferences(patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: financeQueryKeys.preferences.all });
      queryClient.invalidateQueries({ queryKey: financeQueryKeys.dashboard.all });
    },
  });
}

export function useEnrollTotpMutation(userId?: string | null) {
  return useMutation({
    mutationFn: enrollTotpFactor,
  });
}

export function useVerifyTotpMutation(userId?: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ factorId, code }: { factorId: string; code: string }) =>
      verifyTotpFactor(factorId, code),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: financeQueryKeys.preferences.all });
    },
  });
}

export function useDisableTotpMutation(userId?: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (factorId: string) => disableTotpFactor(factorId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: financeQueryKeys.preferences.all });
    },
  });
}

export function useRequestExportMutation(userId?: string | null) {
  return useMutation({
    mutationFn: requestDataExport,
  });
}

export function useRequestDeletionMutation(userId?: string | null) {
  return useMutation({
    mutationFn: ({ reason, password }: { reason: string; password: string }) =>
      requestAccountDeletion(reason, password),
  });
}
