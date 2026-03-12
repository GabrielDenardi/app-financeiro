import React, { useMemo } from 'react';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { spacing, typography, type AppColors, useThemeColors } from '../theme';

export const BOTTOM_TAB_BAR_HEIGHT = 78;

export function BottomTabBarMock({ state, descriptors, navigation }: BottomTabBarProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.container}>
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const isFocused = state.index === index;

        const onPress = () => {
          if (!isFocused) {
            navigation.navigate(route.name);
          }
        };

        // Mudamos para 'any' para aceitar nomes de ambas as bibliotecas
        let iconName: any = 'ellipse';

        if (route.name === 'Home') {
          iconName = isFocused ? 'home' : 'home-outline';
        } else if (route.name === 'Transactions') {
          iconName = isFocused
            ? 'swap-horizontal'
            : 'swap-horizontal-outline';
        } else if (route.name === 'Goals') {
          iconName = isFocused ? 'trophy' : 'trophy-outline';
        } else if (route.name === 'Budget') {
          // Nomes exclusivos do MaterialCommunityIcons
          iconName = isFocused ? 'piggy-bank' : 'piggy-bank-outline';
        } else if (route.name === 'Settings') {
          iconName = isFocused ? 'settings' : 'settings-outline';
        }

        return (
          <Pressable
            key={route.key}
            onPress={onPress}
            style={({ pressed }) => [
              styles.tabButton,
              isFocused && styles.tabButtonActive,
              pressed && styles.pressed,
            ]}
          >
            <View style={[styles.iconWrap, isFocused && styles.iconWrapActive]}>
              {route.name === 'Budget' ? (
                <MaterialCommunityIcons
                  name={iconName}
                  size={isFocused ? 20 : 22}
                  color={isFocused ? colors.primary : colors.textSecondary}
                />
              ) : (
                <Ionicons
                  name={iconName}
                  size={isFocused ? 19 : 20}
                  color={isFocused ? colors.primary : colors.textSecondary}
                />
              )}
            </View>

            <Text
              style={[
                styles.tabLabel,
                isFocused && styles.tabLabelActive,
              ]}
              numberOfLines={1}
            >
              {route.name === 'Budget' ? 'Orçamentos' : route.name}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const createStyles = (colors: AppColors) => StyleSheet.create({
  container: {
    height: BOTTOM_TAB_BAR_HEIGHT,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 6,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderRadius: 14,
    paddingVertical: spacing.xs,
  },
  tabButtonActive: {
    backgroundColor: `${colors.primaryLight}14`,
  },
  iconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapActive: {
    backgroundColor: colors.mutedSurface,
    borderWidth: 1,
    borderColor: `${colors.primaryLight}40`,
  },
  pressed: {
    opacity: 0.75,
  },
  tabLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '500',
    fontSize: 10,
  },
  tabLabelActive: {
    color: colors.primary,
    fontWeight: '700',
  },
});
