import { useMemo } from 'react';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';

import { spacing, typography, type AppColors, useThemeColors } from '../theme';

export function GoalsScreen() {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.title}>Metas</Text>
        <Text style={styles.description}>
          Em breve você poderá acompanhar metas de economia e objetivos financeiros por aqui.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const createStyles = (colors: AppColors) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl,
    gap: spacing.md,
  },
  title: {
    ...typography.h1,
    color: colors.textPrimary,
  },
  description: {
    ...typography.body,
    color: colors.textSecondary,
  },
});

