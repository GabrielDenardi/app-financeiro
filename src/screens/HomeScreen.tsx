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
import { ArrowDownRight, ArrowUpRight, Eye, EyeOff, Landmark, Plus, Target, Users } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';

import { useFinanceCategories, useCreateTransactionMutation } from '../features/transactions/hooks/useTransactions';
import { useHomeDashboard } from '../features/dashboard/hooks/useDashboard';
import { useAccounts } from '../features/accounts/hooks/useAccounts';
import { usePreferences } from '../features/preferences/hooks/usePreferences';
import { useProfile } from '../features/profile/hooks/useProfile';
import { formatCurrencyBRL, HIDDEN_CURRENCY_TEXT } from '../utils/format';
import { colors, radius, spacing, typography } from '../theme';
import type { AuthenticatedUserSummary } from '../types/auth';

type HomeScreenProps = {
  currentUser: AuthenticatedUserSummary | null;
};

function displayCurrency(value: number, visible: boolean) {
  return visible ? formatCurrencyBRL(value) : HIDDEN_CURRENCY_TEXT;
}

export function HomeScreen({ currentUser }: HomeScreenProps) {
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
  const categories = categoriesQuery.data?.filter((category) => category.kind !== 'income') ?? [];
  const categorySpending = dashboard?.categorySpending ?? [];
  const recentTransactions = dashboard?.recentTransactions ?? [];
  const displayName =
    profileQuery.data?.fullName?.trim() || currentUser?.fullName?.trim() || currentUser?.email?.split('@')[0] || 'Usuario';

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
    setAccountId(accounts[0]?.id ?? '');
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
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Ola, {displayName}</Text>
            <Text style={styles.subtitle}>Seu resumo financeiro agora vem do Supabase.</Text>
          </View>
          <Pressable style={styles.visibilityButton} onPress={() => setShowValues((current) => !current)}>
            {showValues ? <Eye color={colors.textPrimary} size={18} /> : <EyeOff color={colors.textPrimary} size={18} />}
          </Pressable>
        </View>

        <View style={styles.heroCard}>
          {dashboardQuery.isLoading ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <>
              <Text style={styles.heroLabel}>{dashboard?.summary.monthLabel ?? 'Resumo mensal'}</Text>
              <Text style={styles.heroValue}>{displayCurrency(dashboard?.summary.balance ?? 0, showValues)}</Text>
              <View style={styles.heroStats}>
                <View style={styles.heroStat}>
                  <ArrowUpRight size={16} color="#86EFAC" />
                  <Text style={styles.heroStatText}>{displayCurrency(dashboard?.summary.income ?? 0, showValues)}</Text>
                </View>
                <View style={styles.heroStat}>
                  <ArrowDownRight size={16} color="#FCA5A5" />
                  <Text style={styles.heroStatText}>{displayCurrency(dashboard?.summary.expense ?? 0, showValues)}</Text>
                </View>
              </View>
            </>
          )}
        </View>

        <View style={styles.kpiRow}>
          <Pressable style={styles.kpiCard} onPress={() => navigation.navigate('Accounts')}>
            <Landmark color={colors.primary} size={18} />
            <Text style={styles.kpiValue}>{dashboard?.summary.accountsCount ?? 0}</Text>
            <Text style={styles.kpiLabel}>Contas</Text>
          </Pressable>
          <Pressable style={styles.kpiCard} onPress={() => navigation.navigate('Goals')}>
            <Target color={colors.primary} size={18} />
            <Text style={styles.kpiValue}>{dashboard?.summary.goalsCount ?? 0}</Text>
            <Text style={styles.kpiLabel}>Metas</Text>
          </Pressable>
          <Pressable style={styles.kpiCard} onPress={() => navigation.getParent()?.navigate('Groups')}>
            <Users color={colors.primary} size={18} />
            <Text style={styles.kpiValue}>{dashboard?.summary.groupsCount ?? 0}</Text>
            <Text style={styles.kpiLabel}>Grupos</Text>
          </Pressable>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Categorias do mes</Text>
            <Pressable onPress={() => navigation.navigate('Reports')}>
              <Text style={styles.sectionAction}>Relatorios</Text>
            </Pressable>
          </View>
          <View style={styles.sectionCard}>
            {categorySpending.length ? (
              categorySpending.map((item) => (
                <View key={item.category} style={styles.categoryRow}>
                  <View style={styles.categoryLabelRow}>
                    <View style={[styles.categoryDot, { backgroundColor: item.color }]} />
                    <Text style={styles.categoryLabel}>{item.category}</Text>
                  </View>
                  <View style={styles.categoryValueRow}>
                    <Text style={styles.categoryShare}>{item.share.toFixed(1)}%</Text>
                    <Text style={styles.categoryAmount}>{displayCurrency(item.amount, showValues)}</Text>
                  </View>
                </View>
              ))
            ) : (
              <Text style={styles.emptyText}>Nenhum gasto reportavel neste periodo.</Text>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Ultimas movimentacoes</Text>
            <Pressable onPress={() => navigation.navigate('Transactions')}>
              <Text style={styles.sectionAction}>Ver todas</Text>
            </Pressable>
          </View>
          <View style={styles.sectionCard}>
            {recentTransactions.length ? (
              recentTransactions.map((item) => (
                <View key={item.id} style={styles.transactionRow}>
                  <View style={styles.transactionLeft}>
                    <Text style={styles.transactionTitle}>{item.title}</Text>
                    <Text style={styles.transactionMeta}>
                      {item.category} • {item.paymentMethod}
                    </Text>
                  </View>
                  <View style={styles.transactionRight}>
                    <Text style={[styles.transactionAmount, item.type === 'income' ? styles.transactionIncome : styles.transactionExpense]}>
                      {item.type === 'income' ? '+' : '-'} {displayCurrency(item.amount, showValues)}
                    </Text>
                    <Text style={styles.transactionDate}>{item.dateLabel}</Text>
                  </View>
                </View>
              ))
            ) : (
              <Text style={styles.emptyText}>As novas transacoes vao aparecer aqui.</Text>
            )}
          </View>
        </View>

        <Pressable style={styles.quickAddButton} onPress={handleOpenQuickAdd}>
          <Plus color={colors.white} size={18} />
          <Text style={styles.quickAddButtonText}>Adicionar lancamento</Text>
        </Pressable>
      </ScrollView>

      <Modal visible={quickAddVisible} transparent animationType="slide" onRequestClose={() => setQuickAddVisible(false)}>
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={() => setQuickAddVisible(false)} />
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Lancamento rapido</Text>
            <View style={styles.typeRow}>
              <Pressable
                onPress={() => setType('expense')}
                style={[styles.typeChip, type === 'expense' && styles.typeChipActive]}
              >
                <Text style={[styles.typeChipText, type === 'expense' && styles.typeChipTextActive]}>Despesa</Text>
              </Pressable>
              <Pressable
                onPress={() => setType('income')}
                style={[styles.typeChip, type === 'income' && styles.typeChipActive]}
              >
                <Text style={[styles.typeChipText, type === 'income' && styles.typeChipTextActive]}>Receita</Text>
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
            <TextInput
              placeholder="Observacoes"
              value={notes}
              onChangeText={setNotes}
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

            <View style={styles.recurringRow}>
              <View>
                <Text style={styles.recurringTitle}>Criar regra recorrente</Text>
                <Text style={styles.recurringSubtitle}>Mensal, mesma conta, categoria e valor.</Text>
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

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
    paddingBottom: 120,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xl,
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
  heroCard: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  heroLabel: {
    ...typography.caption,
    color: 'rgba(255,255,255,0.85)',
    fontWeight: '700',
  },
  heroValue: {
    ...typography.h1,
    color: colors.white,
  },
  heroStats: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  heroStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  heroStatText: {
    ...typography.body,
    color: colors.white,
    fontWeight: '700',
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
    padding: spacing.md,
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
  },
  section: {
    gap: spacing.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  sectionAction: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '700',
  },
  sectionCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.md,
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
  categoryValueRow: {
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
  },
  transactionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  transactionLeft: {
    flex: 1,
  },
  transactionRight: {
    alignItems: 'flex-end',
  },
  transactionTitle: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  transactionMeta: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  transactionAmount: {
    ...typography.body,
    fontWeight: '700',
  },
  transactionIncome: {
    color: colors.success,
  },
  transactionExpense: {
    color: colors.danger,
  },
  transactionDate: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  emptyText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  quickAddButton: {
    minHeight: 52,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  quickAddButtonText: {
    ...typography.body,
    color: colors.white,
    fontWeight: '700',
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
  typeChipActive: {
    borderColor: colors.primary,
    backgroundColor: '#DBEAFE',
  },
  typeChipText: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  typeChipTextActive: {
    color: colors.primary,
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
    paddingVertical: spacing.xs,
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
    marginTop: spacing.sm,
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
