import { useMemo, useState } from 'react';
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
} from 'react-native';
import {
  ArrowDownRight,
  ArrowLeft,
  ArrowUpRight,
  ChevronRight,
  CreditCard,
  Eye,
  EyeOff,
  Landmark,
  Plus,
  Repeat,
} from 'lucide-react-native';

import { AddAccountModal } from '../components/AddAccountModal';
import { TransferModal } from '../components/TransferModal';
import { typeConfig } from '../data/accountsMock';
import { useAccountsOverview, useCreateAccountMutation, useCreateTransferMutation } from '../features/accounts/hooks/useAccounts';
import { useAuthenticatedUser } from '../features/auth/hooks/useAuthenticatedUser';
import { colors, radius, spacing, typography } from '../theme';
import { formatCurrencyBRL } from '../utils/format';

export function AccountsScreen({ navigation }: any) {
  const currentUser = useAuthenticatedUser();
  const overviewQuery = useAccountsOverview(currentUser?.id);
  const createAccountMutation = useCreateAccountMutation(currentUser?.id);
  const createTransferMutation = useCreateTransferMutation(currentUser?.id);

  const [showBalances, setShowBalances] = useState(true);
  const [addVisible, setAddVisible] = useState(false);
  const [transferVisible, setTransferVisible] = useState(false);

  const overview = overviewQuery.data;
  const activeAccounts = useMemo(
    () => overview?.accounts.filter((account) => account.isActive) ?? [],
    [overview?.accounts],
  );

  const formatMaybeHidden = (value: number) => {
    return showBalances ? formatCurrencyBRL(value) : 'R$ ••••••';
  };

  const handleCreateAccount = async (input: any) => {
    try {
      await createAccountMutation.mutateAsync(input);
      setAddVisible(false);
    } catch (error) {
      Alert.alert('Erro', error instanceof Error ? error.message : 'Nao foi possivel criar a conta.');
    }
  };

  const handleCreateTransfer = async (input: any) => {
    try {
      await createTransferMutation.mutateAsync(input);
      setTransferVisible(false);
    } catch (error) {
      Alert.alert('Erro', error instanceof Error ? error.message : 'Nao foi possivel transferir.');
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primary} />

      <View style={styles.headerBackground}>
        <SafeAreaView>
          <View style={styles.headerContent}>
            <Pressable onPress={() => navigation.goBack()} style={styles.headerIconButton}>
              <ArrowLeft color={colors.white} size={22} />
            </Pressable>

            <Text style={styles.headerTitle}>Minhas Contas</Text>

            <View style={styles.headerActions}>
              <Pressable style={styles.actionButtonGhost} onPress={() => setTransferVisible(true)}>
                <Repeat color={colors.white} size={14} />
                <Text style={styles.headerActionText}>Transferir</Text>
              </Pressable>
              <Pressable style={styles.actionButtonSolid} onPress={() => setAddVisible(true)}>
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
                  <Text style={styles.totalLabel}>Patrimonio Liquido</Text>
                  <Pressable onPress={() => setShowBalances((current) => !current)}>
                    {showBalances ? (
                      <Eye color={colors.white} size={18} opacity={0.7} />
                    ) : (
                      <EyeOff color={colors.white} size={18} opacity={0.7} />
                    )}
                  </Pressable>
                </View>
                <Text style={styles.totalValue}>{formatMaybeHidden(overview?.totalBalance ?? 0)}</Text>

                <View style={styles.statsGrid}>
                  <View style={styles.statItem}>
                    <Text style={styles.statLabel}>Ativos</Text>
                    <Text style={styles.statValue}>{formatMaybeHidden(overview?.totalAssets ?? 0)}</Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statItem}>
                    <Text style={styles.statLabel}>Dividas</Text>
                    <Text style={[styles.statValue, styles.debtValue]}>
                      {showBalances ? formatCurrencyBRL(overview?.totalLiabilities ?? 0) : 'R$ ••••'}
                    </Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statItem}>
                    <Text style={styles.statLabel}>Contas</Text>
                    <Text style={styles.statValue}>{activeAccounts.length}</Text>
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
                <Text style={styles.summarySmallLabel}>Saidas</Text>
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
                      ? Math.min(((overview.monthlyExpense ?? 0) / overview.monthlyIncome) * 100, 100)
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
                    <View style={[styles.typeIconContainer, { backgroundColor: config.light }]}>
                      <config.icon size={12} color={colors.primary} />
                    </View>
                    <Text style={styles.accountTypeLabel}>{config.label}</Text>
                  </View>

                  <Text style={styles.accountName}>{account.name}</Text>

                  <View style={styles.institutionRow}>
                    <Landmark size={12} color={colors.textSecondary} />
                    <Text style={styles.institutionText}>
                      {account.institution || 'Instituicao nao informada'}
                    </Text>
                  </View>
                </View>

                <View style={styles.accountBalanceWrapper}>
                  <View style={styles.balanceTextContainer}>
                    <Text style={styles.balanceLabel}>Saldo</Text>
                    <Text style={styles.balanceValue}>
                      {showBalances ? formatCurrencyBRL(account.currentBalance) : '••••'}
                    </Text>
                  </View>
                  <ChevronRight size={16} color={colors.border} />
                </View>
              </View>
            );
          })
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Nenhuma conta cadastrada</Text>
            <Text style={styles.emptyText}>Crie a primeira conta para ver o patrimonio real do app.</Text>
          </View>
        )}

        <View style={styles.quickActions}>
          <Pressable style={styles.quickActionCard} onPress={() => navigation.navigate('Cards')}>
            <View style={styles.quickActionContent}>
              <View style={styles.quickActionIcon}>
                <CreditCard size={20} color={colors.primary} />
              </View>
              <View>
                <Text style={styles.quickActionTitle}>Cartoes</Text>
                <Text style={styles.quickActionSubtitle}>Gerenciar faturas</Text>
              </View>
            </View>
            <ChevronRight size={18} color={colors.border} />
          </Pressable>

          <Pressable style={styles.quickActionCard} onPress={() => setTransferVisible(true)}>
            <View style={styles.quickActionContent}>
              <View style={styles.quickActionIcon}>
                <Repeat size={20} color={colors.primary} />
              </View>
              <View>
                <Text style={styles.quickActionTitle}>Transferir</Text>
                <Text style={styles.quickActionSubtitle}>Entre suas contas</Text>
              </View>
            </View>
            <ChevronRight size={18} color={colors.border} />
          </Pressable>
        </View>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerBackground: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingBottom: 70,
    borderBottomLeftRadius: radius.lg * 2,
    borderBottomRightRadius: radius.lg * 2,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
  },
  headerIconButton: {
    padding: spacing.sm,
    marginLeft: -spacing.sm,
  },
  headerTitle: {
    ...typography.h2,
    color: colors.white,
  },
  headerActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionButtonGhost: {
    padding: spacing.md,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: radius.md,
    flexDirection: 'row',
    gap: 5,
    alignItems: 'center',
  },
  actionButtonSolid: {
    padding: spacing.md,
    backgroundColor: colors.success,
    borderRadius: radius.md,
    flexDirection: 'row',
    gap: 5,
    alignItems: 'center',
  },
  headerActionText: {
    ...typography.caption,
    color: colors.white,
    fontWeight: '700',
  },
  totalCard: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    padding: spacing.lg,
    borderRadius: radius.lg,
    marginTop: spacing.sm,
    minHeight: 158,
    justifyContent: 'center',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    ...typography.caption,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '600',
  },
  totalValue: {
    ...typography.h1,
    color: colors.white,
    fontSize: 32,
    marginTop: spacing.xs,
  },
  statsGrid: {
    flexDirection: 'row',
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  statItem: {
    flex: 1,
  },
  statDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginHorizontal: spacing.md,
  },
  statLabel: {
    ...typography.caption,
    color: 'rgba(255,255,255,0.5)',
  },
  statValue: {
    ...typography.body,
    color: colors.white,
    fontWeight: '700',
    marginTop: spacing.xs,
  },
  debtValue: {
    color: colors.danger,
  },
  scrollContent: {
    flex: 1,
    marginTop: -50,
  },
  scrollPadding: {
    paddingHorizontal: spacing.xl,
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
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  summaryBox: {
    flex: 1,
  },
  summaryLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: 4,
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
    height: '100%',
    backgroundColor: colors.border,
    marginHorizontal: spacing.md,
  },
  progressBg: {
    height: 6,
    backgroundColor: colors.mutedSurface,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.success,
  },
  sectionTitle: {
    ...typography.h2,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  accountCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  typeIconContainer: {
    padding: 4,
    borderRadius: radius.pill,
  },
  accountTypeLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  accountName: {
    ...typography.h2,
    color: colors.textPrimary,
    marginVertical: 2,
  },
  institutionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: 2,
  },
  institutionText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  accountBalanceWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  balanceTextContainer: {
    justifyContent: 'center',
  },
  balanceLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'right',
  },
  balanceValue: {
    ...typography.h2,
    color: colors.textPrimary,
    textAlign: 'right',
  },
  quickActions: {
    gap: spacing.sm,
    marginTop: spacing.md,
    flexDirection: 'row',
  },
  quickActionCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    padding: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  quickActionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  quickActionIcon: {
    width: 44,
    height: 44,
    backgroundColor: colors.mutedSurface,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionTitle: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  quickActionSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
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
    alignItems: 'center',
  },
});
