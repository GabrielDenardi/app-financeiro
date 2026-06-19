import { useMemo } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { radius, spacing, typography, type AppColors, useThemeColors } from '../theme';

export type BadgeTone = 'neutral' | 'primary' | 'success' | 'danger' | 'warning';

interface BadgeProps {
  label: string;
  tone?: BadgeTone;
  style?: StyleProp<ViewStyle>;
}

export function Badge({ label, tone = 'neutral', style }: BadgeProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const toneStyle = TONE_STYLES(colors)[tone];

  return (
    <View style={[styles.badge, { backgroundColor: toneStyle.bg }, style]}>
      <Text style={[styles.label, { color: toneStyle.fg }]}>{label}</Text>
    </View>
  );
}

const TONE_STYLES = (colors: AppColors): Record<BadgeTone, { bg: string; fg: string }> => ({
  neutral: { bg: colors.mutedSurface, fg: colors.textSecondary },
  primary: { bg: colors.primarySoft, fg: colors.primary },
  success: { bg: colors.successSoft, fg: colors.success },
  danger: { bg: colors.dangerSoft, fg: colors.danger },
  warning: { bg: colors.warningSoft, fg: colors.textPrimary },
});

const createStyles = (colors: AppColors) =>
  StyleSheet.create({
    badge: {
      alignSelf: 'flex-start',
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
      borderRadius: radius.sm,
    },
    label: {
      ...typography.caption,
      fontWeight: '700',
    },
  });
