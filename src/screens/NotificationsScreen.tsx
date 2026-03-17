import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import {
  Bell,
  ChevronLeft,
  Check,
  Trash2,
  Info,
  ShieldAlert,
  CircleCheck,
  TriangleAlert,
} from "lucide-react-native";
import { useNotifications } from "../hooks/useNotifications";
import type { NotificationItem } from "../types/notifications";

export function NotificationsScreen() {
  const navigation = useNavigation();
  const {
    notifications,
    loading,
    deleteNotification,
    deleteAllNotifications,
    markAsRead,
    markAllAsRead,
  } = useNotifications();

  function renderIcon(type: NotificationItem["icon"]) {
    switch (type) {
      case "success":
        return <CircleCheck size={18} />;
      case "warning":
        return <TriangleAlert size={18} />;
      case "security":
        return <ShieldAlert size={18} />;
      default:
        return <Info size={18} />;
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={styles.backBtn}>
          <ChevronLeft size={22} />
        </Pressable>
        <Text style={styles.headerTitle}>Notificações</Text>
      </View>

      <View style={styles.actionsRow}>
        <Pressable style={styles.topActionBtn} onPress={markAllAsRead}>
          <Check size={16} />
          <Text style={styles.topActionText}>Marcar todas como lidas</Text>
        </Pressable>

        <Pressable style={[styles.topActionBtn, styles.deleteAllBtn]} onPress={deleteAllNotifications}>
          <Trash2 size={16} />
          <Text style={[styles.topActionText, styles.deleteAllText]}>Excluir todas</Text>
        </Pressable>
      </View>

      {loading ? (
        <Text style={styles.stateText}>Carregando notificações...</Text>
      ) : notifications.length === 0 ? (
        <View style={styles.emptyState}>
          <Bell size={28} />
          <Text style={styles.emptyTitle}>Nenhuma notificação</Text>
          <Text style={styles.emptySubtitle}>
            Quando houver novidades, elas aparecerão aqui.
          </Text>
        </View>
      ) : (
        notifications.map((item) => (
          <View key={item.id} style={[styles.card, !item.read && styles.unreadCard]}>
            <View style={styles.cardTop}>
              <View style={styles.iconBox}>{renderIcon(item.icon)}</View>

              <View style={styles.cardText}>
                <Text style={styles.title}>{item.title}</Text>
                <Text style={styles.description}>{item.description}</Text>
                <Text style={styles.date}>{item.date}</Text>
              </View>
            </View>

            <View style={styles.cardActions}>
              <Pressable
                style={[styles.actionBtn, item.read && styles.disabledBtn]}
                onPress={() => markAsRead(item.id)}
                disabled={item.read}
              >
                <Check size={16} />
                <Text style={styles.actionText}>
                  {item.read ? "Visualizada" : "Marcar visualização"}
                </Text>
              </Pressable>

              <Pressable
                style={[styles.actionBtn, styles.deleteBtn]}
                onPress={() => deleteNotification(item.id)}
              >
                <Trash2 size={16} />
                <Text style={[styles.actionText, styles.deleteText]}>Excluir</Text>
              </Pressable>
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  content: { paddingBottom: 28 },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    gap: 10,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "700",
  },

  actionsRow: {
    paddingHorizontal: 16,
    flexDirection: "row",
    gap: 10,
    marginTop: 6,
    marginBottom: 8,
  },
  topActionBtn: {
    flex: 1,
    minHeight: 42,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E8E8E8",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#fff",
    paddingHorizontal: 10,
  },
  topActionText: {
    fontSize: 12,
    fontWeight: "600",
  },
  deleteAllBtn: {
    borderColor: "#F0C7C7",
    backgroundColor: "#FFF7F7",
  },
  deleteAllText: {
    color: "#D93025",
  },

  stateText: {
    paddingHorizontal: 16,
    marginTop: 20,
    color: "#777",
  },

  emptyState: {
    marginTop: 48,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    gap: 10,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  emptySubtitle: {
    fontSize: 13,
    color: "#777",
    textAlign: "center",
    lineHeight: 20,
  },

  card: {
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E9E9E9",
    backgroundColor: "#fff",
    padding: 14,
  },
  unreadCard: {
    borderColor: "#D8E7FF",
    backgroundColor: "#FAFCFF",
  },

  cardTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F5F5F5",
  },
  cardText: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: "700",
  },
  description: {
    fontSize: 12,
    color: "#666",
    marginTop: 4,
    lineHeight: 18,
  },
  date: {
    fontSize: 11,
    color: "#999",
    marginTop: 8,
  },

  cardActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
  },
  actionBtn: {
    flex: 1,
    minHeight: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E8E8E8",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#fff",
    paddingHorizontal: 10,
  },
  actionText: {
    fontSize: 12,
    fontWeight: "600",
  },
  deleteBtn: {
    borderColor: "#F0C7C7",
    backgroundColor: "#FFF7F7",
  },
  deleteText: {
    color: "#D93025",
  },
  disabledBtn: {
    opacity: 0.6,
  },
});