import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { financeQueryKeys } from '../../finance/queryKeys';
import {
  deleteAllNotifications,
  deleteNotification,
  listUserNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from '../services/notificationsService';

export function useUserNotifications(userId?: string | null) {
  return useQuery({
    queryKey: financeQueryKeys.notifications.list(userId),
    queryFn: listUserNotifications,
    enabled: Boolean(userId),
  });
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
