import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Plus, Trash2, X } from 'lucide-react-native';

import { useAuthenticatedUser } from '../features/auth/hooks/useAuthenticatedUser';
import { useBudgets, useDeleteBudgetMutation, useUpsertBudgetMutation } from '../features/budgets/hooks/useBudgets';
import { formatMonthDate, monthLabel } from '../features/finance/utils';
import { useFinanceCategories } from '../features/transactions/hooks/useTransactions';
import { formatCurrencyBRL } from '../utils/format';
import { colors, radius, spacing, typography } from '../theme';

export default function BudgetsScreen() {
  const currentUser = useAuthenticatedUser();
  const monthDate = formatMonthDate();
  const budgetsQuery = useBudgets(currentUser?.id, monthDate);
  const categoriesQuery = useFinanceCategories(currentUser?.id);
  const upsertBudgetMutation = useUpsertBudgetMutation(currentUser?.id);
  const deleteBudgetMutation = useDeleteBudgetMutation(currentUser?.id);

  const [modalVisible, setModalVisible] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [limitAmount, setLimitAmount] = useState('');

  const expenseCategories = useMemo(
    () => (categoriesQuery.data ?? []).filter((category) => category.kind !== 'income'),
    [categoriesQuery.data],
  );

  const totals = useMemo(() => {
    return (budgetsQuery.data ?? []).reduce(
      (accumulator, item) => {
        accumulator.limit += item.limitAmount;
        accumulator.spent += item.spentAmount;
        return accumulator;
      },
      { limit: 0, spent: 0 },
    );
  }, [budgetsQuery.data]);

  const handleSave = async () => {
    if (!selectedCategoryId) {
      Alert.alert('Categoria necessaria', 'Selecione uma categoria para o orcamento.');
      return;
    }

    try {
      await upsertBudgetMutation.mutateAsync({
        categoryId: selectedCategoryId,
        limitAmount: Number(limitAmount.replace(/\./g, '').replace(',', '.') || 0),
        monthDate,
      });
      setModalVisible(false);
      setSelectedCategoryId(null);
      setLimitAmount('');
    } catch (error) {
      Alert.alert('Erro', error instanceof Error ? error.message : 'Nao foi possivel salvar o orcamento.');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteBudgetMutation.mutateAsync(id);
    } catch (error) {
      Alert.alert('Erro', error instanceof Error ? error.message : 'Nao foi possivel excluir o orcamento.');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Orcamentos</Text>
            <Text style={styles.subtitle}>{monthLabel(monthDate)}</Text>
          </View>
          <Pressable style={styles.addButton} onPress={() => setModalVisible(true)}>
            <Plus color={colors.white} size={18} />
            <Text style={styles.addButtonText}>Novo</Text>
          </Pressable>
        </View>

        <View style={styles.summaryCard}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Total orcado</Text>
            <Text style={styles.summaryValue}>{formatCurrencyBRL(totals.limit)}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Total gasto</Text>
            <Text style={[styles.summaryValue, totals.spent > totals.limit && styles.dangerText]}>
              {formatCurrencyBRL(totals.spent)}
            </Text>
          </View>
        </View>

        <View style={styles.listCard}>
          {budgetsQuery.isLoading ? (
            <ActivityIndicator />
          ) : budgetsQuery.data?.length ? (
            budgetsQuery.data.map((budget) => (
              <View key={budget.id} style={styles.budgetRow}>
                <View style={styles.budgetHeader}>
                  <View style={styles.budgetTitleRow}>
                    <View style={[styles.categoryDot, { backgroundColor: budget.categoryColor }]} />
                    <Text style={styles.budgetTitle}>{budget.categoryLabel}</Text>
                  </View>
                  <Pressable onPress={() => handleDelete(budget.id)}>
                    <Trash2 size={18} color={colors.danger} />
                  </Pressable>
                </View>
                <Text style={styles.budgetText}>
                  {formatCurrencyBRL(budget.spentAmount)} de {formatCurrencyBRL(budget.limitAmount)}
                </Text>
                <View style={styles.progressTrack}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${Math.min(budget.progressPercent, 100)}%`,
                        backgroundColor: budget.progressPercent > 100 ? colors.danger : budget.categoryColor,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.budgetMeta}>
                  Restam {formatCurrencyBRL(budget.remainingAmount)} • {budget.progressPercent.toFixed(1)}%
                </Text>
              </View>
            ))
          ) : (
            <Text style={styles.emptyText}>Crie o primeiro limite mensal por categoria.</Text>
          )}
        </View>
      </ScrollView>

      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={() => setModalVisible(false)} />
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Novo orcamento</Text>
              <Pressable onPress={() => setModalVisible(false)}>
                <X size={22} color={colors.textPrimary} />
              </Pressable>
            </View>

            <TextInput
              placeholder="Limite mensal"
              value={limitAmount}
              onChangeText={setLimitAmount}
              keyboardType="decimal-pad"
              style={styles.modalInput}
              placeholderTextColor={colors.textSecondary}
            />

            <Text style={styles.modalLabel}>Categoria</Text>
            <View style={styles.chipsWrap}>
              {expenseCategories.map((category) => (
                <Pressable
                  key={category.id}
                  onPress={() => setSelectedCategoryId(category.id)}
                  style={[styles.filterChip, selectedCategoryId === category.id && styles.filterChipActive]}
                >
                  <Text style={[styles.filterChipText, selectedCategoryId === category.id && styles.filterChipTextActive]}>
                    {category.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.modalActions}>
              <Pressable style={styles.secondaryButton} onPress={() => setModalVisible(false)}>
                <Text style={styles.secondaryButtonText}>Cancelar</Text>
              </Pressable>
              <Pressable
                style={[styles.primaryButton, (!selectedCategoryId || upsertBudgetMutation.isPending) && styles.primaryButtonDisabled]}
                onPress={handleSave}
                disabled={!selectedCategoryId || upsertBudgetMutation.isPending}
              >
                {upsertBudgetMutation.isPending ? (
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
    paddingBottom: 80,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xl,
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
  addButton: {
    minHeight: 44,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  addButtonText: {
    ...typography.body,
    color: colors.white,
    fontWeight: '700',
  },
  summaryCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    flexDirection: 'row',
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  summaryValue: {
    ...typography.h2,
    color: colors.textPrimary,
    marginTop: spacing.xs,
  },
  listCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.md,
  },
  budgetRow: {
    gap: spacing.sm,
  },
  budgetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  budgetTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  categoryDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  budgetTitle: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  budgetText: {
    ...typography.body,
    color: colors.textPrimary,
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: colors.mutedSurface,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  budgetMeta: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  emptyText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  dangerText: {
    color: colors.danger,
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
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
