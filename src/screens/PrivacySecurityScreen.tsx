import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { ArrowLeft, Download, ShieldCheck, Trash2, X } from 'lucide-react-native';

import { useAuthenticatedUser } from '../features/auth/hooks/useAuthenticatedUser';
import {
  useDisableTotpMutation,
  useEnrollTotpMutation,
  useLoginEvents,
  useMfaFactors,
  usePreferences,
  useRequestDeletionMutation,
  useRequestExportMutation,
  useUpdatePreferencesMutation,
  useVerifyTotpMutation,
} from '../features/preferences/hooks/usePreferences';
import {
  canUseBiometricLock,
  setBiometricLockEnabled,
} from '../features/preferences/services/biometricService';
import { colors, radius, spacing, typography } from '../theme';

export function PrivacySecurityScreen({ navigation }: any) {
  const currentUser = useAuthenticatedUser();
  const preferencesQuery = usePreferences(currentUser?.id);
  const loginEventsQuery = useLoginEvents(currentUser?.id);
  const mfaFactorsQuery = useMfaFactors(currentUser?.id);
  const updatePreferencesMutation = useUpdatePreferencesMutation(currentUser?.id);
  const enrollTotpMutation = useEnrollTotpMutation(currentUser?.id);
  const verifyTotpMutation = useVerifyTotpMutation(currentUser?.id);
  const disableTotpMutation = useDisableTotpMutation(currentUser?.id);
  const requestExportMutation = useRequestExportMutation(currentUser?.id);
  const requestDeletionMutation = useRequestDeletionMutation(currentUser?.id);

  const [mfaModalVisible, setMfaModalVisible] = useState(false);
  const [mfaCode, setMfaCode] = useState('');
  const [enrollment, setEnrollment] = useState<{
    factorId: string;
    qrCode: string;
    secret: string;
    uri: string;
  } | null>(null);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deleteReason, setDeleteReason] = useState('');
  const [deletePassword, setDeletePassword] = useState('');

  const preferences = preferencesQuery.data;

  const handleToggleBiometric = async (nextValue: boolean) => {
    try {
      if (nextValue) {
        const available = await canUseBiometricLock();
        if (!available) {
          Alert.alert('Biometria indisponivel', 'O dispositivo nao possui biometria configurada.');
          return;
        }
      }

      await setBiometricLockEnabled(nextValue);
      await updatePreferencesMutation.mutateAsync({
        biometricEnabled: nextValue,
      });
    } catch (error) {
      Alert.alert('Erro', error instanceof Error ? error.message : 'Nao foi possivel atualizar a biometria.');
    }
  };

  const handleTogglePreference = async (key: 'hideValuesHome' | 'loginAlertsEnabled' | 'shareAnonymousStats', value: boolean) => {
    try {
      await updatePreferencesMutation.mutateAsync({
        [key]: value,
      });
    } catch (error) {
      Alert.alert('Erro', error instanceof Error ? error.message : 'Nao foi possivel atualizar a preferencia.');
    }
  };

  const handleToggleTwoFactor = async (nextValue: boolean) => {
    try {
      if (nextValue) {
        const data = await enrollTotpMutation.mutateAsync();
        setEnrollment(data);
        setMfaModalVisible(true);
        return;
      }

      const verifiedFactor = mfaFactorsQuery.data?.[0];
      if (!verifiedFactor) {
        return;
      }

      await disableTotpMutation.mutateAsync(verifiedFactor.id);
    } catch (error) {
      Alert.alert('Erro', error instanceof Error ? error.message : 'Nao foi possivel atualizar o MFA.');
    }
  };

  const handleVerifyTotp = async () => {
    if (!enrollment) {
      return;
    }

    try {
      await verifyTotpMutation.mutateAsync({
        factorId: enrollment.factorId,
        code: mfaCode,
      });
      setMfaModalVisible(false);
      setEnrollment(null);
      setMfaCode('');
    } catch (error) {
      Alert.alert('Codigo invalido', error instanceof Error ? error.message : 'Nao foi possivel validar o TOTP.');
    }
  };

  const handleRequestExport = async () => {
    try {
      const signedUrl = await requestExportMutation.mutateAsync();
      if (signedUrl) {
        await Linking.openURL(signedUrl);
        Alert.alert('Exportacao pronta', 'O arquivo foi gerado e o download foi iniciado.');
        return;
      }

      Alert.alert('Exportacao solicitada', 'A requisicao foi registrada, mas o link ainda nao ficou disponivel.');
    } catch (error) {
      Alert.alert('Erro', error instanceof Error ? error.message : 'Nao foi possivel solicitar a exportacao.');
    }
  };

  const handleRequestDeletion = async () => {
    try {
      await requestDeletionMutation.mutateAsync({
        reason: deleteReason,
        password: deletePassword,
      });
      setDeleteModalVisible(false);
      setDeleteReason('');
      setDeletePassword('');
      Alert.alert('Conta excluida', 'Sua conta foi removida e a sessao atual foi encerrada.');
    } catch (error) {
      Alert.alert('Erro', error instanceof Error ? error.message : 'Nao foi possivel solicitar a exclusao.');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
            <ArrowLeft size={22} color={colors.textPrimary} />
          </Pressable>
          <View style={styles.headerText}>
            <Text style={styles.title}>Privacidade e seguranca</Text>
            <Text style={styles.subtitle}>MFA, biometria, exportacao e exclusao reais.</Text>
          </View>
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <ShieldCheck size={18} color={colors.primary} />
            <Text style={styles.sectionTitle}>Controles</Text>
          </View>

          <PreferenceRow
            label="Autenticacao em duas etapas"
            description="Via TOTP do Supabase Auth."
            value={preferences?.twoFactorEnabled ?? false}
            loading={disableTotpMutation.isPending || enrollTotpMutation.isPending || verifyTotpMutation.isPending}
            onChange={handleToggleTwoFactor}
          />
          <PreferenceRow
            label="Bloqueio por biometria"
            description="Exige biometria ao abrir o app."
            value={preferences?.biometricEnabled ?? false}
            loading={updatePreferencesMutation.isPending}
            onChange={handleToggleBiometric}
          />
          <PreferenceRow
            label="Ocultar valores na tela inicial"
            description="Esconde saldos e totais na Home."
            value={preferences?.hideValuesHome ?? false}
            loading={updatePreferencesMutation.isPending}
            onChange={(value) => handleTogglePreference('hideValuesHome', value)}
          />
          <PreferenceRow
            label="Alertas de login"
            description="Registra e exibe acessos recentes."
            value={preferences?.loginAlertsEnabled ?? false}
            loading={updatePreferencesMutation.isPending}
            onChange={(value) => handleTogglePreference('loginAlertsEnabled', value)}
          />
          <PreferenceRow
            label="Compartilhar estatisticas anonimas"
            description="Mantem apenas telemetria opcional."
            value={preferences?.shareAnonymousStats ?? false}
            loading={updatePreferencesMutation.isPending}
            onChange={(value) => handleTogglePreference('shareAnonymousStats', value)}
          />
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Operacoes</Text>
          <Pressable style={styles.actionButton} onPress={handleRequestExport}>
            <Download size={18} color={colors.primary} />
            <Text style={styles.actionText}>Exportar meus dados</Text>
            {requestExportMutation.isPending ? <ActivityIndicator /> : null}
          </Pressable>
          <Pressable style={[styles.actionButton, styles.dangerAction]} onPress={() => setDeleteModalVisible(true)}>
            <Trash2 size={18} color={colors.danger} />
            <Text style={[styles.actionText, styles.dangerText]}>Excluir minha conta</Text>
          </Pressable>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Acessos recentes</Text>
          {loginEventsQuery.isLoading ? (
            <ActivityIndicator />
          ) : loginEventsQuery.data?.length ? (
            loginEventsQuery.data.map((event) => (
              <View key={event.id} style={styles.loginEventRow}>
                <View>
                  <Text style={styles.loginEventTitle}>{event.eventType}</Text>
                  <Text style={styles.loginEventMeta}>
                    {event.deviceLabel || event.platform} • {new Date(event.createdAt).toLocaleString('pt-BR')}
                  </Text>
                </View>
              </View>
            ))
          ) : (
            <Text style={styles.emptyText}>Nenhum evento registrado ainda.</Text>
          )}
        </View>
      </ScrollView>

      <Modal visible={mfaModalVisible} transparent animationType="slide" onRequestClose={() => setMfaModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={() => setMfaModalVisible(false)} />
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Confirmar MFA</Text>
              <Pressable onPress={() => setMfaModalVisible(false)}>
                <X size={22} color={colors.textPrimary} />
              </Pressable>
            </View>

            {enrollment ? (
              <>
                <View style={styles.qrWrap}>
                  <QRCode value={enrollment.uri} size={180} />
                </View>
                <Text style={styles.secretText}>Chave secreta: {enrollment.secret}</Text>
                <TextInput
                  placeholder="Codigo de 6 digitos"
                  value={mfaCode}
                  onChangeText={setMfaCode}
                  keyboardType="number-pad"
                  style={styles.modalInput}
                  placeholderTextColor={colors.textSecondary}
                />
                <View style={styles.modalActions}>
                  <Pressable style={styles.secondaryButton} onPress={() => setMfaModalVisible(false)}>
                    <Text style={styles.secondaryButtonText}>Cancelar</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.primaryButton, verifyTotpMutation.isPending && styles.primaryButtonDisabled]}
                    onPress={handleVerifyTotp}
                    disabled={verifyTotpMutation.isPending}
                  >
                    {verifyTotpMutation.isPending ? (
                      <ActivityIndicator color={colors.white} />
                    ) : (
                      <Text style={styles.primaryButtonText}>Verificar</Text>
                    )}
                  </Pressable>
                </View>
              </>
            ) : null}
          </View>
        </View>
      </Modal>

      <Modal visible={deleteModalVisible} transparent animationType="slide" onRequestClose={() => setDeleteModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={() => setDeleteModalVisible(false)} />
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Excluir conta</Text>
              <Pressable onPress={() => setDeleteModalVisible(false)}>
                <X size={22} color={colors.textPrimary} />
              </Pressable>
            </View>
            <TextInput
              placeholder="Motivo"
              value={deleteReason}
              onChangeText={setDeleteReason}
              style={styles.modalInput}
              placeholderTextColor={colors.textSecondary}
            />
            <TextInput
              placeholder="Senha atual"
              value={deletePassword}
              onChangeText={setDeletePassword}
              secureTextEntry
              style={styles.modalInput}
              placeholderTextColor={colors.textSecondary}
            />
            <View style={styles.modalActions}>
              <Pressable style={styles.secondaryButton} onPress={() => setDeleteModalVisible(false)}>
                <Text style={styles.secondaryButtonText}>Cancelar</Text>
              </Pressable>
              <Pressable
                style={[styles.primaryButton, requestDeletionMutation.isPending && styles.primaryButtonDisabled]}
                onPress={handleRequestDeletion}
                disabled={requestDeletionMutation.isPending}
              >
                {requestDeletionMutation.isPending ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Text style={styles.primaryButtonText}>Confirmar</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function PreferenceRow({
  label,
  description,
  value,
  loading,
  onChange,
}: {
  label: string;
  description: string;
  value: boolean;
  loading?: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.preferenceRow}>
      <View style={styles.preferenceText}>
        <Text style={styles.preferenceLabel}>{label}</Text>
        <Text style={styles.preferenceDescription}>{description}</Text>
      </View>
      {loading ? <ActivityIndicator /> : <Switch value={value} onValueChange={onChange} />}
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
    paddingBottom: 80,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.xl,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
  },
  title: {
    ...typography.h1,
    color: colors.textPrimary,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  sectionCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  sectionTitle: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  preferenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  preferenceText: {
    flex: 1,
  },
  preferenceLabel: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  preferenceDescription: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  actionButton: {
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  actionText: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '700',
    flex: 1,
  },
  dangerAction: {
    borderColor: '#FECACA',
    backgroundColor: '#FFF5F5',
  },
  dangerText: {
    color: colors.danger,
  },
  loginEventRow: {
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  loginEventTitle: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  loginEventMeta: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  emptyText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15, 23, 42, 0.35)',
  },
  modalBackdrop: {
    flex: 1,
  },
  modalSheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: spacing.lg,
    gap: spacing.md,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalTitle: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  qrWrap: {
    alignItems: 'center',
    backgroundColor: colors.white,
    padding: spacing.md,
    borderRadius: radius.lg,
  },
  secretText: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  modalInput: {
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    color: colors.textPrimary,
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  secondaryButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  primaryButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    ...typography.body,
    color: colors.white,
    fontWeight: '700',
  },
});
