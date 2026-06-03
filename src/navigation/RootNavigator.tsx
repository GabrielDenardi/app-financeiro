import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Linking from 'expo-linking';
import type { Session } from '@supabase/supabase-js';

import { AuthCallbackResult } from '../features/auth/components/AuthCallbackResult';
import { AuthFlowProvider } from '../features/auth/context/AuthFlowContext';
import { PasswordRecoveryScreen } from '../features/auth/screens/AuthScreens';
import { isValidPlanId, SUBSCRIPTION_PLANS } from '../features/plans/plans';
import type { SubscriptionPlanId } from '../features/plans/types';
import {
  createSessionFromAuthUrl,
  isAuthCallbackUrl,
  type AuthCallbackOutcome,
} from '../lib/authRedirect';
import {
  authenticateWithBiometrics,
  isBiometricLockEnabledLocally,
} from '../features/preferences/services/biometricService';
import { getPreferences, registerLoginEvent } from '../features/preferences/services/preferencesService';
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
type PlanGateState = 'checking' | 'required' | 'ready';

const PLAN_ORDER: SubscriptionPlanId[] = ['basic', 'intermediate', 'pro'];

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
  const [isSelectingPlan, setIsSelectingPlan] = useState(false);
  const [isPasswordRecoveryFlow, setIsPasswordRecoveryFlow] = useState(false);
  const [currentUser, setCurrentUser] = useState<AuthenticatedUserSummary | null>(null);
  const [isBiometricLocked, setIsBiometricLocked] = useState(false);

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

      if (isMounted) {
        setPlanGateState('checking');
        setAppUnlockState('locked');
      }

      const { data } = await supabase
        .from('profiles')
        .select('full_name, subscription_plan')
        .eq('id', session.user.id)
        .maybeSingle();

      if (!isMounted) {
        return false;
      }

      if (!isValidPlanId(data?.subscription_plan)) {
        setPlanGateState('required');
        setCurrentUser({
          id: session.user.id,
          email: session.user.email ?? null,
          fullName: fallbackFullName || 'Usuario',
        });
        return false;
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

    const isBiometricLockRequired = async (session: Session | null): Promise<boolean> => {
      if (!session?.user) {
        return false;
      }

      const [preferences, biometricEnabledLocally] = await Promise.all([
        getPreferences(),
        isBiometricLockEnabledLocally(),
      ]);

      return preferences.biometricEnabled && biometricEnabledLocally;
    };

    /**
     * SECURITY: Resolves lock state without auto-unlocking.
     * If biometric lock is enabled, the app stays locked until manual unlock action.
     */
    const performBiometricCheck = async (session: Session | null): Promise<void> => {
      if (!session?.user) {
        if (isMounted) {
          setIsBiometricLocked(false);
          setAppUnlockState('locked');
        }
        return;
      }

      // Se já houver uma checagem em andamento, ignora chamadas duplicadas de background
      if (isCheckingRef.current) return;

      try {
        isCheckingRef.current = true; // Ativa a proteção contra duplicidade

        const shouldLock = await isBiometricLockRequired(session);

        // Se o usuário desativou a biometria nas configurações, libera o app direto
        if (!shouldLock) {
          if (isMounted) {
            setIsBiometricLocked(false);
            setAppUnlockState('unlocked');
          }
          return;
        }

        // Com biometria ativa, mantém o app bloqueado até desbloqueio manual no LockScreen.
        if (isMounted) {
          setIsBiometricLocked(true);
          setAppUnlockState('locked');
        }
      } catch {
        if (isMounted) {
          setIsBiometricLocked(true);
          setAppUnlockState('locked');
        }
      } finally {
        isCheckingRef.current = false; // Desativa a proteção ao terminar
      }
    };
    const syncSessionState = async (): Promise<void> => {
      const { data } = await supabase.auth.getSession();
      const hadValidPlan = data.session ? await loadCurrentUser(data.session) : false;
      await maybeRegisterLogin(data.session);
      if (hadValidPlan) {
        await performBiometricCheck(data.session);
      }
      if (isMounted) {
        setSessionState(data.session ? 'authenticated' : 'unauthenticated');
      }
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
      const planCheckPromise = loadCurrentUser(session).catch(() => {
        if (isMounted) {
          setCurrentUser(null);
          setPlanGateState(session ? 'required' : 'checking');
        }
        return false;
      });
      if (_event === 'SIGNED_IN') {
        maybeRegisterLogin(session).catch(() => undefined);
      }
      if (!session) {
        lastLoggedUserIdRef.current = null;
        setIsBiometricLocked(false);
        setAppUnlockState('locked');
      }

      const nextSessionState = session ? 'authenticated' : 'unauthenticated';

      if (session && (_event === 'SIGNED_IN' || _event === 'USER_UPDATED')) {
        planCheckPromise
          .then((hadValidPlan) => (hadValidPlan ? performBiometricCheck(session) : undefined))
          .catch(() => undefined)
          .finally(() => {
            if (isMounted) {
              setSessionState(nextSessionState);
            }
          });
        return;
      }

      setSessionState(nextSessionState);
    });

    /**
     * SECURITY: AppState listener resolves lock state on background->foreground transition.
     * It only locks users who have biometric lock enabled, avoiding trapping accounts that opted out.
     */
    const appStateSubscription = AppState.addEventListener('change', (nextState) => {
      const previousState = appStateRef.current;
      appStateRef.current = nextState;

      const becameActive = previousState.match(/inactive|background/) && nextState === 'active';
      if (!becameActive) return;

      supabase.auth
        .getSession()
        .then(async ({ data: sessionData }) => {
          const shouldLock = await isBiometricLockRequired(sessionData.session);
          if (!isMounted) return;

          setIsBiometricLocked(shouldLock);
          setAppUnlockState(shouldLock ? 'locked' : 'unlocked');
        })
        .catch(() => {
          if (isMounted) {
            setIsBiometricLocked(true);
            setAppUnlockState('locked');
          }
        });
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
    if (planGateState === 'checking') {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primaryLight} />
        </View>
      );
    }

    if (planGateState === 'required') {
      return (
        <RequiredPlanScreen
          colors={colors}
          styles={styles}
          isSelectingPlan={isSelectingPlan}
          onSelectPlan={async (planId) => {
            if (!currentUser?.id) {
              return;
            }

            setIsSelectingPlan(true);
            try {
              const { error } = await supabase
                .from('profiles')
                .update({ subscription_plan: planId })
                .eq('id', currentUser.id);

              if (error) {
                throw error;
              }

              setPlanGateState('ready');
              setAppUnlockState('unlocked');
            } finally {
              setIsSelectingPlan(false);
            }
          }}
          onSignOut={async () => {
            await supabase.auth.signOut();
          }}
        />
      );
    }

    // SECURITY BARRIER: App is locked or biometric check in progress
    // Shows neutral LockScreen without any sensitive data
    if (appUnlockState === 'locked' || appUnlockState === 'checking') {
      return (
        <LockScreen
          isCheckingBiometric={appUnlockState === 'checking'}
          onManualUnlock={async () => {
            setAppUnlockState('checking');
            const result = await authenticateWithBiometrics('Desbloqueie o app');
            if (result.success) {
              setIsBiometricLocked(false);
              setAppUnlockState('unlocked');
            } else {
              setIsBiometricLocked(true);
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

function RequiredPlanScreen({
  colors,
  styles,
  isSelectingPlan,
  onSelectPlan,
  onSignOut,
}: {
  colors: AppColors;
  styles: ReturnType<typeof createStyles>;
  isSelectingPlan: boolean;
  onSelectPlan: (planId: SubscriptionPlanId) => Promise<void>;
  onSignOut: () => Promise<void>;
}) {
  return (
    <View style={styles.planGateContainer}>
      <ScrollView contentContainerStyle={styles.planGateContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.planGateTitle}>Escolha um plano</Text>
        <Text style={styles.planGateSubtitle}>
          Sua conta foi criada. Para acessar o aplicativo, selecione um plano.
        </Text>

        {PLAN_ORDER.map((planId) => {
          const plan = SUBSCRIPTION_PLANS[planId];

          return (
            <View key={plan.id} style={styles.planGateCard}>
              <View style={styles.planGateHeader}>
                <View>
                  <Text style={styles.planGateName}>{plan.name}</Text>
                  <Text style={styles.planGatePrice}>{plan.priceLabel}/mes</Text>
                </View>
                <Text style={styles.planGateLimit}>{plan.accountLimit} conta(s)</Text>
              </View>

              {plan.benefits.map((benefit) => (
                <Text key={benefit} style={styles.planGateBenefit}>
                  - {benefit}
                </Text>
              ))}

              <Pressable
                style={[styles.planGateButton, isSelectingPlan && styles.planGateButtonDisabled]}
                disabled={isSelectingPlan}
                onPress={() => onSelectPlan(plan.id)}
              >
                <Text style={styles.planGateButtonText}>
                  {isSelectingPlan ? 'Salvando...' : 'Assinar plano'}
                </Text>
              </Pressable>
            </View>
          );
        })}

        <Pressable style={styles.planGateSignOut} onPress={onSignOut}>
          <Text style={styles.planGateSignOutText}>Sair da conta</Text>
        </Pressable>
      </ScrollView>
    </View>
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
    planGateContainer: {
      flex: 1,
      backgroundColor: colors.background,
    },
    planGateContent: {
      padding: 24,
      gap: 16,
      paddingTop: 56,
      paddingBottom: 36,
    },
    planGateTitle: {
      color: colors.textPrimary,
      fontSize: 28,
      fontWeight: '800',
    },
    planGateSubtitle: {
      color: colors.textSecondary,
      fontSize: 15,
      lineHeight: 21,
    },
    planGateCard: {
      gap: 12,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      backgroundColor: colors.surface,
      padding: 16,
    },
    planGateHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 12,
    },
    planGateName: {
      color: colors.textPrimary,
      fontSize: 18,
      fontWeight: '800',
    },
    planGatePrice: {
      color: colors.primary,
      fontSize: 15,
      fontWeight: '800',
      marginTop: 4,
    },
    planGateLimit: {
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: '700',
    },
    planGateBenefit: {
      color: colors.textSecondary,
      fontSize: 14,
      lineHeight: 19,
    },
    planGateButton: {
      minHeight: 48,
      borderRadius: 12,
      backgroundColor: colors.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 4,
    },
    planGateButtonDisabled: {
      opacity: 0.7,
    },
    planGateButtonText: {
      color: colors.white,
      fontSize: 15,
      fontWeight: '800',
    },
    planGateSignOut: {
      alignItems: 'center',
      paddingVertical: 12,
    },
    planGateSignOutText: {
      color: colors.textSecondary,
      fontSize: 14,
      fontWeight: '700',
    },
  });



