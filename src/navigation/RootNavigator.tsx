import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import * as Linking from 'expo-linking';
import type { Session } from '@supabase/supabase-js';

import { AuthCallbackResult } from '../features/auth/components/AuthCallbackResult';
import { AuthFlowProvider } from '../features/auth/context/AuthFlowContext';
import {
  createSessionFromAuthUrl,
  isAuthCallbackUrl,
  type AuthCallbackOutcome,
} from '../lib/authRedirect';
import { supabase } from '../lib/supabase';
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
  const [sessionState, setSessionState] = useState<AuthSessionState>('loading');
  const [callbackNotice, setCallbackNotice] = useState<CallbackNotice | null>(null);
  const [currentUser, setCurrentUser] = useState<AuthenticatedUserSummary | null>(null);

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

    const syncSessionState = async () => {
      const { data } = await supabase.auth.getSession();
      await loadCurrentUser(data.session);
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
      setSessionState(session ? 'authenticated' : 'unauthenticated');
    });

    return () => {
      isMounted = false;
      urlSubscription.remove();
      data.subscription.unsubscribe();
    };
  }, []);

  if (sessionState === 'loading') {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
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
    return <AppStack currentUser={currentUser} />;
  }

  return (
    <AuthFlowProvider>
      <AuthStack />
    </AuthFlowProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

