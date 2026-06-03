import React, { useMemo } from "react";
import {
  Alert,
  Switch,
  Text,
  TouchableOpacity,
  View,
  StyleSheet,
} from "react-native";
import { ChevronRight, LogOut, User } from "lucide-react-native";

import { Card } from "../components/Card";
import { PageHeader } from "../components/PageHeader";
import { PageShell } from "../components/PageShell";
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
  "Cards",
  "Goals",
  "Help",
  "Privacy",
  "Notifications",
  "Import",
  "Plans",
  "About",
  "Budgets",
  "Reports",
  "Groups",
  "RecurringTransactions",
  "ListChat",
]);

export function MenuScreen({ navigation, user }: MenuScreenProps) {
  const { colors, isDarkMode, setDarkMode } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
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
    try {
      await registerLoginEvent("sign_out");
    } catch {
      // Ignore logging failures on sign out.
    }

    const { error } = await supabase.auth.signOut();

    if (error) {
      Alert.alert("Erro", "Não foi possível sair agora. Tente novamente.");
    }
  };

  const handleNavigate = (page?: string) => {
    if (!page) {
      return;
    }

    if (!IMPLEMENTED_ROUTES.has(page)) {
      Alert.alert("Em breve", "Essa tela ainda não está disponível.");
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
        title="Configurações"
        variant="primary"
        subtitle="Ajuste preferências, perfil e segurança."
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

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <LogOut size={20} color={colors.white} />
        <Text style={styles.logoutButtonText}>Sair da Conta</Text>
      </TouchableOpacity>
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
      borderRadius: 30,
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
      ...typography.body,
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
      ...typography.caption,
      color: colors.textSecondary,
      fontWeight: "700",
      marginLeft: spacing.xs,
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
      backgroundColor: colors.dangerSoft,
      gap: spacing.sm,
      marginBottom: spacing.sm,
    },
    logoutButtonText: {
      ...typography.body,
      color: colors.white,
      fontWeight: "700",
    },
  });
