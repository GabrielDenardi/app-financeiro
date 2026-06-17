import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import { Fingerprint } from 'lucide-react-native';
import { radius, spacing, type AppColors, useThemeColors } from '../theme';

/**
 * SECURITY: Neutral lock screen shown while biometric authentication is in progress.
 * Displays no financial data or sensitive information.
 *
 * O prompt de biometria (com fallback para o PIN do aparelho) é disparado
 * automaticamente ao montar e sempre que o app volta para primeiro plano —
 * comportamento estilo Nubank/WhatsApp. O app só desbloqueia após sucesso.
 */
interface LockScreenProps {
  isCheckingBiometric: boolean;
  onManualUnlock: () => Promise<void>;
  onSignOut: () => Promise<void>;
}

export function LockScreen({
  isCheckingBiometric,
  onManualUnlock,
  onSignOut,
}: LockScreenProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isPrompting, setIsPrompting] = useState(false);
  const isPromptingRef = useRef(false);
  const lastPromptEndedAtRef = useRef(0);
  const onManualUnlockRef = useRef(onManualUnlock);
  onManualUnlockRef.current = onManualUnlock;

  const promptUnlock = useCallback(async (): Promise<void> => {
    if (isPromptingRef.current) {
      return;
    }

    isPromptingRef.current = true;
    setIsPrompting(true);

    // Se o prompt nativo travar (ex.: disparado antes da Activity estar pronta),
    // o watchdog libera o botao "Tentar novamente" em vez de prender em "Aguardando...".
    const watchdog = setTimeout(() => {
      isPromptingRef.current = false;
      setIsPrompting(false);
    }, 15000);

    try {
      await onManualUnlockRef.current();
    } finally {
      clearTimeout(watchdog);
      isPromptingRef.current = false;
      lastPromptEndedAtRef.current = Date.now();
      setIsPrompting(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    // Pequeno atraso antes do prompt automatico: no cold start do Android o
    // authenticateAsync disparado cedo demais (Activity ainda nao em primeiro
    // plano) nao exibe nada e nunca resolve.
    const initialPrompt = setTimeout(() => {
      if (!cancelled && AppState.currentState === 'active') {
        promptUnlock().catch(() => undefined);
      }
    }, 400);

    const subscription = AppState.addEventListener('change', (nextState) => {
      // O fechamento do proprio prompt biometrico gera uma transicao para
      // 'active'; o cooldown evita reabrir o prompt em loop apos um cancelamento.
      if (nextState === 'active' && Date.now() - lastPromptEndedAtRef.current > 1000) {
        promptUnlock().catch(() => undefined);
      }
    });

    return () => {
      cancelled = true;
      clearTimeout(initialPrompt);
      subscription.remove();
    };
  }, [promptUnlock]);

  const handleSignOut = async (): Promise<void> => {
    setSignOutError(null);
    setIsSigningOut(true);

    try {
      await onSignOut();
    } catch (error) {
      console.error('Não foi possível sair da conta.', error);
      setSignOutError('Não foi possível sair da conta. Tente novamente.');
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.contentWrapper}>
        <View style={styles.iconWrapper}>
          <Fingerprint size={36} color={colors.primary} />
        </View>

        <Text style={styles.lockTitle}>App bloqueado</Text>
        <Text style={styles.lockMessage}>
          {isPrompting || isCheckingBiometric
            ? 'Confirme sua identidade para continuar.'
            : 'Use sua biometria ou o PIN do aparelho para desbloquear.'}
        </Text>

        <Pressable
          style={({ pressed }) => [
            styles.unlockButton,
            (pressed || isPrompting) && styles.unlockButtonPressed,
          ]}
          onPress={() => promptUnlock().catch(() => undefined)}
          disabled={isPrompting || isCheckingBiometric}
        >
          <Text style={styles.unlockButtonText}>
            {isPrompting || isCheckingBiometric ? 'Aguardando...' : 'Tentar novamente'}
          </Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.signOutButton, pressed && styles.signOutButtonPressed]}
          onPress={handleSignOut}
          disabled={isPrompting || isCheckingBiometric || isSigningOut}
        >
          <Text style={styles.signOutText}>{isSigningOut ? 'Saindo...' : 'Sair da conta'}</Text>
        </Pressable>

        {signOutError ? <Text style={styles.errorText}>{signOutError}</Text> : null}
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
      paddingHorizontal: spacing.xl,
    },
    contentWrapper: {
      width: '100%',
      maxWidth: 320,
      gap: 20,
      alignItems: 'center',
    },
    iconWrapper: {
      width: 72,
      height: 72,
      borderRadius: radius.pill,
      backgroundColor: colors.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
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
      borderRadius: radius.md,
      backgroundColor: colors.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 20,
    },
    unlockButtonPressed: {
      opacity: 0.85,
    },
    unlockButtonText: {
      color: colors.white,
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
    errorText: {
      color: colors.danger,
      fontSize: 13,
      lineHeight: 18,
      textAlign: 'center',
    },
  });
