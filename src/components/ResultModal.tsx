import { createContext, useCallback, useContext, useMemo, useState, type PropsWithChildren } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { CheckCircle2, XCircle } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { layout, radius, spacing, typography, type AppColors, useThemeColors } from '../theme';
import { Button } from './Button';

type ResultVariant = 'success' | 'error';

type ResultOptions = {
  variant: ResultVariant;
  title: string;
  message?: string;
  actionLabel?: string;
};

type ResultModalContextValue = {
  showResult: (options: ResultOptions) => void;
};

const ResultModalContext = createContext<ResultModalContextValue | null>(null);

export function ResultModalProvider({ children }: PropsWithChildren) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors, insets), [colors, insets]);
  const [result, setResult] = useState<ResultOptions | null>(null);

  const showResult = useCallback((options: ResultOptions) => {
    setResult(options);
  }, []);

  const close = useCallback(() => setResult(null), []);

  const value = useMemo<ResultModalContextValue>(() => ({ showResult }), [showResult]);
  const isError = result?.variant === 'error';

  return (
    <ResultModalContext.Provider value={value}>
      {children}
      <Modal visible={result !== null} animationType="slide" onRequestClose={close}>
        <View style={styles.page}>
          <View style={styles.center}>
            <View style={[styles.iconCircle, isError ? styles.iconCircleError : styles.iconCircleSuccess]}>
              {isError ? (
                <XCircle size={72} color={colors.danger} />
              ) : (
                <CheckCircle2 size={72} color={colors.success} />
              )}
            </View>

            <Text style={styles.title}>{result?.title}</Text>
            {result?.message ? <Text style={styles.message}>{result.message}</Text> : null}
          </View>

          <Button
            label={result?.actionLabel ?? 'Concluir'}
            style={styles.action}
            size="lg"
            variant={isError ? 'danger' : 'primary'}
            onPress={close}
          />
        </View>
      </Modal>
    </ResultModalContext.Provider>
  );
}

export function useResultModal(): ResultModalContextValue {
  const context = useContext(ResultModalContext);
  if (!context) {
    throw new Error('useResultModal deve ser usado dentro de um ResultModalProvider.');
  }
  return context;
}

const createStyles = (colors: AppColors, insets: { top: number; bottom: number }) =>
  StyleSheet.create({
    page: {
      flex: 1,
      backgroundColor: colors.background,
      paddingHorizontal: layout.pageHorizontal,
      paddingTop: insets.top + spacing.xxl,
      paddingBottom: insets.bottom + spacing.lg,
      justifyContent: 'space-between',
    },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.md,
    },
    action: {
      width: '100%',
      alignSelf: 'stretch',
    },
    iconCircle: {
      width: 128,
      height: 128,
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.sm,
    },
    iconCircleSuccess: {
      backgroundColor: colors.successSoft,
    },
    iconCircleError: {
      backgroundColor: colors.dangerSoft,
    },
    title: {
      ...typography.h1,
      color: colors.textPrimary,
      textAlign: 'center',
    },
    message: {
      ...typography.body,
      color: colors.textSecondary,
      textAlign: 'center',
      paddingHorizontal: spacing.lg,
    },
  });
