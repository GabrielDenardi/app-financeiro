import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Calendar as CalIcon, Car, Home, Landmark, Plane, Plus, Target, Trash2, X } from 'lucide-react-native';
import { Calendar, CalendarUtils } from 'react-native-calendars';

import { useAccounts } from '../features/accounts/hooks/useAccounts';
import { useAuthenticatedUser } from '../features/auth/hooks/useAuthenticatedUser';
import { useCreateGoalMutation, useDeleteGoalMutation, useGoalContributionMutation, useGoals, useUpdateGoalMutation } from '../features/goals/hooks/useGoals';
import { type AppColors, useThemeColors } from '../theme';
import { formatCurrencyBRL } from '../utils/format';

const TODAY = CalendarUtils.getCalendarDateString(new Date());
const COLORS = ['#10B981', '#3B82F6', '#8B5CF6', '#F43F5E', '#F59E0B'];
const ICONS = [
  { id: 'target', label: 'Geral', Icon: Target },
  { id: 'car', label: 'Carro', Icon: Car },
  { id: 'home', label: 'Casa', Icon: Home },
  { id: 'plane', label: 'Viagem', Icon: Plane },
  { id: 'wallet', label: 'Reserva', Icon: Landmark },
] as const;

function moneyMask(v: string) {
  const raw = v.replace(/\D/g, '');
  if (!raw) return '';
  return (Number(raw) / 100).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}
function moneyValue(v: string) {
  return Number((v || '0').replace(/\./g, '').replace(',', '.'));
}
function iconOf(id: string) {
  return ICONS.find((item) => item.id === id)?.Icon ?? Target;
}
function dateBR(v: string | null) {
  return v ? v.split('-').reverse().join('/') : 'Sem prazo';
}
function monthlyNeed(current: number, target: number, due: string | null) {
  if (current >= target) return 0;
  if (!due) return (target - current) / 12;
  const now = new Date();
  const end = new Date(`${due}T00:00:00`);
  const months = Math.max(1, (end.getFullYear() - now.getFullYear()) * 12 + end.getMonth() - now.getMonth() + 1);
  return (target - current) / months;
}

export default function MetasScreen() {
  const themeColors = useThemeColors();
  const s = useMemo(() => createStyles(themeColors), [themeColors]);
  const user = useAuthenticatedUser();
  const goalsQuery = useGoals(user?.id);
  const accountsQuery = useAccounts(user?.id);
  const createGoal = useCreateGoalMutation(user?.id);
  const deleteGoal = useDeleteGoalMutation(user?.id);
  const contribute = useGoalContributionMutation(user?.id);
  const updateGoal = useUpdateGoalMutation(user?.id);

  const [tab, setTab] = useState<'active' | 'completed'>('active');
  const [createOpen, setCreateOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [deadlineOpen, setDeadlineOpen] = useState(false);
  const [goalId, setGoalId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [target, setTarget] = useState('');
  const [saved, setSaved] = useState('');
  const [due, setDue] = useState(TODAY);
  const [color, setColor] = useState(COLORS[0]);
  const [icon, setIcon] = useState<(typeof ICONS)[number]['id']>('car');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [accountId, setAccountId] = useState('');
  const [tempDue, setTempDue] = useState(TODAY);

  const goals = goalsQuery.data ?? [];
  const accounts = (accountsQuery.data ?? []).filter((item) => item.isActive);
  const activeCount = goals.filter((item) => item.status !== 'completed').length;
  const doneCount = goals.filter((item) => item.status === 'completed').length;
  const list = goals.filter((item) => (tab === 'active' ? item.status !== 'completed' : item.status === 'completed'));
  const selectedGoal = useMemo(() => goals.find((item) => item.id === goalId) ?? null, [goals, goalId]);

  const resetCreate = () => {
    setTitle('');
    setTarget('');
    setSaved('');
    setDue(TODAY);
    setColor(COLORS[0]);
    setIcon('car');
  };

  const onCreate = async () => {
    if (!title.trim() || !target) {
      Alert.alert('Atencao', 'Informe nome e valor alvo.');
      return;
    }
    try {
      await createGoal.mutateAsync({ title: title.trim(), targetAmount: moneyValue(target), initialAmount: moneyValue(saved), targetDate: due, color, icon });
      setCreateOpen(false);
      resetCreate();
    } catch (error) {
      Alert.alert('Erro', error instanceof Error ? error.message : 'Nao foi possivel criar a meta.');
    }
  };

  const onDelete = (id: string) =>
    Alert.alert('Excluir meta', 'Deseja realmente apagar esta meta?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          try { await deleteGoal.mutateAsync(id); } catch (error) { Alert.alert('Erro', error instanceof Error ? error.message : 'Nao foi possivel excluir a meta.'); }
        },
      },
    ]);

  const onContribute = async () => {
    if (!goalId || !accountId || moneyValue(amount) <= 0) {
      Alert.alert('Atencao', 'Selecione uma conta e informe um aporte valido.');
      return;
    }
    try {
      await contribute.mutateAsync({ goalId, accountId, amount: moneyValue(amount), note });
      setAddOpen(false);
      setAmount('');
      setNote('');
      setGoalId(null);
    } catch (error) {
      Alert.alert('Erro', error instanceof Error ? error.message : 'Nao foi possivel registrar o aporte.');
    }
  };

  const onUpdateDeadline = async (next: string | null) => {
    if (!goalId) return;
    try {
      await updateGoal.mutateAsync({ id: goalId, targetDate: next });
      setDeadlineOpen(false);
      setGoalId(null);
    } catch (error) {
      Alert.alert('Erro', error instanceof Error ? error.message : 'Nao foi possivel atualizar o prazo.');
    }
  };

  return (
    <SafeAreaView style={s.bg}>
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <View style={s.head}>
          <View><Text style={s.tt}>Metas Financeiras</Text><Text style={s.sub}>{activeCount} ativa(s)</Text></View>
          <Pressable style={s.darkBtn} onPress={() => { resetCreate(); setCreateOpen(true); }}><Plus size={16} color="#fff" /><Text style={s.darkBtnText}>Nova Meta</Text></Pressable>
        </View>

        <View style={s.tabs}>
          <Pressable style={[s.tab, tab === 'active' && s.tabOn]} onPress={() => setTab('active')}><Text style={[s.tabText, tab === 'active' && s.tabTextOn]}>Ativas ({activeCount})</Text></Pressable>
          <Pressable style={[s.tab, tab === 'completed' && s.tabOn]} onPress={() => setTab('completed')}><Text style={[s.tabText, tab === 'completed' && s.tabTextOn]}>Concluidas ({doneCount})</Text></Pressable>
        </View>

        {goalsQuery.isLoading ? <View style={s.card}><ActivityIndicator color={themeColors.primaryLight} /></View> : null}
        {goalsQuery.isError ? <View style={s.card}><Text style={s.msg}>Nao foi possivel carregar as metas.</Text><Pressable style={s.retry} onPress={() => goalsQuery.refetch()}><Text style={s.retryText}>Tentar novamente</Text></Pressable></View> : null}
        {!goalsQuery.isLoading && !goalsQuery.isError && !list.length ? <View style={s.card}><Text style={s.msg}>Nenhuma meta nesta aba.</Text></View> : null}

        {list.map((goal) => {
          const Icon = iconOf(goal.icon);
          const done = goal.status === 'completed';
          return (
            <View key={goal.id} style={[s.card, s.goal, { borderTopColor: goal.color, borderTopWidth: 4 }]}>
              <View style={s.row}>
                <View style={[s.iconBox, { backgroundColor: goal.color }]}><Icon size={20} color="#fff" /></View>
                <View style={s.flex}><Text style={s.goalTitle}>{goal.title}</Text><Text style={s.goalSub}>{done ? 'Meta concluida' : `Prazo: ${dateBR(goal.targetDate)}`}</Text></View>
                {!done ? <Pressable style={s.iconBtn} onPress={() => { setGoalId(goal.id); setTempDue(goal.targetDate ?? TODAY); setDeadlineOpen(true); }}><CalIcon size={18} color="#6567ef" /></Pressable> : null}
                <Pressable style={s.iconBtn} onPress={() => onDelete(goal.id)}><Trash2 size={18} color="#ef4444" /></Pressable>
              </View>
              <View style={[s.row, s.between]}><Text style={s.money}>{formatCurrencyBRL(goal.currentAmount)}</Text><Text style={s.money}>{formatCurrencyBRL(goal.targetAmount)}</Text></View>
              <View style={s.track}><View style={[s.fill, { width: `${Math.min(goal.progressPercent, 100)}%`, backgroundColor: done ? themeColors.success : themeColors.textPrimary }]} /></View>
              <Text style={s.pct}>{goal.progressPercent.toFixed(1)}% alcancado</Text>
              {!done ? <View style={s.soft}><Text style={s.softText}>Guarde <Text style={s.softStrong}>{formatCurrencyBRL(monthlyNeed(goal.currentAmount, goal.targetAmount, goal.targetDate))}/mes</Text> para concluir no prazo.</Text></View> : null}
              {!done ? <Pressable style={s.add} onPress={() => { setGoalId(goal.id); setAccountId(accounts[0]?.id ?? ''); setAmount(''); setNote(''); setAddOpen(true); }}><Plus size={18} color={themeColors.textPrimary} /><Text style={s.addText}>Adicionar</Text></Pressable> : null}
            </View>
          );
        })}
      </ScrollView>

      <Modal visible={createOpen} transparent animationType="slide" onRequestClose={() => setCreateOpen(false)}>
        <View style={s.overlay}><View style={s.sheet}><View style={s.sheetHead}><Text style={s.sheetTitle}>Nova Meta</Text><Pressable onPress={() => setCreateOpen(false)}><X size={22} color={themeColors.textPrimary} /></Pressable></View><ScrollView showsVerticalScrollIndicator={false}><Text style={s.label}>Nome</Text><TextInput value={title} onChangeText={setTitle} placeholder="Ex: Reserva de emergencia" placeholderTextColor={themeColors.textSecondary} style={s.input} /><Text style={s.label}>Valor alvo</Text><View style={s.moneyRow}><Text style={s.prefix}>R$</Text><TextInput value={target} onChangeText={(v) => setTarget(moneyMask(v))} keyboardType="numeric" placeholder="0,00" placeholderTextColor={themeColors.textSecondary} style={s.moneyInput} /></View><Text style={s.label}>Ja guardado</Text><View style={s.moneyRow}><Text style={s.prefix}>R$</Text><TextInput value={saved} onChangeText={(v) => setSaved(moneyMask(v))} keyboardType="numeric" placeholder="0,00" placeholderTextColor={themeColors.textSecondary} style={s.moneyInput} /></View><Text style={s.label}>Prazo</Text><View style={s.calendar}><Calendar current={due} minDate={TODAY} markedDates={{ [due]: { selected: true, selectedColor: '#6567ef' } }} onDayPress={(day) => setDue(day.dateString)} theme={{ todayTextColor: '#6567ef', selectedDayBackgroundColor: '#6567ef' }} /></View><Text style={s.label}>Icone</Text><View style={s.wrap}>{ICONS.map((item) => <Pressable key={item.id} style={[s.pill, icon === item.id && s.pillOn]} onPress={() => setIcon(item.id)}><Text style={[s.pillText, icon === item.id && s.pillTextOn]}>{item.label}</Text></Pressable>)}</View><Text style={s.label}>Cor</Text><View style={s.colors}>{COLORS.map((item) => <Pressable key={item} style={[s.color, { backgroundColor: item }, color === item && s.colorOn]} onPress={() => setColor(item)} />)}</View><Pressable style={[s.primary, createGoal.isPending && s.dim]} onPress={onCreate} disabled={createGoal.isPending}>{createGoal.isPending ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryText}>Criar Meta</Text>}</Pressable></ScrollView></View></View>
      </Modal>

      <Modal visible={addOpen} transparent animationType="fade" onRequestClose={() => setAddOpen(false)}>
        <View style={s.center}><View style={s.modal}><View style={s.row}><Text style={s.modalTitle}>Adicionar Valor</Text><Pressable onPress={() => setAddOpen(false)}><X size={18} color={themeColors.textSecondary} /></Pressable></View><Text style={s.modalSub}>Adicionando a <Text style={s.softStrong}>{selectedGoal?.title ?? 'Meta'}</Text></Text><View style={s.wrap}>{accounts.length ? accounts.map((item) => <Pressable key={item.id} style={[s.pill, accountId === item.id && s.pillOn]} onPress={() => setAccountId(item.id)}><Text style={[s.pillText, accountId === item.id && s.pillTextOn]}>{item.name}</Text></Pressable>) : <Text style={s.modalSub}>Crie uma conta antes de aportar.</Text>}</View><View style={s.moneyRow}><Text style={s.prefix}>R$</Text><TextInput value={amount} onChangeText={(v) => setAmount(moneyMask(v))} keyboardType="numeric" placeholder="0,00" placeholderTextColor={themeColors.textSecondary} style={s.moneyInput} autoFocus /></View><TextInput value={note} onChangeText={setNote} placeholder="Observacao" placeholderTextColor={themeColors.textSecondary} style={s.input} /><View style={s.actions}><Pressable style={s.ghost} onPress={() => setAddOpen(false)}><Text style={s.ghostText}>Cancelar</Text></Pressable><Pressable style={[s.green, (contribute.isPending || !accounts.length) && s.dim]} onPress={onContribute} disabled={contribute.isPending || !accounts.length}>{contribute.isPending ? <ActivityIndicator color="#fff" /> : <Text style={s.greenText}>Adicionar</Text>}</Pressable></View></View></View>
      </Modal>

      <Modal visible={deadlineOpen} transparent animationType="slide" onRequestClose={() => setDeadlineOpen(false)}>
        <View style={s.overlay}><View style={s.sheet}><View style={s.sheetHead}><Text style={s.sheetTitle}>Editar Prazo</Text><Pressable onPress={() => setDeadlineOpen(false)}><X size={22} color={themeColors.textPrimary} /></Pressable></View><Text style={s.modalSub}>Nova data para <Text style={s.softStrong}>{selectedGoal?.title ?? 'Meta'}</Text></Text><View style={s.calendar}><Calendar current={tempDue} minDate={TODAY} markedDates={{ [tempDue]: { selected: true, selectedColor: '#6567ef' } }} onDayPress={(day) => setTempDue(day.dateString)} theme={{ todayTextColor: '#6567ef', selectedDayBackgroundColor: '#6567ef' }} /></View><Pressable style={s.ghostWide} onPress={() => onUpdateDeadline(null)}><Text style={s.ghostText}>Limpar prazo</Text></Pressable><Pressable style={[s.primary, updateGoal.isPending && s.dim]} onPress={() => onUpdateDeadline(tempDue)} disabled={updateGoal.isPending}>{updateGoal.isPending ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryText}>Salvar Novo Prazo</Text>}</Pressable></View></View>
      </Modal>
    </SafeAreaView>
  );
}

const createStyles = (colors: AppColors) => StyleSheet.create({
  bg: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: 40 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, gap: 12 },
  tt: { fontSize: 20, fontWeight: '800', color: colors.textPrimary },
  sub: { fontSize: 12, color: colors.textSecondary, marginTop: 4 },
  darkBtn: { backgroundColor: colors.textPrimary, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 6 },
  darkBtnText: { color: colors.white, fontWeight: '700', fontSize: 13 },
  tabs: { flexDirection: 'row', marginHorizontal: 16, marginBottom: 16, padding: 4, borderRadius: 14, backgroundColor: colors.mutedSurface },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 12 },
  tabOn: { backgroundColor: colors.surface },
  tabText: { fontSize: 13, fontWeight: '700', color: colors.textSecondary },
  tabTextOn: { color: colors.textPrimary },
  card: { backgroundColor: colors.surface, borderRadius: 20, marginHorizontal: 16, marginBottom: 16, padding: 16, borderWidth: 1, borderColor: colors.border },
  goal: { elevation: 2 },
  row: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1 },
  between: { justifyContent: 'space-between', marginBottom: 8 },
  iconBox: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  iconBtn: { padding: 6 },
  goalTitle: { fontSize: 16, fontWeight: '800', color: colors.textPrimary, marginLeft: 12 },
  goalSub: { fontSize: 12, color: colors.textSecondary, marginTop: 4, marginLeft: 12 },
  money: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  track: { height: 8, backgroundColor: colors.border, borderRadius: 999, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 999 },
  pct: { textAlign: 'center', fontSize: 11, color: colors.textSecondary, marginTop: 8 },
  soft: { backgroundColor: colors.background, borderRadius: 14, padding: 14, marginTop: 16 },
  softText: { textAlign: 'center', fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
  softStrong: { fontWeight: '800', color: colors.textPrimary },
  add: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, paddingTop: 14, marginTop: 14, borderTopWidth: 1, borderTopColor: colors.border },
  addText: { fontWeight: '800', color: colors.textPrimary },
  msg: { textAlign: 'center', color: colors.textSecondary, lineHeight: 18 },
  retry: { backgroundColor: colors.primaryLight, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 999, alignSelf: 'center', marginTop: 12 },
  retryText: { color: colors.white, fontWeight: '700' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, maxHeight: '90%' },
  sheetHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sheetTitle: { fontSize: 24, fontWeight: '800', color: colors.textPrimary },
  label: { fontSize: 14, fontWeight: '700', color: colors.textSecondary, marginTop: 18, marginBottom: 8 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 15, backgroundColor: colors.surfaceMuted, color: colors.textPrimary },
  moneyRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: 14, backgroundColor: colors.surfaceMuted, marginTop: 4 },
  prefix: { marginLeft: 16, fontWeight: '800', color: colors.textSecondary },
  moneyInput: { flex: 1, paddingHorizontal: 12, paddingVertical: 15, color: colors.textPrimary },
  calendar: { borderRadius: 20, overflow: 'hidden', marginTop: 4 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  pill: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 999, backgroundColor: colors.mutedSurface },
  pillOn: { backgroundColor: `${colors.primaryLight}1F` },
  pillText: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
  pillTextOn: { color: colors.primaryLight },
  colors: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 8 },
  color: { width: 36, height: 36, borderRadius: 18 },
  colorOn: { borderWidth: 3, borderColor: colors.border },
  primary: { backgroundColor: colors.primaryLight, borderRadius: 999, paddingVertical: 18, alignItems: 'center', justifyContent: 'center', marginTop: 24 },
  primaryText: { color: colors.white, fontWeight: '800', fontSize: 16 },
  center: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 24 },
  modal: { backgroundColor: colors.surface, borderRadius: 18, padding: 20, borderWidth: 1, borderColor: colors.border },
  modalTitle: { fontSize: 18, fontWeight: '800', color: colors.textPrimary, flex: 1 },
  modalSub: { fontSize: 13, color: colors.textSecondary, marginVertical: 12 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 16 },
  ghost: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 12 },
  ghostWide: { borderWidth: 1, borderColor: colors.border, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
  ghostText: { color: colors.textSecondary, fontWeight: '700' },
  green: { backgroundColor: colors.success, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 12, minWidth: 104, alignItems: 'center' },
  greenText: { color: colors.white, fontWeight: '700' },
  dim: { opacity: 0.7 },
});
