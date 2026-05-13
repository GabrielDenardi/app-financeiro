import { requireCurrentUserId } from '../../../lib/auth';
import { supabase } from '../../../lib/supabase';
import type { UserNotification } from '../types';

type NotificationRow = {
  id: string;
  title: string;
  description: string;
  icon: UserNotification['icon'];
  read_at: string | null;
  created_at: string;
};

function mapNotification(row: NotificationRow): UserNotification {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    icon: row.icon,
    read: Boolean(row.read_at),
    date: row.created_at,
  };
}

export async function listUserNotifications(): Promise<UserNotification[]> {
  const userId = await requireCurrentUserId();
  const { data, error } = await supabase
    .from('user_notifications')
    .select('id, title, description, icon, read_at, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return ((data as NotificationRow[] | null) ?? []).map(mapNotification);
}

export async function markNotificationAsRead(notificationId: string): Promise<void> {
  const { error } = await supabase
    .from('user_notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', notificationId)
    .is('read_at', null);

  if (error) {
    throw new Error(error.message);
  }
}

export async function markAllNotificationsAsRead(): Promise<void> {
  const userId = await requireCurrentUserId();
  const { error } = await supabase
    .from('user_notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('read_at', null);

  if (error) {
    throw new Error(error.message);
  }
}

export async function deleteNotification(notificationId: string): Promise<void> {
  const { error } = await supabase.from('user_notifications').delete().eq('id', notificationId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function deleteAllNotifications(): Promise<void> {
  const userId = await requireCurrentUserId();
  const { error } = await supabase.from('user_notifications').delete().eq('user_id', userId);

  if (error) {
    throw new Error(error.message);
  }
}
