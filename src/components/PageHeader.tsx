import { ArrowLeft } from 'lucide-react-native';
import { type ReactNode, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { layout, radius, spacing, typography, type AppColors, useThemeColors } from '../theme';

type PageHeaderProps = {
  title: string;
  subtitle?: string;
  onBackPress?: () => void;
  action?: ReactNode;
  variant?: 'primary' | 'secondary';
};

export function PageHeader({
  title,
  subtitle,
  onBackPress,
  action,
  variant = 'secondary',
}: PageHeaderProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.root}>
      {onBackPress ? (
        <Pressable style={styles.backButton} onPress={onBackPress}>
          <ArrowLeft size={20} color={colors.textPrimary} />
        </Pressable>
      ) : null}

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
      paddingTop: layout.pageHeaderTop,
      paddingBottom: spacing.md,
    },
    backButton: {
      width: 40,
      height: 40,
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
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
