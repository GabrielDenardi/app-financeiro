import { requireCurrentUserId } from '../../../lib/auth';
import { supabase } from '../../../lib/supabase';
import type { NotificationPreferences, UserNotification } from '../types';

type NotificationRow = {
  id: string;
  title: string;
  description: string;
  icon: UserNotification['icon'];
  read_at: string | null;
  created_at: string;
  source_type: UserNotification['category'];
  metadata: Record<string, unknown> | null;
};

function mapNotification(row: NotificationRow): UserNotification {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    icon: row.icon,
    read: Boolean(row.read_at),
    date: row.created_at,
    category: row.source_type,
    metadata: row.metadata ?? {},
  };
}

export async function listUserNotifications(): Promise<UserNotification[]> {
  const userId = await requireCurrentUserId();
  const { data, error } = await supabase
    .from('user_notifications')
    .select('id, title, description, icon, read_at, created_at, source_type, metadata')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return ((data as NotificationRow[] | null) ?? []).map(mapNotification);
}

export async function markNotificationAsRead(notificationId: string): Promise<void> {
  const userId = await requireCurrentUserId();
  const { error } = await supabase
    .from('user_notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', notificationId)
    .eq('user_id', userId)
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
  const userId = await requireCurrentUserId();
  const { error } = await supabase.from('user_notifications').delete().eq('id', notificationId).eq('user_id', userId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function refreshNotifications(): Promise<void> {
  await requireCurrentUserId();
  const { error } = await supabase.rpc('refresh_user_notifications');
  if (error) throw new Error(error.message);
}

export async function recordNotificationInteraction(notificationId: string): Promise<void> {
  const userId = await requireCurrentUserId();
  const { error } = await supabase.from('user_notifications')
    .update({ interacted_at: new Date().toISOString(), read_at: new Date().toISOString() })
    .eq('id', notificationId).eq('user_id', userId);
  if (error) throw new Error(error.message);
}

export async function getNotificationPreferences(): Promise<NotificationPreferences> {
  const userId = await requireCurrentUserId();
  const { error: ensureError } = await supabase.from('notification_preferences')
    .upsert({ user_id: userId }, { onConflict: 'user_id', ignoreDuplicates: true });
  if (ensureError) throw new Error(ensureError.message);
  const { data, error } = await supabase.from('notification_preferences').select('*').eq('user_id', userId).single();
  if (error) throw new Error(error.message);
  return data as NotificationPreferences;
}

export async function updateNotificationPreferences(prefs: NotificationPreferences): Promise<void> {
  const userId = await requireCurrentUserId();
  const { error } = await supabase.from('notification_preferences').update({
    budgets: prefs.budgets, reminders: prefs.reminders, groups: prefs.groups,
    security: prefs.security, recommendations: prefs.recommendations,
    push_enabled: prefs.push_enabled, hide_sensitive: prefs.hide_sensitive,
    budget_thresholds: prefs.budget_thresholds, reminder_days: prefs.reminder_days,
    quiet_start: prefs.quiet_start, quiet_end: prefs.quiet_end, timezone: prefs.timezone,
    ai_enabled: prefs.ai_enabled,
  }).eq('user_id', userId);
  if (error) throw new Error(error.message);
}

export async function generateNotificationRecommendation(): Promise<void> {
  await requireCurrentUserId();
  const { error } = await supabase.functions.invoke('recommend-notifications', { body: {} });
  if (!error) return;
  let message = 'Não foi possível gerar uma recomendação agora.';
  try {
    const body = await error.context?.json();
    if (typeof body?.error === 'string') message = body.error;
  } catch { /* Keep the localized fallback when no JSON body is available. */ }
  throw new Error(message);
}

export async function deleteAllNotifications(): Promise<void> {
  const userId = await requireCurrentUserId();
  const { error } = await supabase.from('user_notifications').delete().eq('user_id', userId);

  if (error) {
    throw new Error(error.message);
  }
}
