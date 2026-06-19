import { type ReactNode, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { X } from 'lucide-react-native';

import { radius, shadows, spacing, typography, type AppColors, useThemeColors } from '../theme';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

type SheetRenderProp = ReactNode | ((close: () => void) => ReactNode);

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Título do header padrão. Omita para renderizar o próprio header via children. */
  title?: string;
  subtitle?: string;
  /** Exibe o botão de fechar (X). Padrão: true quando há título. */
  showClose?: boolean;
  /** Ícone centralizado acima do título (layout "hero", ex.: paywall). */
  headerIcon?: ReactNode;
  headerAlign?: 'left' | 'center';
  /** Rodapé fixo. Pode ser um nó ou função que recebe o `close` animado. */
  footer?: SheetRenderProp;
  children: SheetRenderProp;
  /** Proporção máxima da altura da tela (0–1). Padrão 0.9. */
  maxHeightRatio?: number;
  /** Renderiza o conteúdo dentro de um ScrollView. Padrão: true. */
  scroll?: boolean;
  contentContainerStyle?: StyleProp<ViewStyle>;
}

export function BottomSheet({
  visible,
  onClose,
  title,
  subtitle,
  showClose,
  headerIcon,
  headerAlign = 'left',
  footer,
  children,
  maxHeightRatio = 0.9,
  scroll = true,
  contentContainerStyle,
}: BottomSheetProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  const animateIn = useCallback(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 260, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 320, useNativeDriver: true }),
    ]).start();
  }, [fadeAnim, translateY]);

  const requestClose = useCallback(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 220, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: SCREEN_HEIGHT, duration: 280, useNativeDriver: true }),
    ]).start(({ finished }) => {
      if (finished) {
        onClose();
      }
    });
  }, [fadeAnim, onClose, translateY]);

  useEffect(() => {
    if (visible) {
      animateIn();
      return;
    }
    fadeAnim.setValue(0);
    translateY.setValue(SCREEN_HEIGHT);
  }, [animateIn, fadeAnim, translateY, visible]);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => gestureState.dy > 5,
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          translateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 120) {
          requestClose();
          return;
        }
        Animated.timing(translateY, { toValue: 0, duration: 180, useNativeDriver: true }).start();
      },
    }),
  ).current;

  const shouldShowClose = showClose ?? Boolean(title);
  const isCentered = headerAlign === 'center';
  const hasHeader = Boolean(title || headerIcon);
  const resolvedFooter = typeof footer === 'function' ? footer(requestClose) : footer;
  const resolvedChildren = typeof children === 'function' ? children(requestClose) : children;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={requestClose}>
      <View style={styles.overlay}>
        <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
          <TouchableOpacity style={styles.backdropTouch} activeOpacity={1} onPress={requestClose} />
        </Animated.View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardWrap}
        >
          <Animated.View
            style={[styles.sheet, { maxHeight: SCREEN_HEIGHT * maxHeightRatio, transform: [{ translateY }] }]}
          >
            <View {...panResponder.panHandlers} style={styles.gestureCapture}>
              <View style={styles.handle} />
              {hasHeader ? (
                <View style={[styles.header, isCentered && styles.headerCentered]}>
                  {isCentered ? (
                    <View style={styles.headerCenterContent}>
                      {headerIcon ? <View style={styles.headerIconWrap}>{headerIcon}</View> : null}
                      {title ? <Text style={[styles.title, styles.titleCentered]}>{title}</Text> : null}
                      {subtitle ? (
                        <Text style={[styles.subtitle, styles.subtitleCentered]}>{subtitle}</Text>
                      ) : null}
                    </View>
                  ) : (
                    <View style={styles.headerTexts}>
                      {title ? <Text style={styles.title}>{title}</Text> : null}
                      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
                    </View>
                  )}
                  {shouldShowClose ? (
                    <TouchableOpacity onPress={requestClose} style={styles.closeButton}>
                      <X size={18} color={colors.textPrimary} />
                    </TouchableOpacity>
                  ) : null}
                </View>
              ) : null}
            </View>

            {scroll ? (
              <ScrollView
                bounces={false}
                contentContainerStyle={[styles.content, contentContainerStyle]}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {resolvedChildren}
              </ScrollView>
            ) : (
              <View style={[styles.content, contentContainerStyle]}>{resolvedChildren}</View>
            )}

            {resolvedFooter ? <View style={styles.footer}>{resolvedFooter}</View> : null}
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const createStyles = (colors: AppColors) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.overlay,
    },
    backdropTouch: {
      flex: 1,
    },
    keyboardWrap: {
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: colors.background,
      borderTopLeftRadius: radius.xl,
      borderTopRightRadius: radius.xl,
      minHeight: 100,
      ...shadows.sheet,
      shadowColor: colors.shadow,
    },
    gestureCapture: {
      paddingTop: spacing.md,
      backgroundColor: colors.background,
      borderTopLeftRadius: radius.xl,
      borderTopRightRadius: radius.xl,
      zIndex: 10,
    },
    handle: {
      width: 40,
      height: 4,
      backgroundColor: colors.border,
      borderRadius: radius.sm,
      alignSelf: 'center',
      marginBottom: spacing.md,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: spacing.xl,
      marginBottom: spacing.lg,
    },
    headerCentered: {
      justifyContent: 'center',
    },
    headerTexts: {
      flex: 1,
    },
    headerCenterContent: {
      flex: 1,
      alignItems: 'center',
    },
    headerIconWrap: {
      marginBottom: spacing.md,
    },
    title: {
      ...typography.h2,
      color: colors.textPrimary,
    },
    titleCentered: {
      ...typography.h1,
      textAlign: 'center',
    },
    subtitle: {
      ...typography.caption,
      color: colors.textSecondary,
      marginTop: 2,
    },
    subtitleCentered: {
      ...typography.body,
      textAlign: 'center',
      marginTop: spacing.sm,
    },
    closeButton: {
      width: 36,
      height: 36,
      borderRadius: radius.pill,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      marginLeft: spacing.md,
    },
    content: {
      paddingHorizontal: spacing.xl,
    },
    footer: {
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.background,
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.lg,
      paddingBottom: spacing.xxl,
      flexDirection: 'row',
      gap: spacing.md,
    },
  });
