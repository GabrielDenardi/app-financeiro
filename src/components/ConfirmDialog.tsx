import { useMemo } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { AlertTriangle } from 'lucide-react-native';

import { Button } from './Button';
import { radius, spacing, typography, type AppColors, useThemeColors } from '../theme';

interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** true = botão de confirmação vermelho (ação destrutiva). Padrão: true. */
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Diálogo de confirmação cross-platform. Use no lugar de Alert.alert com
 * botões de ação: no web o Alert do react-native é um no-op e o usuário
 * não consegue confirmar nada.
 */
export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  destructive = true,
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={styles.content}>
          <AlertTriangle size={40} color={destructive ? colors.danger : colors.warning} style={styles.icon} />
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>

          <View style={styles.actions}>
            <Button label={cancelLabel} variant="secondary" fullWidth onPress={onCancel} disabled={loading} />
            <Button
              label={confirmLabel}
              variant={destructive ? 'danger' : 'primary'}
              fullWidth
              onPress={onConfirm}
              loading={loading}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (colors: AppColors) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: 'center',
      alignItems: 'center',
      padding: spacing.lg,
    },
    content: {
      width: '100%',
      maxWidth: 360,
      backgroundColor: colors.surface,
      borderRadius: radius.xl,
      padding: spacing.xl,
      alignItems: 'center',
      gap: spacing.sm,
    },
    icon: {
      marginBottom: spacing.xs,
    },
    title: {
      ...typography.h2,
      color: colors.textPrimary,
      textAlign: 'center',
    },
    message: {
      ...typography.body,
      color: colors.textSecondary,
      textAlign: 'center',
      marginBottom: spacing.md,
    },
    actions: {
      flexDirection: 'row',
      gap: spacing.md,
      width: '100%',
      marginTop: spacing.md,
    },
  });
