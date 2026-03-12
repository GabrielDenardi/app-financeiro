import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Pencil, PiggyBank, Plus, Trash2, X } from 'lucide-react-native';

import { useAuthenticatedUser } from '../features/auth/hooks/useAuthenticatedUser';
import { useBudgets, useDeleteBudgetMutation, useUpsertBudgetMutation } from '../features/budgets/hooks/useBudgets';
import { formatMonthDate, monthLabel } from '../features/finance/utils';
import { useFinanceCategories } from '../features/transactions/hooks/useTransactions';
import { radius, spacing, typography, type AppColors, useThemeColors } from '../theme';
import { formatCurrencyBRL } from '../utils/format';

export default function BudgetsScreen() {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const currentUser = useAuthenticatedUser();
  const monthDate = formatMonthDate();
  const budgetsQuery = useBudgets(currentUser?.id, monthDate);
  const categoriesQuery = useFinanceCategories(currentUser?.id);
  const upsertBudgetMutation = useUpsertBudgetMutation(currentUser?.id);
  const deleteBudgetMutation = useDeleteBudgetMutation(currentUser?.id);

  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
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

  const closeModal = () => {
    setModalVisible(false);
    setEditingId(null);
    setSelectedCategoryId(null);
    setLimitAmount('');
  };

  const handleEdit = (budget: NonNullable<typeof budgetsQuery.data>[number]) => {
    setEditingId(budget.id);
    setSelectedCategoryId(budget.categoryId);
    setLimitAmount(
      budget.limitAmount.toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    );
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!selectedCategoryId) {
      Alert.alert('Erro', 'Selecione uma categoria.');
      return;
    }

    try {
      await upsertBudgetMutation.mutateAsync({
        id: editingId ?? undefined,
        categoryId: selectedCategoryId,
        limitAmount: Number(limitAmount.replace(/\./g, '').replace(',', '.') || 0),
        monthDate,
      });
      closeModal();
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
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View>
            <Text style={styles.h2}>Orcamentos</Text>
            <Text style={styles.caption}>{monthLabel(monthDate)}</Text>
          </View>
          <Pressable style={styles.btnHeader} onPress={() => setModalVisible(true)}>
            <Plus size={18} color={colors.white} />
            <Text style={styles.btnHeaderText}>Novo</Text>
          </Pressable>
        </View>

        <View style={styles.summaryBox}>
          <View style={styles.summaryItem}>
            <Text style={styles.caption}>Total Orcado</Text>
            <Text style={styles.h1}>{formatCurrencyBRL(totals.limit)}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.caption}>Total Gasto</Text>
            <Text style={[styles.h1, totals.spent > totals.limit && styles.dangerText]}>
              {formatCurrencyBRL(totals.spent)}
            </Text>
          </View>
        </View>

        <View style={styles.listContainer}>
          {budgetsQuery.isLoading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator />
            </View>
          ) : budgetsQuery.data?.length ? (
            budgetsQuery.data.map((item) => {
              const percentage = Math.min(item.progressPercent, 100);
              const isOverLimit = item.spentAmount > item.limitAmount;

              return (
                <View key={item.id} style={styles.card}>
                  <View style={styles.cardHeader}>
                    <View style={styles.budgetInfo}>
                      <View style={styles.budgetTitleRow}>
                        <View style={[styles.categoryBadge, { backgroundColor: `${item.categoryColor}18` }]}>
                          <PiggyBank size={16} color={item.categoryColor} />
                        </View>
                        <Text style={styles.h2}>{item.categoryLabel}</Text>
                      </View>
                      <Text style={styles.bodyText}>
                        <Text style={[styles.amountStrong, isOverLimit && styles.dangerText]}>
                          {formatCurrencyBRL(item.spentAmount)}
                        </Text>
                        {' / '}
                        {formatCurrencyBRL(item.limitAmount)}
                      </Text>
                    </View>

                    <View style={styles.actionButtons}>
                      <Pressable onPress={() => handleEdit(item)} style={styles.iconButton}>
                        <Pencil size={18} color={colors.primaryLight} />
                      </Pressable>
                      <Pressable onPress={() => handleDelete(item.id)} style={styles.iconButton}>
                        <Trash2 size={18} color={colors.danger} />
                      </Pressable>
                    </View>
                  </View>

                  <View style={styles.progressBarBg}>
                    <View
                      style={[
                        styles.progressBarFill,
                        {
                          width: `${percentage}%`,
                          backgroundColor: isOverLimit ? colors.danger : item.categoryColor,
                        },
                      ]}
                    />
                  </View>

                  <View style={styles.cardFooter}>
                    <Text style={styles.caption}>{Math.round(item.progressPercent)}% usado</Text>
                    <Text style={[styles.caption, item.progressPercent >= 80 ? styles.dangerText : styles.successText]}>
                      Restam {formatCurrencyBRL(item.remainingAmount)}
                    </Text>
                  </View>
                </View>
              );
            })
          ) : (
            <View style={styles.emptyCard}>
              <Text style={styles.h2}>Nenhum orcamento criado</Text>
              <Text style={styles.bodyText}>Crie o primeiro limite mensal por categoria para acompanhar seus gastos.</Text>
            </View>
          )}
        </View>
      </ScrollView>

      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={closeModal}>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalWrap}
          >
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.h2}>{editingId ? 'Editar Orcamento' : 'Novo Orcamento'}</Text>
                <Pressable onPress={closeModal}>
                  <X size={24} color={colors.textPrimary} />
                </Pressable>
              </View>

              <Text style={styles.inputLabel}>Limite Mensal</Text>
              <TextInput
                placeholder="R$ 0,00"
                keyboardType="decimal-pad"
                placeholderTextColor={colors.textSecondary}
                style={styles.input}
                value={limitAmount}
                onChangeText={setLimitAmount}
              />

              <Text style={styles.inputLabel}>Categoria</Text>
              <View style={styles.chipsWrap}>
                {expenseCategories.map((category) => (
                  <Pressable
                    key={category.id}
                    onPress={() => setSelectedCategoryId(category.id)}
                    style={[
                      styles.categoryChip,
                      selectedCategoryId === category.id && {
                        borderColor: category.color,
                        backgroundColor: `${category.color}12`,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.categoryChipText,
                        selectedCategoryId === category.id && { color: category.color },
                      ]}
                    >
                      {category.label}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <View style={styles.modalActions}>
                <Pressable style={[styles.btnBase, styles.btnCancel]} onPress={closeModal}>
                  <Text style={styles.btnTextCancel}>Cancelar</Text>
                </Pressable>
                <Pressable
                  style={[styles.btnBase, styles.btnCreate, (!selectedCategoryId || upsertBudgetMutation.isPending) && styles.disabledButton]}
                  onPress={handleSave}
                  disabled={!selectedCategoryId || upsertBudgetMutation.isPending}
                >
                  {upsertBudgetMutation.isPending ? (
                    <ActivityIndicator color={colors.white} />
                  ) : (
                    <Text style={styles.btnTextCreate}>{editingId ? 'Salvar' : 'Criar'}</Text>
                  )}
                </Pressable>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const createStyles = (colors: AppColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 24,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xl,
    marginBottom: spacing.lg,
  },
  btnHeader: {
    flexDirection: 'row',
    backgroundColor: colors.textPrimary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    gap: 8,
  },
  btnHeaderText: {
    ...typography.body,
    color: colors.white,
    fontWeight: '700',
  },
  summaryBox: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    padding: 20,
    borderRadius: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: colors.border,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  h1: {
    ...typography.h1,
    color: colors.textPrimary,
  },
  h2: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  caption: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  bodyText: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: 4,
  },
  amountStrong: {
    color: colors.textPrimary,
    fontWeight: '700',
  },
  listContainer: {
    gap: 16,
  },
  card: {
    backgroundColor: colors.surface,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  budgetInfo: {
    flex: 1,
  },
  budgetTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  categoryBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconButton: {
    padding: 8,
    backgroundColor: colors.surfaceMuted,
    borderRadius: 8,
  },
  progressBarBg: {
    height: 6,
    backgroundColor: colors.border,
    borderRadius: 3,
    overflow: 'hidden',
    marginVertical: 12,
  },
  progressBarFill: {
    height: '100%',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  successText: {
    color: colors.success,
    fontWeight: '600',
  },
  dangerText: {
    color: colors.danger,
  },
  loadingWrap: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  emptyCard: {
    backgroundColor: colors.surface,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'flex-end',
  },
  modalWrap: {
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
    alignItems: 'center',
  },
  inputLabel: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: 8,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
    color: colors.textPrimary,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 24,
  },
  categoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  categoryChipText: {
    ...typography.caption,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  btnBase: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnCreate: {
    backgroundColor: colors.success,
  },
  btnCancel: {
    borderWidth: 1,
    borderColor: colors.border,
  },
  btnTextCreate: {
    ...typography.body,
    color: colors.white,
    fontWeight: '700',
  },
  btnTextCancel: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  disabledButton: {
    opacity: 0.6,
  },
});
