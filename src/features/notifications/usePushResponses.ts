import { useEffect } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import type { NotificationResponse } from 'expo-notifications';
import { createNavigationContainerRef } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import { financeQueryKeys } from '../finance/queryKeys';
import { listUserNotifications, recordNotificationInteraction } from './services/notificationsService';
import { notificationDestination } from './navigation';

export const notificationNavigationRef = createNavigationContainerRef<any>();

// Only mounted in the authenticated, unlocked app. The payload contains an ID,
// never financial details or a route that can bypass an authenticated screen.
export function usePushResponses(userId?: string | null) {
  const client = useQueryClient();
  useEffect(() => {
    if (!userId || Platform.OS === 'web' || Constants.appOwnership === 'expo') return;
    let active = true;
    let remove: (() => void) | undefined;
    const handled = new Set<string>();
    void import('expo-notifications').then(async Notifications => {
      if (!active) return;
      let pending: NotificationResponse | null = null;
      async function open(response: NotificationResponse | null) {
        if (!response || !active) return;
        if (!notificationNavigationRef.isReady()) { pending = response; return; }
        pending = null;
        const id = response.notification.request.content.data.notificationId;
        if (typeof id !== 'string' || handled.has(id)) return;
        handled.add(id);
        try {
          const item = (await listUserNotifications()).find(n => n.id === id);
          if (!active || !item) return;
          await recordNotificationInteraction(id);
          if (!active) return;
          const destination = notificationDestination(item);
          if (destination) notificationNavigationRef.navigate(destination.screen, destination.params);
          else notificationNavigationRef.navigate('Notifications');
          await client.invalidateQueries({ queryKey: financeQueryKeys.notifications.list(userId) });
          await Notifications.clearLastNotificationResponseAsync();
        } catch { handled.delete(id); }
      }
      const responseListener = Notifications.addNotificationResponseReceivedListener(response => { void open(response); });
      const receivedListener = Notifications.addNotificationReceivedListener(() => {
        void client.invalidateQueries({ queryKey: financeQueryKeys.notifications.list(userId) });
      });
      const removeReadyListener = notificationNavigationRef.addListener('ready', () => { void open(pending); });
      remove = () => { responseListener.remove(); receivedListener.remove(); removeReadyListener(); };
      await open(await Notifications.getLastNotificationResponseAsync());
    }).catch(() => { /* Push availability never blocks opening the internal inbox. */ });
    return () => { active = false; remove?.(); };
  }, [userId, client]);
}
