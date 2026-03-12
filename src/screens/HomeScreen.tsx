import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Eye, EyeOff, Landmark, Target, Users } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';

import { BalanceCard } from '../components/BalanceCard';
import { BOTTOM_TAB_BAR_HEIGHT } from '../components/BottomTabBarMock';
import { Card } from '../components/Card';
import { FloatingActionButton } from '../components/FloatingActionButton';
import { MonthlyBarChart } from '../components/MonthlyBarChart';
import { SectionHeader } from '../components/SectionHeader';
import { SummaryStatCard } from '../components/SummaryStatCard';
import { TransactionListItem } from '../components/TransactionListItem';
import { useAccounts } from '../features/accounts/hooks/useAccounts';
import { useHomeDashboard } from '../features/dashboard/hooks/useDashboard';
import { usePreferences } from '../features/preferences/hooks/usePreferences';
import { useProfile } from '../features/profile/hooks/useProfile';
import { useCreateTransactionMutation, useFinanceCategories } from '../features/transactions/hooks/useTransactions';
import { radius, spacing, typography, type AppColors, useThemeColors } from '../theme';
import type { AuthenticatedUserSummary } from '../types/auth';
import { HIDDEN_CURRENCY_TEXT, formatCurrencyBRL } from '../utils/format';

type HomeScreenProps = {
  currentUser: AuthenticatedUserSummary | null;
};

function getDisplayName(fullName?: string | null, email?: string | null) {
  if (fullName?.trim()) {
    return fullName.trim();
  }

  if (email?.includes('@')) {
    return email.split('@')[0];
  }

  return 'Usuario';
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
  const createTransactionMutation = useCreateTransactionMutation(currentUser?.id);

  const [showValues, setShowValues] = useState(true);
  const [quickAddVisible, setQuickAddVisible] = useState(false);
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [amount, setAmount] = useState('');
  const [title, setTitle] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [accountId, setAccountId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Pix');
  const [notes, setNotes] = useState('');
  const [recurring, setRecurring] = useState(false);

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
  const primaryAccount = accounts.find((account) => account.isActive) ?? accounts[0] ?? null;

  const quickAddCategories = useMemo(
    () =>
      (type === 'income'
        ? categoriesQuery.data?.filter((category) => category.kind !== 'expense')
        : categoriesQuery.data?.filter((category) => category.kind !== 'income')) ?? [],
    [categoriesQuery.data, type],
  );

  useEffect(() => {
    if (preferencesQuery.data?.hideValuesHome) {
      setShowValues(false);
    }
  }, [preferencesQuery.data?.hideValuesHome]);

  const handleOpenQuickAdd = () => {
    setQuickAddVisible(true);
    setCategoryId(quickAddCategories[0]?.id ?? null);
    setAccountId(primaryAccount?.id ?? '');
  };

  const handleSubmitQuickAdd = async () => {
    await createTransactionMutation.mutateAsync({
      accountId,
      categoryId,
      title: title.trim() || 'Lancamento rapido',
      amount: Number(amount.replace(/\./g, '').replace(',', '.') || 0),
      type,
      paymentMethod,
      occurredAt: new Date().toISOString(),
      notes,
      isRecurring: recurring,
    });

    setQuickAddVisible(false);
    setAmount('');
    setTitle('');
    setNotes('');
    setRecurring(false);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Ola, {displayName}</Text>
          <Text style={styles.subtitle}>Seu resumo financeiro com dados reais.</Text>
        </View>
        <Pressable style={styles.visibilityButton} onPress={() => setShowValues((current) => !current)}>
          {showValues ? <Eye color={colors.textPrimary} size={18} /> : <EyeOff color={colors.textPrimary} size={18} />}
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <BalanceCard
          summary={{
            monthLabel: summary?.monthLabel ?? 'Mes atual',
            balance: summary?.balance ?? 0,
            income: summary?.income ?? 0,
            expense: summary?.expense ?? 0,
            updatedAtLabel: summary?.updatedAtLabel ?? 'Atualizado em tempo real',
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
            label="Saidas"
            amount={summary?.expense ?? 0}
            type="expense"
            style={styles.summaryStatCard}
            hideAmounts={!showValues}
          />
        </View>

        <View style={styles.kpiRow}>
          <Pressable style={styles.kpiCard} onPress={() => navigation.navigate('Goals')}>
            <Target color={colors.primary} size={18} />
            <Text style={styles.kpiValue}>{summary?.goalsCount ?? 0}</Text>
            <Text style={styles.kpiLabel}>Metas</Text>
          </Pressable>
          <Pressable style={styles.kpiCard} onPress={() => navigation.getParent()?.navigate('Groups')}>
            <Users color={colors.primary} size={18} />
            <Text style={styles.kpiValue}>{summary?.groupsCount ?? 0}</Text>
            <Text style={styles.kpiLabel}>Grupos</Text>
          </Pressable>
          <Pressable style={styles.kpiCard} onPress={() => navigation.navigate('Accounts')}>
            <Landmark color={colors.primary} size={18} />
            <Text style={styles.kpiValue}>{summary?.accountsCount ?? accounts.length}</Text>
            <Text style={styles.kpiLabel}>Contas</Text>
          </Pressable>
        </View>

        {primaryAccount ? (
          <Card style={styles.accountHeroCard}>
            <SectionHeader
              title="Conta principal"
              actionLabel="Ver contas"
              onActionPress={() => navigation.navigate('Accounts')}
            />
            <View style={styles.accountRow}>
              <View>
                <Text style={styles.accountName}>{primaryAccount.name}</Text>
                <Text style={styles.accountMeta}>
                  {primaryAccount.institution || 'Instituicao nao informada'}
                </Text>
              </View>
              <Text style={styles.accountAmount}>
                {formatVisibleCurrency(primaryAccount.currentBalance, showValues)}
              </Text>
            </View>
          </Card>
        ) : null}

        <MonthlyBarChart data={weeklyFlow} hideValues={!showValues} />

        <Card style={styles.sectionCard}>
          <SectionHeader
            title="Categorias do mes"
            actionLabel="Relatorios"
            onActionPress={() => navigation.navigate('Reports')}
          />
          {dashboardQuery.isLoading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator />
            </View>
          ) : categorySpending.length ? (
            categorySpending.map((item) => (
              <View key={item.category} style={styles.categoryRow}>
                <View style={styles.categoryLabelRow}>
                  <View style={[styles.categoryDot, { backgroundColor: item.color }]} />
                  <Text style={styles.categoryLabel}>{item.category}</Text>
                </View>
                <View style={styles.categoryValueBlock}>
                  <Text style={styles.categoryShare}>{item.share.toFixed(1)}%</Text>
                  <Text style={styles.categoryAmount}>
                    {formatVisibleCurrency(item.amount, showValues)}
                  </Text>
                </View>
              </View>
            ))
          ) : (
            <Text style={styles.emptyText}>Nenhum gasto reportavel neste periodo.</Text>
          )}
        </Card>

        <Card noPadding style={styles.sectionCard}>
          <View style={styles.sectionInner}>
            <SectionHeader
              title="Ultimas movimentacoes"
              actionLabel="Ver todas"
              onActionPress={() => navigation.navigate('Transactions')}
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
            <View style={styles.sectionInner}>
              <Text style={styles.emptyText}>As novas transacoes vao aparecer aqui.</Text>
            </View>
          )}
        </Card>
      </ScrollView>

      <FloatingActionButton style={styles.fab} onPress={handleOpenQuickAdd} />

      <Modal visible={quickAddVisible} transparent animationType="slide" onRequestClose={() => setQuickAddVisible(false)}>
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={() => setQuickAddVisible(false)} />
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Lancamento rapido</Text>

            <View style={styles.typeRow}>
              <Pressable
                onPress={() => setType('expense')}
                style={[styles.typeChip, type === 'expense' && styles.typeChipExpense]}
              >
                <Text style={[styles.typeChipText, type === 'expense' && styles.typeChipTextExpense]}>Despesa</Text>
              </Pressable>
              <Pressable
                onPress={() => setType('income')}
                style={[styles.typeChip, type === 'income' && styles.typeChipIncome]}
              >
                <Text style={[styles.typeChipText, type === 'income' && styles.typeChipTextIncome]}>Receita</Text>
              </Pressable>
            </View>

            <TextInput
              placeholder="Descricao"
              value={title}
              onChangeText={setTitle}
              style={styles.modalInput}
              placeholderTextColor={colors.textSecondary}
            />
            <TextInput
              placeholder="Valor"
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              style={styles.modalInput}
              placeholderTextColor={colors.textSecondary}
            />

            <Text style={styles.modalLabel}>Conta</Text>
            <View style={styles.chipsWrap}>
              {accounts.map((account) => (
                <Pressable
                  key={account.id}
                  onPress={() => setAccountId(account.id)}
                  style={[styles.filterChip, accountId === account.id && styles.filterChipActive]}
                >
                  <Text style={[styles.filterChipText, accountId === account.id && styles.filterChipTextActive]}>
                    {account.name}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.modalLabel}>Categoria</Text>
            <View style={styles.chipsWrap}>
              {quickAddCategories.map((category) => (
                <Pressable
                  key={category.id}
                  onPress={() => setCategoryId(category.id)}
                  style={[styles.filterChip, categoryId === category.id && styles.filterChipActive]}
                >
                  <Text style={[styles.filterChipText, categoryId === category.id && styles.filterChipTextActive]}>
                    {category.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.modalLabel}>Metodo</Text>
            <View style={styles.chipsWrap}>
              {['Pix', 'Transferencia', 'Dinheiro', 'Cartao de debito', 'Cartao de credito', 'Boleto'].map((method) => (
                <Pressable
                  key={method}
                  onPress={() => setPaymentMethod(method)}
                  style={[styles.filterChip, paymentMethod === method && styles.filterChipActive]}
                >
                  <Text style={[styles.filterChipText, paymentMethod === method && styles.filterChipTextActive]}>
                    {method}
                  </Text>
                </Pressable>
              ))}
            </View>

            <TextInput
              placeholder="Observacoes"
              value={notes}
              onChangeText={setNotes}
              style={styles.modalInput}
              placeholderTextColor={colors.textSecondary}
            />

            <View style={styles.recurringRow}>
              <View>
                <Text style={styles.recurringTitle}>Criar regra recorrente</Text>
                <Text style={styles.recurringSubtitle}>Mesma conta, categoria e valor.</Text>
              </View>
              <Switch value={recurring} onValueChange={setRecurring} />
            </View>

            <View style={styles.modalActions}>
              <Pressable style={styles.secondaryButton} onPress={() => setQuickAddVisible(false)}>
                <Text style={styles.secondaryButtonText}>Cancelar</Text>
              </Pressable>
              <Pressable
                style={[styles.primaryButton, (!accountId || !amount || createTransactionMutation.isPending) && styles.primaryButtonDisabled]}
                onPress={handleSubmitQuickAdd}
                disabled={!accountId || !amount || createTransactionMutation.isPending}
              >
                {createTransactionMutation.isPending ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Text style={styles.primaryButtonText}>Salvar</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const createStyles = (colors: AppColors) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  summaryStatCard: {
    flex: 1,
  },
  kpiRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    alignItems: 'center',
    gap: spacing.xs,
  },
  kpiValue: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  kpiLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  accountHeroCard: {
    gap: spacing.md,
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  accountName: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '700',
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  categoryLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
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
    fontWeight: '600',
  },
  categoryValueBlock: {
    alignItems: 'flex-end',
  },
  categoryShare: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  categoryAmount: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '700',
    marginTop: 2,
  },
  emptyText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  loadingWrap: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  fab: {
    position: 'absolute',
    right: spacing.lg,
    bottom: BOTTOM_TAB_BAR_HEIGHT + 10,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15, 23, 42, 0.35)',
  },
  modalBackdrop: {
    flex: 1,
  },
  modalSheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: spacing.lg,
    gap: spacing.md,
  },
  modalTitle: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  modalLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '700',
  },
  typeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  typeChip: {
    flex: 1,
    minHeight: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeChipExpense: {
    backgroundColor: 'rgba(220, 38, 38, 0.08)',
    borderColor: 'rgba(220, 38, 38, 0.24)',
  },
  typeChipIncome: {
    backgroundColor: 'rgba(22, 163, 74, 0.08)',
    borderColor: 'rgba(22, 163, 74, 0.24)',
  },
  typeChipText: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  typeChipTextExpense: {
    color: colors.danger,
  },
  typeChipTextIncome: {
    color: colors.success,
  },
  modalInput: {
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    color: colors.textPrimary,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  filterChipActive: {
    backgroundColor: '#DBEAFE',
    borderColor: colors.primary,
  },
  filterChipText: {
    ...typography.caption,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: colors.primary,
  },
  recurringRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  recurringTitle: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  recurringSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  secondaryButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  primaryButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryLight,
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    ...typography.body,
    color: colors.white,
    fontWeight: '700',
  },
});
