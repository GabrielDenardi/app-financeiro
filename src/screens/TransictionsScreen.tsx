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
import { ArrowLeft, Search, SlidersHorizontal, X } from 'lucide-react-native';

import { TransactionListItem } from '../components/TransactionListItem';
import { useAuthenticatedUser } from '../features/auth/hooks/useAuthenticatedUser';
import { useTransactionSections } from '../features/transactions/hooks/useTransactions';
import { formatCurrencyBRL } from '../utils/format';
import { radius, spacing, typography, type AppColors, useThemeColors } from '../theme';

const MONTHS = ['Todos', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const METHODS = ['Todos', 'Pix', 'Transferencia', 'Dinheiro', 'Cartao de credito', 'Cartao de debito', 'Boleto'];

export function TransactionsScreen({ navigation }: any) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const currentUser = useAuthenticatedUser();
  const [searchText, setSearchText] = useState('');
  const [activeType, setActiveType] = useState<'all' | 'income' | 'expense'>('all');
  const [activeMonth, setActiveMonth] = useState('Todos');
  const [activeMethod, setActiveMethod] = useState('Todos');
  const [showFilters, setShowFilters] = useState(false);

  const monthIndex = activeMonth === 'Todos' ? null : MONTHS.indexOf(activeMonth) - 1;
  const sectionsQuery = useTransactionSections(currentUser?.id, {
    search: searchText,
    type: activeType,
    month: monthIndex,
    paymentMethod: activeMethod === 'Todos' ? null : activeMethod,
  });

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

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
          <ArrowLeft size={22} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.title}>Transacoes</Text>
        <Pressable
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
          />
          {searchText ? (
            <Pressable onPress={() => setSearchText('')}>
              <X size={16} color={colors.textSecondary} />
            </Pressable>
          ) : null}
        </View>
      </View>

      {showFilters ? (
        <View style={styles.advancedFilters}>
          <Text style={styles.filterLabel}>Periodo</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalScroll}
          >
            {MONTHS.map((month) => (
              <FilterChip
                key={month}
                label={month}
                active={activeMonth === month}
                onPress={() => setActiveMonth(month)}
                styles={styles}
              />
            ))}
          </ScrollView>

          <Text style={styles.filterLabel}>Metodo de pagamento</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalScroll}
          >
            {METHODS.map((method) => (
              <FilterChip
                key={method}
                label={method}
                active={activeMethod === method}
                onPress={() => setActiveMethod(method)}
                styles={styles}
              />
            ))}
          </ScrollView>

          <Text style={styles.filterLabel}>Tipo</Text>
          <View style={styles.chipRow}>
            <FilterChip label="Tudo" active={activeType === 'all'} onPress={() => setActiveType('all')} styles={styles} />
            <FilterChip label="Entradas" active={activeType === 'income'} onPress={() => setActiveType('income')} styles={styles} />
            <FilterChip label="Saidas" active={activeType === 'expense'} onPress={() => setActiveType('expense')} styles={styles} />
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

      <SectionList
        sections={sectionsQuery.data ?? []}
        keyExtractor={(item) => item.id}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={styles.listContent}
        renderSectionHeader={({ section }) => <Text style={styles.sectionTitle}>{section.date}</Text>}
        renderItem={({ item, index, section }) => (
          <View style={styles.transactionCard}>
            <TransactionListItem item={item} showDivider={index < section.data.length - 1} />
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            {sectionsQuery.isLoading ? (
              <ActivityIndicator />
            ) : (
              <Text style={styles.emptyText}>Nenhuma transacao para os filtros selecionados.</Text>
            )}
          </View>
        }
      />
    </SafeAreaView>
  );
}

function FilterChip({
  label,
  active,
  onPress,
  styles,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <Pressable style={[styles.chip, active && styles.chipActive]} onPress={onPress}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
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
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    gap: spacing.md,
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
    backgroundColor: colors.textPrimary,
    borderColor: colors.textPrimary,
  },
  searchRow: {
    paddingHorizontal: spacing.lg,
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
  advancedFilters: {
    backgroundColor: colors.surface,
    marginHorizontal: spacing.lg,
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
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    marginRight: 8,
  },
  chipActive: {
    backgroundColor: colors.textPrimary,
    borderColor: colors.textPrimary,
  },
  chipText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  chipTextActive: {
    color: colors.background,
  },
  summaryCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    marginHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
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
    paddingHorizontal: spacing.lg,
    paddingBottom: 48,
  },
  sectionTitle: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
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
  },
  emptyText: {
    ...typography.body,
    color: colors.textSecondary,
  },
});
