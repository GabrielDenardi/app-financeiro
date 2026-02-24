import React, { useState, useMemo } from 'react';
import { 
  View, 
  Text, 
  SectionList, 
  StyleSheet, 
  SafeAreaView, 
  TextInput, 
  TouchableOpacity,
  Platform,
  ScrollView
} from 'react-native';
import { ArrowLeft, Search, X, SlidersHorizontal } from 'lucide-react-native';
import { TransactionListItem } from '../components/TransictionListItem';
import { MOCK_TRANSACTIONS } from '../data/transictionsMock';
import { colors, radius, spacing, typography } from '../theme/index';
import { formatCurrency } from '../utils/format';

const TransactionsScreen = ({ navigation }: any) => {
  const [searchText, setSearchText] = useState('');
  const [activeType, setActiveType] = useState<'all' | 'income' | 'expense'>('all');
  const [activeMonth, setActiveMonth] = useState('Todos');
  const [activeMethod, setActiveMethod] = useState('Todos'); // Novo estado para Método
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  const months = ['Todos', 'Janeiro', 'Fevereiro', 'Março'];
  const methods = ['Todos', 'Dinheiro', 'Débito', 'Crédito', 'PIX', 'Transferência', 'Boleto'];

  // --- Lógica de Filtro Combinada (Busca + Tipo + Mês + Método) ---
  const filteredSections = useMemo(() => {
    return MOCK_TRANSACTIONS.map(section => {
      const filteredItems = section.data.filter(item => {
        // 1. Busca por Texto
        const matchesSearch = item.title.toLowerCase().includes(searchText.toLowerCase()) || 
                             item.category.toLowerCase().includes(searchText.toLowerCase());
        
        // 2. Filtro por Tipo (Receita/Despesa)
        const isIncome = item.amount > 0;
        const matchesType = activeType === 'all' ? true : (activeType === 'income' ? isIncome : !isIncome);

        // 3. Filtro por Mês
        const matchesMonth = activeMonth === 'Todos' ? true : section.date.toLowerCase().includes(activeMonth.toLowerCase());

        // 4. Filtro por Método (PIX, Dinheiro, etc)
        // Note: Verifique se no seu mock o campo se chama 'method' ou 'paymentMethod'
        const matchesMethod = activeMethod === 'Todos' ? true : item.paymentMethod === activeMethod;

        return matchesSearch && matchesType && matchesMonth && matchesMethod;
      });

      return { ...section, data: filteredItems };
    }).filter(section => section.data.length > 0);
  }, [searchText, activeType, activeMonth, activeMethod]);

  const totals = useMemo(() => {
    let income = 0; let expense = 0;
    filteredSections.forEach(s => s.data.forEach(i => i.amount > 0 ? income += i.amount : expense += Math.abs(i.amount)));
    return { income, expense, balance: income - expense };
  }, [filteredSections]);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation?.goBack()}>
          <ArrowLeft size={28} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Transações</Text>
        <View style={{ width: 28 }} /> 
      </View>

      {/* Busca e Toggle de Filtros */}
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
          {searchText !== '' && (
            <TouchableOpacity onPress={() => setSearchText('')}><X size={16} color={colors.textSecondary} /></TouchableOpacity>
          )}
        </View>
        <TouchableOpacity 
          style={[styles.filterToggle, showAdvancedFilters && styles.filterToggleActive]} 
          onPress={() => setShowAdvancedFilters(!showAdvancedFilters)}
        >
          <SlidersHorizontal size={20} color={showAdvancedFilters ? colors.background : colors.textPrimary} />
        </TouchableOpacity>
      </View>

      {/* Área de Filtros Avançados */}
      {showAdvancedFilters && (
        <View style={styles.advancedFilters}>
          {/* Filtro de Mês */}
          <Text style={styles.filterLabel}>Período</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalScroll}>
            {months.map(m => (
              <FilterChip key={m} label={m} active={activeMonth === m} onPress={() => setActiveMonth(m)} />
            ))}
          </ScrollView>

          {/* NOVO: Filtro de Método de Pagamento */}
          <Text style={styles.filterLabel}>Método de Pagamento</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalScroll}>
            {methods.map(method => (
              <FilterChip 
                key={method} 
                label={method} 
                active={activeMethod === method} 
                onPress={() => setActiveMethod(method)} 
              />
            ))}
          </ScrollView>

          {/* Filtro de Tipo */}
          <Text style={styles.filterLabel}>Tipo</Text>
          <View style={styles.chipRow}>
            <FilterChip label="Tudo" active={activeType === 'all'} onPress={() => setActiveType('all')} />
            <FilterChip label="Entradas" active={activeType === 'income'} onPress={() => setActiveType('income')} />
            <FilterChip label="Saídas" active={activeType === 'expense'} onPress={() => setActiveType('expense')} />
          </View>
        </View>
      )}

      {/* Resumo Card */}
      <View style={styles.summaryCard}>
        <SummaryItem label="Receitas" value={totals.income} color={colors.success} />
        <View style={styles.divider} />
        <SummaryItem label="Despesas" value={totals.expense} color={colors.danger} isNegative />
        <View style={styles.divider} />
        <SummaryItem label="Saldo" value={totals.balance} color={totals.balance >= 0 ? colors.textPrimary : colors.danger} />
      </View>

      {/* Lista Final */}
      <SectionList
        sections={filteredSections}
        keyExtractor={(item) => item.id}
        stickySectionHeadersEnabled={true}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => <TransactionListItem item={item} />}
        renderSectionHeader={({ section: { date } }) => (
          <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>{date}</Text></View>
        )}
        ListEmptyComponent={() => (
          <View style={styles.emptyContainer}><Text style={styles.emptyText}>Nenhuma transação para os filtros selecionados.</Text></View>
        )}
      />
    </SafeAreaView>
  );
};

// Componentes Auxiliares
const FilterChip = ({ label, active, onPress }: any) => (
  <TouchableOpacity style={[styles.chip, active && styles.chipActive]} onPress={onPress}>
    <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
  </TouchableOpacity>
);

const SummaryItem = ({ label, value, color, isNegative }: any) => (
  <View style={styles.summaryItem}>
    <Text style={styles.summaryLabel}>{label}</Text>
    <Text style={[styles.summaryValue, { color }]}>{isNegative ? '-' : ''}{formatCurrency(value)}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md },
  backButton: { padding: spacing.xs },
  headerTitle: { ...typography.h2, color: colors.textPrimary, fontWeight: 'bold' },
  searchRow: { flexDirection: 'row', paddingHorizontal: spacing.lg, gap: spacing.sm, marginBottom: spacing.md },
  searchContainer: {
    flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface,
    borderRadius: radius.md, paddingHorizontal: spacing.md, height: 48, borderWidth: 1, borderColor: colors.border, gap: spacing.sm,
  },
  searchInput: { flex: 1, ...typography.body, color: colors.textPrimary },
  filterToggle: { 
    width: 48, height: 48, backgroundColor: colors.surface, borderRadius: radius.md, 
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border 
  },
  filterToggleActive: { backgroundColor: colors.textPrimary, borderColor: colors.textPrimary },
  advancedFilters: { 
    backgroundColor: colors.surface, marginHorizontal: spacing.lg, padding: spacing.md, 
    borderRadius: radius.md, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border 
  },
  filterLabel: { ...typography.caption, fontWeight: 'bold', color: colors.textSecondary, marginBottom: spacing.xs, marginTop: spacing.sm },
  horizontalScroll: { gap: spacing.xs, paddingRight: spacing.xl, paddingVertical: spacing.xs },
  chipRow: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.xs },
  chip: { paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.pill || 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, marginRight: 8 },
  chipActive: { backgroundColor: colors.textPrimary, borderColor: colors.textPrimary },
  chipText: { ...typography.caption, color: colors.textSecondary, fontWeight: '600' },
  chipTextActive: { color: colors.background },
  summaryCard: {
    flexDirection: 'row', backgroundColor: colors.surface, marginHorizontal: spacing.lg, 
    paddingVertical: spacing.lg, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.lg,
    ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4 }, android: { elevation: 2 } })
  },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryLabel: { ...typography.caption, color: colors.textSecondary, marginBottom: 4 },
  summaryValue: { ...typography.body, fontWeight: 'bold', fontSize: 13 },
  divider: { width: 1, height: '60%', backgroundColor: colors.border, alignSelf: 'center' },
  listContent: { paddingHorizontal: spacing.lg, paddingBottom: 40 },
  sectionHeader: { backgroundColor: colors.background, paddingVertical: spacing.sm },
  sectionTitle: { ...typography.caption, fontWeight: 'bold', color: colors.textSecondary, textTransform: 'uppercase' },
  emptyContainer: { alignItems: 'center', marginTop: 50 },
  emptyText: { ...typography.body, color: colors.textSecondary }
});

export default TransactionsScreen;