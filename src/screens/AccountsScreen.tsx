import { useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
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
  Pencil,
  Plus,
  Repeat,
} from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AddAccountModal } from "../components/AddAccountModal";
import { Button } from "../components/Button";
import { useToast } from "../components/Toast";
import { TransferModal } from "../components/TransferModal";
import { typeConfig } from "../data/accountsMock";
import {
  useAccountsOverview,
  useCreateAccountMutation,
  useCreateTransferMutation,
  useUpdateAccountMutation,
} from "../features/accounts/hooks/useAccounts";
import type { AccountBalanceSnapshot } from "../features/accounts/types";
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
import {
  formatCompactCurrencyBRL,
  formatCurrencyBRL,
  isCompactCurrencyBRL,
} from "../utils/format";

const COMPACT_HINT_STORAGE_KEY = "app-financeiro:accounts-compact-hint-seen";

export function AccountsScreen({ navigation }: any) {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(
    () => createStyles(colors, insets.top, insets.bottom),
    [colors, insets.top, insets.bottom],
  );
  const { showSuccess, showError } = useToast();
  const currentUser = useAuthenticatedUser();
  const overviewQuery = useAccountsOverview(currentUser?.id);
  const createAccountMutation = useCreateAccountMutation(currentUser?.id);
  const updateAccountMutation = useUpdateAccountMutation(currentUser?.id);
  const createTransferMutation = useCreateTransferMutation(currentUser?.id);
  const currentPlan = useCurrentPlan(currentUser?.id);

  const [showBalances, setShowBalances] = useState(true);
  const [addVisible, setAddVisible] = useState(false);
  const [editingAccount, setEditingAccount] =
    useState<AccountBalanceSnapshot | null>(null);
  const [transferVisible, setTransferVisible] = useState(false);
  const [pressedStat, setPressedStat] = useState<
    "assets" | "liabilities" | null
  >(null);
  const [compactHintDismissed, setCompactHintDismissed] = useState(true);

  const overview = overviewQuery.data;

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(COMPACT_HINT_STORAGE_KEY).then((value) => {
      if (active && value !== "1") {
        setCompactHintDismissed(false);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const dismissCompactHint = () => {
    setCompactHintDismissed(true);
    AsyncStorage.setItem(COMPACT_HINT_STORAGE_KEY, "1").catch(() => {});
  };

  const hasCompactStatValue =
    isCompactCurrencyBRL(overview?.totalAssets ?? 0) ||
    isCompactCurrencyBRL(overview?.totalLiabilities ?? 0);
  const showCompactHint =
    showBalances && hasCompactStatValue && !compactHintDismissed;

  useEffect(() => {
    if (!showCompactHint) return;
    const timer = setTimeout(dismissCompactHint, 5000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showCompactHint]);
  const activeAccounts = useMemo(
    () => overview?.accounts.filter((account) => account.isActive) ?? [],
    [overview?.accounts],
  );

  const formatMaybeHidden = (value: number) => {
    return showBalances ? formatCurrencyBRL(value) : "R$ ••••••";
  };

  const formatMaybeHiddenCompact = (value: number) => {
    return showBalances ? formatCompactCurrencyBRL(value) : "R$ ••••••";
  };

  const handleSubmitAccount = async (input: any) => {
    try {
      if (editingAccount) {
        await updateAccountMutation.mutateAsync({
          id: editingAccount.id,
          ...input,
        });
        setEditingAccount(null);
        showSuccess("Conta atualizada.");
      } else {
        await createAccountMutation.mutateAsync(input);
        showSuccess("Conta criada.");
      }
      setAddVisible(false);
    } catch (error) {
      showError(
        error instanceof Error
          ? error.message
          : "Não foi possível salvar a conta.",
      );
    }
  };

  const handleOpenAddAccount = () => {
    if (!canCreateAccount(currentPlan.plan.id, activeAccounts.length)) {
      showError(getAccountLimitMessage(currentPlan.plan.id));
      return;
    }

    setAddVisible(true);
  };

  const handleCreateTransfer = async (input: any) => {
    try {
      await createTransferMutation.mutateAsync(input);
      setTransferVisible(false);
      showSuccess("Transferência realizada.");
    } catch (error) {
      showError(
        error instanceof Error ? error.message : "Não foi possível transferir.",
      );
    }
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.topBar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Voltar"
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <ArrowLeft color={colors.textPrimary} size={20} />
          </Pressable>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Contas</Text>
          </View>

          <View style={styles.totalCard}>
            {overviewQuery.isLoading ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <>
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Patrimônio Líquido</Text>
                  <Pressable
                    onPress={() => setShowBalances((current) => !current)}
                  >
                    {showBalances ? (
                      <Eye color={colors.textSecondary} size={18} />
                    ) : (
                      <EyeOff color={colors.textSecondary} size={18} />
                    )}
                  </Pressable>
                </View>
                <Text style={styles.totalValue}>
                  {formatMaybeHidden(overview?.totalBalance ?? 0)}
                </Text>

                <View style={styles.statsGrid}>
                  <Pressable
                    style={styles.statItem}
                    onPress={() => {
                      dismissCompactHint();
                      setPressedStat((current) =>
                        current === "assets" ? null : "assets",
                      );
                    }}
                  >
                    <Text style={styles.statLabel}>Ativos</Text>
                    <Text
                      style={[
                        styles.statValue,
                        isCompactCurrencyBRL(overview?.totalAssets ?? 0) &&
                          showBalances &&
                          styles.statValueHintable,
                      ]}
                      numberOfLines={1}
                    >
                      {formatMaybeHiddenCompact(overview?.totalAssets ?? 0)}
                    </Text>
                    {pressedStat === "assets" &&
                      showBalances &&
                      isCompactCurrencyBRL(overview?.totalAssets ?? 0) && (
                        <View
                          style={[
                            styles.fullValueTooltip,
                            styles.fullValueTooltipLeft,
                          ]}
                          pointerEvents="none"
                        >
                          <Text
                            style={styles.fullValueTooltipText}
                            numberOfLines={1}
                          >
                            {formatCurrencyBRL(overview?.totalAssets ?? 0)}
                          </Text>
                        </View>
                      )}
                  </Pressable>
                  <View style={styles.statDivider} />
                  <Pressable
                    style={styles.statItem}
                    onPress={() => {
                      dismissCompactHint();
                      setPressedStat((current) =>
                        current === "liabilities" ? null : "liabilities",
                      );
                    }}
                  >
                    <Text style={styles.statLabel}>Dívidas</Text>
                    <Text
                      style={[
                        styles.statValue,
                        isCompactCurrencyBRL(overview?.totalLiabilities ?? 0) &&
                          showBalances &&
                          styles.statValueHintable,
                      ]}
                      numberOfLines={1}
                    >
                      {formatMaybeHiddenCompact(
                        overview?.totalLiabilities ?? 0,
                      )}
                    </Text>
                    {pressedStat === "liabilities" &&
                      showBalances &&
                      isCompactCurrencyBRL(overview?.totalLiabilities ?? 0) && (
                        <View
                          style={[
                            styles.fullValueTooltip,
                            styles.fullValueTooltipRight,
                          ]}
                          pointerEvents="none"
                        >
                          <Text
                            style={styles.fullValueTooltipText}
                            numberOfLines={1}
                          >
                            {formatCurrencyBRL(overview?.totalLiabilities ?? 0)}
                          </Text>
                        </View>
                      )}
                  </Pressable>
                  <View style={styles.statDivider} />
                  <View style={styles.statItem}>
                    <Text style={styles.statLabel}>Contas</Text>
                    <Text style={styles.statValue}>
                      {activeAccounts.length}/
                      {currentPlan.entitlements.accountLimit}
                    </Text>
                  </View>
                </View>

                {showCompactHint && (
                  <Pressable
                    style={styles.compactHint}
                    onPress={dismissCompactHint}
                  >
                    <Text style={styles.compactHintText}>
                      Segure no valor para ver o número completo
                    </Text>
                  </Pressable>
                )}
              </>
            )}
          </View>

          <View style={styles.restContent}>
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
                        <Text style={styles.accountTypeLabel}>
                          {config.label}
                        </Text>
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
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Editar conta ${account.name}`}
                        hitSlop={spacing.sm}
                        style={styles.editAccountBtn}
                        onPress={() => {
                          setEditingAccount(account);
                          setAddVisible(true);
                        }}
                      >
                        <Pencil size={16} color={colors.textSecondary} />
                      </Pressable>
                    </View>
                  </View>
                );
              })
            ) : (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>Nenhuma conta cadastrada</Text>
                <Text style={styles.emptyText}>
                  Crie a primeira conta para ver o patrimônio real do
                  aplicativo.
                </Text>
              </View>
            )}
          </View>
        </ScrollView>

        <View style={styles.footerBar}>
          <Button
            label="Transferir"
            variant="secondary"
            fullWidth
            icon={<Repeat size={16} color={colors.textPrimary} />}
            onPress={() => setTransferVisible(true)}
          />
          <Button
            label="Criar"
            fullWidth
            icon={<Plus size={16} color={colors.white} />}
            onPress={handleOpenAddAccount}
          />
        </View>
      </SafeAreaView>

      <AddAccountModal
        visible={addVisible}
        account={editingAccount}
        submitting={
          createAccountMutation.isPending || updateAccountMutation.isPending
        }
        onClose={() => {
          setAddVisible(false);
          setEditingAccount(null);
        }}
        onSubmit={handleSubmitAccount}
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

const createStyles = (
  colors: AppColors,
  topInset: number,
  bottomInset: number,
) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    safeArea: {
      flex: 1,
      backgroundColor: colors.background,
    },
    topBar: {
      backgroundColor: colors.surface,
      paddingTop: topInset + spacing.xs,
      paddingBottom: spacing.xs,
      paddingHorizontal: layout.pageHorizontal,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    backButton: {
      width: 36,
      height: 36,
      alignItems: "center",
      justifyContent: "center",
    },
    scroll: {
      flex: 1,
    },
    footerBar: {
      flexDirection: "row",
      gap: spacing.md,
      backgroundColor: colors.surface,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingHorizontal: layout.pageHorizontal,
      paddingTop: spacing.md,
      paddingBottom: bottomInset + spacing.md,
    },
    headerContent: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: spacing.sm,
      paddingHorizontal: layout.pageHorizontal,
      paddingTop: spacing.lg,
      paddingBottom: spacing.md,
    },
    headerTitle: {
      ...typography.h1,
      color: colors.textPrimary,
      flex: 1,
      flexShrink: 1,
    },
    totalCard: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.lg,
      borderRadius: radius.lg,
      marginHorizontal: layout.pageHorizontal,
      marginBottom: spacing.xl,
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
      color: colors.textSecondary,
      fontWeight: "600",
    },
    totalValue: {
      ...typography.h1,
      color: colors.textPrimary,
      fontSize: 32,
      marginTop: spacing.xs,
    },
    statsGrid: {
      flexDirection: "row",
      marginTop: spacing.lg,
      paddingTop: spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    statItem: {
      flex: 1,
      position: "relative",
    },
    fullValueTooltip: {
      position: "absolute",
      bottom: "100%",
      marginBottom: spacing.xs,
      width: 130,
      alignItems: "center",
      backgroundColor: colors.textPrimary,
      borderRadius: radius.sm,
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.sm,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 6,
      elevation: 6,
      zIndex: 20,
    },
    fullValueTooltipLeft: {
      left: 0,
    },
    fullValueTooltipRight: {
      right: 0,
    },
    fullValueTooltipText: {
      ...typography.caption,
      color: colors.surface,
      fontWeight: "700",
    },
    statDivider: {
      width: 1,
      backgroundColor: colors.border,
      marginHorizontal: spacing.md,
    },
    statLabel: {
      ...typography.caption,
      color: colors.textSecondary,
    },
    statValue: {
      ...typography.body,
      color: colors.textPrimary,
      fontWeight: "700",
      marginTop: spacing.xs,
    },
    statValueHintable: {
      textDecorationLine: "underline",
      textDecorationStyle: "dotted",
      textDecorationColor: colors.textSecondary,
    },
    compactHint: {
      marginTop: spacing.md,
      alignSelf: "flex-start",
      backgroundColor: colors.mutedSurface,
      borderRadius: radius.sm,
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.sm,
    },
    compactHintText: {
      ...typography.caption,
      color: colors.textSecondary,
    },
    scrollContent: {
      flexGrow: 1,
      backgroundColor: colors.background,
    },
    restContent: {
      flexGrow: 1,
      backgroundColor: colors.background,
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
    editAccountBtn: {
      padding: spacing.xs,
      borderRadius: radius.sm,
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
