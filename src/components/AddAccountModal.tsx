import { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import {
  Banknote,
  Building2,
  Check,
  PiggyBank,
  TrendingUp,
  Wallet,
} from "lucide-react-native";

import type {
  AccountType,
  CreateAccountInput,
} from "../features/accounts/types";
import { formatCurrencyInput, normalizeCurrencyInput } from "../features/finance/utils";
import { spacing, typography, type AppColors, useThemeColors } from "../theme";
import { BottomSheet } from "./BottomSheet";
import { Button } from "./Button";
import { Chip } from "./Chip";
import { FieldCard, FieldDivider, FieldRow } from "./FormField";

const ACCOUNT_TYPES: Array<{
  value: AccountType;
  label: string;
  icon: typeof Wallet;
}> = [
  { value: "checking", label: "Corrente", icon: Wallet },
  { value: "savings", label: "Poupança", icon: PiggyBank },
  { value: "investment", label: "Investimento", icon: TrendingUp },
  { value: "cash", label: "Dinheiro", icon: Banknote },
  { value: "other", label: "Outros", icon: Building2 },
];

const POPULAR_BANKS = [
  { id: "nubank", name: "Nubank", color: "#8A05BE" },
  { id: "inter", name: "Inter", color: "#FF7A00" },
  { id: "itau", name: "Itaú", color: "#EC7000" },
  { id: "bradesco", name: "Bradesco", color: "#CC092F" },
  { id: "santander", name: "Santander", color: "#EC0000" },
  { id: "c6", name: "C6 Bank", color: "#212121" },
];

type AddAccountModalProps = {
  visible: boolean;
  submitting?: boolean;
  onClose: () => void;
  onSubmit: (input: CreateAccountInput) => Promise<void> | void;
};

export function AddAccountModal({
  visible,
  submitting = false,
  onClose,
  onSubmit,
}: AddAccountModalProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [name, setName] = useState("");
  const [institution, setInstitution] = useState("");
  const [openingBalance, setOpeningBalance] = useState("");
  const [type, setType] = useState<AccountType>("checking");
  const [selectedColor, setSelectedColor] = useState<string>(
    colors.primaryLight,
  );

  useEffect(() => {
    if (!visible) {
      setName("");
      setInstitution("");
      setOpeningBalance("");
      setType("checking");
      setSelectedColor(colors.primaryLight);
    }
  }, [colors.primaryLight, visible]);

  const handleSubmit = async () => {
    await onSubmit({
      name: name.trim(),
      institution: institution.trim(),
      type,
      openingBalance: normalizeCurrencyInput(openingBalance),
      color: selectedColor,
    });
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Nova Conta"
      subtitle="Configure os detalhes da conta"
      maxHeightRatio={0.85}
      footer={(close) => (
        <>
          <Button label="Cancelar" variant="secondary" fullWidth onPress={close} />
          <Button
            label="Criar Conta"
            fullWidth
            onPress={handleSubmit}
            disabled={!name.trim()}
            loading={submitting}
          />
        </>
      )}
    >
      <Text style={styles.sectionLabel}>Tipo de Conta</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.horizontalScroll}
        contentContainerStyle={styles.horizontalScrollContent}
      >
        {ACCOUNT_TYPES.map((option) => {
          const selected = type === option.value;
          return (
            <Chip
              key={option.value}
              label={option.label}
              selected={selected}
              onPress={() => setType(option.value)}
              icon={
                <option.icon
                  size={18}
                  color={selected ? colors.primary : colors.textSecondary}
                />
              }
            />
          );
        })}
      </ScrollView>

      <Text style={styles.sectionLabel}>Instituições Populares</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.horizontalScroll}
        contentContainerStyle={styles.horizontalScrollContent}
      >
        {POPULAR_BANKS.map((bank) => {
          const selected = institution === bank.name;
          return (
            <Chip
              key={bank.id}
              label={bank.name}
              selected={selected}
              activeColor={bank.color}
              dotColor={bank.color}
              trailingIcon={
                selected ? <Check size={14} color={bank.color} style={styles.checkIcon} /> : undefined
              }
              onPress={() => {
                setInstitution(bank.name);
                setSelectedColor(bank.color);
                setName((current) => current || bank.name);
              }}
            />
          );
        })}
      </ScrollView>

      <FieldCard>
        <FieldRow
          label="Apelido"
          placeholder="Ex: Minha Carteira"
          value={name}
          onChangeText={setName}
        />
        <FieldDivider />
        <FieldRow
          label="Instituição"
          placeholder="Ex: Nubank"
          value={institution}
          onChangeText={setInstitution}
        />
        <FieldDivider />
        <FieldRow
          label="Saldo Inicial"
          prefix="R$"
          placeholder="0,00"
          keyboardType="decimal-pad"
          value={openingBalance}
          onChangeText={(value) => setOpeningBalance(formatCurrencyInput(value))}
        />
      </FieldCard>

      <View style={styles.bottomSpacer} />
    </BottomSheet>
  );
}

const createStyles = (colors: AppColors) =>
  StyleSheet.create({
    sectionLabel: {
      ...typography.caption,
      color: colors.textSecondary,
      marginBottom: spacing.md,
      textTransform: "uppercase",
      fontWeight: "700",
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
    checkIcon: {
      marginLeft: spacing.xs,
    },
    bottomSpacer: {
      height: 120,
    },
  });
