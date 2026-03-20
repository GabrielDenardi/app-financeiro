export type NotificationItem = {
    id: string;
    title: string;
    description: string;
    date: string;
    read: boolean;
    icon: "info" | "success" | "warning" | "security";
  };