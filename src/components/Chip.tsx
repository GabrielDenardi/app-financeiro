import { type ReactNode, useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, type StyleProp, type ViewStyle } from 'react-native';

import { radius, spacing, typography, type AppColors, useThemeColors } from '../theme';

interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  /** Ícone à esquerda do texto. */
  icon?: ReactNode;
  /** Ícone à direita (ex.: check quando selecionado). */
  trailingIcon?: ReactNode;
  /** Pequeno ponto colorido à esquerda (ex.: cor do banco). */
  dotColor?: string;
  /** Cor de destaque quando selecionado (sobrescreve o primário do tema). */
  activeColor?: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Chip({
  label,
  selected = false,
  onPress,
  icon,
  trailingIcon,
  dotColor,
  activeColor,
  disabled = false,
  style,
}: ChipProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const selectedStyle = selected
    ? activeColor
      ? { borderColor: activeColor, backgroundColor: `${activeColor}10` }
      : styles.selected
    : null;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.8}
      style={[styles.chip, selectedStyle, disabled && styles.disabled, style]}
    >
      {dotColor ? <View style={[styles.dot, { backgroundColor: dotColor }]} /> : null}
      {icon}
      <Text style={[styles.label, selected && (activeColor ? { color: activeColor } : styles.labelSelected)]}>
        {label}
      </Text>
      {trailingIcon}
    </TouchableOpacity>
  );
}

const createStyles = (colors: AppColors) =>
  StyleSheet.create({
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingHorizontal: spacing.lg,
      height: 44,
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    selected: {
      borderColor: colors.primary,
      backgroundColor: colors.primarySoft,
    },
    disabled: {
      opacity: 0.4,
    },
    dot: {
      width: 8,
      height: 8,
      borderRadius: radius.pill,
    },
    label: {
      ...typography.body,
      color: colors.textSecondary,
      fontWeight: '600',
    },
    labelSelected: {
      color: colors.primary,
      fontWeight: '700',
    },
  });
