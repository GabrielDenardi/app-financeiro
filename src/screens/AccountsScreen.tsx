import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ArrowLeft, CreditCard, Plus, Repeat } from 'lucide-react-native';

import { AddAccountModal } from '../components/AddAccountModal';
import { TransferModal } from '../components/TransferModal';
import { useAuthenticatedUser } from '../features/auth/hooks/useAuthenticatedUser';
import { useAccountsOverview, useCreateAccountMutation, useCreateTransferMutation } from '../features/accounts/hooks/useAccounts';
import { formatCurrencyBRL } from '../utils/format';
import { colors, radius, spacing, typography } from '../theme';

export function AccountsScreen({ navigation }: any) {
  const currentUser = useAuthenticatedUser();
  const overviewQuery = useAccountsOverview(currentUser?.id);
  const createAccountMutation = useCreateAccountMutation(currentUser?.id);
  const createTransferMutation = useCreateTransferMutation(currentUser?.id);
  const [addVisible, setAddVisible] = useState(false);
  const [transferVisible, setTransferVisible] = useState(false);

  const overview = overviewQuery.data;

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
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
            <ArrowLeft size={22} color={colors.textPrimary} />
          </Pressable>
          <View style={styles.headerText}>
            <Text style={styles.title}>Minhas contas</Text>
            <Text style={styles.subtitle}>Saldos, transferencias e patrimonio em tempo real.</Text>
          </View>
        </View>

        <View style={styles.summaryCard}>
          {overviewQuery.isLoading ? (
            <ActivityIndicator />
          ) : (
            <>
              <Text style={styles.summaryLabel}>Patrimonio liquido</Text>
              <Text style={styles.summaryValue}>{formatCurrencyBRL(overview?.totalBalance ?? 0)}</Text>
              <View style={styles.summaryStats}>
                <View style={styles.summaryStat}>
                  <Text style={styles.summaryStatLabel}>Entradas do mes</Text>
                  <Text style={styles.summaryStatValue}>{formatCurrencyBRL(overview?.monthlyIncome ?? 0)}</Text>
                </View>
                <View style={styles.summaryStat}>
                  <Text style={styles.summaryStatLabel}>Saidas do mes</Text>
                  <Text style={styles.summaryStatValue}>{formatCurrencyBRL(overview?.monthlyExpense ?? 0)}</Text>
                </View>
              </View>
            </>
          )}
        </View>

        <View style={styles.actionsRow}>
          <Pressable style={styles.primaryAction} onPress={() => setAddVisible(true)}>
            <Plus color={colors.white} size={18} />
            <Text style={styles.primaryActionText}>Nova conta</Text>
          </Pressable>
          <Pressable style={styles.secondaryAction} onPress={() => setTransferVisible(true)}>
            <Repeat color={colors.primary} size={18} />
            <Text style={styles.secondaryActionText}>Transferir</Text>
          </Pressable>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contas ativas</Text>
          <View style={styles.listCard}>
            {overview?.accounts.filter((account) => account.isActive).length ? (
              overview.accounts
                .filter((account) => account.isActive)
                .map((account) => (
                  <View key={account.id} style={styles.accountRow}>
                    <View style={styles.accountLeft}>
                      <View style={[styles.colorBadge, { backgroundColor: account.color }]} />
                      <View>
                        <Text style={styles.accountName}>{account.name}</Text>
                        <Text style={styles.accountMeta}>
                          {account.institution || 'Sem instituicao'} • {account.type}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.accountBalance}>{formatCurrencyBRL(account.currentBalance)}</Text>
                  </View>
                ))
            ) : (
              <Text style={styles.emptyText}>A primeira conta cadastrada vai aparecer aqui.</Text>
            )}
          </View>
        </View>

        <Pressable style={styles.cardsShortcut} onPress={() => navigation.navigate('Cards')}>
          <View>
            <Text style={styles.cardsShortcutTitle}>Cartoes</Text>
            <Text style={styles.cardsShortcutText}>Pague faturas usando qualquer conta cadastrada.</Text>
          </View>
          <CreditCard color={colors.primary} size={20} />
        </Pressable>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.xl,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
  },
  title: {
    ...typography.h1,
    color: colors.textPrimary,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  summaryCard: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  summaryLabel: {
    ...typography.caption,
    color: 'rgba(255,255,255,0.85)',
    fontWeight: '700',
  },
  summaryValue: {
    ...typography.h1,
    color: colors.white,
  },
  summaryStats: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  summaryStat: {
    flex: 1,
  },
  summaryStatLabel: {
    ...typography.caption,
    color: 'rgba(255,255,255,0.85)',
  },
  summaryStatValue: {
    ...typography.body,
    color: colors.white,
    fontWeight: '700',
    marginTop: spacing.xs,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  primaryAction: {
    flex: 1,
    minHeight: 48,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  primaryActionText: {
    ...typography.body,
    color: colors.white,
    fontWeight: '700',
  },
  secondaryAction: {
    flex: 1,
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  secondaryActionText: {
    ...typography.body,
    color: colors.primary,
    fontWeight: '700',
  },
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  listCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.md,
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  accountLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
  },
  colorBadge: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  accountName: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  accountMeta: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  accountBalance: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  cardsShortcut: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardsShortcutTitle: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  cardsShortcutText: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  emptyText: {
    ...typography.body,
    color: colors.textSecondary,
  },
});
