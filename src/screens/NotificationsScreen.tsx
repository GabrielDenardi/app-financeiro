import { useMemo, useState } from "react";
import {
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
import { useToast } from "../components/Toast";
import { NotificationSettings } from "../features/notifications/components/NotificationSettings";
import { notificationDestination } from "../features/notifications/navigation";
import { PageHeader } from "../components/PageHeader";
import { PageShell } from "../components/PageShell";
import { useAuthenticatedUser } from "../features/auth/hooks/useAuthenticatedUser";
import {
  useDeleteAllNotificationsMutation,
  useDeleteNotificationMutation,
  useMarkAllNotificationsAsReadMutation,
  useMarkNotificationAsReadMutation,
  useUserNotifications,
  useNotificationInteraction,
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
  const toast = useToast();
  const [showSettings, setShowSettings] = useState(false);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const interaction = useNotificationInteraction(user?.id);
  const notificationsQuery = useUserNotifications(user?.id);
  const markAllMutation = useMarkAllNotificationsAsReadMutation(user?.id);
  const markOneMutation = useMarkNotificationAsReadMutation(user?.id);
  const deleteOneMutation = useDeleteNotificationMutation(user?.id);
  const deleteAllMutation = useDeleteAllNotificationsMutation(user?.id);

  const notifications = (notificationsQuery.data ?? []).filter(item => !unreadOnly || !item.read);
  const unreadCount = (notificationsQuery.data ?? []).filter(item => !item.read).length;
  const onError = (error: Error) => toast.showError(error.message);
  async function openNotification(item: UserNotification) {
    const destination = notificationDestination(item);
    try {
      await interaction.mutateAsync(item.id);
      if (destination) navigation.navigate(destination.screen, destination.params);
    } catch (error) { toast.showError(error instanceof Error ? error.message : 'Não foi possível abrir a notificação.'); }
  }
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
        return <TriangleAlert size={18} color={colors.warning} />;
      case "security":
        return <ShieldAlert size={18} color={colors.primary} />;
      default:
        return <Info size={18} color={colors.textSecondary} />;
    }
  }

  return (
    <PageShell onBackPress={() => navigation.goBack()}>
      <PageHeader title="Notificações" />
      <Text style={styles.stateText}>{unreadCount} não lida(s)</Text>
      <View style={styles.actionsRow}>
        <Pressable accessibilityRole="button" style={styles.topActionBtn} onPress={() => setUnreadOnly(!unreadOnly)}>
          <Text style={styles.topActionText}>{unreadOnly ? 'Mostrar todas' : 'Somente não lidas'}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" style={styles.topActionBtn} onPress={() => setShowSettings(!showSettings)}>
          <Text style={styles.topActionText}>{showSettings ? 'Fechar preferências' : 'Preferências'}</Text>
        </Pressable>
      </View>
      {showSettings && <NotificationSettings userId={user?.id} />}

      <View style={styles.actionsRow}>
        <Pressable
          accessibilityRole="button"
          style={styles.topActionBtn}
          onPress={() => markAllMutation.mutate(undefined, { onError })}
          disabled={loading}
        >
          <Check size={14} color={colors.textPrimary} />
          <Text style={styles.topActionText}>Marcar todas como lidas</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          style={[styles.topActionBtn, styles.deleteAction]}
          onPress={() => deleteAllMutation.mutate(undefined, { onError })}
          disabled={loading}
        >
          <Trash2 size={14} color={colors.danger} />
          <Text style={[styles.topActionText, styles.deleteText]}>
            Excluir todas
          </Text>
        </Pressable>
      </View>

      {notificationsQuery.isError ? (
        <Pressable onPress={() => notificationsQuery.refetch()}><Text style={styles.stateText}>Não foi possível carregar notificações. Toque para tentar novamente.</Text></Pressable>
      ) : notificationsQuery.isLoading ? (
        <Text style={styles.stateText}>Carregando notificações...</Text>
      ) : notifications.length === 0 ? (
        <Card style={styles.emptyState}>
          <Bell size={28} color={colors.textSecondary} />
          <Text style={styles.emptyTitle}>{unreadOnly ? 'Nenhuma notificação não lida' : 'Nenhuma notificação'}</Text>
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

              <Pressable accessibilityRole="button" accessibilityLabel={`Abrir: ${item.title}`} style={styles.cardText} disabled={interaction.isPending} onPress={() => openNotification(item)}>
                <Text style={styles.title}>{item.title}</Text>
                <Text style={styles.description}>{item.description}</Text>
                <Text style={styles.date}>
                  {new Date(item.date).toLocaleString("pt-BR")}
                </Text>
              </Pressable>
            </View>

            <View style={styles.cardActions}>
              <Pressable
                accessibilityRole="button"
                style={[styles.actionBtn, item.read && styles.disabledBtn]}
                onPress={() => markOneMutation.mutate(item.id, { onError })}
                disabled={item.read || loading}
              >
                <Check size={16} color={colors.textPrimary} />
                <Text style={styles.actionText}>
                  {item.read ? "Visualizada" : "Marcar visualização"}
                </Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                style={[styles.actionBtn, styles.deleteAction]}
                onPress={() => deleteOneMutation.mutate(item.id, { onError })}
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
