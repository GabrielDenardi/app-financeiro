import { useState } from 'react';
import { ActivityIndicator, Alert, Linking, Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { ArrowLeft, Database, Download, Lock, ShieldCheck, Trash2, X } from 'lucide-react-native';

import { appEnv } from '../config/env';
import { useAuthenticatedUser } from '../features/auth/hooks/useAuthenticatedUser';
import { useDisableTotpMutation, useEnrollTotpMutation, useLoginEvents, useMfaFactors, usePreferences, useRequestDeletionMutation, useRequestExportMutation, useUpdatePreferencesMutation, useVerifyTotpMutation } from '../features/preferences/hooks/usePreferences';
import { canUseBiometricLock, setBiometricLockEnabled } from '../features/preferences/services/biometricService';

export function PrivacySecurityScreen({ navigation }: any) {
  const user = useAuthenticatedUser();
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

  const onTogglePref = async (key: 'hideValuesHome' | 'loginAlertsEnabled' | 'shareAnonymousStats', value: boolean) => {
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
      if (factor) await disableTotp.mutateAsync(factor.id);
    } catch (error) {
      Alert.alert('Erro', error instanceof Error ? error.message : 'Nao foi possivel atualizar o MFA.');
    }
  };

  const onVerifyMfa = async () => {
    if (!enrollment) return;
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
    <SafeAreaView style={s.bg}>
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <View style={s.head}><Pressable onPress={() => navigation.goBack()} style={s.back}><ArrowLeft size={22} color="#111" /></Pressable><Text style={s.title}>Privacidade e Seguranca</Text></View>

        {preferencesQuery.isLoading && !prefs ? <View style={s.card}><ActivityIndicator color="#111827" /></View> : null}
        {preferencesQuery.isError ? <View style={s.card}><Text style={s.desc}>Nao foi possivel carregar suas preferencias.</Text><Pressable style={s.linkBtn} onPress={() => preferencesQuery.refetch()}><Text style={s.linkBtnText}>Tentar novamente</Text></Pressable></View> : null}

        {prefs ? (
          <>
            <Section title="Seguranca" icon={<ShieldCheck size={18} color="#111827" />}>
              <PrefRow label="Autenticacao em duas etapas" desc="Adiciona uma camada extra de seguranca." value={prefs.twoFactorEnabled} loading={mfaBusy} onChange={onToggleTwoFactor} />
              <PrefRow label="Bloqueio por biometria" desc="Use biometria ao abrir o app." value={prefs.biometricEnabled} loading={updatePref.isPending} onChange={onToggleBiometric} />
              <PrefRow label="Alertas de login" desc="Notificar sobre novos acessos." value={prefs.loginAlertsEnabled} loading={updatePref.isPending} onChange={(value) => onTogglePref('loginAlertsEnabled', value)} />
            </Section>

            <Section title="Privacidade" icon={<Lock size={18} color="#111827" />}>
              <PrefRow label="Ocultar valores na tela inicial" desc="Protege seus dados em publico." value={prefs.hideValuesHome} loading={updatePref.isPending} onChange={(value) => onTogglePref('hideValuesHome', value)} />
              <PrefRow label="Compartilhar estatisticas anonimas" desc="Ajuda a melhorar o app." value={prefs.shareAnonymousStats} loading={updatePref.isPending} onChange={(value) => onTogglePref('shareAnonymousStats', value)} />
            </Section>

            <Section title="Seus Dados" icon={<Database size={18} color="#111827" />}>
              <Pressable style={s.action} onPress={onExport}><Download size={18} color="#111827" /><Text style={s.actionText}>Exportar meus dados</Text>{exportData.isPending ? <ActivityIndicator /> : null}</Pressable>
              <Pressable style={[s.action, s.danger]} onPress={() => setDeleteOpen(true)}><Trash2 size={18} color="#dc2626" /><Text style={[s.actionText, s.dangerText]}>Excluir minha conta</Text></Pressable>
            </Section>
          </>
        ) : null}

        <View style={s.card}>
          <Text style={s.sectionTitle}>Acessos recentes</Text>
          {loginEventsQuery.isLoading ? <ActivityIndicator color="#111827" /> : null}
          {loginEventsQuery.isError ? <Text style={s.desc}>Nao foi possivel carregar os acessos.</Text> : null}
          {!loginEventsQuery.isLoading && !loginEventsQuery.isError && !(loginEventsQuery.data?.length) ? <Text style={s.desc}>Nenhum evento registrado ainda.</Text> : null}
          {(loginEventsQuery.data ?? []).map((item) => <View key={item.id} style={s.event}><Text style={s.eventTitle}>{item.eventType}</Text><Text style={s.eventMeta}>{item.deviceLabel || item.platform} • {new Date(item.createdAt).toLocaleString('pt-BR')}</Text></View>)}
        </View>

        <View style={s.policy}>
          <Text style={s.policyTitle}>Politica de Privacidade</Text>
          <Text style={s.policyText}>Levamos sua privacidade a serio. Seus dados financeiros sao protegidos, voce pode exporta-los a qualquer momento e o controle das preferencias fica sempre com sua conta.</Text>
          <Pressable onPress={onOpenPolicy}><Text style={s.policyLink}>Ler politica completa</Text></Pressable>
        </View>
      </ScrollView>

      <Modal visible={mfaOpen} transparent animationType="slide" onRequestClose={() => setMfaOpen(false)}>
        <View style={s.overlay}><View style={s.sheet}><View style={s.sheetHead}><Text style={s.sheetTitle}>Confirmar MFA</Text><Pressable onPress={() => setMfaOpen(false)}><X size={22} color="#111827" /></Pressable></View>{enrollment ? <><View style={s.qr}><QRCode value={enrollment.uri} size={176} /></View><Text style={s.small}>Chave secreta: {enrollment.secret}</Text><TextInput value={mfaCode} onChangeText={setMfaCode} keyboardType="number-pad" placeholder="Codigo de 6 digitos" placeholderTextColor="#9ca3af" style={s.input} /><View style={s.actions}><Pressable style={s.ghost} onPress={() => setMfaOpen(false)}><Text style={s.ghostText}>Cancelar</Text></Pressable><Pressable style={[s.primary, verifyTotp.isPending && s.dim]} onPress={onVerifyMfa} disabled={verifyTotp.isPending}>{verifyTotp.isPending ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryText}>Verificar</Text>}</Pressable></View></> : null}</View></View>
      </Modal>

      <Modal visible={deleteOpen} transparent animationType="slide" onRequestClose={() => setDeleteOpen(false)}>
        <View style={s.overlay}><View style={s.sheet}><View style={s.sheetHead}><Text style={s.sheetTitle}>Excluir conta</Text><Pressable onPress={() => setDeleteOpen(false)}><X size={22} color="#111827" /></Pressable></View><TextInput value={reason} onChangeText={setReason} placeholder="Motivo" placeholderTextColor="#9ca3af" style={s.input} /><TextInput value={password} onChangeText={setPassword} secureTextEntry placeholder="Senha atual" placeholderTextColor="#9ca3af" style={s.input} /><View style={s.actions}><Pressable style={s.ghost} onPress={() => setDeleteOpen(false)}><Text style={s.ghostText}>Cancelar</Text></Pressable><Pressable style={[s.deleteBtn, deleteAccount.isPending && s.dim]} onPress={onDelete} disabled={deleteAccount.isPending}>{deleteAccount.isPending ? <ActivityIndicator color="#fff" /> : <Text style={s.deleteText}>Confirmar</Text>}</Pressable></View></View></View>
      </Modal>
    </SafeAreaView>
  );
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return <View style={s.card}><View style={s.sectionHead}><View style={s.sectionIcon}>{icon}</View><Text style={s.sectionTitle}>{title}</Text></View>{children}</View>;
}

function PrefRow({ label, desc, value, onChange, loading }: { label: string; desc: string; value: boolean; onChange: (value: boolean) => void; loading?: boolean }) {
  return <View style={s.pref}><View style={s.prefText}><Text style={s.prefTitle}>{label}</Text><Text style={s.prefDesc}>{desc}</Text></View>{loading ? <ActivityIndicator /> : <Switch value={value} onValueChange={onChange} />}</View>;
}

const s = StyleSheet.create({
  bg: { flex: 1, backgroundColor: '#f8f9fa' }, content: { paddingBottom: 28 }, head: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 }, back: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' }, title: { fontSize: 16, fontWeight: '800', color: '#111827' }, card: { marginHorizontal: 16, marginTop: 12, borderRadius: 16, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', overflow: 'hidden', padding: 14 }, sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }, sectionIcon: { width: 22, alignItems: 'center' }, sectionTitle: { fontSize: 14, fontWeight: '800', color: '#111827' }, pref: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#f1f5f9' }, prefText: { flex: 1 }, prefTitle: { fontSize: 13, fontWeight: '700', color: '#111827' }, prefDesc: { fontSize: 12, color: '#6b7280', marginTop: 2, lineHeight: 17 }, action: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 13, marginTop: 10 }, actionText: { fontSize: 13, fontWeight: '700', color: '#111827', flex: 1 }, danger: { borderColor: '#fecaca', backgroundColor: '#fff5f5' }, dangerText: { color: '#dc2626' }, desc: { fontSize: 12, color: '#6b7280', lineHeight: 18 }, linkBtn: { alignSelf: 'flex-start', marginTop: 10 }, linkBtnText: { fontSize: 12, fontWeight: '800', color: '#111827' }, event: { paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#f1f5f9' }, eventTitle: { fontSize: 13, fontWeight: '700', color: '#111827' }, eventMeta: { fontSize: 12, color: '#6b7280', marginTop: 4, lineHeight: 17 }, policy: { marginHorizontal: 16, marginTop: 14 }, policyTitle: { fontSize: 13, fontWeight: '800', color: '#111827', marginBottom: 8 }, policyText: { fontSize: 12, color: '#6b7280', lineHeight: 18 }, policyLink: { marginTop: 8, fontSize: 12, fontWeight: '800', color: '#111827' }, overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }, sheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, gap: 12 }, sheetHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, sheetTitle: { fontSize: 18, fontWeight: '800', color: '#111827' }, qr: { alignItems: 'center', backgroundColor: '#fff', padding: 12, borderRadius: 16, borderWidth: 1, borderColor: '#f1f5f9' }, small: { fontSize: 12, color: '#6b7280', textAlign: 'center', lineHeight: 18 }, input: { minHeight: 48, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, paddingHorizontal: 14, backgroundColor: '#fafafa', color: '#111827' }, actions: { flexDirection: 'row', gap: 10, marginTop: 4 }, ghost: { flex: 1, minHeight: 46, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, alignItems: 'center', justifyContent: 'center' }, ghostText: { fontWeight: '700', color: '#111827' }, primary: { flex: 1, minHeight: 46, borderRadius: 12, backgroundColor: '#111827', alignItems: 'center', justifyContent: 'center' }, primaryText: { color: '#fff', fontWeight: '800' }, deleteBtn: { flex: 1, minHeight: 46, borderRadius: 12, backgroundColor: '#dc2626', alignItems: 'center', justifyContent: 'center' }, deleteText: { color: '#fff', fontWeight: '800' }, dim: { opacity: 0.7 },
});
