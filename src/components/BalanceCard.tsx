import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { SummaryStats } from '../types/finance';
import { radius, spacing, typography, type AppColors, useThemeColors } from '../theme';
import { formatCurrencyBRL, HIDDEN_CURRENCY_TEXT } from '../utils/format';

interface BalanceCardProps {
  summary: SummaryStats;
  variationLabel?: string;
  hideAmounts?: boolean;
}

export function BalanceCard({
  summary,
  variationLabel,
  hideAmounts = false,
}: BalanceCardProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const balanceText = hideAmounts ? HIDDEN_CURRENCY_TEXT : formatCurrencyBRL(summary.balance);
  const badgeText = hideAmounts ? 'Oculto' : variationLabel;

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <Text style={styles.label}>Saldo do mes</Text>
        {badgeText ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badgeText}</Text>
          </View>
        ) : null}
      </View>

      <Text style={styles.balanceValue}>{balanceText}</Text>
      <Text style={styles.metaText}>{summary.updatedAtLabel}</Text>
    </View>
  );
}

const createStyles = (colors: AppColors) => StyleSheet.create({
  card: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    padding: spacing.lg,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 3,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  label: {
    ...typography.body,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '600',
  },
  badge: {
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  badgeText: {
    ...typography.caption,
    color: colors.white,
    fontWeight: '600',
  },
  balanceValue: {
    ...typography.h1,
    color: colors.white,
    marginTop: spacing.md,
  },
  metaText: {
    ...typography.caption,
    color: 'rgba(255,255,255,0.8)',
    marginTop: spacing.sm,
  },
});
