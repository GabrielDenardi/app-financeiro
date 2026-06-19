import { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { ArrowLeftRight, RefreshCw } from "lucide-react-native";

import type {
  AccountBalanceSnapshot,
  CreateTransferInput,
} from "../features/accounts/types";
import { formatCurrencyInput, normalizeCurrencyInput } from "../features/finance/utils";
import { radius, spacing, typography, type AppColors, useThemeColors } from "../theme";
import { BottomSheet } from "./BottomSheet";
import { Button } from "./Button";
import { Chip } from "./Chip";

type TransferModalProps = {
  visible: boolean;
  accounts: AccountBalanceSnapshot[];
  submitting?: boolean;
  onClose: () => void;
  onSubmit: (input: CreateTransferInput) => Promise<void> | void;
};

export function TransferModal({
  visible,
  accounts,
  submitting = false,
  onClose,
  onSubmit,
}: TransferModalProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const activeAccounts = useMemo(
    () => accounts.filter((account) => account.isActive),
    [accounts],
  );
  const [amount, setAmount] = useState("");
  const [fromAccountId, setFromAccountId] = useState("");
  const [toAccountId, setToAccountId] = useState("");

  useEffect(() => {
    if (visible) {
      if (!fromAccountId) {
        setFromAccountId(activeAccounts[0]?.id ?? "");
      }
      if (!toAccountId) {
        setToAccountId(activeAccounts[1]?.id ?? activeAccounts[0]?.id ?? "");
      }
      return;
    }

    setAmount("");
    setFromAccountId(activeAccounts[0]?.id ?? "");
    setToAccountId(activeAccounts[1]?.id ?? activeAccounts[0]?.id ?? "");
  }, [activeAccounts, fromAccountId, toAccountId, visible]);

  const selectedFrom = activeAccounts.find(
    (account) => account.id === fromAccountId,
  );
  const selectedTo = activeAccounts.find(
    (account) => account.id === toAccountId,
  );

  const handleTransfer = async () => {
    await onSubmit({
      fromAccountId,
      toAccountId,
      amount: normalizeCurrencyInput(amount),
    });
  };

  const swapAccounts = () => {
    setFromAccountId(toAccountId);
    setToAccountId(fromAccountId);
  };

  const saveDisabled =
    !amount.trim() ||
    normalizeCurrencyInput(amount) <= 0 ||
    !Number.isFinite(normalizeCurrencyInput(amount)) ||
    !fromAccountId ||
    !toAccountId ||
    fromAccountId === toAccountId;

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Transferência"
      subtitle="Mover saldo entre suas contas"
      maxHeightRatio={0.85}
      footer={(close) => (
        <>
          <Button label="Cancelar" variant="secondary" fullWidth onPress={close} />
          <Button
            label="Confirmar"
            fullWidth
            onPress={handleTransfer}
            disabled={saveDisabled}
            loading={submitting}
            icon={<RefreshCw size={18} color={colors.white} />}
          />
        </>
      )}
    >
      <View style={styles.transferFlowCard}>
        <View style={styles.flowItem}>
          <Text style={styles.flowLabel}>De (Origem)</Text>
          <Text style={styles.flowAccountName} numberOfLines={1}>
            {selectedFrom?.name || "Selecionar"}
          </Text>
        </View>

        <TouchableOpacity
          onPress={swapAccounts}
          style={styles.swapButton}
          activeOpacity={0.75}
        >
          <ArrowLeftRight size={18} color={colors.primary} />
        </TouchableOpacity>

        <View style={[styles.flowItem, styles.flowItemRight]}>
          <Text style={styles.flowLabel}>Para (Destino)</Text>
          <Text style={[styles.flowAccountName, styles.rightText]} numberOfLines={1}>
            {selectedTo?.name || "Selecionar"}
          </Text>
        </View>
      </View>

      <Text style={styles.sectionLabel}>Conta de Saída</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.horizontalScroll}
        contentContainerStyle={styles.horizontalScrollContent}
      >
        {activeAccounts.map((account) => (
          <Chip
            key={`from-${account.id}`}
            label={account.name}
            selected={fromAccountId === account.id}
            onPress={() => setFromAccountId(account.id)}
          />
        ))}
      </ScrollView>

      <Text style={styles.sectionLabel}>Conta de Entrada</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.horizontalScroll}
        contentContainerStyle={styles.horizontalScrollContent}
      >
        {activeAccounts.map((account) => (
          <Chip
            key={`to-${account.id}`}
            label={account.name}
            selected={toAccountId === account.id}
            disabled={account.id === fromAccountId}
            onPress={() => setToAccountId(account.id)}
          />
        ))}
      </ScrollView>

      <View style={styles.inputCard}>
        <Text style={styles.inputLabel}>Quanto deseja transferir?</Text>
        <View style={styles.amountContainer}>
          <Text style={styles.currencyPrefix}>R$</Text>
          <TextInput
            placeholder="0,00"
            placeholderTextColor={colors.textSecondary}
            keyboardType="decimal-pad"
            maxLength={10}
            style={styles.amountInput}
            value={amount}
            onChangeText={(value) => setAmount(formatCurrencyInput(value))}
          />
        </View>
      </View>

      <View style={styles.bottomSpacer} />
    </BottomSheet>
  );
}

const createStyles = (colors: AppColors) =>
  StyleSheet.create({
    transferFlowCard: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: colors.surface,
      padding: spacing.xl,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: spacing.xl,
    },
    flowItem: {
      flex: 1,
    },
    flowItemRight: {
      alignItems: "flex-end",
    },
    flowLabel: {
      ...typography.caption,
      color: colors.textSecondary,
      fontWeight: "700",
      textTransform: "uppercase",
      marginBottom: spacing.xs,
      letterSpacing: 0.5,
    },
    flowAccountName: {
      ...typography.body,
      color: colors.textPrimary,
      fontWeight: "700",
    },
    rightText: {
      textAlign: "right",
    },
    swapButton: {
      width: 42,
      height: 42,
      borderRadius: radius.pill,
      backgroundColor: colors.primarySoft,
      alignItems: "center",
      justifyContent: "center",
      marginHorizontal: spacing.md,
      borderColor: colors.border,
      borderWidth: 1,
    },
    sectionLabel: {
      ...typography.caption,
      color: colors.textSecondary,
      marginBottom: spacing.md,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    horizontalScroll: {
      marginHorizontal: -spacing.xl,
      marginBottom: spacing.xl,
    },
    horizontalScrollContent: {
      paddingHorizontal: spacing.xl,
      gap: spacing.sm,
    },
    inputCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.xl,
    },
    inputLabel: {
      ...typography.body,
      color: colors.textSecondary,
      fontWeight: "600",
    },
    amountContainer: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: spacing.md,
    },
    currencyPrefix: {
      fontSize: 24,
      lineHeight: 30,
      fontWeight: "700",
      color: colors.textPrimary,
      marginRight: spacing.sm,
    },
    amountInput: {
      fontSize: 28,
      lineHeight: 34,
      fontWeight: "700",
      color: colors.textPrimary,
      flex: 1,
    },
    bottomSpacer: {
      height: 140,
    },
  });
