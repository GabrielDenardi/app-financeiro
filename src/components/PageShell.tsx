import { type PropsWithChildren, type ReactElement, useMemo } from 'react';
import type { RefreshControlProps, StyleProp, ViewStyle } from 'react-native';
import { SafeAreaView, ScrollView, StyleSheet, View } from 'react-native';

import { BOTTOM_TAB_BAR_HEIGHT } from './BottomTabBarMock';
import { layout, spacing, type AppColors, useThemeColors } from '../theme';

type PageShellProps = PropsWithChildren<{
  contentContainerStyle?: StyleProp<ViewStyle>;
  scroll?: boolean;
  showsVerticalScrollIndicator?: boolean;
  withTabBarInset?: boolean;
  style?: StyleProp<ViewStyle>;
  /** RefreshControl para pull-to-refresh (apenas com scroll habilitado). */
  refreshControl?: ReactElement<RefreshControlProps>;
}>;

export function PageShell({
  children,
  contentContainerStyle,
  scroll = true,
  showsVerticalScrollIndicator = false,
  withTabBarInset = false,
  style,
  refreshControl,
}: PageShellProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const baseContentStyle = [
    styles.content,
    withTabBarInset && styles.contentWithTabBarInset,
    contentContainerStyle,
  ];

  if (scroll) {
    return (
      <SafeAreaView style={[styles.safeArea, style]}>
        <ScrollView
          contentContainerStyle={baseContentStyle}
          showsVerticalScrollIndicator={showsVerticalScrollIndicator}
          refreshControl={refreshControl}
        >
          {children}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, style]}>
      <View style={baseContentStyle}>{children}</View>
    </SafeAreaView>
  );
}

const createStyles = (colors: AppColors) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      paddingHorizontal: layout.pageHorizontal,
      paddingBottom: spacing.xxl,
      gap: layout.pageSectionGap,
    },
    contentWithTabBarInset: {
      paddingBottom: BOTTOM_TAB_BAR_HEIGHT + 72,
    },
  });
