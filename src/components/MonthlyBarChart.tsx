import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Card } from './Card';
import type { WeeklyFlowPoint } from '../types/finance';
import { colors, radius, spacing, typography } from '../theme';
import { formatCurrencyBRL, HIDDEN_CURRENCY_TEXT } from '../utils/format';

interface MonthlyBarChartProps {
  data: WeeklyFlowPoint[];
  hideValues?: boolean;
}

type FlowSeries = 'income' | 'expense';

const CHART_HEIGHT = 112;
const MIN_BAR_HEIGHT = 6;
const VALUE_MARKER_HEIGHT = 18;
const VALUE_MARKER_GAP = 4;
const CHART_FOOTER_SPACE = 24;

function getBarHeight(value: number, maxValue: number): number {
  if (value <= 0) {
    return 0;
  }

  const scaled = (value / maxValue) * CHART_HEIGHT;
  return Math.max(MIN_BAR_HEIGHT, Math.round(scaled));
}

function getSeriesMeta(series: FlowSeries) {
  if (series === 'income') {
    return {
      label: 'Entradas',
      color: colors.primaryLight,
    };
  }

  return {
    label: 'Saidas',
    color: colors.danger,
  };
}

function formatBarMarkerValue(value: number): string {
  const abs = Math.abs(value);

  if (abs >= 1_000_000) {
    const compact = (abs / 1_000_000).toLocaleString('pt-BR', {
      maximumFractionDigits: 1,
    });
    return `R$ ${compact}mi`;
  }

  if (abs >= 1_000) {
    const compact = (abs / 1_000).toLocaleString('pt-BR', {
      maximumFractionDigits: 1,
    });
    return `R$ ${compact}k`;
  }

  return `R$ ${Math.round(abs).toLocaleString('pt-BR')}`;
}

export function MonthlyBarChart({ data, hideValues = false }: MonthlyBarChartProps) {
  const [activeSeries, setActiveSeries] = useState<FlowSeries>('income');

  const seriesValues = data.map((point) => (activeSeries === 'income' ? point.income : point.expense));
  const maxValue = Math.max(...seriesValues, 1);
  const totalValue = seriesValues.reduce((sum, value) => sum + value, 0);
  const seriesMeta = getSeriesMeta(activeSeries);
  const totalText = hideValues ? HIDDEN_CURRENCY_TEXT : formatCurrencyBRL(totalValue);

  return (
    <Card>
      <View style={styles.header}>
        <View style={styles.headerTextBlock}>
          <Text style={styles.title}>Fluxo mensal</Text>
          <Text style={styles.subtitle}>Semanas do mes</Text>
        </View>

        <View style={styles.seriesPill}>
          <View style={[styles.legendDot, { backgroundColor: seriesMeta.color }]} />
          <Text style={styles.seriesPillText}>{seriesMeta.label}</Text>
        </View>
      </View>

      <View style={styles.summaryRow}>
        <View>
          <Text style={styles.summaryLabel}>Total da serie</Text>
          <Text style={[styles.summaryValue, { color: seriesMeta.color }]}>{totalText}</Text>
        </View>

        <View style={styles.segmentedControl}>
          <Pressable
            accessibilityRole="button"
            onPress={() => setActiveSeries('income')}
            style={({ pressed }) => [
              styles.segmentButton,
              activeSeries === 'income' && styles.segmentButtonActive,
              pressed && styles.segmentPressed,
            ]}
          >
            <Text
              style={[
                styles.segmentLabel,
                activeSeries === 'income' && styles.segmentLabelActive,
              ]}
            >
              Entradas
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={() => setActiveSeries('expense')}
            style={({ pressed }) => [
              styles.segmentButton,
              activeSeries === 'expense' && styles.segmentButtonActive,
              pressed && styles.segmentPressed,
            ]}
          >
            <Text
              style={[
                styles.segmentLabel,
                activeSeries === 'expense' && styles.segmentLabelActive,
              ]}
            >
              Saidas
            </Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.chartContainer}>
        {data.map((point, index) => {
          const value = seriesValues[index] ?? 0;
          const barHeight = getBarHeight(value, maxValue);
          const markerText = hideValues ? 'R$ ***' : formatBarMarkerValue(value);

          return (
            <View key={point.weekLabel} style={styles.weekColumn}>
              <Text style={styles.valueMarker} numberOfLines={1}>
                {markerText}
              </Text>
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.bar,
                    {
                      height: barHeight,
                      backgroundColor: seriesMeta.color,
                    },
                  ]}
                />
              </View>
              <Text style={styles.weekLabel}>{point.weekLabel}</Text>
            </View>
          );
        })}

        {hideValues ? (
          <View pointerEvents="none" style={styles.hiddenOverlay}>
            <Text style={styles.hiddenOverlayText}>Valores ocultos</Text>
          </View>
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
  },
  headerTextBlock: {
    flex: 1,
  },
  title: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  seriesPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.mutedSurface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  seriesPillText: {
    ...typography.caption,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: radius.pill,
  },
  summaryRow: {
    marginTop: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  summaryLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  summaryValue: {
    ...typography.value,
    marginTop: spacing.xs,
    fontSize: 18,
    lineHeight: 24,
  },
  segmentedControl: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.mutedSurface,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 2,
  },
  segmentButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  segmentButtonActive: {
    backgroundColor: colors.surface,
  },
  segmentPressed: {
    opacity: 0.8,
  },
  segmentLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  segmentLabelActive: {
    color: colors.textPrimary,
  },
  chartContainer: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
    height: CHART_HEIGHT + VALUE_MARKER_HEIGHT + VALUE_MARKER_GAP + CHART_FOOTER_SPACE,
    gap: spacing.sm,
  },
  hiddenOverlay: {
    ...StyleSheet.absoluteFillObject,
    top: -VALUE_MARKER_GAP,
    left: -2,
    right: -2,
    bottom: -2,
    backgroundColor: 'rgba(248, 250, 252, 0.9)',
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hiddenOverlayText: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '600',
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  weekColumn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    minWidth: 0,
  },
  valueMarker: {
    ...typography.caption,
    width: '100%',
    height: VALUE_MARKER_HEIGHT,
    textAlign: 'center',
    color: colors.textSecondary,
    fontWeight: '700',
    marginBottom: VALUE_MARKER_GAP,
  },
  barTrack: {
    height: CHART_HEIGHT,
    width: '100%',
    justifyContent: 'flex-end',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  bar: {
    width: '68%',
    borderTopLeftRadius: radius.sm,
    borderTopRightRadius: radius.sm,
    minWidth: 10,
  },
  weekLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    fontWeight: '600',
  },
});
