import { Alert, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';

import { supabase } from '../lib/supabase';
import { colors, radius, spacing, typography } from '../theme';

export function SettingsScreen() {
  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();

    if (error) {
      Alert.alert('Erro', 'Nao foi possivel sair agora. Tente novamente.');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.title}>Configuracoes</Text>
        <Text style={styles.subtitle}>
          Use o botao abaixo para encerrar sua sessao e voltar para o fluxo de login.
        </Text>

        <Pressable
          onPress={handleSignOut}
          style={({ pressed }) => [styles.signOutButton, pressed && styles.pressed]}
        >
          <Text style={styles.signOutText}>Sair da conta</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
  pressed: {
    opacity: 0.85,
  },
});

