import { createContext, useCallback, useContext, useMemo, useRef, useState, type PropsWithChildren } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { CheckCircle2, XCircle } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { radius, shadows, spacing, typography, type AppColors, useThemeColors } from '../theme';
import { BOTTOM_TAB_BAR_HEIGHT } from './BottomTabBarMock';

type ToastVariant = 'success' | 'error';

type ToastState = {
  id: number;
  message: string;
  variant: ToastVariant;
};

type ToastContextValue = {
  showSuccess: (message: string) => void;
  showError: (message: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const VISIBLE_DURATION_MS = 2600;

export function ToastProvider({ children }: PropsWithChildren) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [toast, setToast] = useState<ToastState | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(12)).current;
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nextIdRef = useRef(0);

  const dismiss = useCallback(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 12, duration: 180, useNativeDriver: true }),
    ]).start(({ finished }) => {
      if (finished) {
        setToast(null);
      }
    });
  }, [opacity, translateY]);

  const show = useCallback(
    (message: string, variant: ToastVariant) => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }

      nextIdRef.current += 1;
      setToast({ id: nextIdRef.current, message, variant });
      opacity.setValue(0);
      translateY.setValue(12);

      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0, duration: 220, useNativeDriver: true }),
      ]).start();

      hideTimeoutRef.current = setTimeout(dismiss, VISIBLE_DURATION_MS);
    },
    [dismiss, opacity, translateY],
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      showSuccess: (message: string) => show(message, 'success'),
      showError: (message: string) => show(message, 'error'),
    }),
    [show],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast ? (
        <Animated.View
          pointerEvents="box-none"
          style={[
            styles.wrapper,
            { bottom: insets.bottom + BOTTOM_TAB_BAR_HEIGHT + spacing.md, opacity, transform: [{ translateY }] },
          ]}
        >
          <Pressable onPress={dismiss} style={[styles.toast, toast.variant === 'error' && styles.toastError]}>
            {toast.variant === 'success' ? (
              <CheckCircle2 size={18} color={colors.success} />
            ) : (
              <XCircle size={18} color={colors.danger} />
            )}
            <Text style={styles.message} numberOfLines={2}>
              {toast.message}
            </Text>
          </Pressable>
        </Animated.View>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast deve ser usado dentro de um ToastProvider.');
  }
  return context;
}

const createStyles = (colors: AppColors) =>
  StyleSheet.create({
    wrapper: {
      position: 'absolute',
      left: spacing.lg,
      right: spacing.lg,
      alignItems: 'center',
    },
    toast: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      maxWidth: 420,
      width: '100%',
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      ...shadows.lg,
      shadowColor: colors.shadow,
    },
    toastError: {
      borderColor: colors.danger,
    },
    message: {
      ...typography.body,
      color: colors.textPrimary,
      fontWeight: '600',
      flex: 1,
    },
  });
