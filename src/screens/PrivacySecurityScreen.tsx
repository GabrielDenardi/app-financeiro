import { type ReactNode, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { Database, Download, Lock, ShieldCheck, Trash2 } from 'lucide-react-native';

import { Card } from '../components/Card';
import { PageHeader } from '../components/PageHeader';
import { PageShell } from '../components/PageShell';
import { BottomSheet } from '../components/BottomSheet';
import { Button } from '../components/Button';
import { FieldCard, FieldDivider, FieldRow } from '../components/FormField';
import { appEnv } from '../config/env';
import { useAuthenticatedUser } from '../features/auth/hooks/useAuthenticatedUser';
import { UpgradePaywallSheet } from '../features/plans/components/UpgradePaywallSheet';
import { useCurrentPlan } from '../features/plans/hooks';
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
  const [paywallOpen, setPaywallOpen] = useState(false);
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

      await updatePref.mutateAsync({ biometricEnabled: value });
      await setBiometricLockEnabled(value);
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
      setPaywallOpen(true);
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

      <UpgradePaywallSheet
        visible={paywallOpen}
        onClose={() => setPaywallOpen(false)}
        featureTitle="Exportar dados"
        description="Baixe uma copia completa dos seus dados financeiros — recurso do Plano Pro."
      />

      <BottomSheet
        visible={mfaOpen}
        onClose={() => setMfaOpen(false)}
        title="Confirmar MFA"
        subtitle="Escaneie o QR code e insira o código de 6 dígitos"
        footer={(close) => (
          <>
            <Button label="Cancelar" variant="secondary" fullWidth onPress={close} />
            <Button
              label="Verificar"
              fullWidth
              onPress={onVerifyMfa}
              loading={verifyTotp.isPending}
            />
          </>
        )}
      >
        {enrollment ? (
          <>
            <View style={styles.qr}>
              <QRCode value={enrollment.uri} size={176} />
            </View>
            <Text style={styles.small}>Chave secreta: {enrollment.secret}</Text>
            <FieldCard>
              <FieldRow
                label="Código"
                placeholder="6 dígitos"
                keyboardType="number-pad"
                value={mfaCode}
                onChangeText={setMfaCode}
                autoFocus
              />
            </FieldCard>
          </>
        ) : null}
        <View style={styles.sheetSpacer} />
      </BottomSheet>

      <BottomSheet
        visible={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Excluir conta"
        subtitle="Esta ação é irreversível. Confirme com sua senha."
        footer={(close) => (
          <>
            <Button label="Cancelar" variant="secondary" fullWidth onPress={close} />
            <Button
              label="Confirmar exclusão"
              variant="danger"
              fullWidth
              onPress={onDelete}
              loading={deleteAccount.isPending}
            />
          </>
        )}
      >
        <FieldCard>
          <FieldRow
            label="Motivo"
            placeholder="Opcional"
            value={reason}
            onChangeText={setReason}
          />
          <FieldDivider />
          <FieldRow
            label="Senha atual"
            placeholder="••••••••"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
        </FieldCard>
        <View style={styles.sheetSpacer} />
      </BottomSheet>
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
      paddingVertical: spacing.md,
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
    sheetSpacer: {
      height: spacing.lg,
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
  });
