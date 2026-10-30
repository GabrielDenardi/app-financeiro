import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useToast } from '../components/Toast';
import { supabase } from '../lib/supabase';
import { radius, spacing, typography, type AppColors, useThemeColors } from '../theme';

const LOGOUT_MINIMUM_DURATION_MS = 800;

export function SettingsScreen() {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { showError } = useToast();
  const [isConfirmationVisible, setConfirmationVisible] = useState(false);
  const [isSigningOut, setSigningOut] = useState(false);

  const handleSignOut = async () => {
    setConfirmationVisible(false);
    setSigningOut(true);

    try {
      const [result] = await Promise.all([
        supabase.auth.signOut(),
        new Promise<void>((resolve) => setTimeout(resolve, LOGOUT_MINIMUM_DURATION_MS)),
      ]);

      if (result.error) {
        throw result.error;
      }
    } catch {
      showError('Não foi possível sair agora. Tente novamente.');
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.title}>Configurações</Text>
        <Text style={styles.subtitle}>
          Use o botão abaixo para encerrar sua sessão e voltar para o fluxo de login.
        </Text>

        <Pressable
          accessibilityRole="button"
          onPress={() => setConfirmationVisible(true)}
          style={({ pressed }) => [styles.signOutButton, pressed && styles.pressed]}
        >
          <Text style={styles.signOutText}>Sair da conta</Text>
        </Pressable>
      </View>

      <Modal
        visible={isConfirmationVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setConfirmationVisible(false)}
      >
        <View style={styles.overlay}>
          <View style={styles.confirmationCard}>
            <Text style={styles.dialogTitle}>Deseja sair do aplicativo?</Text>
            <Text style={styles.dialogMessage}>
              Sua sessão será encerrada e você voltará para a tela de login.
            </Text>

            <View style={styles.actions}>
              <Pressable
                accessibilityRole="button"
                onPress={() => setConfirmationVisible(false)}
                style={({ pressed }) => [styles.cancelButton, pressed && styles.pressed]}
              >
                <Text style={styles.cancelText}>Cancelar</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={handleSignOut}
                style={({ pressed }) => [styles.confirmButton, pressed && styles.pressed]}
              >
                <Text style={styles.confirmText}>Sair</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={isSigningOut} animationType="fade" transparent onRequestClose={() => {}}>
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingCard}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text accessibilityLiveRegion="polite" style={styles.loadingText}>
              Saindo do aplicativo...
            </Text>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const createStyles = (colors: AppColors) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.background,
    },
    container: {
      flex: 1,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.xxl,
      gap: spacing.lg,
    },
    title: {
      ...typography.h1,
      color: colors.textPrimary,
    },
    subtitle: {
      ...typography.body,
      color: colors.textSecondary,
    },
    signOutButton: {
      minHeight: 48,
      borderRadius: radius.md,
      backgroundColor: colors.danger,
      alignItems: 'center',
      justifyContent: 'center',
    },
    signOutText: {
      ...typography.body,
      color: colors.white,
      fontWeight: '700',
    },
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(15, 23, 42, 0.6)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: spacing.lg,
    },
    confirmationCard: {
      width: '100%',
      maxWidth: 360,
      padding: spacing.xl,
      gap: spacing.md,
      borderRadius: 16,
      backgroundColor: colors.surface,
    },
    dialogTitle: {
      ...typography.h2,
      color: colors.textPrimary,
      textAlign: 'center',
    },
    dialogMessage: {
      ...typography.body,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    actions: {
      flexDirection: 'row',
      gap: spacing.md,
      marginTop: spacing.sm,
    },
    cancelButton: {
      flex: 1,
      height: 48,
      borderRadius: 12,
      backgroundColor: colors.surfaceMuted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cancelText: {
      ...typography.body,
      color: colors.textPrimary,
      fontWeight: '600',
    },
    confirmButton: {
      flex: 1,
      height: 48,
      borderRadius: 12,
      backgroundColor: colors.danger,
      alignItems: 'center',
      justifyContent: 'center',
    },
    confirmText: {
      ...typography.body,
      color: colors.white,
      fontWeight: '700',
    },
    loadingOverlay: {
      flex: 1,
      backgroundColor: 'rgba(15, 23, 42, 0.6)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: spacing.lg,
    },
    loadingCard: {
      minWidth: 240,
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.xl,
      gap: spacing.lg,
      borderRadius: 16,
      backgroundColor: colors.surface,
      alignItems: 'center',
    },
    loadingText: {
      ...typography.body,
      color: colors.textPrimary,
      textAlign: 'center',
    },
    pressed: {
      opacity: 0.85,
    },
  });
