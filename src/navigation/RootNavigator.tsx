import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, AppState, StyleSheet, View } from 'react-native';
import * as Linking from 'expo-linking';
import type { Session } from '@supabase/supabase-js';

import { AuthCallbackResult } from '../features/auth/components/AuthCallbackResult';
import { MfaChallengeScreen } from '../features/auth/components/MfaChallengeScreen';
import { AuthFlowProvider } from '../features/auth/context/AuthFlowContext';
import { PasswordRecoveryScreen } from '../features/auth/screens/AuthScreens';
import { isValidPlanId } from '../features/plans/plans';
import { selectFreePlan } from '../features/plans/services/plansService';
import {
  createSessionFromAuthUrl,
  isAuthCallbackUrl,
  type AuthCallbackOutcome,
} from '../lib/authRedirect';
import {
  authenticateWithBiometrics,
  isBiometricLockEnabledLocally,
} from '../features/preferences/services/biometricService';
import { registerLoginEvent } from '../features/preferences/services/preferencesService';
import { supabase } from '../lib/supabase';
import { type AppColors, useThemeColors } from '../theme';
import type { AuthSessionState, AuthenticatedUserSummary } from '../types/auth';
import { AppStack } from './AppStack';
import { AuthStack } from './AuthStack';
import { LockScreen } from '../screens/LockScreen';

/**
 * SECURITY: These types define the authentication flow state machine to prevent race conditions
 * that could expose sensitive financial data during biometric verification.
 */
type CallbackNotice = {
  variant: 'success' | 'error';
  title: string;
  message: string;
  actionLabel: string;
};

/**
 * Unlock state machine:
 * - 'locked': App is in background or initializing; data is shielded (LockScreen)
 * - 'checking': Biometric auth in progress; safe neutral UI shown (LockScreen)
 * - 'unlocked': Biometric passed or not required; AppStack is mounted safely
 */
type AppUnlockState = 'locked' | 'checking' | 'unlocked';
type PlanGateState = 'checking' | 'ready';
type MfaGateState = 'checking' | 'required' | 'verified';

function isRecoveryUrl(url: string): boolean {
  return /(?:[?#&]|^)type=recovery(?:[&#]|$)/i.test(url);
}

function getSuccessNotice(type: AuthCallbackOutcome['type']): CallbackNotice {
  if (type === 'recovery') {
    return {
      variant: 'success',
      title: 'Link validado com sucesso',
      message: 'Sua autenticação foi confirmada. Continue para ajustar sua senha no aplicativo.',
      actionLabel: 'Continuar',
    };
  }

  if (type === 'email_change') {
    return {
      variant: 'success',
      title: 'E-mail confirmado',
      message: 'A alteração do seu e-mail foi validada com sucesso.',
      actionLabel: 'Continuar',
    };
  }

  return {
    variant: 'success',
    title: 'E-mail confirmado',
    message: 'Seu cadastro foi confirmado com sucesso.',
    actionLabel: 'Entrar no app',
  };
}

export function RootNavigator() {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [sessionState, setSessionState] = useState<AuthSessionState>('loading');
  const [callbackNotice, setCallbackNotice] = useState<CallbackNotice | null>(null);
  const [planGateState, setPlanGateState] = useState<PlanGateState>('checking');
  const [mfaGateState, setMfaGateState] = useState<MfaGateState>('checking');
  const [isPasswordRecoveryFlow, setIsPasswordRecoveryFlow] = useState(false);
  const [currentUser, setCurrentUser] = useState<AuthenticatedUserSummary | null>(null);

  /**
   * SECURITY: Unlock state gates rendering of AppStack to prevent data leakage.
   * Starts as 'locked' to shield data on init and backgroundâ†’foreground transitions.
   * Only transitions to 'unlocked' after successful biometric verification.
   */
  const [appUnlockState, setAppUnlockState] = useState<AppUnlockState>('locked');

  const lastLoggedUserIdRef = useRef<string | null>(null);
  const appStateRef = useRef(AppState.currentState);
  const isCheckingRef = useRef(false);

  useEffect(() => {
    let isMounted = true;

    const loadCurrentUser = async (session: Session | null): Promise<boolean> => {
      if (!session?.user) {
        if (isMounted) {
          setCurrentUser(null);
          setPlanGateState('checking');
        }
        return false;
      }

      const fallbackFullName =
        typeof session.user.user_metadata.full_name === 'string'
          ? session.user.user_metadata.full_name.trim()
          : '';

      const { data } = await supabase
        .from('profiles')
        .select('full_name, subscription_plan')
        .eq('id', session.user.id)
        .maybeSingle();

      if (!isMounted) {
        return false;
      }

      // Perfis sem plano definido entram automaticamente no plano Free.
      if (!isValidPlanId(data?.subscription_plan)) {
        selectFreePlan().catch((err) => {
          console.warn('Failed to auto-select free plan:', err);
        });
      }

      setPlanGateState('ready');

      setCurrentUser({
        id: session.user.id,
        email: session.user.email ?? null,
        fullName:
          typeof data?.full_name === 'string' && data.full_name.trim().length > 0
            ? data.full_name.trim()
            : fallbackFullName,
      });
      return true;
    };

    const maybeRegisterLogin = async (session: Session | null): Promise<void> => {
      const userId = session?.user?.id ?? null;
      if (!userId || lastLoggedUserIdRef.current === userId) {
        return;
      }

      lastLoggedUserIdRef.current = userId;

      try {
        await registerLoginEvent('sign_in');
      } catch {
        // Ignore telemetry failures during boot
      }
    };

    /**
     * SECURITY: A decisão de bloquear depende apenas do flag local (SecureStore),
     * sem chamadas de rede — uma preferência dessincronizada no servidor não pode
     * destravar o app sozinha.
     */
    const isBiometricLockRequired = async (session: Session | null): Promise<boolean> => {
      if (!session?.user) {
        return false;
      }

      return isBiometricLockEnabledLocally();
    };

    /**
     * SECURITY: Resolves lock state without auto-unlocking.
     * If biometric lock is enabled, the app stays locked until manual unlock action.
     */
    const performBiometricCheck = async (session: Session | null): Promise<void> => {
      if (!session?.user) {
        if (isMounted) {
          setAppUnlockState('locked');
        }
        return;
      }

      // Se já houver uma checagem em andamento, ignora chamadas duplicadas de background
      if (isCheckingRef.current) return;

      try {
        isCheckingRef.current = true; // Ativa a proteção contra duplicidade

        const shouldLock = await isBiometricLockRequired(session);

        if (isMounted) {
          setAppUnlockState(shouldLock ? 'locked' : 'unlocked');
        }
      } catch {
        if (isMounted) {
          setAppUnlockState('locked');
        }
      } finally {
        isCheckingRef.current = false; // Desativa a proteção ao terminar
      }
    };
    const syncSessionState = async (): Promise<void> => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        if (isMounted) {
          setMfaGateState('checking');
          setSessionState('unauthenticated');
        }
        await loadCurrentUser(null);
        return;
      }

      const { data: assurance, error: assuranceError } =
        await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      const requiresChallenge =
        Boolean(assuranceError) ||
        (assurance?.nextLevel === 'aal2' && assurance.currentLevel !== 'aal2');
      if (requiresChallenge) {
        if (isMounted) {
          setMfaGateState('required');
          setCurrentUser(null);
          setPlanGateState('checking');
          setAppUnlockState('locked');
          setSessionState('authenticated');
        }
        return;
      }

      if (isMounted) setMfaGateState('verified');
      const hadValidPlan = await loadCurrentUser(data.session);
      await maybeRegisterLogin(data.session);
      if (hadValidPlan) {
        await performBiometricCheck(data.session);
      }
      if (isMounted) setSessionState('authenticated');
    };

    const handleIncomingUrl = async (url: string): Promise<void> => {
      if (!isAuthCallbackUrl(url)) {
        await syncSessionState();
        return;
      }

      if (isMounted && isRecoveryUrl(url)) {
        setIsPasswordRecoveryFlow(true);
        setCallbackNotice(null);
      }

      try {
        const outcome = await createSessionFromAuthUrl(url);
        if (isMounted && outcome) {
          if (outcome.type === 'recovery') {
            setIsPasswordRecoveryFlow(true);
            setCallbackNotice(null);
          } else {
            setIsPasswordRecoveryFlow(false);
            setCallbackNotice(getSuccessNotice(outcome.type));
          }
        }
      } catch (error) {
        console.error('Não foi possível concluir a autenticação pelo link.', error);
        if (isMounted) {
          setIsPasswordRecoveryFlow(false);
          setCallbackNotice({
            variant: 'error',
            title: 'Link inválido ou expirado',
            message:
              'Não foi possível concluir a confirmação. Solicite um novo e-mail e tente novamente.',
            actionLabel: 'Voltar',
          });
        }
      } finally {
        await syncSessionState();
      }
    };

    const bootstrapSession = async (): Promise<void> => {
      const initialUrl = await Linking.getInitialURL();
      if (initialUrl && isAuthCallbackUrl(initialUrl)) {
        await handleIncomingUrl(initialUrl);
        return;
      }

      await syncSessionState();
    };

    bootstrapSession().catch(() => {
      if (isMounted) {
        setSessionState('unauthenticated');
      }
    });

    const urlSubscription = Linking.addEventListener('url', ({ url }) => {
      handleIncomingUrl(url).catch(() => {
        if (isMounted) {
          setSessionState('unauthenticated');
        }
      });
    });

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (_event === 'PASSWORD_RECOVERY') {
        setIsPasswordRecoveryFlow(true);
        setCallbackNotice(null);
      }
      if (!session) {
        lastLoggedUserIdRef.current = null;
        setAppUnlockState('locked');
      }
      setTimeout(() => {
        syncSessionState().catch(() => {
          if (isMounted) setSessionState('unauthenticated');
        });
      }, 0);
    });

    /**
     * SECURITY: O app é bloqueado assim que vai para background (protegendo os dados
     * na troca de apps) e NUNCA se desbloqueia sozinho ao voltar — quem tem o bloqueio
     * ativo só entra após autenticar no LockScreen (biometria ou PIN do aparelho).
     */
    const appStateSubscription = AppState.addEventListener('change', (nextState) => {
      const previousState = appStateRef.current;
      appStateRef.current = nextState;

      if (nextState === 'background') {
        isBiometricLockEnabledLocally()
          .then((enabled) => {
            if (enabled && isMounted) {
              setAppUnlockState('locked');
            }
          })
          .catch(() => {
            if (isMounted) {
              setAppUnlockState('locked');
            }
          });
        return;
      }

      const becameActive = previousState.match(/inactive|background/) && nextState === 'active';
      if (!becameActive) return;

      supabase.auth
        .getSession()
        .then(async ({ data: sessionData }) => {
          if (!sessionData.session?.user) return;

          const shouldLock = await isBiometricLockRequired(sessionData.session);
          if (!isMounted) return;

          // Libera apenas quem não usa o bloqueio; quem usa permanece travado
          // até autenticar no LockScreen.
          if (!shouldLock) {
            setAppUnlockState('unlocked');
          }
        })
        .catch(() => undefined);
    });

    return () => {
      isMounted = false;
      urlSubscription.remove();
      data.subscription.unsubscribe();
      appStateSubscription.remove();
    };
  }, []);

  // Loading state during bootstrap
  if (sessionState === 'loading') {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primaryLight} />
      </View>
    );
  }

  // Auth callback flow (email confirmation, etc.)
  if (callbackNotice && sessionState !== 'authenticated') {
    return (
      <AuthCallbackResult
        variant={callbackNotice.variant}
        title={callbackNotice.title}
        message={callbackNotice.message}
        actionLabel={callbackNotice.actionLabel}
        onContinue={() => setCallbackNotice(null)}
      />
    );
  }

  // Password recovery flow
  if (isPasswordRecoveryFlow) {
    return <PasswordRecoveryScreen onComplete={() => setIsPasswordRecoveryFlow(false)} />;
  }

  // Authenticated but potentially locked
  if (sessionState === 'authenticated') {
    if (mfaGateState === 'checking') {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primaryLight} />
        </View>
      );
    }

    if (mfaGateState === 'required') {
      return (
        <MfaChallengeScreen
          onVerified={() => {
            setSessionState('loading');
            supabase.auth.refreshSession().catch(() => supabase.auth.signOut());
          }}
          onSignOut={async () => {
            await supabase.auth.signOut();
          }}
        />
      );
    }

    if (planGateState === 'checking') {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primaryLight} />
        </View>
      );
    }

    // SECURITY BARRIER: App is locked or biometric check in progress
    // Shows neutral LockScreen without any sensitive data
    if (appUnlockState === 'locked' || appUnlockState === 'checking') {
      return (
        <LockScreen
          isCheckingBiometric={appUnlockState === 'checking'}
          onManualUnlock={async () => {
            const result = await authenticateWithBiometrics('Desbloqueie o app');
            if (result.success) {
              setAppUnlockState('unlocked');
            } else {
              setAppUnlockState('locked');
            }
          }}
          onSignOut={async () => {
            await supabase.auth.signOut();
          }}
        />
      );
    }

    // SECURITY GATE: AppStack only renders when unlock state is explicitly 'unlocked'
    // This prevents the visual glitch where financial data appears before biometric UI
    if (appUnlockState === 'unlocked') {
      return <AppStack currentUser={currentUser} />;
    }
  }

  // Unauthenticated: show login flow
  return (
    <AuthFlowProvider>
      <AuthStack />
    </AuthFlowProvider>
  );
}

const createStyles = (colors: AppColors) =>
  StyleSheet.create({
    loadingContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.background,
    },
  });



