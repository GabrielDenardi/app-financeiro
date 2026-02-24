import { Ionicons } from '@expo/vector-icons';
import type { StyleProp, ViewStyle } from 'react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, spacing, typography } from '../theme';

type TabKey = 'home' | 'transactions' | 'goals' | 'settings';

interface BottomTabBarMockProps {
  activeTab?: TabKey;
  style?: StyleProp<ViewStyle>;
}

interface TabItem {
  key: TabKey;
  label: string;
  activeIcon: keyof typeof Ionicons.glyphMap;
  inactiveIcon: keyof typeof Ionicons.glyphMap;
}

export const BOTTOM_TAB_BAR_HEIGHT = 78;

const tabs: TabItem[] = [
  {
    key: 'home',
    label: 'Home',
    activeIcon: 'grid',
    inactiveIcon: 'grid-outline',
  },
  {
    key: 'transactions',
    label: 'Lancamentos',
    activeIcon: 'swap-horizontal',
    inactiveIcon: 'swap-horizontal-outline',
  },
  {
    key: 'goals',
    label: 'Metas',
    activeIcon: 'trophy',
    inactiveIcon: 'trophy-outline',
  },
  {
    key: 'settings',
    label: 'Config',
    activeIcon: 'settings',
    inactiveIcon: 'settings-outline',
  },
];

export function BottomTabBarMock({ activeTab = 'home', style }: BottomTabBarMockProps) {
  return (
    <View style={[styles.container, style]}>
      {tabs.map((tab) => {
        const active = tab.key === activeTab;

        return (
          <Pressable
            key={tab.key}
            accessibilityRole="button"
            onPress={() => {
              console.log(`[TabBar] ${tab.key}`);
            }}
            style={({ pressed }) => [
              styles.tabButton,
              active && styles.tabButtonActive,
              pressed && styles.pressed,
            ]}
          >
            <View style={[styles.iconWrap, active && styles.iconWrapActive]}>
              <Ionicons
                name={active ? tab.activeIcon : tab.inactiveIcon}
                size={active ? 19 : 20}
                color={active ? colors.primary : colors.textSecondary}
              />
            </View>
            <Text style={[styles.tabLabel, active && styles.tabLabelActive]} numberOfLines={1}>
              {tab.label}
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
