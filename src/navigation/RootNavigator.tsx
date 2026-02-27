import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { AuthFlowProvider } from '../features/auth/context/AuthFlowContext';
import { supabase } from '../lib/supabase';
import type { AuthSessionState } from '../types/auth';
import { AuthStack } from './AuthStack';
import { AppTabs } from './AppTabs';

export function RootNavigator() {
  const [sessionState, setSessionState] = useState<AuthSessionState>('loading');

  useEffect(() => {
    let isMounted = true;

    const bootstrapSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (isMounted) {
        setSessionState(data.session ? 'authenticated' : 'unauthenticated');
      }
    };

    bootstrapSession().catch(() => {
      if (isMounted) {
        setSessionState('unauthenticated');
      }
    });

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setSessionState(session ? 'authenticated' : 'unauthenticated');
    });

    return () => {
      isMounted = false;
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

  if (sessionState === 'authenticated') {
    return <AppTabs />;
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

