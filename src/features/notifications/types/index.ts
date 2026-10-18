export type UserNotificationIcon = 'info' | 'success' | 'warning' | 'security';

export type UserNotification = {
  id: string;
  title: string;
  description: string;
  date: string;
  read: boolean;
  icon: UserNotificationIcon;
  category: NotificationCategory;
  metadata: Record<string, unknown>;
};

export type NotificationCategory = 'budgets' | 'reminders' | 'groups' | 'security' | 'recommendations' | 'system';

export type NotificationPreferences = {
  budgets: boolean;
  reminders: boolean;
  groups: boolean;
  security: boolean;
  recommendations: boolean;
  push_enabled: boolean;
  hide_sensitive: boolean;
  budget_thresholds: number[];
  reminder_days: number;
  quiet_start: number;
  quiet_end: number;
  timezone: string;
  ai_enabled: boolean;
};
