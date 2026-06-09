import { useMemo } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import {
  Bell,
  Check,
  CircleCheck,
  Info,
  ShieldAlert,
  Trash2,
  TriangleAlert,
} from "lucide-react-native";

import { Card } from "../components/Card";
import { PageHeader } from "../components/PageHeader";
import { PageShell } from "../components/PageShell";
import { useAuthenticatedUser } from "../features/auth/hooks/useAuthenticatedUser";
import {
  useDeleteAllNotificationsMutation,
  useDeleteNotificationMutation,
  useMarkAllNotificationsAsReadMutation,
  useMarkNotificationAsReadMutation,
  useUserNotifications,
} from "../features/notifications/hooks/useNotifications";
import {
  radius,
  spacing,
  typography,
  type AppColors,
  useThemeColors,
} from "../theme";
import type { UserNotification } from "../features/notifications/types";

export function NotificationsScreen() {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const navigation = useNavigation<any>();
  const user = useAuthenticatedUser();
  const notificationsQuery = useUserNotifications(user?.id);
  const markAllMutation = useMarkAllNotificationsAsReadMutation(user?.id);
  const markOneMutation = useMarkNotificationAsReadMutation(user?.id);
  const deleteOneMutation = useDeleteNotificationMutation(user?.id);
  const deleteAllMutation = useDeleteAllNotificationsMutation(user?.id);

  const notifications = notificationsQuery.data ?? [];
  const loading =
    notificationsQuery.isLoading ||
    markAllMutation.isPending ||
    markOneMutation.isPending ||
    deleteOneMutation.isPending ||
    deleteAllMutation.isPending;

  function renderIcon(type: UserNotification["icon"]) {
    switch (type) {
      case "success":
        return <CircleCheck size={18} color={colors.success} />;
      case "warning":
        return <TriangleAlert size={18} color="#D97706" />;
      case "security":
        return <ShieldAlert size={18} color={colors.primary} />;
      default:
        return <Info size={18} color={colors.textSecondary} />;
    }
  }

  return (
    <PageShell>
      <PageHeader
        title="Notificações"
        onBackPress={() => navigation.goBack()}
      />

      <View style={styles.actionsRow}>
        <Pressable
          style={styles.topActionBtn}
          onPress={() => markAllMutation.mutate()}
          disabled={loading}
        >
          <Check size={14} color={colors.textPrimary} />
          <Text style={styles.topActionText}>Marcar todas como lidas</Text>
        </Pressable>

        <Pressable
          style={[styles.topActionBtn, styles.deleteAction]}
          onPress={() => deleteAllMutation.mutate()}
          disabled={loading}
        >
          <Trash2 size={14} color={colors.danger} />
          <Text style={[styles.topActionText, styles.deleteText]}>
            Excluir todas
          </Text>
        </Pressable>
      </View>

      {notificationsQuery.isLoading ? (
        <Text style={styles.stateText}>Carregando notificações...</Text>
      ) : notifications.length === 0 ? (
        <Card style={styles.emptyState}>
          <Bell size={28} color={colors.textSecondary} />
          <Text style={styles.emptyTitle}>Nenhuma notificação</Text>
          <Text style={styles.emptySubtitle}>
            Quando houver novidades, elas aparecerão aqui.
          </Text>
        </Card>
      ) : (
        notifications.map((item) => (
          <Card
            key={item.id}
            style={[styles.card, !item.read && styles.unreadCard]}
          >
            <View style={styles.cardTop}>
              <View style={styles.iconBox}>{renderIcon(item.icon)}</View>

              <View style={styles.cardText}>
                <Text style={styles.title}>{item.title}</Text>
                <Text style={styles.description}>{item.description}</Text>
                <Text style={styles.date}>
                  {new Date(item.date).toLocaleString("pt-BR")}
                </Text>
              </View>
            </View>

            <View style={styles.cardActions}>
              <Pressable
                style={[styles.actionBtn, item.read && styles.disabledBtn]}
                onPress={() => markOneMutation.mutate(item.id)}
                disabled={item.read || loading}
              >
                <Check size={16} color={colors.textPrimary} />
                <Text style={styles.actionText}>
                  {item.read ? "Visualizada" : "Marcar visualização"}
                </Text>
              </Pressable>

              <Pressable
                style={[styles.actionBtn, styles.deleteAction]}
                onPress={() => deleteOneMutation.mutate(item.id)}
                disabled={loading}
              >
                <Trash2 size={16} color={colors.danger} />
                <Text style={[styles.actionText, styles.deleteText]}>
                  Excluir
                </Text>
              </Pressable>
            </View>
          </Card>
        ))
      )}
    </PageShell>
  );
}

const createStyles = (colors: AppColors) =>
  StyleSheet.create({
    actionsRow: {
      flexDirection: "row",
      gap: spacing.sm,
    },
    topActionBtn: {
      flex: 1,
      minHeight: 44,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.xs,
      backgroundColor: colors.surface,
      paddingHorizontal: spacing.sm,
    },
    topActionText: {
      ...typography.caption,
      color: colors.textPrimary,
      fontWeight: "600",
    },
    deleteAction: {
      borderColor: colors.danger,
      backgroundColor: colors.dangerSoft,
    },
    deleteText: {
      color: colors.danger,
    },
    stateText: {
      ...typography.body,
      color: colors.textSecondary,
    },
    emptyState: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: spacing.xl,
      gap: spacing.sm,
    },
    emptyTitle: {
      ...typography.h2,
      color: colors.textPrimary,
    },
    emptySubtitle: {
      ...typography.body,
      color: colors.textSecondary,
      textAlign: "center",
      lineHeight: 20,
    },
    card: {
      gap: spacing.md,
    },
    unreadCard: {
      borderColor: colors.primary,
      backgroundColor: colors.primarySoft,
    },
    cardTop: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: spacing.md,
    },
    iconBox: {
      width: 36,
      height: 36,
      borderRadius: radius.md,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surfaceMuted,
    },
    cardText: {
      flex: 1,
    },
    title: {
      ...typography.body,
      color: colors.textPrimary,
      fontWeight: "700",
    },
    description: {
      ...typography.caption,
      color: colors.textSecondary,
      marginTop: spacing.xs,
      lineHeight: 18,
    },
    date: {
      ...typography.caption,
      color: colors.textSecondary,
      marginTop: spacing.sm,
    },
    cardActions: {
      flexDirection: "row",
      gap: spacing.sm,
    },
    actionBtn: {
      flex: 1,
      minHeight: 40,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.sm,
      backgroundColor: colors.surface,
      paddingHorizontal: spacing.sm,
    },
    actionText: {
      ...typography.caption,
      color: colors.textPrimary,
      fontWeight: "700",
    },
    disabledBtn: {
      opacity: 0.6,
    },
  });
