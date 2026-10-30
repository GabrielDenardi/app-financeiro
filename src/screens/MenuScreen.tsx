import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  Switch,
  Text,
  TouchableOpacity,
  View,
  StyleSheet,
} from "react-native";
import {
  ArrowLeftRight,
  ChartSpline,
  ChevronRight,
  Crown,
  FileText,
  Landmark,
  LogOut,
  Receipt,
  Trophy,
  User,
  Users,
} from "lucide-react-native";

import { Card } from "../components/Card";
import { PageHeader } from "../components/PageHeader";
import { PageShell } from "../components/PageShell";
import { useToast } from "../components/Toast";
import { useAuthenticatedUser } from "../features/auth/hooks/useAuthenticatedUser";
import { useUserNotifications } from "../features/notifications/hooks/useNotifications";
import { useProfile } from "../features/profile/hooks/useProfile";
import { registerLoginEvent } from "../features/preferences/services/preferencesService";
import { supabase } from "../lib/supabase";
import {
  radius,
  spacing,
  typography,
  type AppColors,
  useAppTheme,
} from "../theme";
import type { AuthenticatedUserSummary } from "../types/auth";
import { menuMock } from "../data/menuMock";

type MenuScreenProps = {
  navigation: any;
  user: AuthenticatedUserSummary | null;
};

const IMPLEMENTED_ROUTES = new Set([
  "Accounts",
  "Goals",
  "Help",
  "Privacy",
  "Notifications",
  "Import",
  "IncomeTax",
  "Plans",
  "About",
  "Reports",
  "Groups",
  "RecurringTransactions",
  "ListChat",
]);

const FEATURE_GRID = [
  { icon: Landmark, label: "Contas", page: "Accounts" },
  { icon: Trophy, label: "Metas", page: "Goals" },
  { icon: Users, label: "Grupos", page: "Groups" },
  { icon: ChartSpline, label: "Relatórios", page: "Reports" },
  { icon: ArrowLeftRight, label: "Recorrentes", page: "RecurringTransactions" },
  { icon: FileText, label: "Importar", page: "Import" },
  { icon: Receipt, label: "Imp. de Renda", page: "IncomeTax" },
  { icon: Crown, label: "Planos", page: "Plans" },
] as const;

export function MenuScreen({ navigation, user }: MenuScreenProps) {
  const { colors, isDarkMode, setDarkMode } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { showError } = useToast();
  const [isLogoutConfirmationVisible, setLogoutConfirmationVisible] = useState(false);
  const [isSigningOut, setSigningOut] = useState(false);
  const currentUser = useAuthenticatedUser();
  const resolvedUserId = currentUser?.id ?? user?.id;
  const profileQuery = useProfile(resolvedUserId);
  const notificationsQuery = useUserNotifications(resolvedUserId);
  const profileName =
    profileQuery.data?.fullName ||
    currentUser?.fullName ||
    user?.fullName ||
    "Usuário";
  const profileEmail =
    profileQuery.data?.email ||
    currentUser?.email ||
    user?.email ||
    "usuario@email.com";
  const parentNavigation = navigation?.getParent?.();
  const unreadNotifications = (notificationsQuery.data ?? []).filter(
    (item) => !item.read,
  ).length;
  const darkModeItemId = "dark-mode";
  const sections = menuMock.map((section) => ({
    ...section,
    items: section.items.map((item) =>
      item.page === "Notifications"
        ? {
            ...item,
            value: unreadNotifications > 0 ? String(unreadNotifications) : "0",
          }
        : item,
    ),
  }));

  const handleLogout = async () => {
    setLogoutConfirmationVisible(false);
    setSigningOut(true);
    void registerLoginEvent("sign_out").catch(() => undefined);
    await new Promise<void>((resolve) => setTimeout(resolve, 800));

    try {
      const { error } = await supabase.auth.signOut();

      if (error) {
      showError("Não foi possível sair agora. Tente novamente.");
      }
    } catch {
      showError("Não foi possível sair agora. Tente novamente.");
    } finally {
      setSigningOut(false);
    }
  };

  const handleNavigate = (page?: string) => {
    if (!page) return;

    if (!IMPLEMENTED_ROUTES.has(page)) {
      showError("Essa tela ainda não está disponível.");
      return;
    }

    if (parentNavigation) {
      parentNavigation.navigate(page);
      return;
    }

    navigation?.navigate(page);
  };

  const handleEditProfile = () => {
    if (parentNavigation) {
      parentNavigation.navigate("EditProfile");
      return;
    }
    navigation?.navigate("EditProfile");
  };

  return (
    <PageShell withTabBarInset>
      <PageHeader
        title="Mais"
        variant="primary"
        subtitle="Funcionalidades e configurações do app."
      />

      <Card style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {profileName.charAt(0)?.toUpperCase() || "U"}
          </Text>
        </View>
        <View style={styles.profileInfo}>
          <Text style={styles.profileName}>{profileName}</Text>
          <Text style={styles.profileEmail}>{profileEmail}</Text>
        </View>
        <TouchableOpacity style={styles.editButton} onPress={handleEditProfile}>
          <User size={16} color={colors.textPrimary} />
          <Text style={styles.editButtonText}>Editar</Text>
        </TouchableOpacity>
      </Card>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Funcionalidades</Text>
        <View style={styles.featureGrid}>
          {FEATURE_GRID.map((item) => {
            const Icon = item.icon;
            return (
              <Pressable
                key={item.page}
                style={({ pressed }) => [
                  styles.featureTile,
                  pressed && styles.pressed,
                ]}
                onPress={() => handleNavigate(item.page)}
              >
                <View style={styles.featureIconWrap}>
                  <Icon size={22} color={colors.primaryText} />
                </View>
                <Text style={styles.featureLabel} numberOfLines={2}>
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {sections.map((section) => (
        <View key={section.title} style={styles.section}>
          <Text style={styles.sectionTitle}>{section.title}</Text>
          <Card style={styles.menuGroup} noPadding>
            {section.items.map((item, index) => {
              const Icon = item.icon;
              const isLast = index === section.items.length - 1;

              return (
                <View key={item.id ?? item.page ?? item.label}>
                  <TouchableOpacity
                    style={styles.menuItem}
                    disabled={item.toggle}
                    onPress={() => handleNavigate(item.page)}
                  >
                    <View style={styles.menuItemIcon}>
                      <Icon size={20} color={colors.textSecondary} />
                    </View>

                    <Text style={styles.menuItemLabel}>{item.label}</Text>

                    {item.toggle ? (
                      <Switch
                        value={item.id === darkModeItemId ? isDarkMode : false}
                        onValueChange={(value) => {
                          if (item.id === darkModeItemId) {
                            setDarkMode(value);
                          }
                        }}
                        disabled={item.disabled}
                        thumbColor={
                          isDarkMode ? colors.primaryLight : colors.white
                        }
                        trackColor={{
                          false: colors.border,
                          true: `${colors.primaryLight}66`,
                        }}
                      />
                    ) : item.value ? (
                      <Text style={styles.menuItemValue}>{item.value}</Text>
                    ) : (
                      <ChevronRight size={18} color={colors.border} />
                    )}
                  </TouchableOpacity>
                  {!isLast ? <View style={styles.separator} /> : null}
                </View>
              );
            })}
          </Card>
        </View>
      ))}

      <TouchableOpacity
        style={styles.logoutButton}
        onPress={() => setLogoutConfirmationVisible(true)}
      >
        <LogOut size={20} color={colors.white} />
        <Text style={styles.logoutButtonText}>Sair da Conta</Text>
      </TouchableOpacity>

      <Modal
        visible={isLogoutConfirmationVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setLogoutConfirmationVisible(false)}
      >
        <View style={styles.logoutOverlay}>
          <View style={styles.logoutDialog}>
            <Text style={styles.logoutDialogTitle}>Deseja sair do aplicativo?</Text>
            <Text style={styles.logoutDialogMessage}>
              Sua sessão será encerrada e você voltará para a tela de login.
            </Text>
            <View style={styles.logoutActions}>
              <Pressable
                accessibilityRole="button"
                onPress={() => setLogoutConfirmationVisible(false)}
                style={({ pressed }) => [styles.logoutCancelButton, pressed && styles.pressed]}
              >
                <Text style={styles.logoutCancelText}>Cancelar</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={handleLogout}
                style={({ pressed }) => [styles.logoutConfirmButton, pressed && styles.pressed]}
              >
                <Text style={styles.logoutConfirmText}>Sair</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={isSigningOut} animationType="fade" transparent onRequestClose={() => {}}>
        <View style={styles.logoutOverlay}>
          <View style={styles.logoutLoadingCard}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text accessibilityLiveRegion="polite" style={styles.logoutLoadingText}>
              Saindo do aplicativo...
            </Text>
          </View>
        </View>
      </Modal>
    </PageShell>
  );
}

const createStyles = (colors: AppColors) =>
  StyleSheet.create({
    profileCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
    },
    avatar: {
      width: 60,
      height: 60,
      borderRadius: radius.pill,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    avatarText: {
      ...typography.h2,
      color: colors.white,
      fontWeight: "700",
    },
    profileInfo: {
      flex: 1,
      gap: 2,
    },
    profileName: {
      ...typography.h2,
      color: colors.textPrimary,
    },
    profileEmail: {
      ...typography.caption,
      color: colors.textSecondary,
    },
    editButton: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      gap: spacing.xs,
    },
    editButtonText: {
      ...typography.body,
      color: colors.textPrimary,
      fontWeight: "600",
    },
    section: {
      gap: spacing.sm,
    },
    sectionTitle: {
      ...typography.body,
      color: colors.textPrimary,
      fontWeight: "600",
      marginLeft: spacing.xs,
    },
    featureGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm,
    },
    featureTile: {
      width: "22%",
      flexGrow: 1,
      alignItems: "center",
      gap: spacing.sm,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.lg,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xs,
    },
    featureIconWrap: {
      width: 48,
      height: 48,
      borderRadius: radius.md,
      backgroundColor: colors.surfaceMuted,
      alignItems: "center",
      justifyContent: "center",
    },
    featureLabel: {
      ...typography.caption,
      color: colors.textPrimary,
      fontWeight: "600",
      textAlign: "center",
    },
    pressed: {
      opacity: 0.7,
    },
    menuGroup: {
      overflow: "hidden",
    },
    menuItem: {
      flexDirection: "row",
      alignItems: "center",
      padding: spacing.lg,
    },
    menuItemIcon: {
      width: 36,
      height: 36,
      borderRadius: radius.md,
      backgroundColor: colors.surfaceMuted,
      alignItems: "center",
      justifyContent: "center",
      marginRight: spacing.md,
    },
    menuItemLabel: {
      flex: 1,
      ...typography.body,
      color: colors.textPrimary,
      fontWeight: "500",
    },
    menuItemValue: {
      ...typography.caption,
      color: colors.textSecondary,
    },
    separator: {
      height: 1,
      backgroundColor: colors.border,
      marginLeft: 68,
    },
    logoutButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      minHeight: 56,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.danger,
      backgroundColor: colors.danger,
      gap: spacing.sm,
      marginBottom: spacing.sm,
    },
    logoutButtonText: {
      ...typography.body,
      color: colors.white,
      fontWeight: "700",
    },
    logoutOverlay: {
      flex: 1,
      backgroundColor: "rgba(15, 23, 42, 0.6)",
      justifyContent: "center",
      alignItems: "center",
      padding: spacing.lg,
    },
    logoutDialog: {
      width: "100%",
      maxWidth: 360,
      padding: spacing.xl,
      gap: spacing.md,
      borderRadius: 16,
      backgroundColor: colors.surface,
    },
    logoutDialogTitle: {
      ...typography.h2,
      color: colors.textPrimary,
      textAlign: "center",
    },
    logoutDialogMessage: {
      ...typography.body,
      color: colors.textSecondary,
      textAlign: "center",
    },
    logoutActions: {
      flexDirection: "row",
      gap: spacing.md,
      marginTop: spacing.sm,
    },
    logoutCancelButton: {
      flex: 1,
      height: 48,
      borderRadius: 12,
      backgroundColor: colors.surfaceMuted,
      alignItems: "center",
      justifyContent: "center",
    },
    logoutCancelText: {
      ...typography.body,
      color: colors.textPrimary,
      fontWeight: "600",
    },
    logoutConfirmButton: {
      flex: 1,
      height: 48,
      borderRadius: 12,
      backgroundColor: colors.danger,
      alignItems: "center",
      justifyContent: "center",
    },
    logoutConfirmText: {
      ...typography.body,
      color: colors.white,
      fontWeight: "700",
    },
    logoutLoadingCard: {
      minWidth: 240,
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.xl,
      gap: spacing.lg,
      borderRadius: 16,
      backgroundColor: colors.surface,
      alignItems: "center",
    },
    logoutLoadingText: {
      ...typography.body,
      color: colors.textPrimary,
      textAlign: "center",
    },
  });
