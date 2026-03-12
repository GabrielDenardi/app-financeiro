import { useMemo } from 'react';
import { Ionicons } from '@expo/vector-icons';
import type { StyleProp, ViewStyle } from 'react-native';
import { Pressable, StyleSheet } from 'react-native';

import { type AppColors, useThemeColors } from '../theme';

interface FloatingActionButtonProps {
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

export const FAB_SIZE = 56;

export function FloatingActionButton({ onPress, style }: FloatingActionButtonProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Adicionar lançamento"
      onPress={onPress}
      style={({ pressed }) => [styles.fab, pressed && styles.pressed, style]}
    >
      <Ionicons name="add" size={28} color={colors.white} />
    </Pressable>
  );
}

const createStyles = (colors: AppColors) => StyleSheet.create({
  fab: {
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primaryLight,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 14,
    elevation: 5,
  },
  pressed: {
    opacity: 0.85,
  },
});
