import { useMemo } from 'react';
import { Fuel, HeartPulse, HelpCircle, ShoppingBag, Utensils, Wallet, Zap } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import type { RecentTransaction } from '../types/finance';
import { radius, spacing, typography, type AppColors, useThemeColors } from '../theme';
import { formatHiddenSignedCurrencyBRL, formatShortDate, formatSignedCurrencyBRL } from '../utils/format';

interface TransactionListItemProps {
  item: RecentTransaction;
  showDivider?: boolean;
  hideAmounts?: boolean;
}

function getCategoryIcon(category: string, colors: AppColors) {
  const normalized = category.toLowerCase();

  if (normalized.includes('combustivel') || normalized.includes('transporte')) {
    return <Fuel size={20} color={colors.textSecondary} />;
  }

  if (normalized.includes('alimenta') || normalized.includes('restaurante')) {
    return <Utensils size={20} color={colors.textSecondary} />;
  }

  if (normalized.includes('compras') || normalized.includes('mercado')) {
    return <ShoppingBag size={20} color={colors.textSecondary} />;
  }

  if (normalized.includes('conta') || normalized.includes('luz')) {
    return <Zap size={20} color={colors.textSecondary} />;
  }

  if (normalized.includes('saude') || normalized.includes('farmacia')) {
    return <HeartPulse size={20} color={colors.textSecondary} />;
  }

  if (normalized.includes('salario') || normalized.includes('receita')) {
    return <Wallet size={20} color={colors.textSecondary} />;
  }

  return <HelpCircle size={20} color={colors.textSecondary} />;
}

export function TransactionListItem({
  item,
  showDivider = false,
  hideAmounts = false,
}: TransactionListItemProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isIncome = item.type === 'income';
  const amountText = hideAmounts
    ? formatHiddenSignedCurrencyBRL(item.type)
    : formatSignedCurrencyBRL(item.amount, item.type);
  const dateText = item.dateLabel || item.date || formatShortDate(item.dateISO ?? item.occurredOn ?? '');

  return (
    <View>
      <View style={styles.container}>
        <View style={styles.iconContainer}>{getCategoryIcon(item.category, colors)}</View>

        <View style={styles.details}>
          <Text style={styles.title} numberOfLines={1}>
            {item.title}
          </Text>
          <View style={styles.subtitleContainer}>
            <Text style={styles.subtitle}>{dateText}</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText} numberOfLines={1}>
                {item.paymentMethod}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.amountContainer}>
          <Text style={[styles.amount, { color: isIncome ? colors.success : colors.danger }]} numberOfLines={1}>
            {amountText}
          </Text>
          <Text style={styles.category} numberOfLines={1}>
            {item.category}
          </Text>
        </View>
      </View>

      {showDivider ? <View style={styles.divider} /> : null}
    </View>
  );
}

const createStyles = (colors: AppColors) => StyleSheet.create({
  container: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
    gap: spacing.md,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.mutedSurface,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  details: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    ...typography.body,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  subtitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
    gap: spacing.sm,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  badge: {
    backgroundColor: colors.mutedSurface,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textPrimary,
    maxWidth: 88,
  },
  amountContainer: {
    alignItems: 'flex-end',
    flexShrink: 0,
    maxWidth: 120,
  },
  amount: {
    ...typography.body,
    fontWeight: '700',
  },
  category: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: spacing.lg,
  },
});
