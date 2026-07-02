import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  ArrowDownRight,
  ArrowLeft,
  ArrowUpRight,
  Eye,
  EyeOff,
  Landmark,
  Plus,
  Repeat,
} from "lucide-react-native";

import { AddAccountModal } from "../components/AddAccountModal";
import { TransferModal } from "../components/TransferModal";
import { typeConfig } from "../data/accountsMock";
import {
  useAccountsOverview,
  useCreateAccountMutation,
  useCreateTransferMutation,
} from "../features/accounts/hooks/useAccounts";
import { useAuthenticatedUser } from "../features/auth/hooks/useAuthenticatedUser";
import { useCurrentPlan } from "../features/plans/hooks";
import {
  canCreateAccount,
  getAccountLimitMessage,
} from "../features/plans/plans";
import {
  layout,
  radius,
  spacing,
  typography,
  type AppColors,
  useAppTheme,
} from "../theme";
import { formatCurrencyBRL } from "../utils/format";

export function AccountsScreen({ navigation }: any) {
  const { colors, isDarkMode } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const currentUser = useAuthenticatedUser();
  const overviewQuery = useAccountsOverview(currentUser?.id);
  const createAccountMutation = useCreateAccountMutation(currentUser?.id);
  const createTransferMutation = useCreateTransferMutation(currentUser?.id);
  const currentPlan = useCurrentPlan(currentUser?.id);

  const [showBalances, setShowBalances] = useState(true);
  const [addVisible, setAddVisible] = useState(false);
  const [transferVisible, setTransferVisible] = useState(false);

  const overview = overviewQuery.data;
  const activeAccounts = useMemo(
    () => overview?.accounts.filter((account) => account.isActive) ?? [],
    [overview?.accounts],
  );

  const formatMaybeHidden = (value: number) => {
    return showBalances ? formatCurrencyBRL(value) : "R$ ••••••";
  };

  const handleCreateAccount = async (input: any) => {
    try {
      await createAccountMutation.mutateAsync(input);
      setAddVisible(false);
    } catch (error) {
      Alert.alert(
        "Erro",
        error instanceof Error
          ? error.message
          : "Não foi possível criar a conta.",
      );
    }
  };

  const handleOpenAddAccount = () => {
    if (!canCreateAccount(currentPlan.plan.id, activeAccounts.length)) {
      Alert.alert(
        "Limite do plano",
        getAccountLimitMessage(currentPlan.plan.id),
      );
      return;
    }

    setAddVisible(true);
  };

  const handleCreateTransfer = async (input: any) => {
    try {
      await createTransferMutation.mutateAsync(input);
      setTransferVisible(false);
    } catch (error) {
      Alert.alert(
        "Erro",
        error instanceof Error ? error.message : "Não foi possível transferir.",
      );
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle={isDarkMode ? "light-content" : "dark-content"}
        backgroundColor={colors.background}
      />

      <View style={styles.headerBackground}>
        <SafeAreaView>
          <View style={styles.headerContent}>
            <Pressable
              onPress={() => navigation.goBack()}
              style={styles.headerIconButton}
            >
              <ArrowLeft color={colors.white} size={22} />
            </Pressable>

            <Text style={styles.headerTitle}>Contas</Text>

            <View style={styles.headerActions}>
              <Pressable
                style={styles.actionButtonGhost}
                onPress={() => setTransferVisible(true)}
              >
                <Repeat color={colors.white} size={14} />
                <Text style={styles.headerActionText}>Transferir</Text>
              </Pressable>
              <Pressable
                style={styles.actionButtonSolid}
                onPress={handleOpenAddAccount}
              >
                <Plus color={colors.white} size={14} />
                <Text style={styles.headerActionText}>Novo</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.totalCard}>
            {overviewQuery.isLoading ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <>
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Patrimônio Líquido</Text>
                  <Pressable
                    onPress={() => setShowBalances((current) => !current)}
                  >
                    {showBalances ? (
                      <Eye color={colors.white} size={18} opacity={0.7} />
                    ) : (
                      <EyeOff color={colors.white} size={18} opacity={0.7} />
                    )}
                  </Pressable>
                </View>
                <Text style={styles.totalValue}>
                  {formatMaybeHidden(overview?.totalBalance ?? 0)}
                </Text>

                <View style={styles.statsGrid}>
                  <View style={styles.statItem}>
                    <Text style={styles.statLabel}>Ativos</Text>
                    <Text style={styles.statValue}>
                      {formatMaybeHidden(overview?.totalAssets ?? 0)}
                    </Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statItem}>
                    <Text style={styles.statLabel}>Dívidas</Text>
                    <Text style={styles.statValue}>
                      {showBalances
                        ? formatCurrencyBRL(overview?.totalLiabilities ?? 0)
                        : "R$ ••••"}
                    </Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statItem}>
                    <Text style={styles.statLabel}>Contas</Text>
                    <Text style={styles.statValue}>
                      {activeAccounts.length}/
                      {currentPlan.entitlements.accountLimit}
                    </Text>
                  </View>
                </View>
              </>
            )}
          </View>
        </SafeAreaView>
      </View>

      <ScrollView
        style={styles.scrollContent}
        contentContainerStyle={styles.scrollPadding}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryBox}>
              <View style={styles.summaryLabelRow}>
                <ArrowUpRight size={14} color={colors.success} />
                <Text style={styles.summarySmallLabel}>Entradas</Text>
              </View>
              <Text style={[styles.summaryAmount, styles.incomeText]}>
                {formatMaybeHidden(overview?.monthlyIncome ?? 0)}
              </Text>
            </View>

            <View style={styles.verticalDivider} />

            <View style={styles.summaryBox}>
              <View style={styles.summaryLabelRow}>
                <ArrowDownRight size={14} color={colors.danger} />
                <Text style={styles.summarySmallLabel}>Saídas</Text>
              </View>
              <Text style={[styles.summaryAmount, styles.expenseText]}>
                {formatMaybeHidden(overview?.monthlyExpense ?? 0)}
              </Text>
            </View>
          </View>

          <View style={styles.progressBg}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${
                    overview?.monthlyIncome
                      ? Math.min(
                          ((overview.monthlyExpense ?? 0) /
                            overview.monthlyIncome) *
                            100,
                          100,
                        )
                      : 0
                  }%`,
                },
              ]}
            />
          </View>
        </View>

        <Text style={styles.sectionTitle}>Suas Contas</Text>

        {overviewQuery.isLoading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator />
          </View>
        ) : activeAccounts.length ? (
          activeAccounts.map((account) => {
            const config = typeConfig[account.type];

            return (
              <View key={account.id} style={styles.accountCard}>
                <View style={styles.accountMainInfo}>
                  <View style={styles.accountTypeRow}>
                    <View
                      style={[
                        styles.typeIconContainer,
                        { backgroundColor: config.light },
                      ]}
                    >
                      <config.icon size={12} color={colors.primary} />
                    </View>
                    <Text style={styles.accountTypeLabel}>{config.label}</Text>
                  </View>

                  <Text style={styles.accountName}>{account.name}</Text>

                  <View style={styles.institutionRow}>
                    <Landmark size={12} color={colors.textSecondary} />
                    <Text style={styles.institutionText}>
                      {account.institution || "Instituição não informada"}
                    </Text>
                  </View>
                </View>

                <View style={styles.accountBalanceWrapper}>
                  <View style={styles.balanceTextContainer}>
                    <Text style={styles.balanceLabel}>Saldo</Text>
                    <Text style={styles.balanceValue}>
                      {showBalances
                        ? formatCurrencyBRL(account.currentBalance)
                        : "••••"}
                    </Text>
                  </View>
                </View>
              </View>
            );
          })
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Nenhuma conta cadastrada</Text>
            <Text style={styles.emptyText}>
              Crie a primeira conta para ver o patrimônio real do aplicativo.
            </Text>
          </View>
        )}

      </ScrollView>

      <AddAccountModal
        visible={addVisible}
        submitting={createAccountMutation.isPending}
        onClose={() => setAddVisible(false)}
        onSubmit={handleCreateAccount}
      />

      <TransferModal
        visible={transferVisible}
        accounts={overview?.accounts ?? []}
        submitting={createTransferMutation.isPending}
        onClose={() => setTransferVisible(false)}
        onSubmit={handleCreateTransfer}
      />
    </View>
  );
}

const createStyles = (colors: AppColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    headerBackground: {
      backgroundColor: colors.primary,
      paddingHorizontal: layout.pageHorizontal,
      paddingBottom: 70,
      borderBottomLeftRadius: radius.lg * 2,
      borderBottomRightRadius: radius.lg * 2,
    },
    headerContent: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: spacing.sm,
      paddingTop: layout.pageHeaderTop,
      paddingBottom: spacing.md,
    },
    headerIconButton: {
      padding: spacing.sm,
      marginLeft: -spacing.sm,
    },
    headerTitle: {
      ...typography.h1,
      color: colors.white,
      flex: 1,
      flexShrink: 1,
    },
    headerActions: {
      flexDirection: "row",
      gap: spacing.xs,
      alignItems: "center",
    },
    actionButtonGhost: {
      minHeight: 40,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.sm,
      backgroundColor: colors.primaryLight,
      borderRadius: radius.md,
      flexDirection: "row",
      gap: spacing.xs,
      alignItems: "center",
    },
    actionButtonSolid: {
      minHeight: 40,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.sm,
      backgroundColor: colors.success,
      borderRadius: radius.md,
      flexDirection: "row",
      gap: spacing.xs,
      alignItems: "center",
    },
    headerActionText: {
      ...typography.caption,
      color: colors.white,
      fontWeight: "700",
    },
    totalCard: {
      backgroundColor: colors.whiteAlpha08,
      padding: spacing.lg,
      borderRadius: radius.lg,
      marginTop: spacing.sm,
      minHeight: 158,
      justifyContent: "center",
    },
    totalRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    totalLabel: {
      ...typography.caption,
      color: colors.whiteAlpha65,
      fontWeight: "600",
    },
    totalValue: {
      ...typography.h1,
      color: colors.white,
      fontSize: 32,
      marginTop: spacing.xs,
    },
    statsGrid: {
      flexDirection: "row",
      marginTop: spacing.lg,
      paddingTop: spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.whiteAlpha08,
    },
    statItem: {
      flex: 1,
    },
    statDivider: {
      width: 1,
      backgroundColor: colors.whiteAlpha08,
      marginHorizontal: spacing.md,
    },
    statLabel: {
      ...typography.caption,
      color: colors.whiteAlpha50,
    },
    statValue: {
      ...typography.body,
      color: colors.white,
      fontWeight: "700",
      marginTop: spacing.xs,
    },
    scrollContent: {
      flex: 1,
      marginTop: -50,
    },
    scrollPadding: {
      paddingHorizontal: layout.pageHorizontal,
      paddingBottom: spacing.xxl,
    },
    summaryCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: spacing.lg,
      marginBottom: spacing.xl,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.05,
      shadowRadius: 10,
      elevation: 4,
    },
    summaryRow: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: spacing.md,
    },
    summaryBox: {
      flex: 1,
    },
    summaryLabelRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
      marginBottom: spacing.xs,
    },
    summarySmallLabel: {
      ...typography.caption,
      color: colors.textSecondary,
    },
    summaryAmount: {
      ...typography.h2,
    },
    incomeText: {
      color: colors.success,
    },
    expenseText: {
      color: colors.danger,
    },
    verticalDivider: {
      width: 1,
      height: "100%",
      backgroundColor: colors.border,
      marginHorizontal: spacing.md,
    },
    progressBg: {
      height: 6,
      backgroundColor: colors.mutedSurface,
      borderRadius: radius.pill,
      overflow: "hidden",
    },
    progressFill: {
      height: "100%",
      backgroundColor: colors.success,
    },
    sectionTitle: {
      ...typography.h2,
      color: colors.textPrimary,
      marginBottom: spacing.md,
    },
    accountCard: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      backgroundColor: colors.surface,
      padding: spacing.md,
      borderRadius: radius.lg,
      marginBottom: spacing.sm,
      borderWidth: 1,
      borderColor: colors.border,
    },
    accountMainInfo: {
      flex: 1,
      gap: 2,
    },
    accountTypeRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
    },
    typeIconContainer: {
      padding: spacing.xs,
      borderRadius: radius.pill,
    },
    accountTypeLabel: {
      ...typography.caption,
      color: colors.textSecondary,
      fontWeight: "500",
    },
    accountName: {
      ...typography.h2,
      color: colors.textPrimary,
      marginVertical: 2,
    },
    institutionRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
      marginTop: 2,
    },
    institutionText: {
      ...typography.caption,
      color: colors.textSecondary,
    },
    accountBalanceWrapper: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },
    balanceTextContainer: {
      justifyContent: "center",
    },
    balanceLabel: {
      ...typography.caption,
      color: colors.textSecondary,
      textAlign: "right",
    },
    balanceValue: {
      ...typography.h2,
      color: colors.textPrimary,
      textAlign: "right",
    },
    emptyCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.lg,
      marginBottom: spacing.md,
    },
    emptyTitle: {
      ...typography.h2,
      color: colors.textPrimary,
    },
    emptyText: {
      ...typography.body,
      color: colors.textSecondary,
      marginTop: spacing.sm,
    },
    loadingWrap: {
      paddingVertical: spacing.xl,
      alignItems: "center",
    },
  });
