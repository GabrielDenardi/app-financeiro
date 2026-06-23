import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { supabase } from '../../../lib/supabase';
import { useThemeColors } from '../../../theme';
import { getMfaErrorMessage } from '../utils/mfaErrors';

type Props = {
  onVerified: () => void;
  onSignOut: () => Promise<void>;
};

export function MfaChallengeScreen({ onVerified, onSignOut }: Props) {
  const colors = useThemeColors();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const verify = async () => {
    if (!/^\d{6}$/.test(code)) {
      setError('Digite o código de 6 dígitos do seu autenticador.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
      if (factorsError) throw factorsError;
      const factor = factors.totp.find((item) => item.status === 'verified');
      if (!factor) throw new Error('MFA factor not found');

      const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
        factorId: factor.id,
        code,
      });
      if (verifyError) throw verifyError;
      onVerified();
    } catch (verificationError) {
      setError(getMfaErrorMessage(verificationError));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.card, { backgroundColor: colors.surface }]}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Verificação em duas etapas</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Abra seu aplicativo autenticador e informe o código atual.
        </Text>
        <TextInput
          value={code}
          onChangeText={(value) => {
            setCode(value.replace(/\D/g, '').slice(0, 6));
            setError(null);
          }}
          keyboardType="number-pad"
          maxLength={6}
          autoFocus
          secureTextEntry
          style={[styles.input, { color: colors.textPrimary, borderColor: error ? colors.danger : colors.border }]}
          placeholder="000000"
          placeholderTextColor={colors.textSecondary}
        />
        {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
        <Pressable style={[styles.primary, { backgroundColor: colors.primary }]} onPress={verify} disabled={loading}>
          {loading ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={[styles.primaryText, { color: colors.white }]}>Verificar</Text>
          )}
        </Pressable>
        <Pressable style={styles.secondary} onPress={onSignOut} disabled={loading}>
          <Text style={[styles.secondaryText, { color: colors.textSecondary }]}>Sair da conta</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 420, borderRadius: 20, padding: 24, gap: 14 },
  title: { fontSize: 24, fontWeight: '700' },
  subtitle: { fontSize: 15, lineHeight: 22 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 24, letterSpacing: 8, textAlign: 'center' },
  error: { fontSize: 13 },
  primary: { minHeight: 50, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  primaryText: { fontSize: 16, fontWeight: '700' },
  secondary: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { fontSize: 14, fontWeight: '600' },
});
