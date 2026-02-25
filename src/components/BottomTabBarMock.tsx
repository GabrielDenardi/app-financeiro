import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, spacing, typography } from '../theme';

export const BOTTOM_TAB_BAR_HEIGHT = 78;

export function BottomTabBarMock({ state, descriptors, navigation }: BottomTabBarProps) {
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

        let iconName: keyof typeof Ionicons.glyphMap = 'ellipse';

        if (route.name === 'Home') {
          iconName = isFocused ? 'grid' : 'grid-outline';
        } else if (route.name === 'Transactions') {
          iconName = isFocused
            ? 'swap-horizontal'
            : 'swap-horizontal-outline';
        } else if (route.name === 'Goals') {
          iconName = isFocused ? 'trophy' : 'trophy-outline';
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
              <Ionicons
                name={iconName}
                size={isFocused ? 19 : 20}
                color={isFocused ? colors.primary : colors.textSecondary}
              />
            </View>

            <Text
              style={[
                styles.tabLabel,
                isFocused && styles.tabLabelActive,
              ]}
              numberOfLines={1}
            >
              {route.name}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
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
    backgroundColor: 'rgba(37, 99, 235, 0.04)',
  },
  iconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapActive: {
    backgroundColor: '#DBEAFE',
    borderWidth: 1,
    borderColor: 'rgba(37, 99, 235, 0.14)',
  },
  pressed: {
    opacity: 0.75,
  },
  tabLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  tabLabelActive: {
    color: colors.primary,
    fontWeight: '700',
  },
});