import { type ReactNode, useMemo } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { radius, spacing, type AppColors, useThemeColors } from '../theme';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  /** Faz o botão ocupar todo o espaço disponível (flex: 1). */
  fullWidth?: boolean;
  /** Ícone exibido à esquerda do texto. */
  icon?: ReactNode;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

const SIZES: Record<ButtonSize, { minHeight: number; fontSize: number; paddingHorizontal: number }> = {
  sm: { minHeight: 40, fontSize: 14, paddingHorizontal: spacing.md },
  md: { minHeight: 48, fontSize: 15, paddingHorizontal: spacing.lg },
  lg: { minHeight: 52, fontSize: 16, paddingHorizontal: spacing.xl },
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'lg',
  disabled = false,
  loading = false,
  fullWidth = false,
  icon,
  style,
  accessibilityLabel,
}: ButtonProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const sizeConfig = SIZES[size];
  const isDisabled = Boolean(disabled || loading);

  const spinnerColor = variant === 'secondary' || variant === 'ghost' ? colors.primaryLight : colors.white;
  const textColorStyle =
    variant === 'secondary'
      ? styles.textSecondary
      : variant === 'ghost'
        ? styles.textGhost
        : styles.textOnFilled;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={({ pressed }) => [
        styles.base,
        {
          minHeight: sizeConfig.minHeight,
          paddingHorizontal: sizeConfig.paddingHorizontal,
        },
        styles[variant],
        fullWidth && styles.fullWidth,
        pressed && !isDisabled && styles.pressed,
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={spinnerColor} />
      ) : (
        <View style={styles.content}>
          {icon}
          <Text style={[styles.label, { fontSize: sizeConfig.fontSize }, textColorStyle]}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

const createStyles = (colors: AppColors) =>
  StyleSheet.create({
    base: {
      borderRadius: radius.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    content: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
    },
    fullWidth: {
      flex: 1,
      alignSelf: 'stretch',
    },
    primary: {
      backgroundColor: colors.primaryLight,
    },
    secondary: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    danger: {
      backgroundColor: colors.danger,
    },
    ghost: {
      backgroundColor: 'transparent',
    },
    pressed: {
      opacity: 0.85,
    },
    disabled: {
      opacity: 0.5,
    },
    label: {
      fontWeight: '700',
    },
    textOnFilled: {
      color: colors.white,
    },
    textSecondary: {
      color: colors.textPrimary,
    },
    textGhost: {
      color: colors.primaryLight,
    },
  });
