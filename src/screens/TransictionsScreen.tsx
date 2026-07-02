import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { ChevronLeft, ChevronRight, Search, SlidersHorizontal, X } from 'lucide-react-native';

import { BOTTOM_TAB_BAR_HEIGHT } from '../components/BottomTabBarMock';
import { Chip } from '../components/Chip';
import { FloatingActionButton } from '../components/FloatingActionButton';
import { TransactionListItem } from '../components/TransactionListItem';
import { useAccounts } from '../features/accounts/hooks/useAccounts';
import { useAuthenticatedUser } from '../features/auth/hooks/useAuthenticatedUser';
import { endOfMonth, localIsoDate, monthLabel, startOfMonth } from '../features/finance/utils';
import { useCurrentPlan } from '../features/plans/hooks';
import { QuickAddTransactionSheet } from '../features/transactions/components/QuickAddTransactionSheet';
import { TransactionActionsSheet } from '../features/transactions/components/TransactionActionsSheet';
import { useDebouncedValue } from '../features/transactions/hooks/useDebouncedValue';
import { useFinanceCategories, useTransactionSections } from '../features/transactions/hooks/useTransactions';
import type { TransactionFeedItem } from '../features/transactions/types';
import { formatCurrencyBRL } from '../utils/format';
import { layout, radius, spacing, typography, type AppColors, useThemeColors } from '../theme';

const METHODS = ['Todos', 'Pix', 'Transferência', 'Dinheiro', 'Cartão de crédito', 'Cartão de débito', 'Boleto'];

export function TransactionsScreen() {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const currentUser = useAuthenticatedUser();
  const [searchText, setSearchText] = useState('');
  const [activeType, setActiveType] = useState<'all' | 'income' | 'expense'>('all');
  const [activeMethod, setActiveMethod] = useState('Todos');
  const [showFilters, setShowFilters] = useState(false);
  const [monthCursor, setMonthCursor] = useState(() => startOfMonth(new Date()));
  const [allPeriod, setAllPeriod] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<TransactionFeedItem | null>(null);
  const [quickAddVisible, setQuickAddVisible] = useState(false);

  const debouncedSearch = useDebouncedValue(searchText);

  const categoriesQuery = useFinanceCategories(currentUser?.id);
  const accountsQuery = useAccounts(currentUser?.id);
  const currentPlan = useCurrentPlan(currentUser?.id);
  const sectionsQuery = useTransactionSections(currentUser?.id, {
    search: debouncedSearch,
    type: activeType,
    paymentMethod: activeMethod === 'Todos' ? null : activeMethod,
    from: allPeriod ? null : localIsoDate(startOfMonth(monthCursor)),
    to: allPeriod ? null : localIsoDate(endOfMonth(monthCursor)),
  });

  const accounts = accountsQuery.data ?? [];
  const primaryAccount = accounts.find((account) => account.isActive) ?? accounts[0] ?? null;

  const monthTitle = useMemo(() => {
    const label = monthLabel(monthCursor);
    return label.charAt(0).toUpperCase() + label.slice(1);
  }, [monthCursor]);

  const hasActiveFilters =
    Boolean(debouncedSearch.trim()) || activeType !== 'all' || activeMethod !== 'Todos';

  const totals = useMemo(() => {
    return (sectionsQuery.data ?? []).reduce(
      (accumulator, section) => {
        section.data.forEach((item) => {
          if (item.type === 'income') {
            accumulator.income += item.amount;
          } else {
            accumulator.expense += item.amount;
          }
        });

        return accumulator;
      },
      { income: 0, expense: 0 },
    );
  }, [sectionsQuery.data]);

  const shiftMonth = (delta: number) => {
    setMonthCursor((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1));
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.title}>Transações</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Filtros"
          accessibilityState={{ expanded: showFilters }}
          style={[styles.filterToggle, showFilters && styles.filterToggleActive]}
          onPress={() => setShowFilters((current) => !current)}
        >
          <SlidersHorizontal
            size={18}
            color={showFilters ? colors.background : colors.textPrimary}
          />
        </Pressable>
      </View>

      <View style={styles.searchRow}>
        <View style={styles.searchContainer}>
          <Search size={18} color={colors.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar..."
            placeholderTextColor={colors.textSecondary}
            value={searchText}
            onChangeText={setSearchText}
            accessibilityLabel="Buscar transações"
          />
          {searchText ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Limpar busca" onPress={() => setSearchText('')}>
              <X size={16} color={colors.textSecondary} />
            </Pressable>
          ) : null}
        </View>
      </View>

      <View style={styles.monthRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Mês anterior"
          disabled={allPeriod}
          onPress={() => shiftMonth(-1)}
          style={[styles.monthArrow, allPeriod && styles.monthArrowDisabled]}
        >
          <ChevronLeft size={18} color={allPeriod ? colors.textSecondary : colors.textPrimary} />
        </Pressable>
        <Text style={styles.monthLabel}>{allPeriod ? 'Todo o período' : monthTitle}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Próximo mês"
          disabled={allPeriod}
          onPress={() => shiftMonth(1)}
          style={[styles.monthArrow, allPeriod && styles.monthArrowDisabled]}
        >
          <ChevronRight size={18} color={allPeriod ? colors.textSecondary : colors.textPrimary} />
        </Pressable>
        <Chip
          label="Todos"
          selected={allPeriod}
          onPress={() => setAllPeriod((current) => !current)}
          style={styles.allPeriodChip}
        />
      </View>

      {showFilters ? (
        <View style={styles.advancedFilters}>
          <Text style={styles.filterLabel}>Método de pagamento</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalScroll}
          >
            {METHODS.map((method) => (
              <Chip
                key={method}
                label={method}
                selected={activeMethod === method}
                onPress={() => setActiveMethod(method)}
              />
            ))}
          </ScrollView>

          <Text style={styles.filterLabel}>Tipo</Text>
          <View style={styles.chipRow}>
            <Chip label="Tudo" selected={activeType === 'all'} onPress={() => setActiveType('all')} />
            <Chip label="Entradas" selected={activeType === 'income'} onPress={() => setActiveType('income')} />
            <Chip label="Saídas" selected={activeType === 'expense'} onPress={() => setActiveType('expense')} />
          </View>
        </View>
      ) : null}

      <View style={styles.summaryCard}>
        <SummaryItem label="Receitas" value={formatCurrencyBRL(totals.income)} color={colors.success} styles={styles} />
        <View style={styles.divider} />
        <SummaryItem label="Despesas" value={formatCurrencyBRL(totals.expense)} color={colors.danger} styles={styles} />
        <View style={styles.divider} />
        <SummaryItem
          label="Saldo"
          value={formatCurrencyBRL(totals.income - totals.expense)}
          color={totals.income - totals.expense >= 0 ? colors.textPrimary : colors.danger}
          styles={styles}
        />
      </View>
      {hasActiveFilters ? (
        <Text style={styles.filteredTotalsHint}>Totais dos resultados filtrados</Text>
      ) : null}

      <SectionList
        sections={sectionsQuery.data ?? []}
        keyExtractor={(item) => item.id}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={styles.listContent}
        refreshing={sectionsQuery.isRefetching}
        onRefresh={() => sectionsQuery.refetch()}
        renderSectionHeader={({ section }) => <Text style={styles.sectionTitle}>{section.date}</Text>}
        renderItem={({ item, index, section }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Transação ${item.title}`}
            style={styles.transactionCard}
            onPress={() => setSelectedTransaction(item)}
          >
            <TransactionListItem item={item} showDivider={index < section.data.length - 1} showOptions />
          </Pressable>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            {sectionsQuery.isLoading ? (
              <ActivityIndicator />
            ) : sectionsQuery.isError ? (
              <>
                <Text style={styles.emptyText}>Não foi possível carregar as transações.</Text>
                <Pressable
                  accessibilityRole="button"
                  style={styles.retryButton}
                  onPress={() => sectionsQuery.refetch()}
                >
                  <Text style={styles.retryText}>Tentar novamente</Text>
                </Pressable>
              </>
            ) : (
              <Text style={styles.emptyText}>Nenhuma transação para os filtros selecionados.</Text>
            )}
          </View>
        }
      />

      <FloatingActionButton style={styles.fab} onPress={() => setQuickAddVisible(true)} />

      <QuickAddTransactionSheet
        visible={quickAddVisible}
        currentUserId={currentUser?.id}
        accounts={accounts}
        categories={categoriesQuery.data ?? []}
        primaryAccountId={primaryAccount?.id ?? null}
        allowVoiceCapture={currentPlan.entitlements.voiceCapture}
        onClose={() => setQuickAddVisible(false)}
      />

      <TransactionActionsSheet
        visible={selectedTransaction !== null}
        transaction={selectedTransaction}
        categories={categoriesQuery.data ?? []}
        onClose={() => setSelectedTransaction(null)}
      />
    </SafeAreaView>
  );
}

function SummaryItem({
  label,
  value,
  color,
  styles,
}: {
  label: string;
  value: string;
  color: string;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.summaryItem}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={[styles.summaryValue, { color }]}>{value}</Text>
    </View>
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
    paddingHorizontal: layout.pageHorizontal,
    paddingTop: layout.pageHeaderTop,
    gap: spacing.md,
  },
  title: {
    ...typography.h1,
    color: colors.textPrimary,
    flex: 1,
  },
  filterToggle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterToggleActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primaryLight,
  },
  searchRow: {
    paddingHorizontal: layout.pageHorizontal,
    gap: spacing.sm,
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  searchInput: {
    flex: 1,
    ...typography.body,
    color: colors.textPrimary,
  },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: layout.pageHorizontal,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  monthArrow: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthArrowDisabled: {
    opacity: 0.4,
  },
  monthLabel: {
    flex: 1,
    ...typography.h3,
    fontWeight: '600',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  allPeriodChip: {
    height: 36,
    paddingHorizontal: spacing.md,
  },
  advancedFilters: {
    backgroundColor: colors.surface,
    marginHorizontal: layout.pageHorizontal,
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterLabel: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: spacing.xs,
    marginTop: spacing.sm,
  },
  horizontalScroll: {
    gap: spacing.xs,
    paddingRight: spacing.xl,
    paddingVertical: spacing.xs,
  },
  chipRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  summaryCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    marginHorizontal: layout.pageHorizontal,
    paddingVertical: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filteredTotalsHint: {
    ...typography.caption,
    color: colors.textSecondary,
    paddingHorizontal: layout.pageHorizontal,
    marginTop: spacing.xs,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  summaryValue: {
    ...typography.body,
    fontWeight: '700',
    fontSize: 13,
  },
  divider: {
    width: 1,
    height: '60%',
    backgroundColor: colors.border,
    alignSelf: 'center',
  },
  listContent: {
    paddingHorizontal: layout.pageHorizontal,
    paddingTop: spacing.lg,
    paddingBottom: BOTTOM_TAB_BAR_HEIGHT + 72,
  },
  sectionTitle: {
    ...typography.h3,
    fontWeight: '600',
    color: colors.textSecondary,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  transactionCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    marginBottom: spacing.sm,
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 50,
    gap: spacing.md,
  },
  emptyText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  fab: {
    position: 'absolute',
    right: spacing.lg,
    bottom: BOTTOM_TAB_BAR_HEIGHT - spacing.lg,
  },
  retryButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.primaryLight,
  },
  retryText: {
    ...typography.body,
    fontWeight: '600',
    color: colors.white,
  },
});
