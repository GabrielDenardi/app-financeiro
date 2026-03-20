import AsyncStorage from "@react-native-async-storage/async-storage";
import type { NotificationItem } from "../types/notifications";
import { notificationsMock } from "../data/notificationsMock";

const KEY = "@app_financeiro:notifications_v1";

export async function loadNotifications(): Promise<NotificationItem[]> {
  const raw = await AsyncStorage.getItem(KEY);

  if (!raw) {
    await AsyncStorage.setItem(KEY, JSON.stringify(notificationsMock));
    return notificationsMock;
  }

  try {
    return JSON.parse(raw) as NotificationItem[];
  } catch {
    await AsyncStorage.setItem(KEY, JSON.stringify(notificationsMock));
    return notificationsMock;
  }
}

export async function saveNotifications(items: NotificationItem[]): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(items));
}