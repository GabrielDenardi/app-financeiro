import { type PropsWithChildren, type ReactNode, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import { radius, spacing, typography, type AppColors, useThemeColors } from '../theme';

/** Cartão com borda que agrupa linhas de campos (`FieldRow`) com divisores. */
export function FieldCard({ children, style }: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return <View style={[styles.card, style]}>{children}</View>;
}

/** Divisor de 1px entre linhas dentro de um `FieldCard`. */
export function FieldDivider() {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return <View style={styles.divider} />;
}

interface FieldRowProps extends Omit<TextInputProps, 'style'> {
  label: string;
  /** Prefixo monetário (ex.: "R$") exibido antes do input. */
  prefix?: string;
  /** Conteúdo customizado no lugar do TextInput (ex.: seletor). */
  trailing?: ReactNode;
  inputStyle?: TextInputProps['style'];
}

/** Linha de campo: rótulo à esquerda, entrada alinhada à direita. */
export function FieldRow({ label, prefix, trailing, inputStyle, ...inputProps }: FieldRowProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      {trailing ?? (
        <View style={styles.inputWrap}>
          {prefix ? <Text style={styles.prefix}>{prefix}</Text> : null}
          <TextInput
            placeholderTextColor={colors.textSecondary}
            textAlign="right"
            {...inputProps}
            style={[styles.input, inputStyle]}
          />
        </View>
      )}
    </View>
  );
}

const createStyles = (colors: AppColors) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    divider: {
      height: 1,
      backgroundColor: colors.border,
      marginHorizontal: spacing.lg,
    },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      minHeight: 56,
      gap: spacing.md,
    },
    label: {
      ...typography.body,
      color: colors.textPrimary,
      fontWeight: '600',
    },
    inputWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      flex: 1,
      justifyContent: 'flex-end',
    },
    prefix: {
      ...typography.body,
      color: colors.textSecondary,
      fontWeight: '700',
    },
    input: {
      ...typography.body,
      color: colors.textPrimary,
      flex: 1,
    },
  });
