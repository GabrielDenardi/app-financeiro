import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Linking from 'expo-linking';
import type { Session } from '@supabase/supabase-js';

import { AuthCallbackResult } from '../features/auth/components/AuthCallbackResult';
import { AuthFlowProvider } from '../features/auth/context/AuthFlowContext';
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

type CallbackNotice = {
  variant: 'success' | 'error';
  title: string;
  message: string;
  actionLabel: string;
};

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
  const [currentUser, setCurrentUser] = useState<AuthenticatedUserSummary | null>(null);
  const [isBiometricChecking, setIsBiometricChecking] = useState(false);
  const [isBiometricLocked, setIsBiometricLocked] = useState(false);
  const lastLoggedUserIdRef = useRef<string | null>(null);
  const appStateRef = useRef(AppState.currentState);

  useEffect(() => {
    let isMounted = true;

    const loadCurrentUser = async (session: Session | null) => {
      if (!session?.user) {
        if (isMounted) {
          setCurrentUser(null);
        }
        return;
      }

      const fallbackFullName =
        typeof session.user.user_metadata.full_name === 'string'
          ? session.user.user_metadata.full_name.trim()
          : '';

      const { data } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', session.user.id)
        .maybeSingle();

      if (!isMounted) {
        return;
      }

      setCurrentUser({
        id: session.user.id,
        email: session.user.email ?? null,
        fullName:
          typeof data?.full_name === 'string' && data.full_name.trim().length > 0
            ? data.full_name.trim()
            : fallbackFullName,
      });
    };

    const maybeRegisterLogin = async (session: Session | null) => {
      const userId = session?.user?.id ?? null;
      if (!userId || lastLoggedUserIdRef.current === userId) {
        return;
      }

      lastLoggedUserIdRef.current = userId;

      try {
        await registerLoginEvent('sign_in');
      } catch {
        // Ignore telemetry failures during boot.
      }
    };

    const maybeRunBiometricCheck = async (session: Session | null) => {
      if (!session?.user) {
        if (isMounted) {
          setIsBiometricLocked(false);
          setIsBiometricChecking(false);
        }
        return;
      }

      try {
        const [preferences, biometricEnabledLocally] = await Promise.all([
          getPreferences(),
          isBiometricLockEnabledLocally(),
        ]);

        if (!preferences.biometricEnabled || !biometricEnabledLocally) {
          if (isMounted) {
            setIsBiometricLocked(false);
            setIsBiometricChecking(false);
          }
          return;
        }

        if (isMounted) {
          setIsBiometricChecking(true);
        }

        const result = await authenticateWithBiometrics('Desbloqueie o app');

        if (!isMounted) {
          return;
        }

        setIsBiometricLocked(!result.success);
      } catch {
        if (isMounted) {
          setIsBiometricLocked(false);
        }
      } finally {
        if (isMounted) {
          setIsBiometricChecking(false);
        }
      }
    };

    const syncSessionState = async () => {
      const { data } = await supabase.auth.getSession();
      await loadCurrentUser(data.session);
      await maybeRegisterLogin(data.session);
      await maybeRunBiometricCheck(data.session);
      if (isMounted) {
        setSessionState(data.session ? 'authenticated' : 'unauthenticated');
      }
    };

    const handleIncomingUrl = async (url: string) => {
      if (!isAuthCallbackUrl(url)) {
        await syncSessionState();
        return;
      }

      try {
        const outcome = await createSessionFromAuthUrl(url);
        if (isMounted && outcome) {
          setCallbackNotice(getSuccessNotice(outcome.type));
        }
      } catch (error) {
        console.error('Não foi possível concluir a autenticação pelo link.', error);
        if (isMounted) {
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

    const bootstrapSession = async () => {
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
      loadCurrentUser(session).catch(() => {
        if (isMounted) {
          setCurrentUser(null);
        }
      });
      if (_event === 'SIGNED_IN') {
        maybeRegisterLogin(session).catch(() => undefined);
      }
      if (_event === 'SIGNED_IN' || _event === 'USER_UPDATED') {
        maybeRunBiometricCheck(session).catch(() => undefined);
      }
      if (!session) {
        lastLoggedUserIdRef.current = null;
        setIsBiometricLocked(false);
      }
      setSessionState(session ? 'authenticated' : 'unauthenticated');
    });

    const appStateSubscription = AppState.addEventListener('change', (nextState) => {
      const previousState = appStateRef.current;
      appStateRef.current = nextState;

      const becameActive = previousState.match(/inactive|background/) && nextState === 'active';
      if (!becameActive) {
        return;
      }

      supabase.auth
        .getSession()
        .then(({ data: sessionData }) => maybeRunBiometricCheck(sessionData.session))
        .catch(() => undefined);
    });

    return () => {
      isMounted = false;
      urlSubscription.remove();
      data.subscription.unsubscribe();
      appStateSubscription.remove();
    };
  }, []);

  if (sessionState === 'loading') {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primaryLight} />
      </View>
    );
  }

  if (callbackNotice) {
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

  if (sessionState === 'authenticated') {
    if (isBiometricChecking) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primaryLight} />
        </View>
      );
    }

    if (isBiometricLocked) {
      return (
        <View style={styles.lockContainer}>
          <Text style={styles.lockTitle}>App bloqueado</Text>
          <Text style={styles.lockMessage}>
            A biometria esta habilitada para esta conta. Use o botao abaixo para desbloquear.
          </Text>
          <Pressable
            style={({ pressed }) => [styles.unlockButton, pressed && styles.pressed]}
            onPress={async () => {
              const { data } = await supabase.auth.getSession();
              if (!data.session) {
                return;
              }

              setIsBiometricChecking(true);
              const result = await authenticateWithBiometrics('Desbloqueie o app');
              setIsBiometricChecking(false);
              setIsBiometricLocked(!result.success);
            }}
          >
            <Text style={styles.unlockButtonText}>Desbloquear</Text>
          </Pressable>
          <Pressable
            onPress={async () => {
              await supabase.auth.signOut();
            }}
          >
            <Text style={styles.signOutText}>Sair da conta</Text>
          </Pressable>
        </View>
      );
    }

    return <AppStack currentUser={currentUser} />;
  }

  return (
    <AuthFlowProvider>
      <AuthStack />
    </AuthFlowProvider>
  );
}

const createStyles = (colors: AppColors) => StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  lockContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 16,
    backgroundColor: colors.background,
  },
  lockTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  lockMessage: {
    fontSize: 14,
    textAlign: 'center',
    color: colors.textSecondary,
  },
  unlockButton: {
    minWidth: 180,
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  unlockButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  signOutText: {
    color: colors.danger,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.85,
  },
});

