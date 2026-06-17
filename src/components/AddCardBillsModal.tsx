import { useEffect, useMemo, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Check, ChevronRight } from "lucide-react-native";

import type {
  CreditCard,
  RecordCardChargeInput,
} from "../features/cards/types";
import type { FinanceCategory } from "../features/transactions/types";
import {
  radius,
  spacing,
  typography,
  type AppColors,
  useThemeColors,
} from "../theme";
import { BottomSheet } from "./BottomSheet";
import { Button } from "./Button";
import { Chip } from "./Chip";
import { FieldCard, FieldDivider, FieldRow } from "./FormField";

const INSTALLMENT_OPTIONS = [
  "A vista",
  "2x",
  "3x",
  "4x",
  "5x",
  "6x",
  "7x",
  "8x",
  "9x",
  "10x",
  "11x",
  "12x",
];

type AddCardBillsModalProps = {
  visible: boolean;
  cards: CreditCard[];
  categories: FinanceCategory[];
  submitting?: boolean;
  onClose: () => void;
  onSubmit: (input: RecordCardChargeInput) => Promise<void> | void;
};

function formatCurrencyInput(value: string) {
  const digits = value.replace(/\D/g, "");
  const numeric = Number(digits || "0") / 100;

  return numeric.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function parseCurrencyInput(value: string) {
  return Number(value.replace(/\./g, "").replace(",", ".") || 0);
}

export function AddCardBillsModal({
  visible,
  cards,
  categories,
  submitting = false,
  onClose,
  onSubmit,
}: AddCardBillsModalProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const expenseCategories = useMemo(
    () => categories.filter((category) => category.kind !== "income"),
    [categories],
  );
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [selectedCardId, setSelectedCardId] = useState(cards[0]?.id ?? "");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(
    expenseCategories[0]?.id ?? null,
  );
  const [installment, setInstallment] = useState("A vista");
  const [purchaseDate, setPurchaseDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (visible) {
      if (!selectedCardId) {
        setSelectedCardId(cards[0]?.id ?? "");
      }
      if (!selectedCategoryId) {
        setSelectedCategoryId(expenseCategories[0]?.id ?? null);
      }
      return;
    }

    setTitle("");
    setAmount("");
    setSelectedCardId(cards[0]?.id ?? "");
    setSelectedCategoryId(expenseCategories[0]?.id ?? null);
    setInstallment("A vista");
    setPurchaseDate(new Date());
    setShowDatePicker(false);
    setNotes("");
  }, [cards, expenseCategories, selectedCardId, selectedCategoryId, visible]);

  const installmentCount =
    installment === "A vista" ? 1 : Number(installment.replace("x", "")) || 1;
  const numericAmount = parseCurrencyInput(amount);

  const handleSave = async () => {
    await onSubmit({
      cardId: selectedCardId,
      title: title.trim(),
      totalAmount: numericAmount,
      categoryId: selectedCategoryId,
      purchaseDate: purchaseDate.toISOString().slice(0, 10),
      installmentCount,
      notes: notes.trim() || undefined,
    });
  };

  const renderInstallmentSchedule = () => {
    if (installmentCount <= 1 || !numericAmount) {
      return null;
    }

    const installmentValue = numericAmount / installmentCount;

    return (
      <View style={styles.installmentContainer}>
        <View style={styles.summaryBox}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Valor total</Text>
            <Text style={styles.summaryValueBold}>R$ {amount}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Por parcela</Text>
            <Text style={styles.summaryValueBlue}>
              {installmentCount}x de R${" "}
              {installmentValue.toLocaleString("pt-BR", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </Text>
          </View>
        </View>
        <Text style={styles.scheduleTitle}>Cronograma</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.scheduleScroll}
        >
          {Array.from({ length: installmentCount }).map((_, index) => {
            const dueDate = new Date(purchaseDate);
            dueDate.setMonth(purchaseDate.getMonth() + index);
            const monthLabel = dueDate
              .toLocaleString("pt-BR", { month: "short" })
              .replace(".", "")
              .concat(`/${String(dueDate.getFullYear()).slice(-2)}`);

            return (
              <View
                key={`${monthLabel}-${index + 1}`}
                style={styles.scheduleCard}
              >
                <Text style={styles.scheduleNumber}>
                  {index + 1}/{installmentCount}
                </Text>
                <Text style={styles.scheduleValue}>
                  R${" "}
                  {installmentValue.toLocaleString("pt-BR", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </Text>
                <Text style={styles.scheduleMonth}>{monthLabel}</Text>
              </View>
            );
          })}
        </ScrollView>
      </View>
    );
  };

  const saveDisabled =
    !title.trim() ||
    !amount.trim() ||
    numericAmount <= 0 ||
    !Number.isFinite(numericAmount) ||
    !selectedCardId ||
    !selectedCategoryId;

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Lançar Despesa"
      subtitle="Registre um gasto no seu cartão"
      maxHeightRatio={0.9}
      footer={(close) => (
        <>
          <Button
            label="Cancelar"
            variant="secondary"
            fullWidth
            onPress={close}
          />
          <Button
            label="Confirmar"
            fullWidth
            onPress={handleSave}
            disabled={saveDisabled}
            loading={submitting}
          />
        </>
      )}
    >
      <Text style={styles.inputLabel}>Escolha o Cartão</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.horizontalScroll}
        contentContainerStyle={styles.horizontalScrollContent}
      >
        {cards.map((card) => {
          const selected = selectedCardId === card.id;

          return (
            <Chip
              key={card.id}
              label={card.name}
              selected={selected}
              activeColor={card.color}
              dotColor={card.color}
              onPress={() => setSelectedCardId(card.id)}
              trailingIcon={
                selected ? <Check size={14} color={card.color} /> : undefined
              }
            />
          );
        })}
      </ScrollView>

      <FieldCard>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Valor</Text>
          <TextInput
            placeholder="R$ 0,00"
            keyboardType="number-pad"
            placeholderTextColor={colors.textSecondary}
            style={styles.amountInput}
            value={amount}
            onChangeText={(text) => setAmount(formatCurrencyInput(text))}
          />
        </View>
        <FieldDivider />
        <TouchableOpacity
          style={styles.infoRow}
          onPress={() => setShowDatePicker(true)}
        >
          <Text style={styles.infoLabel}>Data</Text>
          <View style={styles.valueWithIcon}>
            <Text style={styles.infoValue}>
              {purchaseDate.toLocaleDateString("pt-BR")}
            </Text>
            <ChevronRight size={18} color={colors.textSecondary} />
          </View>
        </TouchableOpacity>
      </FieldCard>

      <View style={styles.mutedCard}>
        <Text style={styles.mutedCardHeader}>Detalhes da Fatura</Text>
        <Text style={styles.sectionLabelMini}>Categoria</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.miniChipScroll}
        >
          {expenseCategories.map((category) => {
            const selected = selectedCategoryId === category.id;

            return (
              <TouchableOpacity
                key={category.id}
                onPress={() => setSelectedCategoryId(category.id)}
                style={[
                  styles.miniChip,
                  selected && {
                    backgroundColor: `${category.color}20`,
                    borderColor: category.color,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.miniChipText,
                    selected && {
                      color: category.color,
                      fontWeight: "700",
                    },
                  ]}
                >
                  {category.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <Text style={[styles.sectionLabelMini, styles.installmentLabel]}>
          Parcelas
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.miniChipScroll}
        >
          {INSTALLMENT_OPTIONS.map((option) => {
            const selected = installment === option;

            return (
              <TouchableOpacity
                key={option}
                onPress={() => setInstallment(option)}
                style={[
                  styles.miniChip,
                  selected && {
                    borderColor: colors.primaryLight,
                    backgroundColor: colors.primarySoft,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.miniChipText,
                    selected && {
                      color: colors.primaryLight,
                      fontWeight: "700",
                    },
                  ]}
                >
                  {option}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {renderInstallmentSchedule()}

      <View style={styles.descriptionContainer}>
        <Text style={styles.descriptionHeader}>Descrição</Text>
        <TextInput
          multiline
          placeholder="Adicione uma descrição..."
          placeholderTextColor={colors.textSecondary}
          style={styles.descriptionInput}
          value={title}
          onChangeText={setTitle}
        />
      </View>

      <View style={styles.descriptionContainer}>
        <Text style={styles.descriptionHeader}>Observações</Text>
        <TextInput
          multiline
          placeholder="Opcional"
          placeholderTextColor={colors.textSecondary}
          style={styles.descriptionInput}
          value={notes}
          onChangeText={setNotes}
        />
      </View>

      <View style={styles.bottomSpacer} />

      {showDatePicker ? (
        <DateTimePicker
          value={purchaseDate}
          mode="date"
          display="default"
          onChange={(_event, selectedDate) => {
            setShowDatePicker(false);
            if (selectedDate) {
              setPurchaseDate(selectedDate);
            }
          }}
        />
      ) : null}
    </BottomSheet>
  );
}

const createStyles = (colors: AppColors) =>
  StyleSheet.create({
    inputLabel: {
      ...typography.caption,
      color: colors.textSecondary,
      marginBottom: spacing.md,
      textTransform: "uppercase",
      fontWeight: "700",
    },
    horizontalScroll: {
      marginHorizontal: -spacing.xl,
      marginBottom: spacing.xl,
    },
    horizontalScrollContent: {
      paddingHorizontal: spacing.xl,
      gap: spacing.sm,
    },
    infoRow: {
      minHeight: 56,
      paddingHorizontal: spacing.lg,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: spacing.md,
    },
    infoLabel: {
      ...typography.body,
      color: colors.textPrimary,
      fontWeight: "600",
    },
    amountInput: {
      fontSize: 20,
      lineHeight: 26,
      fontWeight: "700",
      color: colors.textPrimary,
      minWidth: 120,
      textAlign: "right",
    },
    valueWithIcon: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },
    infoValue: {
      ...typography.body,
      color: colors.textSecondary,
      fontWeight: "600",
    },
    mutedCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.lg,
      marginTop: spacing.lg,
    },
    mutedCardHeader: {
      ...typography.body,
      color: colors.textPrimary,
      fontWeight: "700",
      marginBottom: spacing.md,
    },
    sectionLabelMini: {
      ...typography.caption,
      color: colors.textSecondary,
      fontWeight: "700",
    },
    installmentLabel: {
      marginTop: spacing.lg,
    },
    miniChipScroll: {
      marginTop: spacing.md,
    },
    miniChip: {
      paddingHorizontal: spacing.md,
      minHeight: 36,
      borderRadius: radius.md,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      justifyContent: "center",
      marginRight: spacing.sm,
    },
    miniChipText: {
      ...typography.caption,
      color: colors.textPrimary,
      fontWeight: "600",
    },
    installmentContainer: {
      marginTop: spacing.lg,
    },
    summaryBox: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.lg,
    },
    summaryRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      gap: spacing.md,
    },
    summaryLabel: {
      ...typography.caption,
      color: colors.textSecondary,
      fontWeight: "600",
    },
    summaryValueBold: {
      ...typography.body,
      color: colors.textPrimary,
      fontWeight: "700",
    },
    summaryValueBlue: {
      ...typography.body,
      color: colors.primaryLight,
      fontWeight: "700",
    },
    scheduleTitle: {
      ...typography.body,
      color: colors.textPrimary,
      fontWeight: "700",
      marginTop: spacing.lg,
      marginBottom: spacing.md,
    },
    scheduleScroll: {
      marginHorizontal: -spacing.xl,
      paddingHorizontal: spacing.xl,
    },
    scheduleCard: {
      width: 120,
      padding: spacing.lg,
      borderRadius: radius.lg,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      marginRight: spacing.md,
    },
    scheduleNumber: {
      ...typography.caption,
      color: colors.textSecondary,
      fontWeight: "700",
    },
    scheduleValue: {
      ...typography.body,
      color: colors.textPrimary,
      fontWeight: "700",
      marginTop: spacing.sm,
    },
    scheduleMonth: {
      ...typography.caption,
      color: colors.primaryLight,
      fontWeight: "700",
      marginTop: spacing.sm,
    },
    descriptionContainer: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.lg,
      marginTop: spacing.lg,
    },
    descriptionHeader: {
      ...typography.body,
      color: colors.textPrimary,
      fontWeight: "700",
      marginBottom: spacing.md,
    },
    descriptionInput: {
      minHeight: 96,
      textAlignVertical: "top",
      ...typography.body,
      color: colors.textPrimary,
    },
    bottomSpacer: {
      height: 140,
    },
  });
