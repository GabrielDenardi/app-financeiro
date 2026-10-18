import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { financeQueryKeys } from '../../finance/queryKeys';
import {
  deleteAllNotifications,
  deleteNotification,
  listUserNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  refreshNotifications,
  getNotificationPreferences,
  updateNotificationPreferences,
  recordNotificationInteraction,
} from '../services/notificationsService';

export function useUserNotifications(userId?: string | null) {
  return useQuery({
    queryKey: financeQueryKeys.notifications.list(userId),
    queryFn: listUserNotifications,
    enabled: Boolean(userId),
    refetchInterval: 60_000,
  });
}

export function useNotificationPreferences(userId?: string | null) {
  return useQuery({ queryKey: financeQueryKeys.notifications.preferences(userId), queryFn: getNotificationPreferences, enabled: Boolean(userId) });
}

export function useUpdateNotificationPreferences(userId?: string | null) {
  const client = useQueryClient();
  return useMutation({ mutationFn: updateNotificationPreferences, onSuccess: () => {
    client.invalidateQueries({ queryKey: financeQueryKeys.notifications.preferences(userId) });
  } });
}

export function useNotificationInteraction(userId?: string | null) {
  const client = useQueryClient();
  return useMutation({ mutationFn: recordNotificationInteraction, onSuccess: () => {
    client.invalidateQueries({ queryKey: financeQueryKeys.notifications.list(userId) });
  } });
}

export function useNotificationRefresh(userId?: string | null) {
  const client = useQueryClient();
  useEffect(() => {
    if (!userId) return;
    let active = true;
    let running = false;
    async function refresh() {
      if (running || AppState.currentState !== 'active') return;
      running = true;
      try {
        await refreshNotifications();
        if (active) await client.invalidateQueries({ queryKey: financeQueryKeys.notifications.list(userId) });
      } catch {
        // Existing inbox remains available if generation is temporarily unavailable.
      } finally { running = false; }
    }
    void refresh();
    const timer = setInterval(refresh, 60_000);
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') void refresh(); });
    return () => { active = false; clearInterval(timer); subscription.remove(); };
  }, [userId, client]);
}

export function useMarkNotificationAsReadMutation(userId?: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (notificationId: string) => markNotificationAsRead(notificationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: financeQueryKeys.notifications.list(userId) });
    },
  });
}

export function useMarkAllNotificationsAsReadMutation(userId?: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: markAllNotificationsAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: financeQueryKeys.notifications.list(userId) });
    },
  });
}

export function useDeleteNotificationMutation(userId?: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (notificationId: string) => deleteNotification(notificationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: financeQueryKeys.notifications.list(userId) });
    },
  });
}

export function useDeleteAllNotificationsMutation(userId?: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteAllNotifications,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: financeQueryKeys.notifications.list(userId) });
    },
  });
}
