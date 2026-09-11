import { type PropsWithChildren, type ReactElement, type ReactNode, useMemo } from 'react';
import type { RefreshControlProps, StyleProp, ViewStyle } from 'react-native';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, View } from 'react-native';
import { ArrowLeft } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useBottomTabBarHeight } from './BottomTabBarMock';
import { layout, spacing, type AppColors, useThemeColors } from '../theme';

type PageShellProps = PropsWithChildren<{
  contentContainerStyle?: StyleProp<ViewStyle>;
  scroll?: boolean;
  showsVerticalScrollIndicator?: boolean;
  withTabBarInset?: boolean;
  style?: StyleProp<ViewStyle>;
  /** RefreshControl para pull-to-refresh (apenas com scroll habilitado). */
  refreshControl?: ReactElement<RefreshControlProps>;
  /**
   * Quando informado, renderiza uma barra fixa no topo (faixa branca, ocupa a
   * largura da tela) com o botão de voltar. É a única parte do cabeçalho que
   * fica fixa; título, subtítulo e demais ações rolam junto com o conteúdo,
   * como uma camada separada logo abaixo dessa barra.
   */
  onBackPress?: () => void;
  /**
   * Quando informado, renderiza uma barra fixa no rodapé (faixa/card branco)
   * com o(s) botão(ões) de ação principal da tela (ex.: "Novo"). Passe um ou
   * mais `<Button fullWidth />` como filhos — a barra já cuida do layout em
   * linha e do espaçamento entre eles.
   */
  footer?: ReactNode;
}>;

export function PageShell({
  children,
  contentContainerStyle,
  scroll = true,
  showsVerticalScrollIndicator = false,
  withTabBarInset = false,
  style,
  refreshControl,
  onBackPress,
  footer,
}: PageShellProps) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const styles = useMemo(
    () => createStyles(colors, tabBarHeight, insets.bottom, insets.top),
    [colors, tabBarHeight, insets.bottom, insets.top],
  );
  const baseContentStyle = [
    styles.content,
    onBackPress ? styles.contentWithTopBar : styles.contentWithoutTopBar,
    withTabBarInset && styles.contentWithTabBarInset,
    contentContainerStyle,
  ];

  const topBar = onBackPress ? (
    <View style={styles.topBar}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Voltar"
        style={styles.backButton}
        onPress={onBackPress}
      >
        <ArrowLeft size={20} color={colors.textPrimary} />
      </Pressable>
    </View>
  ) : null;

  const footerBar = footer ? <View style={styles.footerBar}>{footer}</View> : null;

  return (
    <SafeAreaView style={[styles.safeArea, style]}>
      {topBar}
      {scroll ? (
        <ScrollView
          style={styles.flexOne}
          contentContainerStyle={baseContentStyle}
          showsVerticalScrollIndicator={showsVerticalScrollIndicator}
          refreshControl={refreshControl}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.flexOne, baseContentStyle]}>{children}</View>
      )}
      {footerBar}
    </SafeAreaView>
  );
}

const createStyles = (colors: AppColors, tabBarHeight: number, bottomInset: number, topInset: number) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.background,
    },
    flexOne: {
      flex: 1,
    },
    content: {
      paddingHorizontal: layout.pageHorizontal,
      paddingBottom: spacing.xxl,
      gap: layout.pageSectionGap,
    },
    /** Já existe a barra fixa com o botão de voltar acima — só um respiro. */
    contentWithTopBar: {
      paddingTop: spacing.lg,
    },
    /** Sem barra fixa (tela raiz de aba, sem voltar) — precisa do respiro do notch. */
    contentWithoutTopBar: {
      paddingTop: layout.pageHeaderTop,
    },
    contentWithTabBarInset: {
      paddingBottom: tabBarHeight + 72,
    },
    topBar: {
      backgroundColor: colors.surface,
      paddingTop: topInset + spacing.xs,
      paddingBottom: spacing.xs,
      paddingHorizontal: layout.pageHorizontal,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    backButton: {
      width: 36,
      height: 36,
      alignItems: 'center',
      justifyContent: 'center',
    },
    footerBar: {
      flexDirection: 'row',
      gap: spacing.md,
      backgroundColor: colors.surface,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingHorizontal: layout.pageHorizontal,
      paddingTop: spacing.md,
      paddingBottom: bottomInset + spacing.md,
    },
  });
