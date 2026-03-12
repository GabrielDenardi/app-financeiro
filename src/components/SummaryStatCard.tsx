import { useMemo } from 'react';
import { Ionicons } from '@expo/vector-icons';
import type { StyleProp, ViewStyle } from 'react-native';
import { StyleSheet, Text, View } from 'react-native';

import { Card } from './Card';
import type { EntryType } from '../types/finance';
import { radius, spacing, typography, type AppColors, useThemeColors } from '../theme';
import { formatCurrencyBRL, HIDDEN_CURRENCY_TEXT } from '../utils/format';

interface SummaryStatCardProps {
  label: string;
  amount: number;
  type: EntryType;
  style?: StyleProp<ViewStyle>;
  hideAmounts?: boolean;
}

export function SummaryStatCard({
  label,
  amount,
  type,
  style,
  hideAmounts = false,
}: SummaryStatCardProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isIncome = type === 'income';
  const toneColor = isIncome ? colors.success : colors.danger;
  const iconName = isIncome ? 'trending-up' : 'trending-down';
  const amountText = hideAmounts ? HIDDEN_CURRENCY_TEXT : formatCurrencyBRL(amount);

  return (
    <Card style={style}>
      <View style={styles.header}>
        <Text style={styles.label}>{label}</Text>
        <View style={[styles.iconBubble, { backgroundColor: `${toneColor}14` }]}>
          <Ionicons name={iconName} size={16} color={toneColor} />
        </View>
      </View>

      <Text style={[styles.amount, { color: toneColor }]} numberOfLines={1}>
        {amountText}
      </Text>
      <Text style={styles.caption}>No mes atual</Text>
    </Card>
  );
}

const createStyles = (colors: AppColors) => StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  label: {
    ...typography.body,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  iconBubble: {
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  amount: {
    ...typography.value,
    marginTop: spacing.md,
  },
  caption: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
});
