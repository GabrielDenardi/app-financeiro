import { useMemo, useState } from 'react';
import {
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

import { useAuthenticatedUser } from '../features/auth/hooks/useAuthenticatedUser';
import { useTransactionSections } from '../features/transactions/hooks/useTransactions';
import { formatCurrencyBRL } from '../utils/format';
import { colors, radius, spacing, typography } from '../theme';

const MONTHS = ['Todos', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const METHODS = ['Todos', 'Pix', 'Transferencia', 'Dinheiro', 'Cartao de credito', 'Cartao de debito', 'Boleto'];

export function TransactionsScreen({ navigation }: any) {
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
        <Pressable style={styles.filterButton} onPress={() => setShowFilters((current) => !current)}>
          <SlidersHorizontal size={18} color={colors.textPrimary} />
        </Pressable>
      </View>

      <View style={styles.searchBox}>
        <Search size={18} color={colors.textSecondary} />
        <TextInput
          value={searchText}
          onChangeText={setSearchText}
          placeholder="Buscar por descricao, categoria ou metodo"
          style={styles.searchInput}
          placeholderTextColor={colors.textSecondary}
        />
        {searchText ? (
          <Pressable onPress={() => setSearchText('')}>
            <X size={16} color={colors.textSecondary} />
          </Pressable>
        ) : null}
      </View>

      {showFilters ? (
        <View style={styles.filtersCard}>
          <Text style={styles.filterLabel}>Tipo</Text>
          <View style={styles.chipsWrap}>
            {[
              { key: 'all', label: 'Tudo' },
              { key: 'income', label: 'Entradas' },
              { key: 'expense', label: 'Saidas' },
            ].map((item) => (
              <FilterChip
                key={item.key}
                active={activeType === item.key}
                label={item.label}
                onPress={() => setActiveType(item.key as 'all' | 'income' | 'expense')}
              />
            ))}
          </View>

          <Text style={styles.filterLabel}>Mes</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.horizontalChips}>
              {MONTHS.map((month) => (
                <FilterChip
                  key={month}
                  active={activeMonth === month}
                  label={month}
                  onPress={() => setActiveMonth(month)}
                />
              ))}
            </View>
          </ScrollView>

          <Text style={styles.filterLabel}>Metodo</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.horizontalChips}>
              {METHODS.map((method) => (
                <FilterChip
                  key={method}
                  active={activeMethod === method}
                  label={method}
                  onPress={() => setActiveMethod(method)}
                />
              ))}
            </View>
          </ScrollView>
        </View>
      ) : null}

      <View style={styles.summaryCard}>
        <SummaryCell label="Receitas" value={formatCurrencyBRL(totals.income)} tone="success" />
        <SummaryCell label="Despesas" value={formatCurrencyBRL(totals.expense)} tone="danger" />
        <SummaryCell label="Saldo" value={formatCurrencyBRL(totals.income - totals.expense)} tone="default" />
      </View>

      <SectionList
        sections={sectionsQuery.data ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({ section }) => <Text style={styles.sectionTitle}>{section.date}</Text>}
        renderItem={({ item }) => (
          <View style={styles.transactionRow}>
            <View style={styles.transactionLeft}>
              <Text style={styles.transactionTitle}>{item.title}</Text>
              <Text style={styles.transactionMeta}>
                {item.category} • {item.paymentMethod}
                {item.installmentLabel ? ` • ${item.installmentLabel}` : ''}
              </Text>
            </View>
            <View style={styles.transactionRight}>
              <Text style={[styles.transactionAmount, item.type === 'income' ? styles.incomeText : styles.expenseText]}>
                {item.type === 'income' ? '+' : '-'} {formatCurrencyBRL(item.amount)}
              </Text>
              <Text style={styles.transactionDate}>{item.dateLabel}</Text>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>Nenhuma transacao encontrada para os filtros atuais.</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

function FilterChip({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

function SummaryCell({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'success' | 'danger' | 'default';
}) {
  return (
    <View style={styles.summaryCell}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text
        style={[
          styles.summaryValue,
          tone === 'success' ? styles.incomeText : tone === 'danger' ? styles.expenseText : null,
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
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
  filterButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBox: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  searchInput: {
    flex: 1,
    ...typography.body,
    color: colors.textPrimary,
  },
  filtersCard: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  filterLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '700',
    marginTop: spacing.xs,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  horizontalChips: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  chipActive: {
    backgroundColor: '#DBEAFE',
    borderColor: colors.primary,
  },
  chipText: {
    ...typography.caption,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  chipTextActive: {
    color: colors.primary,
  },
  summaryCard: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    flexDirection: 'row',
  },
  summaryCell: {
    flex: 1,
    alignItems: 'center',
  },
  summaryLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  summaryValue: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '700',
    marginTop: spacing.xs,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 48,
    paddingTop: spacing.md,
  },
  sectionTitle: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '700',
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
  },
  transactionRow: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  transactionLeft: {
    flex: 1,
  },
  transactionTitle: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  transactionMeta: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  transactionRight: {
    alignItems: 'flex-end',
  },
  transactionAmount: {
    ...typography.body,
    fontWeight: '700',
  },
  transactionDate: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  emptyState: {
    paddingTop: spacing.xxl,
    alignItems: 'center',
  },
  emptyText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  incomeText: {
    color: colors.success,
  },
  expenseText: {
    color: colors.danger,
  },
});
