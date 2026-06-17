import { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Check, CreditCard } from "lucide-react-native";

import type { CreateCardInput } from "../features/cards/types";
import { radius, spacing, typography, type AppColors, useThemeColors } from "../theme";
import { BottomSheet } from "./BottomSheet";
import { Button } from "./Button";
import { Chip } from "./Chip";
import { FieldCard, FieldDivider, FieldRow } from "./FormField";

const POPULAR_BANKS = [
  { id: "nubank", name: "Nubank", color: "#8A05BE" },
  { id: "inter", name: "Inter", color: "#FF7A00" },
  { id: "itau", name: "Itaú", color: "#EC7000" },
  { id: "bradesco", name: "Bradesco", color: "#CC092F" },
  { id: "santander", name: "Santander", color: "#EC0000" },
  { id: "c6", name: "C6 Bank", color: "#212121" },
];

const NETWORKS = ["Visa", "Mastercard", "Elo"];
const CARD_COLORS = [
  "#8A05BE",
  "#FF7A00",
  "#1E3A8A",
  "#DC2626",
  "#16A34A",
  "#0F172A",
];

type AddCardModalProps = {
  visible: boolean;
  submitting?: boolean;
  onClose: () => void;
  onSubmit: (input: CreateCardInput) => Promise<void> | void;
};

function parseCurrencyInput(value: string) {
  return Number(value.replace(/\./g, "").replace(",", ".") || 0);
}

function gradientForColor(baseColor: string): [string, string] {
  if (baseColor === "#0F172A") {
    return ["#334155", "#0F172A"];
  }

  return [baseColor, `${baseColor}DD`];
}

export function AddCardModal({
  visible,
  submitting = false,
  onClose,
  onSubmit,
}: AddCardModalProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [name, setName] = useState("");
  const [institution, setInstitution] = useState("");
  const [network, setNetwork] = useState("Visa");
  const [limitAmount, setLimitAmount] = useState("");
  const [lastDigits, setLastDigits] = useState("");
  const [closingDay, setClosingDay] = useState("");
  const [dueDay, setDueDay] = useState("");
  const [cardColor, setCardColor] = useState(CARD_COLORS[0]);

  const handleSubmit = async () => {
    await onSubmit({
      name: name.trim(),
      institution: institution.trim(),
      network,
      lastDigits: lastDigits.trim(),
      limitAmount: parseCurrencyInput(limitAmount),
      dueDay: Number(dueDay) || 0,
      closingDay: Number(closingDay) || 0,
      color: cardColor,
    });
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Novo Cartão"
      subtitle="Configure os detalhes do seu cartão"
      footer={(close) => (
        <>
          <Button label="Cancelar" variant="secondary" fullWidth onPress={close} />
          <Button
            label="Criar Cartão"
            fullWidth
            onPress={handleSubmit}
            disabled={!name.trim()}
            loading={submitting}
          />
        </>
      )}
    >
      <View style={styles.previewContainer}>
        <LinearGradient
          colors={gradientForColor(cardColor)}
          style={styles.cardPreview}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.circleDecorationTop} />
          <View style={styles.circleDecorationBottom} />

          <View style={styles.cardHeaderPreview}>
            <View>
              <Text style={styles.cardPreviewInstLabel}>
                {(institution || "INSTITUIÇÃO").toUpperCase()}
              </Text>
              <Text style={styles.cardPreviewNameText}>
                {name || "Nome do Cartão"}
              </Text>
            </View>
            <Text style={styles.cardPreviewNetworkText}>{network}</Text>
          </View>

          <Text style={styles.cardPreviewDigitsText}>
            •••• •••• •••• {lastDigits || "****"}
          </Text>

          <View style={styles.cardPreviewFooter}>
            <View>
              <Text style={styles.cardFooterLabel}>VENCIMENTO</Text>
              <Text style={styles.cardFooterValue}>DIA {dueDay || "--"}</Text>
            </View>
            <View style={styles.previewFooterRight}>
              <Text style={styles.cardFooterLabel}>LIMITE TOTAL</Text>
              <Text style={styles.cardFooterValue}>R$ {limitAmount || "0,00"}</Text>
            </View>
          </View>
        </LinearGradient>
      </View>

      <Text style={styles.sectionLabel}>Cor do Cartão</Text>
      <View style={styles.colorRow}>
        {CARD_COLORS.map((color) => (
          <TouchableOpacity
            key={color}
            style={[styles.colorOption, { backgroundColor: color }]}
            onPress={() => setCardColor(color)}
          >
            {cardColor === color ? <Check size={16} color={colors.white} /> : null}
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.sectionLabel}>Instituição</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.horizontalScroll}
        contentContainerStyle={styles.horizontalScrollContent}
      >
        {POPULAR_BANKS.map((bank) => (
          <Chip
            key={bank.id}
            label={bank.name}
            selected={institution === bank.name}
            activeColor={bank.color}
            dotColor={bank.color}
            onPress={() => {
              setInstitution(bank.name);
              setCardColor(bank.color);
              setName((current) => current || bank.name);
            }}
          />
        ))}
      </ScrollView>

      <Text style={styles.sectionLabel}>Bandeira</Text>
      <View style={styles.networkRow}>
        {NETWORKS.map((option) => {
          const selected = network === option;
          return (
            <Chip
              key={option}
              label={option}
              selected={selected}
              onPress={() => setNetwork(option)}
              icon={
                <CreditCard
                  size={16}
                  color={selected ? colors.primary : colors.textSecondary}
                />
              }
            />
          );
        })}
      </View>

      <FieldCard>
        <FieldRow
          label="Nome do Cartão"
          placeholder="Ex: Nubank Black"
          value={name}
          onChangeText={setName}
        />
        <FieldDivider />
        <FieldRow
          label="Últimos 4 dígitos"
          placeholder="0000"
          keyboardType="number-pad"
          maxLength={4}
          value={lastDigits}
          onChangeText={setLastDigits}
        />
        <FieldDivider />
        <FieldRow
          label="Limite Total"
          prefix="R$"
          placeholder="0,00"
          keyboardType="decimal-pad"
          value={limitAmount}
          onChangeText={setLimitAmount}
        />
      </FieldCard>

      <FieldCard style={styles.secondInputCard}>
        <FieldRow
          label="Dia do Vencimento"
          placeholder="10"
          keyboardType="number-pad"
          maxLength={2}
          value={dueDay}
          onChangeText={setDueDay}
        />
        <FieldDivider />
        <FieldRow
          label="Dia do Fechamento"
          placeholder="03"
          keyboardType="number-pad"
          maxLength={2}
          value={closingDay}
          onChangeText={setClosingDay}
        />
      </FieldCard>

      <View style={styles.bottomSpacer} />
    </BottomSheet>
  );
}

const createStyles = (colors: AppColors) =>
  StyleSheet.create({
    previewContainer: {
      marginBottom: spacing.xl,
    },
    cardPreview: {
      height: 200,
      borderRadius: radius.xl,
      padding: spacing.xl,
      overflow: "hidden",
      justifyContent: "space-between",
    },
    circleDecorationTop: {
      position: "absolute",
      width: 180,
      height: 180,
      borderRadius: radius.pill,
      backgroundColor: "rgba(255,255,255,0.08)",
      top: -70,
      right: -35,
    },
    circleDecorationBottom: {
      position: "absolute",
      width: 140,
      height: 140,
      borderRadius: radius.pill,
      backgroundColor: "rgba(255,255,255,0.08)",
      bottom: -50,
      left: -20,
    },
    cardHeaderPreview: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
    },
    cardPreviewInstLabel: {
      ...typography.caption,
      color: "rgba(255,255,255,0.86)",
      fontWeight: "700",
      letterSpacing: 1,
    },
    cardPreviewNameText: {
      ...typography.h2,
      color: colors.white,
      marginTop: spacing.sm,
    },
    cardPreviewNetworkText: {
      ...typography.body,
      color: colors.white,
      fontWeight: "700",
    },
    cardPreviewDigitsText: {
      fontSize: 18,
      lineHeight: 24,
      fontWeight: "700",
      color: colors.white,
      letterSpacing: 2,
    },
    cardPreviewFooter: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-end",
    },
    previewFooterRight: {
      alignItems: "flex-end",
    },
    cardFooterLabel: {
      ...typography.caption,
      color: "rgba(255,255,255,0.7)",
      fontWeight: "700",
    },
    cardFooterValue: {
      ...typography.body,
      color: colors.white,
      fontWeight: "700",
      marginTop: spacing.xs,
    },
    sectionLabel: {
      ...typography.caption,
      color: colors.textSecondary,
      marginBottom: spacing.md,
      textTransform: "uppercase",
      fontWeight: "700",
      letterSpacing: 0.5,
    },
    colorRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.md,
      marginBottom: spacing.xl,
    },
    colorOption: {
      width: 36,
      height: 36,
      borderRadius: radius.pill,
      alignItems: "center",
      justifyContent: "center",
    },
    horizontalScroll: {
      marginHorizontal: -spacing.xl,
      marginBottom: spacing.xl,
    },
    horizontalScrollContent: {
      paddingHorizontal: spacing.xl,
      gap: spacing.sm,
    },
    networkRow: {
      flexDirection: "row",
      gap: spacing.sm,
      marginBottom: spacing.xl,
    },
    secondInputCard: {
      marginTop: spacing.lg,
    },
    bottomSpacer: {
      height: 140,
    },
  });
