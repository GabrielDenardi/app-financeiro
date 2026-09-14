import { type ReactNode, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { spacing, typography, type AppColors, useThemeColors } from '../theme';

type PageHeaderProps = {
  title: string;
  subtitle?: string;
  /**
   * @deprecated O botão de voltar agora é renderizado pelo `PageShell` (prop
   * `onBackPress`), fixo sobre o conteúdo. Passe `onBackPress` para o
   * `PageShell` em vez de para este componente.
   */
  onBackPress?: () => void;
  action?: ReactNode;
  variant?: 'primary' | 'secondary';
};

export function PageHeader({
  title,
  subtitle,
  action,
  variant = 'secondary',
}: PageHeaderProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.root}>
      <View style={styles.copy}>
        <Text style={[styles.title, variant === 'primary' ? styles.primaryTitle : styles.secondaryTitle]}>
          {title}
        </Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>

      {action ? <View style={styles.action}>{action}</View> : null}
    </View>
  );
}

const createStyles = (colors: AppColors) =>
  StyleSheet.create({
    root: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingBottom: spacing.md,
    },
    copy: {
      flex: 1,
      gap: spacing.xs,
    },
    title: {
      color: colors.textPrimary,
    },
    primaryTitle: {
      ...typography.h1,
    },
    secondaryTitle: {
      ...typography.h1,
    },
    subtitle: {
      ...typography.body,
      color: colors.textSecondary,
    },
    action: {
      alignSelf: 'center',
    },
  });
