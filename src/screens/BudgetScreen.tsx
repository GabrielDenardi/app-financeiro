import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Pencil, PiggyBank, Plus, Trash2 } from "lucide-react-native";
import { useNavigation, useRoute } from "@react-navigation/native";

import { PageHeader } from "../components/PageHeader";
import { PageShell } from "../components/PageShell";
import { BottomSheet } from "../components/BottomSheet";
import { Button } from "../components/Button";
import { Chip } from "../components/Chip";
import { FieldCard, FieldRow } from "../components/FormField";
import { useAuthenticatedUser } from "../features/auth/hooks/useAuthenticatedUser";
import {
  useBudgets,
  useDeleteBudgetMutation,
  useUpsertBudgetMutation,
} from "../features/budgets/hooks/useBudgets";
import {
  formatCurrencyInput,
  formatMonthDate,
  monthLabel,
  normalizeCurrencyInput,
} from "../features/finance/utils";
import { useFinanceCategories } from "../features/transactions/hooks/useTransactions";
import {
  radius,
  spacing,
  typography,
  type AppColors,
  useThemeColors,
} from "../theme";
import { formatCurrencyBRL } from "../utils/format";

export default function BudgetsScreen() {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const currentUser = useAuthenticatedUser();
  const monthDate = formatMonthDate();
  const budgetsQuery = useBudgets(currentUser?.id, monthDate);
  const categoriesQuery = useFinanceCategories(currentUser?.id);
  const upsertBudgetMutation = useUpsertBudgetMutation(currentUser?.id);
  const deleteBudgetMutation = useDeleteBudgetMutation(currentUser?.id);

  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [limitAmount, setLimitAmount] = useState("");

  const expenseCategories = useMemo(
    () =>
      (categoriesQuery.data ?? []).filter(
        (category) => category.kind !== "income",
      ),
    [categoriesQuery.data],
  );
  const showBackButton = route.name === "Budgets";

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
    setLimitAmount("");
  };

  const handleEdit = (
    budget: NonNullable<typeof budgetsQuery.data>[number],
  ) => {
    setEditingId(budget.id);
    setSelectedCategoryId(budget.categoryId);
    setLimitAmount(
      budget.limitAmount.toLocaleString("pt-BR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    );
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!selectedCategoryId) {
      Alert.alert("Erro", "Selecione uma categoria.");
      return;
    }

    const parsedAmount = normalizeCurrencyInput(limitAmount);
    if (parsedAmount <= 0) {
      Alert.alert("Erro", "Informe um valor maior que zero.");
      return;
    }

    try {
      await upsertBudgetMutation.mutateAsync({
        id: editingId ?? undefined,
        categoryId: selectedCategoryId,
        limitAmount: parsedAmount,
        monthDate,
      });
      closeModal();
    } catch (error) {
      Alert.alert(
        "Erro",
        error instanceof Error
          ? error.message
          : "Não foi possível salvar o orçamento.",
      );
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteBudgetMutation.mutateAsync(id);
    } catch (error) {
      Alert.alert(
        "Erro",
        error instanceof Error
          ? error.message
          : "Não foi possível excluir o orçamento.",
      );
    }
  };

  return (
    <>
      <PageShell withTabBarInset>
        <PageHeader
          title="Orçamentos"
          subtitle={monthLabel(monthDate)}
          variant="primary"
          onBackPress={showBackButton ? () => navigation.goBack() : undefined}
          action={
            <Button
              label="Novo"
              size="sm"
              icon={<Plus size={16} color={colors.white} />}
              onPress={() => setModalVisible(true)}
            />
          }
        />

        <View style={styles.summaryBox}>
          <View style={styles.summaryItem}>
            <Text style={styles.caption}>Total Orçado</Text>
            <Text style={styles.h1}>{formatCurrencyBRL(totals.limit)}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.caption}>Total Gasto</Text>
            <Text
              style={[
                styles.h1,
                totals.spent > totals.limit && styles.dangerText,
              ]}
            >
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
                        <View
                          style={[
                            styles.categoryBadge,
                            { backgroundColor: `${item.categoryColor}18` },
                          ]}
                        >
                          <PiggyBank size={16} color={item.categoryColor} />
                        </View>
                        <Text style={styles.h2}>{item.categoryLabel}</Text>
                      </View>
                      <Text style={styles.bodyText}>
                        <Text
                          style={[
                            styles.amountStrong,
                            isOverLimit && styles.dangerText,
                          ]}
                        >
                          {formatCurrencyBRL(item.spentAmount)}
                        </Text>
                        {" / "}
                        {formatCurrencyBRL(item.limitAmount)}
                      </Text>
                    </View>

                    <View style={styles.actionButtons}>
                      <Pressable
                        onPress={() => handleEdit(item)}
                        style={styles.iconButton}
                      >
                        <Pencil size={18} color={colors.primaryLight} />
                      </Pressable>
                      <Pressable
                        onPress={() => handleDelete(item.id)}
                        style={styles.iconButton}
                      >
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
                          backgroundColor: isOverLimit
                            ? colors.danger
                            : item.categoryColor,
                        },
                      ]}
                    />
                  </View>

                  <View style={styles.cardFooter}>
                    <Text style={styles.caption}>
                      {Math.round(item.progressPercent)}% usado
                    </Text>
                    <Text
                      style={[
                        styles.caption,
                        item.progressPercent >= 80
                          ? styles.dangerText
                          : styles.successText,
                      ]}
                    >
                      Restam {formatCurrencyBRL(item.remainingAmount)}
                    </Text>
                  </View>
                </View>
              );
            })
          ) : (
            <View style={styles.emptyCard}>
              <Text style={styles.bodyText}>
                Crie o primeiro limite mensal por categoria para acompanhar seus
                gastos.
              </Text>
            </View>
          )}
        </View>
      </PageShell>

      <BottomSheet
        visible={modalVisible}
        onClose={closeModal}
        title={editingId ? "Editar Orçamento" : "Novo Orçamento"}
        footer={(close) => (
          <>
            <Button label="Cancelar" variant="secondary" fullWidth onPress={close} />
            <Button
              label={editingId ? "Salvar" : "Criar"}
              fullWidth
              onPress={handleSave}
              disabled={!selectedCategoryId}
              loading={upsertBudgetMutation.isPending}
            />
          </>
        )}
      >
        <FieldCard>
          <FieldRow
            label="Limite Mensal"
            prefix="R$"
            placeholder="0,00"
            keyboardType="decimal-pad"
            value={limitAmount}
            onChangeText={(value) => setLimitAmount(formatCurrencyInput(value))}
          />
        </FieldCard>

        <Text style={styles.inputLabel}>Categoria</Text>
        <View style={styles.chipsWrap}>
          {expenseCategories.map((category) => (
            <Chip
              key={category.id}
              label={category.label}
              selected={selectedCategoryId === category.id}
              activeColor={category.color}
              onPress={() => setSelectedCategoryId(category.id)}
            />
          ))}
        </View>

        <View style={styles.bottomSpacer} />
      </BottomSheet>
    </>
  );
}

const createStyles = (colors: AppColors) =>
  StyleSheet.create({
    summaryBox: {
      flexDirection: "row",
      backgroundColor: colors.surface,
      padding: spacing.lg,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
    },
    summaryItem: {
      flex: 1,
      alignItems: "center",
    },
    h1: {
      ...typography.h2,
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
      textAlign: "center",
    },
    amountStrong: {
      color: colors.textPrimary,
      fontWeight: "700",
    },
    listContainer: {
      gap: spacing.md,
    },
    card: {
      backgroundColor: colors.surface,
      padding: spacing.lg,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
    },
    cardHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      gap: spacing.md,
    },
    budgetInfo: {
      flex: 1,
    },
    budgetTitleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },
    categoryBadge: {
      width: 32,
      height: 32,
      borderRadius: radius.pill,
      alignItems: "center",
      justifyContent: "center",
    },
    actionButtons: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },
    iconButton: {
      padding: spacing.sm,
      backgroundColor: colors.surfaceMuted,
      borderRadius: radius.sm,
    },
    progressBarBg: {
      height: 6,
      backgroundColor: colors.border,
      borderRadius: radius.pill,
      overflow: "hidden",
      marginVertical: spacing.md,
    },
    progressBarFill: {
      height: "100%",
    },
    cardFooter: {
      flexDirection: "row",
      justifyContent: "space-between",
    },
    successText: {
      color: colors.success,
      fontWeight: "600",
    },
    dangerText: {
      color: colors.danger,
    },
    loadingWrap: {
      paddingVertical: spacing.xl,
      alignItems: "center",
    },
    emptyCard: {
      backgroundColor: colors.surface,
      padding: spacing.lg,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
    },
    inputLabel: {
      ...typography.caption,
      fontWeight: "700",
      color: colors.textSecondary,
      marginTop: spacing.lg,
      marginBottom: spacing.sm,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    chipsWrap: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm,
    },
    bottomSpacer: {
      height: spacing.lg,
    },
  });
