import { useEffect, useState } from "react";
import type { NotificationItem } from "../types/notifications";
import { loadNotifications, saveNotifications } from "../utils/notificationsStorage";

export function useNotifications() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const data = await loadNotifications();
      setNotifications(data);
      setLoading(false);
    })();
  }, []);

  async function persist(next: NotificationItem[]) {
    setNotifications(next);
    await saveNotifications(next);
  }

  async function deleteNotification(id: string) {
    const next = notifications.filter((item) => item.id !== id);
    await persist(next);
  }

  async function deleteAllNotifications() {
    await persist([]);
  }

  async function markAsRead(id: string) {
    const next = notifications.map((item) =>
      item.id === id ? { ...item, read: true } : item
    );
    await persist(next);
  }

  async function markAllAsRead() {
    const next = notifications.map((item) => ({ ...item, read: true }));
    await persist(next);
  }

  return {
    notifications,
    loading,
    deleteNotification,
    deleteAllNotifications,
    markAsRead,
    markAllAsRead,
  };
}