import { useMemo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { type AppColors, useThemeColors } from '../theme';

/**
 * SECURITY: Neutral lock screen shown while biometric authentication is in progress.
 * Displays no financial data or sensitive information.
 * Serves as a visual shield during background→foreground transitions.
 */
interface LockScreenProps {
  isBiometricLocked: boolean;
  isCheckingBiometric: boolean;
  onManualUnlock: () => Promise<void>;
  onSignOut: () => Promise<void>;
}

export function LockScreen({
  isBiometricLocked,
  isCheckingBiometric,
  onManualUnlock,
  onSignOut,
}: LockScreenProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  if (isCheckingBiometric) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={colors.primaryLight} />
        <Text style={styles.checkingText}>Verificando biometria...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.contentWrapper}>
        <Text style={styles.lockTitle}>App bloqueado</Text>
        <Text style={styles.lockMessage}>
          A autenticação biométrica está ativada para esta conta. Use o botão abaixo para
          desbloquear.
        </Text>

        <Pressable
          style={({ pressed }) => [styles.unlockButton, pressed && styles.unlockButtonPressed]}
          onPress={onManualUnlock}
          disabled={isCheckingBiometric}
        >
          <Text style={styles.unlockButtonText}>Desbloquear</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.signOutButton, pressed && styles.signOutButtonPressed]}
          onPress={onSignOut}
          disabled={isCheckingBiometric}
        >
          <Text style={styles.signOutText}>Sair da conta</Text>
        </Pressable>
      </View>
    </View>
  );
}

const createStyles = (colors: AppColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.background,
      paddingHorizontal: 24,
    },
    contentWrapper: {
      width: '100%',
      maxWidth: 320,
      gap: 20,
      alignItems: 'center',
    },
    lockTitle: {
      fontSize: 24,
      fontWeight: '700',
      color: colors.textPrimary,
      textAlign: 'center',
    },
    lockMessage: {
      fontSize: 14,
      textAlign: 'center',
      lineHeight: 20,
      color: colors.textSecondary,
    },
    unlockButton: {
      width: '100%',
      minHeight: 48,
      borderRadius: 12,
      backgroundColor: colors.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 20,
    },
    unlockButtonPressed: {
      opacity: 0.85,
    },
    unlockButtonText: {
      color: '#FFFFFF',
      fontWeight: '700',
      fontSize: 16,
    },
    signOutButton: {
      width: '100%',
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    signOutButtonPressed: {
      opacity: 0.6,
    },
    signOutText: {
      color: colors.danger,
      fontWeight: '600',
      fontSize: 14,
    },
    checkingText: {
      marginTop: 16,
      fontSize: 14,
      color: colors.textSecondary,
      fontWeight: '500',
    },
  });
