import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Calendar as RNCalendar, LocaleConfig } from 'react-native-calendars';
import { BarChart, LineChart, PieChart } from 'react-native-gifted-charts';
import { ArrowLeft, Calendar, Check, ChevronDown, ChevronLeft, ChevronRight, TrendingDown, TrendingUp, X } from 'lucide-react-native';

import { useAuthenticatedUser } from '../features/auth/hooks/useAuthenticatedUser';
import { endOfMonth, isoDate, startOfMonth } from '../features/finance/utils';
import { useReports } from '../features/reports/hooks/useReports';
import { formatCurrencyBRL } from '../utils/format';

LocaleConfig.locales['pt-br'] = { monthNames: ['Janeiro', 'Fevereiro', 'Marco', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'], monthNamesShort: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'], dayNames: ['Domingo', 'Segunda', 'Terca', 'Quarta', 'Quinta', 'Sexta', 'Sabado'], dayNamesShort: ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'], today: 'Hoje' };
LocaleConfig.defaultLocale = 'pt-br';

const MONTHS = ['Janeiro', 'Fevereiro', 'Marco', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const now = new Date();
const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

function fmtDate(v: string) {
  return v.split('-').reverse().join('/');
}

export default function ReportsScreen({ navigation }: any) {
  const user = useAuthenticatedUser();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'Despesas' | 'Tendencias' | 'Evolucao'>('Despesas');
  const [mode, setMode] = useState<'month' | 'range'>('month');
  const [sheetMode, setSheetMode] = useState<'month' | 'range'>('month');
  const [monthKey, setMonthKey] = useState(defaultMonth);
  const [from, setFrom] = useState(isoDate(startOfMonth(now)));
  const [to, setTo] = useState(isoDate(endOfMonth(now)));
  const [tempFrom, setTempFrom] = useState(from);
  const [tempTo, setTempTo] = useState(to);
  const [selecting, setSelecting] = useState<'from' | 'to'>('from');
  const reportQuery = useReports(user?.id, { from, to });
  const report = reportQuery.data;

  const monthLabel = `${MONTHS[Number(monthKey.split('-')[1]) - 1]} ${monthKey.split('-')[0]}`;
  const pieData = useMemo(() => (report?.topCategories ?? []).slice(0, 4).map((item) => ({ value: item.amount, color: item.color })), [report]);
  const lineData = useMemo(() => (report?.lineSeries ?? []).map((item, index) => ({ value: item.value, label: `S${index + 1}` })), [report]);

  const selectMonth = (key: string) => {
    const [year, month] = key.split('-').map(Number);
    const date = new Date(year, month - 1, 1);
    setMonthKey(key);
    setFrom(isoDate(startOfMonth(date)));
    setTo(isoDate(endOfMonth(date)));
    setMode('month');
    setSheetMode('month');
    setOpen(false);
  };

  const applyRange = () => {
    if (new Date(tempFrom) > new Date(tempTo)) {
      Alert.alert('Periodo invalido', 'A data inicial precisa ser menor ou igual a data final.');
      return;
    }
    setFrom(tempFrom);
    setTo(tempTo);
    setMode('range');
    setOpen(false);
  };

  return (
    <SafeAreaView style={s.bg}>
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <View style={s.head}><Pressable onPress={() => navigation.goBack()}><ArrowLeft size={24} color="#111" /></Pressable><Text style={s.title}>Relatorios</Text></View>

        <Pressable style={s.selector} onPress={() => { setSheetMode(mode); setOpen(true); }}>
          <Calendar size={16} color="#64748b" />
          <Text style={s.selectorText}>{mode === 'month' ? monthLabel : `${fmtDate(from)} - ${fmtDate(to)}`}</Text>
          <ChevronDown size={16} color="#64748b" />
        </Pressable>

        <View style={s.rowGap}>
          <View style={[s.sum, { backgroundColor: '#10b981' }]}><View style={s.sumHead}><TrendingUp size={12} color="#fff" /><Text style={s.sumLabel}>Receitas</Text></View><Text style={s.sumValue}>{formatCurrencyBRL(report?.income ?? 0)}</Text></View>
          <View style={[s.sum, { backgroundColor: '#f43f5e' }]}><View style={s.sumHead}><TrendingDown size={12} color="#fff" /><Text style={s.sumLabel}>Despesas</Text></View><Text style={s.sumValue}>{formatCurrencyBRL(report?.expense ?? 0)}</Text></View>
        </View>

        <View style={s.balanceRow}>
          <View><Text style={s.balanceLabel}>Saldo do periodo</Text><Text style={[s.balanceValue, (report?.balance ?? 0) < 0 && { color: '#f43f5e' }]}>{formatCurrencyBRL(report?.balance ?? 0)}</Text></View>
          <View><Text style={s.balanceLabel}>Taxa de poupanca</Text><Text style={s.balanceValue}>{(report?.savingsRate ?? 0).toFixed(1)}%</Text></View>
        </View>

        <View style={s.tabs}>
          {(['Despesas', 'Tendencias', 'Evolucao'] as const).map((item) => <Pressable key={item} style={[s.tab, tab === item && s.tabOn]} onPress={() => setTab(item)}><Text style={[s.tabText, tab === item && s.tabTextOn]}>{item}</Text></Pressable>)}
        </View>

        <View style={s.card}>
          <Text style={s.cardTitle}>{tab}</Text>
          {reportQuery.isLoading ? <ActivityIndicator color="#3b82f6" style={s.loader} /> : null}
          {reportQuery.isError ? <View><Text style={s.msg}>Nao foi possivel gerar o relatorio.</Text><Pressable style={s.retry} onPress={() => reportQuery.refetch()}><Text style={s.retryText}>Tentar novamente</Text></Pressable></View> : null}
          {!reportQuery.isLoading && !reportQuery.isError && tab === 'Despesas' ? (
            report?.topCategories.length ? (
              <View style={s.chartRow}>
                <View style={s.legendCol}>{report.topCategories.slice(0, 4).map((item) => <View key={item.category} style={s.legendRow}><View style={[s.dot, { backgroundColor: item.color }]} /><Text style={s.legendText}>{item.category}</Text></View>)}</View>
                <PieChart data={pieData} donut radius={62} innerRadius={42} centerLabelComponent={() => <View style={s.centerPie}><Text style={s.centerPieSm}>Total</Text><Text style={s.centerPieLg}>{formatCurrencyBRL(report.expense)}</Text></View>} />
              </View>
            ) : <Text style={s.msg}>Sem despesas suficientes no periodo.</Text>
          ) : null}
          {!reportQuery.isLoading && !reportQuery.isError && tab === 'Tendencias' ? (
            report?.barSeries.length ? <BarChart data={report.barSeries} barWidth={34} spacing={34} roundedTop yAxisThickness={0} xAxisThickness={0} hideRules noOfSections={3} /> : <Text style={s.msg}>Sem dados para tendencias.</Text>
          ) : null}
          {!reportQuery.isLoading && !reportQuery.isError && tab === 'Evolucao' ? (
            report?.lineSeries.length ? <LineChart data={lineData} color="#3b82f6" thickness={3} hideDataPoints yAxisThickness={0} xAxisThickness={0} areaChart startFillColor="rgba(59,130,246,0.18)" startOpacity={0.9} endOpacity={0.05} /> : <Text style={s.msg}>Sem dados para evolucao.</Text>
          ) : null}
        </View>

        <View style={s.card}>
          <Text style={s.cardTitle}>Maiores Gastos</Text>
          {reportQuery.isLoading ? <ActivityIndicator color="#3b82f6" /> : null}
          {!reportQuery.isLoading && !(report?.topCategories.length) ? <Text style={s.msg}>Nenhuma categoria encontrada.</Text> : null}
          {(report?.topCategories ?? []).slice(0, 5).map((item, index) => <View key={item.category} style={s.listItem}><View style={s.rank}><Text style={s.rankText}>{index + 1}</Text></View><View style={s.flex}><View style={s.listHead}><Text style={s.listName}>{item.category}</Text><Text style={s.listValue}>{formatCurrencyBRL(item.amount)}</Text></View><View style={s.barBg}><View style={[s.bar, { width: `${Math.min(item.share, 100)}%`, backgroundColor: item.color }]} /></View><Text style={s.share}>{item.share.toFixed(1)}%</Text></View></View>)}
        </View>

        <View style={s.card}>
          <Text style={s.cardTitle}>Por Forma de Pagamento</Text>
          {reportQuery.isLoading ? <ActivityIndicator color="#3b82f6" /> : null}
          {!reportQuery.isLoading && !(report?.paymentMethods.length) ? <Text style={s.msg}>Nenhuma forma de pagamento encontrada.</Text> : null}
          {(report?.paymentMethods ?? []).map((item) => <View key={item.label} style={s.pay}><Text style={s.payLabel}>{item.label}</Text><Text style={s.payValue}>{formatCurrencyBRL(item.amount)}</Text></View>)}
        </View>
      </ScrollView>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={s.overlay}><View style={s.sheet}><View style={s.sheetHead}><Text style={s.sheetTitle}>Periodo</Text><Pressable onPress={() => setOpen(false)}><X size={24} color="#111827" /></Pressable></View><View style={s.tabs}><Pressable style={[s.tab, sheetMode === 'month' && s.tabOn]} onPress={() => setSheetMode('month')}><Text style={[s.tabText, sheetMode === 'month' && s.tabTextOn]}>Mes</Text></Pressable><Pressable style={[s.tab, sheetMode === 'range' && s.tabOn]} onPress={() => setSheetMode('range')}><Text style={[s.tabText, sheetMode === 'range' && s.tabTextOn]}>Intervalo</Text></Pressable></View>{sheetMode === 'month' ? <ScrollView showsVerticalScrollIndicator={false}>{MONTHS.map((label, index) => { const key = `${now.getFullYear()}-${String(index + 1).padStart(2, '0')}`; return <Pressable key={key} style={s.monthRow} onPress={() => selectMonth(key)}><Text style={[s.monthText, monthKey === key && s.monthTextOn]}>{label}</Text>{monthKey === key ? <Check size={18} color="#3b82f6" /> : null}</Pressable>; })}</ScrollView> : <ScrollView showsVerticalScrollIndicator={false}><Text style={s.inputLabel}>Inicio do periodo</Text><Pressable style={[s.dateBox, selecting === 'from' && s.dateBoxOn]} onPress={() => setSelecting('from')}><Text>{fmtDate(tempFrom)}</Text><Calendar size={18} color="#3b82f6" /></Pressable><Text style={[s.inputLabel, { marginTop: 14 }]}>Fim do periodo</Text><Pressable style={[s.dateBox, selecting === 'to' && s.dateBoxOn]} onPress={() => setSelecting('to')}><Text>{fmtDate(tempTo)}</Text><Calendar size={18} color="#3b82f6" /></Pressable><View style={s.calendar}><RNCalendar current={selecting === 'from' ? tempFrom : tempTo} markedDates={{ [tempFrom]: { selected: selecting === 'from', selectedColor: '#3b82f6' }, [tempTo]: { selected: selecting === 'to', selectedColor: '#3b82f6' } }} onDayPress={(day) => selecting === 'from' ? setTempFrom(day.dateString) : setTempTo(day.dateString)} theme={{ todayTextColor: '#3b82f6', selectedDayBackgroundColor: '#3b82f6' }} renderArrow={(dir) => dir === 'left' ? <ChevronLeft size={20} color="#3b82f6" /> : <ChevronRight size={20} color="#3b82f6" />} /></View><Pressable style={s.apply} onPress={applyRange}><Text style={s.applyText}>Aplicar Periodo</Text></Pressable></ScrollView>}</View></View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  bg: { flex: 1, backgroundColor: '#f8fafc' }, content: { paddingBottom: 30 }, head: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 }, title: { fontSize: 18, fontWeight: '800', color: '#111827' }, selector: { flexDirection: 'row', alignItems: 'center', alignSelf: 'center', borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, gap: 8, marginTop: 4 }, selectorText: { fontSize: 13, color: '#1e293b' }, rowGap: { flexDirection: 'row', gap: 12, padding: 16 }, sum: { flex: 1, borderRadius: 12, padding: 12 }, sumHead: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 }, sumLabel: { color: '#fff', fontSize: 11 }, sumValue: { color: '#fff', fontSize: 15, fontWeight: '800' }, balanceRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 16 }, balanceLabel: { fontSize: 11, color: '#94a3b8' }, balanceValue: { fontSize: 15, fontWeight: '800', color: '#10b981', marginTop: 2 }, tabs: { flexDirection: 'row', marginHorizontal: 16, borderRadius: 10, padding: 4, backgroundColor: '#f1f5f9', marginBottom: 16 }, tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 }, tabOn: { backgroundColor: '#fff' }, tabText: { color: '#64748b', fontSize: 12, fontWeight: '600' }, tabTextOn: { color: '#1e293b', fontWeight: '800' }, card: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginHorizontal: 16, marginBottom: 12 }, cardTitle: { fontSize: 15, fontWeight: '800', color: '#111827', marginBottom: 16 }, loader: { marginVertical: 24 }, msg: { color: '#64748b', lineHeight: 18 }, retry: { alignSelf: 'flex-start', backgroundColor: '#3b82f6', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, marginTop: 12 }, retryText: { color: '#fff', fontWeight: '700' }, chartRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }, legendCol: { flex: 1, gap: 10 }, legendRow: { flexDirection: 'row', alignItems: 'center', gap: 8 }, dot: { width: 8, height: 8, borderRadius: 4 }, legendText: { color: '#334155', fontSize: 12 }, centerPie: { alignItems: 'center', width: 76 }, centerPieSm: { fontSize: 9, color: '#94a3b8' }, centerPieLg: { fontSize: 10, fontWeight: '800', textAlign: 'center' }, listItem: { flexDirection: 'row', gap: 12, marginBottom: 18 }, rank: { width: 26, alignItems: 'center', paddingTop: 2 }, rankText: { fontSize: 12, color: '#94a3b8', fontWeight: '700' }, flex: { flex: 1 }, listHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }, listName: { fontSize: 13, fontWeight: '700', color: '#1e293b' }, listValue: { fontSize: 13, fontWeight: '800', color: '#1e293b' }, barBg: { height: 4, borderRadius: 999, backgroundColor: '#f1f5f9', overflow: 'hidden' }, bar: { height: '100%', borderRadius: 999 }, share: { textAlign: 'right', fontSize: 10, color: '#94a3b8', marginTop: 4 }, pay: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }, payLabel: { fontSize: 13, color: '#475569' }, payValue: { fontSize: 14, fontWeight: '800', color: '#111827' }, overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }, sheet: { backgroundColor: '#fff', borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 20, maxHeight: '90%' }, sheetHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }, sheetTitle: { fontSize: 18, fontWeight: '800', color: '#1e293b' }, monthRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }, monthText: { fontSize: 16, color: '#111827' }, monthTextOn: { color: '#3b82f6', fontWeight: '800' }, inputLabel: { fontSize: 14, color: '#64748b', marginBottom: 8 }, dateBox: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, padding: 14 }, dateBoxOn: { borderColor: '#3b82f6', backgroundColor: '#f0f7ff' }, calendar: { borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#f1f5f9', marginTop: 18 }, apply: { backgroundColor: '#3b82f6', borderRadius: 12, padding: 16, alignItems: 'center', marginVertical: 16 }, applyText: { color: '#fff', fontWeight: '800' },
});
