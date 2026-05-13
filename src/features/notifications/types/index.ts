export type UserNotificationIcon = 'info' | 'success' | 'warning' | 'security';

export type UserNotification = {
  id: string;
  title: string;
  description: string;
  date: string;
  read: boolean;
  icon: UserNotificationIcon;
};
