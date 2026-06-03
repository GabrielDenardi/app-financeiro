import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Eye, EyeOff, Landmark, Target, Users } from "lucide-react-native";
import { useNavigation } from "@react-navigation/native";

import { BalanceCard } from "../components/BalanceCard";
import { BOTTOM_TAB_BAR_HEIGHT } from "../components/BottomTabBarMock";
import { Card } from "../components/Card";
import { FloatingActionButton } from "../components/FloatingActionButton";
import { MonthlyBarChart } from "../components/MonthlyBarChart";
import { SectionHeader } from "../components/SectionHeader";
import { SummaryStatCard } from "../components/SummaryStatCard";
import { TransactionListItem } from "../components/TransactionListItem";
import { useAccounts } from "../features/accounts/hooks/useAccounts";
import { useHomeDashboard } from "../features/dashboard/hooks/useDashboard";
import { useCurrentPlan } from "../features/plans/hooks";
import { usePreferences } from "../features/preferences/hooks/usePreferences";
import { useProfile } from "../features/profile/hooks/useProfile";
import { QuickAddTransactionSheet } from "../features/transactions/components/QuickAddTransactionSheet";
import { useFinanceCategories } from "../features/transactions/hooks/useTransactions";
import {
  layout,
  spacing,
  typography,
  type AppColors,
  useThemeColors,
} from "../theme";
import type { AuthenticatedUserSummary } from "../types/auth";
import { HIDDEN_CURRENCY_TEXT, formatCurrencyBRL } from "../utils/format";

type HomeScreenProps = {
  currentUser: AuthenticatedUserSummary | null;
};

function getDisplayName(fullName?: string | null, email?: string | null) {
  if (fullName?.trim()) {
    return fullName.trim();
  }

  if (email?.includes("@")) {
    return email.split("@")[0];
  }

  return "Usuário";
}

function formatVisibleCurrency(value: number, visible: boolean) {
  return visible ? formatCurrencyBRL(value) : HIDDEN_CURRENCY_TEXT;
}

export function HomeScreen({ currentUser }: HomeScreenProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const navigation = useNavigation<any>();
  const profileQuery = useProfile(currentUser?.id);
  const dashboardQuery = useHomeDashboard(currentUser?.id);
  const accountsQuery = useAccounts(currentUser?.id);
  const categoriesQuery = useFinanceCategories(currentUser?.id);
  const preferencesQuery = usePreferences(currentUser?.id);
  const currentPlan = useCurrentPlan(currentUser?.id);

  const [showValues, setShowValues] = useState(true);
  const [quickAddVisible, setQuickAddVisible] = useState(false);

  const dashboard = dashboardQuery.data;
  const accounts = accountsQuery.data ?? [];
  const categorySpending = dashboard?.categorySpending ?? [];
  const recentTransactions = dashboard?.recentTransactions ?? [];
  const weeklyFlow = dashboard?.weeklyFlow ?? [];
  const summary = dashboard?.summary;
  const displayName = getDisplayName(
    profileQuery.data?.fullName ?? currentUser?.fullName,
    profileQuery.data?.email ?? currentUser?.email,
  );
  const primaryAccount =
    accounts.find((account) => account.isActive) ?? accounts[0] ?? null;

  useEffect(() => {
    if (preferencesQuery.data?.hideValuesHome) {
      setShowValues(false);
    }
  }, [preferencesQuery.data?.hideValuesHome]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Olá, {displayName}</Text>
          <Text style={styles.subtitle}>Seu resumo financeiro.</Text>
        </View>
        <Pressable
          style={styles.visibilityButton}
          onPress={() => setShowValues((current) => !current)}
        >
          {showValues ? (
            <Eye color={colors.textPrimary} size={18} />
          ) : (
            <EyeOff color={colors.textPrimary} size={18} />
          )}
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <BalanceCard
          summary={{
            monthLabel: summary?.monthLabel ?? "Mês atual",
            balance: summary?.balance ?? 0,
            income: summary?.income ?? 0,
            expense: summary?.expense ?? 0,
            updatedAtLabel:
              summary?.updatedAtLabel ?? "Atualizado em tempo real",
          }}
          variationLabel={summary?.monthLabel}
          hideAmounts={!showValues}
        />

        <View style={styles.summaryRow}>
          <SummaryStatCard
            label="Entradas"
            amount={summary?.income ?? 0}
            type="income"
            style={styles.summaryStatCard}
            hideAmounts={!showValues}
          />
          <SummaryStatCard
            label="Saídas"
            amount={summary?.expense ?? 0}
            type="expense"
            style={styles.summaryStatCard}
            hideAmounts={!showValues}
          />
        </View>

        <View style={styles.kpiRow}>
          <Pressable
            style={styles.kpiCard}
            onPress={() => navigation.navigate("Goals")}
          >
            <Target color={colors.primary} size={18} />
            <Text style={styles.kpiValue}>{summary?.goalsCount ?? 0}</Text>
            <Text style={styles.kpiLabel}>Metas</Text>
          </Pressable>
          <Pressable
            style={styles.kpiCard}
            onPress={() => navigation.getParent()?.navigate("Groups")}
          >
            <Users color={colors.primary} size={18} />
            <Text style={styles.kpiValue}>{summary?.groupsCount ?? 0}</Text>
            <Text style={styles.kpiLabel}>Grupos</Text>
          </Pressable>
          <Pressable
            style={styles.kpiCard}
            onPress={() => navigation.navigate("Accounts")}
          >
            <Landmark color={colors.primary} size={18} />
            <Text style={styles.kpiValue}>
              {summary?.accountsCount ?? accounts.length}
            </Text>
            <Text style={styles.kpiLabel}>Contas</Text>
          </Pressable>
        </View>

        {primaryAccount ? (
          <Card style={styles.accountHeroCard}>
            <SectionHeader
              title="Conta principal"
              actionLabel="Ver contas"
              onActionPress={() => navigation.navigate("Accounts")}
            />
            <View style={styles.accountRow}>
              <View>
                <Text style={styles.accountName}>{primaryAccount.name}</Text>
                <Text style={styles.accountMeta}>
                  {primaryAccount.institution || "Instituição não informada"}
                </Text>
              </View>
              <Text style={styles.accountAmount}>
                {formatVisibleCurrency(
                  primaryAccount.currentBalance,
                  showValues,
                )}
              </Text>
            </View>
          </Card>
        ) : null}

        <MonthlyBarChart data={weeklyFlow} hideValues={!showValues} />

        <Card style={styles.sectionCard}>
          <SectionHeader
            title="Categorias do mês"
            actionLabel="Relatórios"
            onActionPress={() => navigation.navigate("Reports")}
          />
          {dashboardQuery.isLoading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator />
            </View>
          ) : categorySpending.length ? (
            categorySpending.map((item) => (
              <View key={item.category} style={styles.categoryRow}>
                <View style={styles.categoryLabelRow}>
                  <View
                    style={[
                      styles.categoryDot,
                      { backgroundColor: item.color },
                    ]}
                  />
                  <Text style={styles.categoryLabel}>{item.category}</Text>
                </View>
                <View style={styles.categoryValueBlock}>
                  <Text style={styles.categoryShare}>
                    {item.share.toFixed(1)}%
                  </Text>
                  <Text style={styles.categoryAmount}>
                    {formatVisibleCurrency(item.amount, showValues)}
                  </Text>
                </View>
              </View>
            ))
          ) : (
            <Text style={styles.emptyText}>
              Nenhum gasto reportável neste período.
            </Text>
          )}
        </Card>

        <Card noPadding style={styles.sectionCard}>
          <View style={styles.sectionInner}>
            <SectionHeader
              title="Últimas movimentações"
              actionLabel="Ver todas"
              onActionPress={() => navigation.navigate("Transactions")}
            />
          </View>
          {dashboardQuery.isLoading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator />
            </View>
          ) : recentTransactions.length ? (
            recentTransactions.map((transaction, index) => (
              <TransactionListItem
                key={transaction.id}
                item={transaction}
                hideAmounts={!showValues}
                showDivider={index < recentTransactions.length - 1}
              />
            ))
          ) : (
            <View style={[styles.sectionInner, { padding: spacing.lg }]}>
              <Text style={styles.emptyText}>
                As novas transações vão aparecer aqui.
              </Text>
            </View>
          )}
        </Card>
      </ScrollView>

      <FloatingActionButton
        style={styles.fab}
        onPress={() => setQuickAddVisible(true)}
      />

      <QuickAddTransactionSheet
        visible={quickAddVisible}
        currentUserId={currentUser?.id}
        accounts={accounts}
        categories={categoriesQuery.data ?? []}
        primaryAccountId={primaryAccount?.id ?? null}
        allowVoiceCapture={currentPlan.entitlements.voiceCapture}
        onClose={() => setQuickAddVisible(false)}
      />
    </SafeAreaView>
  );
}

const createStyles = (colors: AppColors) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: layout.pageHorizontal,
      paddingTop: layout.pageHeaderTop,
    },
    content: {
      padding: layout.pageHorizontal,
      gap: layout.pageSectionGap,
      paddingBottom: BOTTOM_TAB_BAR_HEIGHT + 72,
    },
    greeting: {
      ...typography.h1,
      color: colors.textPrimary,
    },
    subtitle: {
      ...typography.caption,
      color: colors.textSecondary,
      marginTop: spacing.xs,
    },
    visibilityButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
    },
    summaryRow: {
      flexDirection: "row",
      gap: spacing.md,
    },
    summaryStatCard: {
      flex: 1,
    },
    kpiRow: {
      flexDirection: "row",
      gap: spacing.md,
    },
    kpiCard: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: spacing.md,
      alignItems: "center",
      gap: spacing.xs,
    },
    kpiValue: {
      ...typography.h2,
      color: colors.textPrimary,
    },
    kpiLabel: {
      ...typography.caption,
      color: colors.textSecondary,
      fontWeight: "600",
    },
    accountHeroCard: {
      gap: spacing.md,
    },
    accountRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: spacing.md,
    },
    accountName: {
      ...typography.body,
      color: colors.textPrimary,
      fontWeight: "700",
    },
    accountMeta: {
      ...typography.caption,
      color: colors.textSecondary,
      marginTop: spacing.xs,
    },
    accountAmount: {
      ...typography.h2,
      color: colors.textPrimary,
    },
    sectionCard: {
      gap: spacing.md,
    },
    sectionInner: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.lg,
    },
    categoryRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: spacing.md,
    },
    categoryLabelRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      flex: 1,
    },
    categoryDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },
    categoryLabel: {
      ...typography.body,
      color: colors.textPrimary,
      fontWeight: "600",
    },
    categoryValueBlock: {
      alignItems: "flex-end",
    },
    categoryShare: {
      ...typography.caption,
      color: colors.textSecondary,
    },
    categoryAmount: {
      ...typography.body,
      color: colors.textPrimary,
      fontWeight: "700",
      marginTop: 2,
    },
    emptyText: {
      ...typography.body,
      color: colors.textSecondary,
    },
    loadingWrap: {
      paddingVertical: spacing.xl,
      alignItems: "center",
    },
    fab: {
      position: "absolute",
      right: spacing.lg,
      bottom: BOTTOM_TAB_BAR_HEIGHT - spacing.lg,
    },
  });
