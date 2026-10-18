import { useEffect, useState } from 'react';
import { Platform, Pressable, Switch, Text, TextInput, View } from 'react-native';
import { Card } from '../../../components/Card';
import { useToast } from '../../../components/Toast';
import { spacing, typography, useThemeColors } from '../../../theme';
import { useNotificationPreferences, useUpdateNotificationPreferences } from '../hooks/useNotifications';
import type { NotificationPreferences } from '../types';
import { enablePushNotifications } from '../services/pushService';
import { generateNotificationRecommendation } from '../services/notificationsService';
import { useQueryClient } from '@tanstack/react-query';
import { financeQueryKeys } from '../../finance/queryKeys';

const categories = [
  ['budgets', 'Alertas de orçamento'], ['reminders', 'Lembretes de vencimento'],
  ['groups', 'Despesas em grupo'], ['security', 'Alertas de segurança'],
  ['recommendations', 'Análises e recomendações financeiras'],
  ['hide_sensitive', 'Ocultar detalhes no push'],
  ['ai_enabled', 'Permitir recomendações com IA'],
] as const;

export function NotificationSettings({ userId }: { userId?: string }) {
  const colors = useThemeColors();
  const toast = useToast();
  const client = useQueryClient();
  const query = useNotificationPreferences(userId);
  const mutation = useUpdateNotificationPreferences(userId);
  const [draft, setDraft] = useState<NotificationPreferences | null>(null);
  const [thresholds, setThresholds] = useState('');
  const [days, setDays] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!query.data) return;
    setDraft(query.data);
    setThresholds(query.data.budget_thresholds.join(', '));
    setDays(String(query.data.reminder_days));
    setStart(String(query.data.quiet_start));
    setEnd(String(query.data.quiet_end));
  }, [query.data]);

  const textStyle = { ...typography.body, color: colors.textPrimary };
  const inputStyle = { ...textStyle, borderWidth: 1, borderColor: colors.border, padding: spacing.sm };

  async function save() {
    if (!draft) return;
    const values = thresholds.split(',').map(value => Number(value.trim()));
    if (!thresholds.trim() || values.length > 5 || values.some(value => !Number.isInteger(value) || value < 1 || value > 200)
      || !/^\d+$/.test(days) || Number(days) > 14
      || !/^\d+$/.test(start) || Number(start) > 23 || !/^\d+$/.test(end) || Number(end) > 23) {
      toast.showError('Confira os percentuais (1 a 200), dias (0 a 14) e horários (0 a 23).');
      return;
    }
    setSaving(true);
    try {
      if (draft.push_enabled && Platform.OS !== 'web') await enablePushNotifications();
      await mutation.mutateAsync({ ...draft, budget_thresholds: [...new Set(values)].sort((a, b) => a - b),
        reminder_days: Number(days), quiet_start: Number(start), quiet_end: Number(end),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || draft.timezone });
      toast.showSuccess('Preferências salvas.');
    } catch (error) { toast.showError(error instanceof Error ? error.message : 'Não foi possível salvar.'); }
    finally { setSaving(false); }
  }

  if (query.isError) return <Pressable onPress={() => query.refetch()}><Text style={textStyle}>Não foi possível carregar preferências. Tentar novamente</Text></Pressable>;
  if (!draft) return <Text style={textStyle}>Carregando preferências...</Text>;
  return <Card style={{ gap: spacing.md }}>
    <Text style={{ ...typography.h2, color: colors.textPrimary }}>Preferências de notificações</Text>
    {categories.map(([key, label]) => <View key={key} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
      <Text style={[textStyle, { flex: 1 }]}>{label}</Text>
      <Switch accessibilityLabel={label} value={draft[key]} disabled={saving} onValueChange={value => setDraft({ ...draft, [key]: value })} />
    </View>)}
    <Text style={{ ...typography.caption, color: colors.textSecondary }}>As análises usam seu histórico financeiro. A central interna mantém os avisos mesmo se o push falhar.</Text>
    <Text style={{ ...typography.caption, color: colors.textSecondary }}>Ao permitir IA, você autoriza o envio de percentuais de uso e projeções dos orçamentos à OpenAI. Nomes, valores e transações não são enviados. Salve as preferências antes de solicitar.</Text>
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <Text style={[textStyle, { flex: 1 }]}>Receber notificações push</Text>
      <Switch accessibilityLabel="Receber notificações push" disabled={saving} value={draft.push_enabled} onValueChange={value => {
        if (value && Platform.OS === 'web') { toast.showError('Ative o push pelo aplicativo instalado no aparelho.'); return; }
        setDraft({ ...draft, push_enabled: value });
      }} />
    </View>
    <Text style={textStyle}>Percentuais do orçamento (separados por vírgula)</Text>
    <TextInput accessibilityLabel="Percentuais do orçamento" style={inputStyle} value={thresholds} onChangeText={setThresholds} keyboardType="numbers-and-punctuation" />
    <Text style={textStyle}>Antecedência de vencimentos (dias)</Text>
    <TextInput accessibilityLabel="Antecedência de vencimentos" style={inputStyle} value={days} onChangeText={setDays} keyboardType="number-pad" />
    <Text style={textStyle}>Horário silencioso para push não urgente (hora inicial / final)</Text>
    <View style={{ flexDirection: 'row', gap: spacing.sm }}>
      <TextInput accessibilityLabel="Início do horário silencioso" style={[inputStyle, { flex: 1 }]} value={start} onChangeText={setStart} keyboardType="number-pad" />
      <TextInput accessibilityLabel="Fim do horário silencioso" style={[inputStyle, { flex: 1 }]} value={end} onChangeText={setEnd} keyboardType="number-pad" />
    </View>
    <Text style={{ ...typography.caption, color: colors.textSecondary }}>Horários iguais desativam o período silencioso. Alertas de segurança podem chegar a qualquer hora.</Text>
    <Pressable accessibilityRole="button" disabled={saving} onPress={save} style={{ backgroundColor: colors.primary, padding: spacing.md }}>
      <Text style={{ ...textStyle, color: colors.white, textAlign: 'center' }}>{saving ? 'Salvando...' : 'Salvar preferências'}</Text>
    </Pressable>
    {draft.ai_enabled && draft.recommendations && <Pressable accessibilityRole="button" disabled={saving} onPress={async () => {
      setSaving(true);
      try {
        await generateNotificationRecommendation();
        await client.invalidateQueries({ queryKey: financeQueryKeys.notifications.list(userId) });
        toast.showSuccess('Recomendação adicionada à central.');
      } catch (error) { toast.showError(error instanceof Error ? error.message : 'Falha ao gerar recomendação.'); }
      finally { setSaving(false); }
    }}><Text style={textStyle}>Gerar recomendação com IA (uma por dia)</Text></Pressable>}
  </Card>;
}
