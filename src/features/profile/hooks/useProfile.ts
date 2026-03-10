import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { UpdateUserProfileInput } from '../../../types/profile';
import { getProfile, updateProfile } from '../services/profileService';

export const profileQueryKeys = {
  all: ['profile'] as const,
  detail: (userId?: string | null) => [...profileQueryKeys.all, 'detail', userId] as const,
};

export function useProfile(userId?: string | null) {
  return useQuery({
    queryKey: profileQueryKeys.detail(userId),
    queryFn: () => getProfile(userId as string),
    enabled: Boolean(userId),
  });
}

export function useUpdateProfileMutation(userId?: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateUserProfileInput) => updateProfile(input),
    onSuccess: (profile) => {
      queryClient.setQueryData(profileQueryKeys.detail(profile.id), profile);
      queryClient.invalidateQueries({ queryKey: profileQueryKeys.all });

      if (userId && userId !== profile.id) {
        queryClient.invalidateQueries({ queryKey: profileQueryKeys.detail(userId) });
      }
    },
  });
}
