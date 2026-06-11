import { type ReactNode, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { Database, Download, Lock, ShieldCheck, Trash2, X } from 'lucide-react-native';

import { Card } from '../components/Card';
import { PageHeader } from '../components/PageHeader';
import { PageShell } from '../components/PageShell';
import { appEnv } from '../config/env';
import { useAuthenticatedUser } from '../features/auth/hooks/useAuthenticatedUser';
import { useCurrentPlan } from '../features/plans/hooks';
import { getUpgradeMessage } from '../features/plans/plans';
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
  authenticateWithBiometrics,
  canUseBiometricLock,
  setBiometricLockEnabled,
} from '../features/preferences/services/biometricService';
import { radius, spacing, typography, type AppColors, useThemeColors } from '../theme';

export function PrivacySecurityScreen({ navigation }: any) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const user = useAuthenticatedUser();
  const currentPlan = useCurrentPlan(user?.id);
  const preferencesQuery = usePreferences(user?.id);
  const loginEventsQuery = useLoginEvents(user?.id);
  const mfaFactorsQuery = useMfaFactors(user?.id);
  const updatePref = useUpdatePreferencesMutation(user?.id);
  const enrollTotp = useEnrollTotpMutation(user?.id);
  const verifyTotp = useVerifyTotpMutation(user?.id);
  const disableTotp = useDisableTotpMutation(user?.id);
  const exportData = useRequestExportMutation(user?.id);
  const deleteAccount = useRequestDeletionMutation(user?.id);

  const [mfaOpen, setMfaOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [mfaCode, setMfaCode] = useState('');
  const [reason, setReason] = useState('');
  const [password, setPassword] = useState('');
  const [enrollment, setEnrollment] = useState<{ factorId: string; qrCode: string; secret: string; uri: string } | null>(null);

  const prefs = preferencesQuery.data;
  const mfaBusy = enrollTotp.isPending || verifyTotp.isPending || disableTotp.isPending;

  const onTogglePref = async (
    key: 'hideValuesHome' | 'loginAlertsEnabled' | 'shareAnonymousStats' | 'requireGroupExpenseReceipt',
    value: boolean,
  ) => {
    try {
      await updatePref.mutateAsync({ [key]: value });
    } catch (error) {
      Alert.alert('Erro', error instanceof Error ? error.message : 'Nao foi possivel atualizar a preferencia.');
    }
  };

  const onToggleBiometric = async (value: boolean) => {
    try {
      if (value && !(await canUseBiometricLock())) {
        Alert.alert('Biometria indisponivel', 'O dispositivo nao possui biometria configurada.');
        return;
      }

      // Exige autenticacao tanto para ativar quanto para desativar o bloqueio,
      // impedindo que alguem com o celular desbloqueado desative a protecao.
      const result = await authenticateWithBiometrics(
        value ? 'Confirme para ativar o bloqueio' : 'Confirme para desativar o bloqueio',
      );
      if (!result.success) {
        return;
      }

      await setBiometricLockEnabled(value);
      await updatePref.mutateAsync({ biometricEnabled: value });
    } catch (error) {
      Alert.alert('Erro', error instanceof Error ? error.message : 'Nao foi possivel atualizar a biometria.');
    }
  };

  const onToggleTwoFactor = async (value: boolean) => {
    try {
      if (value) {
        const data = await enrollTotp.mutateAsync();
        setEnrollment(data);
        setMfaCode('');
        setMfaOpen(true);
        return;
      }

      const factor = mfaFactorsQuery.data?.[0];
      if (factor) {
        await disableTotp.mutateAsync(factor.id);
      }
    } catch (error) {
      Alert.alert('Erro', error instanceof Error ? error.message : 'Nao foi possivel atualizar o MFA.');
    }
  };

  const onVerifyMfa = async () => {
    if (!enrollment) {
      return;
    }

    try {
      await verifyTotp.mutateAsync({ factorId: enrollment.factorId, code: mfaCode });
      setMfaOpen(false);
      setEnrollment(null);
      setMfaCode('');
    } catch (error) {
      Alert.alert('Codigo invalido', error instanceof Error ? error.message : 'Nao foi possivel validar o TOTP.');
    }
  };

  const onExport = async () => {
    if (!currentPlan.entitlements.dataImportExport) {
      Alert.alert('Plano necessario', getUpgradeMessage('Exportar dados'));
      return;
    }

    try {
      const url = await exportData.mutateAsync();
      if (!url) {
        Alert.alert('Exportacao solicitada', 'A requisicao foi registrada, mas o link ainda nao ficou disponivel.');
        return;
      }

      await Linking.openURL(url);
      Alert.alert('Exportacao pronta', 'O download foi iniciado.');
    } catch (error) {
      Alert.alert('Erro', error instanceof Error ? error.message : 'Nao foi possivel solicitar a exportacao.');
    }
  };

  const onDelete = async () => {
    try {
      await deleteAccount.mutateAsync({ reason, password });
      setDeleteOpen(false);
      setReason('');
      setPassword('');
      Alert.alert('Conta excluida', 'Sua conta foi removida e a sessao atual foi encerrada.');
    } catch (error) {
      Alert.alert('Erro', error instanceof Error ? error.message : 'Nao foi possivel solicitar a exclusao.');
    }
  };

  const onOpenPolicy = () => {
    if (!appEnv.privacyPolicyUrl) {
      Alert.alert('Link indisponivel', 'Defina EXPO_PUBLIC_PRIVACY_POLICY_URL para abrir a politica.');
      return;
    }

    Linking.openURL(appEnv.privacyPolicyUrl).catch(() => {
      Alert.alert('Erro', 'Nao foi possivel abrir a politica de privacidade.');
    });
  };

  return (
    <PageShell>
      <PageHeader title="Privacidade e Seguranca" onBackPress={() => navigation.goBack()} />

      {preferencesQuery.isLoading && !prefs ? (
        <Card style={styles.cardCenter}>
          <ActivityIndicator color={colors.primaryLight} />
        </Card>
      ) : null}
      {preferencesQuery.isError ? (
        <Card style={styles.cardCenter}>
          <Text style={styles.desc}>Nao foi possivel carregar suas preferencias.</Text>
          <Pressable style={styles.linkBtn} onPress={() => preferencesQuery.refetch()}>
            <Text style={styles.linkBtnText}>Tentar novamente</Text>
          </Pressable>
        </Card>
      ) : null}

      {prefs ? (
        <>
          <Section
            title="Seguranca"
            icon={<ShieldCheck size={18} color={colors.textPrimary} />}
            styles={styles}
          >
            <PrefRow
              label="Autenticacao em duas etapas"
              desc="Adiciona uma camada extra de seguranca."
              value={prefs.twoFactorEnabled}
              loading={mfaBusy}
              onChange={onToggleTwoFactor}
              styles={styles}
            />
            <PrefRow
              label="Bloqueio por biometria"
              desc="Exige biometria ou o PIN do aparelho ao abrir o app."
              value={prefs.biometricEnabled}
              loading={updatePref.isPending}
              onChange={onToggleBiometric}
              styles={styles}
            />
            <PrefRow
              label="Alertas de login"
              desc="Notificar sobre novos acessos."
              value={prefs.loginAlertsEnabled}
              loading={updatePref.isPending}
              onChange={(value) => onTogglePref('loginAlertsEnabled', value)}
              styles={styles}
            />
          </Section>

          <Section title="Privacidade" icon={<Lock size={18} color={colors.textPrimary} />} styles={styles}>
            <PrefRow
              label="Ocultar valores na tela inicial"
              desc="Protege seus dados em publico."
              value={prefs.hideValuesHome}
              loading={updatePref.isPending}
              onChange={(value) => onTogglePref('hideValuesHome', value)}
              styles={styles}
            />
            <PrefRow
              label="Compartilhar estatisticas anonimas"
              desc="Ajuda a melhorar o app."
              value={prefs.shareAnonymousStats}
              loading={updatePref.isPending}
              onChange={(value) => onTogglePref('shareAnonymousStats', value)}
              styles={styles}
            />
            <PrefRow
              label="Exigir comprovante em despesas de grupo"
              desc="Quando ativo, novos lancamentos de despesa em grupo exigem NF ou notinha."
              value={prefs.requireGroupExpenseReceipt}
              loading={updatePref.isPending}
              onChange={(value) => onTogglePref('requireGroupExpenseReceipt', value)}
              styles={styles}
            />
          </Section>

          <Section title="Seus Dados" icon={<Database size={18} color={colors.textPrimary} />} styles={styles}>
            <Pressable style={styles.action} onPress={onExport}>
              <Download size={18} color={colors.textPrimary} />
              <Text style={styles.actionText}>
                {currentPlan.entitlements.dataImportExport ? 'Exportar meus dados' : 'Exportar meus dados (Pro)'}
              </Text>
              {exportData.isPending ? <ActivityIndicator /> : null}
            </Pressable>
            <Pressable style={[styles.action, styles.danger]} onPress={() => setDeleteOpen(true)}>
              <Trash2 size={18} color={colors.danger} />
              <Text style={[styles.actionText, styles.dangerText]}>Excluir minha conta</Text>
            </Pressable>
          </Section>
        </>
      ) : null}

      <Card style={styles.card}>
        <Text style={styles.sectionTitle}>Acessos recentes</Text>
        {loginEventsQuery.isLoading ? <ActivityIndicator color={colors.primaryLight} /> : null}
        {loginEventsQuery.isError ? <Text style={styles.desc}>Nao foi possivel carregar os acessos.</Text> : null}
        {!loginEventsQuery.isLoading && !loginEventsQuery.isError && !(loginEventsQuery.data?.length) ? (
          <Text style={styles.desc}>Nenhum evento registrado ainda.</Text>
        ) : null}
        {(loginEventsQuery.data ?? []).map((item) => (
          <View key={item.id} style={styles.event}>
            <Text style={styles.eventTitle}>{item.eventType}</Text>
            <Text style={styles.eventMeta}>
              {item.deviceLabel || item.platform} - {new Date(item.createdAt).toLocaleString('pt-BR')}
            </Text>
          </View>
        ))}
      </Card>

      <View style={styles.policy}>
        <Text style={styles.policyTitle}>Politica de Privacidade</Text>
        <Text style={styles.policyText}>
          Levamos sua privacidade a serio. Seus dados financeiros sao protegidos, voce pode exporta-los a qualquer momento
          e o controle das preferencias fica sempre com sua conta.
        </Text>
        <Pressable onPress={onOpenPolicy}>
          <Text style={styles.policyLink}>Ler politica completa</Text>
        </Pressable>
      </View>

      <Modal visible={mfaOpen} transparent animationType="slide" onRequestClose={() => setMfaOpen(false)}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHead}>
              <Text style={styles.sheetTitle}>Confirmar MFA</Text>
              <Pressable onPress={() => setMfaOpen(false)}>
                <X size={22} color={colors.textPrimary} />
              </Pressable>
            </View>
            {enrollment ? (
              <>
                <View style={styles.qr}>
                  <QRCode value={enrollment.uri} size={176} />
                </View>
                <Text style={styles.small}>Chave secreta: {enrollment.secret}</Text>
                <TextInput
                  value={mfaCode}
                  onChangeText={setMfaCode}
                  keyboardType="number-pad"
                  placeholder="Codigo de 6 digitos"
                  placeholderTextColor={colors.textSecondary}
                  style={styles.input}
                />
                <View style={styles.actions}>
                  <Pressable style={styles.ghost} onPress={() => setMfaOpen(false)}>
                    <Text style={styles.ghostText}>Cancelar</Text>
                  </Pressable>
                  <Pressable style={[styles.primary, verifyTotp.isPending && styles.dim]} onPress={onVerifyMfa} disabled={verifyTotp.isPending}>
                    {verifyTotp.isPending ? (
                      <ActivityIndicator color={colors.white} />
                    ) : (
                      <Text style={styles.primaryText}>Verificar</Text>
                    )}
                  </Pressable>
                </View>
              </>
            ) : null}
          </View>
        </View>
      </Modal>

      <Modal visible={deleteOpen} transparent animationType="slide" onRequestClose={() => setDeleteOpen(false)}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHead}>
              <Text style={styles.sheetTitle}>Excluir conta</Text>
              <Pressable onPress={() => setDeleteOpen(false)}>
                <X size={22} color={colors.textPrimary} />
              </Pressable>
            </View>
            <TextInput
              value={reason}
              onChangeText={setReason}
              placeholder="Motivo"
              placeholderTextColor={colors.textSecondary}
              style={styles.input}
            />
            <TextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="Senha atual"
              placeholderTextColor={colors.textSecondary}
              style={styles.input}
            />
            <View style={styles.actions}>
              <Pressable style={styles.ghost} onPress={() => setDeleteOpen(false)}>
                <Text style={styles.ghostText}>Cancelar</Text>
              </Pressable>
              <Pressable style={[styles.deleteBtn, deleteAccount.isPending && styles.dim]} onPress={onDelete} disabled={deleteAccount.isPending}>
                {deleteAccount.isPending ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Text style={styles.deleteText}>Confirmar</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </PageShell>
  );
}

function Section({
  title,
  icon,
  children,
  styles,
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <Card style={styles.card}>
      <View style={styles.sectionHead}>
        <View style={styles.sectionIcon}>{icon}</View>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {children}
    </Card>
  );
}

function PrefRow({
  label,
  desc,
  value,
  onChange,
  loading,
  styles,
}: {
  label: string;
  desc: string;
  value: boolean;
  onChange: (value: boolean) => void;
  loading?: boolean;
  styles: ReturnType<typeof createStyles>;
}) {
  const colors = useThemeColors();

  return (
    <View style={styles.pref}>
      <View style={styles.prefText}>
        <Text style={styles.prefTitle}>{label}</Text>
        <Text style={styles.prefDesc}>{desc}</Text>
      </View>
      {loading ? (
        <ActivityIndicator />
      ) : (
        <Switch
          value={value}
          onValueChange={onChange}
          trackColor={{ false: colors.border, true: `${colors.primary}66` }}
          thumbColor={value ? colors.primaryLight : colors.white}
        />
      )}
    </View>
  );
}

const createStyles = (colors: AppColors) =>
  StyleSheet.create({
    card: {
      gap: spacing.sm,
    },
    cardCenter: {
      alignItems: 'center',
      gap: spacing.sm,
    },
    sectionHead: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginBottom: spacing.xs,
    },
    sectionIcon: {
      width: 22,
      alignItems: 'center',
    },
    sectionTitle: {
      ...typography.h2,
      color: colors.textPrimary,
    },
    pref: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.md,
      paddingVertical: spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    prefText: {
      flex: 1,
    },
    prefTitle: {
      ...typography.body,
      color: colors.textPrimary,
      fontWeight: '700',
    },
    prefDesc: {
      ...typography.caption,
      color: colors.textSecondary,
      marginTop: 2,
      lineHeight: 17,
    },
    action: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: 13,
      marginTop: spacing.sm,
      backgroundColor: colors.surface,
    },
    actionText: {
      ...typography.body,
      color: colors.textPrimary,
      fontWeight: '700',
      flex: 1,
    },
    danger: {
      borderColor: colors.danger,
      backgroundColor: colors.dangerSoft,
    },
    dangerText: {
      color: colors.danger,
    },
    desc: {
      ...typography.body,
      color: colors.textSecondary,
      lineHeight: 18,
    },
    linkBtn: {
      alignSelf: 'flex-start',
    },
    linkBtnText: {
      ...typography.caption,
      color: colors.primary,
      fontWeight: '800',
    },
    event: {
      paddingVertical: spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    eventTitle: {
      ...typography.body,
      color: colors.textPrimary,
      fontWeight: '700',
    },
    eventMeta: {
      ...typography.caption,
      color: colors.textSecondary,
      marginTop: spacing.xs,
      lineHeight: 17,
    },
    policy: {
      gap: spacing.sm,
      paddingBottom: spacing.sm,
    },
    policyTitle: {
      ...typography.body,
      color: colors.textPrimary,
      fontWeight: '800',
    },
    policyText: {
      ...typography.caption,
      color: colors.textSecondary,
      lineHeight: 18,
    },
    policyLink: {
      ...typography.caption,
      color: colors.primary,
      fontWeight: '800',
      marginTop: spacing.xs,
    },
    overlay: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: spacing.lg,
      gap: spacing.md,
    },
    sheetHead: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    sheetTitle: {
      ...typography.h2,
      color: colors.textPrimary,
    },
    qr: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      padding: spacing.md,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
    },
    small: {
      ...typography.caption,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 18,
    },
    input: {
      minHeight: 48,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      backgroundColor: colors.surfaceMuted,
      color: colors.textPrimary,
    },
    actions: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginTop: spacing.xs,
    },
    ghost: {
      flex: 1,
      minHeight: 46,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
    },
    ghostText: {
      ...typography.body,
      color: colors.textPrimary,
      fontWeight: '700',
    },
    primary: {
      flex: 1,
      minHeight: 46,
      borderRadius: radius.md,
      backgroundColor: colors.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryText: {
      ...typography.body,
      color: colors.white,
      fontWeight: '800',
    },
    deleteBtn: {
      flex: 1,
      minHeight: 46,
      borderRadius: radius.md,
      backgroundColor: colors.danger,
      alignItems: 'center',
      justifyContent: 'center',
    },
    deleteText: {
      ...typography.body,
      color: colors.white,
      fontWeight: '800',
    },
    dim: {
      opacity: 0.7,
    },
  });
