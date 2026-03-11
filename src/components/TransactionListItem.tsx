import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import type { RecentTransaction } from '../types/finance';
import { colors, radius, spacing, typography } from '../theme';
import {
  formatHiddenSignedCurrencyBRL,
  formatShortDate,
  formatSignedCurrencyBRL,
} from '../utils/format';

interface TransactionListItemProps {
  item: RecentTransaction;
  showDivider?: boolean;
  hideAmounts?: boolean;
}

export function TransactionListItem({
  item,
  showDivider = false,
  hideAmounts = false,
}: TransactionListItemProps) {
  const isIncome = item.type === 'income';
  const toneColor = isIncome ? colors.success : colors.danger;
  const iconName = isIncome ? 'trending-up-outline' : 'trending-down-outline';
  const amountText = hideAmounts
    ? formatHiddenSignedCurrencyBRL(item.type)
    : formatSignedCurrencyBRL(item.amount, item.type);

  return (
    <View>
      <View style={styles.row}>
        <View style={styles.leftBlock}>
          <View style={[styles.iconContainer, { backgroundColor: `${toneColor}14` }]}>
            <Ionicons name={iconName} size={16} color={toneColor} />
          </View>

          <View style={styles.texts}>
            <Text style={styles.title} numberOfLines={1}>
              {item.title}
            </Text>
            <View style={styles.metaRow}>
              <Text style={styles.categoryChip} numberOfLines={1}>
                {item.category}
              </Text>
              <Text style={styles.dateText}>{formatShortDate(item.dateISO ?? item.occurredOn ?? '')}</Text>
            </View>
          </View>
        </View>

        <Text style={[styles.amountText, { color: toneColor }]} numberOfLines={1}>
          {amountText}
        </Text>
      </View>

      {showDivider ? <View style={styles.divider} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  leftBlock: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minWidth: 0,
  },
  iconContainer: {
    width: 34,
    height: 34,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  texts: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  categoryChip: {
    ...typography.caption,
    color: colors.textSecondary,
    backgroundColor: colors.mutedSurface,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    overflow: 'hidden',
    maxWidth: 110,
  },
  dateText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  amountText: {
    ...typography.body,
    fontWeight: '700',
    flexShrink: 0,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: spacing.lg,
  },
});
