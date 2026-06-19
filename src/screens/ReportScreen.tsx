import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Calendar as RNCalendar, LocaleConfig } from 'react-native-calendars';
import { BarChart, LineChart, PieChart } from 'react-native-gifted-charts';
import { Calendar, Check, ChevronDown, ChevronLeft, ChevronRight, TrendingDown, TrendingUp, X } from 'lucide-react-native';

import { Card } from '../components/Card';
import { PageHeader } from '../components/PageHeader';
import { PageShell } from '../components/PageShell';
import { useAuthenticatedUser } from '../features/auth/hooks/useAuthenticatedUser';
import { endOfMonth, isoDate, startOfMonth } from '../features/finance/utils';
import { useCurrentPlan } from '../features/plans/hooks';
import { useReports } from '../features/reports/hooks/useReports';
import { radius, spacing, typography, type AppColors, useThemeColors } from '../theme';
import { formatCurrencyBRL } from '../utils/format';

LocaleConfig.locales['pt-br'] = {
  monthNames: ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'],
  monthNamesShort: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'],
  dayNames: ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'],
  dayNamesShort: ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'],
  today: 'Hoje',
};
LocaleConfig.defaultLocale = 'pt-br';

const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const now = new Date();
const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

function fmtDate(value: string) {
  return value.split('-').reverse().join('/');
}

export default function ReportsScreen({ navigation }: any) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const user = useAuthenticatedUser();
  const currentPlan = useCurrentPlan(user?.id);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'Despesas' | 'Tendências' | 'Evolução'>('Despesas');
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
  const hasFullReports = currentPlan.entitlements.fullReports;

  const monthLabel = `${MONTHS[Number(monthKey.split('-')[1]) - 1]} ${monthKey.split('-')[0]}`;
  const pieData = useMemo(
    () => (report?.topCategories ?? []).slice(0, 4).map((item) => ({ value: item.amount, color: item.color })),
    [report],
  );
  const lineData = useMemo(
    () => (report?.lineSeries ?? []).map((item, index) => ({ value: item.value, label: `S${index + 1}` })),
    [report],
  );

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
      Alert.alert('Período inválido', 'A data inicial precisa ser menor ou igual à data final.');
      return;
    }

    setFrom(tempFrom);
    setTo(tempTo);
    setMode('range');
    setOpen(false);
  };

  return (
    <PageShell>
      <PageHeader title="Relatórios" onBackPress={() => navigation.goBack()} />

      <Pressable style={styles.selector} onPress={() => { setSheetMode(mode); setOpen(true); }}>
        <Calendar size={16} color={colors.textSecondary} />
        <Text style={styles.selectorText}>{mode === 'month' ? monthLabel : `${fmtDate(from)} - ${fmtDate(to)}`}</Text>
        <ChevronDown size={16} color={colors.textSecondary} />
      </Pressable>

      <View style={styles.rowGap}>
        <View style={[styles.sum, { backgroundColor: colors.success }]}>
          <View style={styles.sumHead}>
            <TrendingUp size={12} color={colors.white} />
            <Text style={styles.sumLabel}>Receitas</Text>
          </View>
          <Text style={styles.sumValue}>{formatCurrencyBRL(report?.income ?? 0)}</Text>
        </View>
        <View style={[styles.sum, { backgroundColor: colors.danger }]}>
          <View style={styles.sumHead}>
            <TrendingDown size={12} color={colors.white} />
            <Text style={styles.sumLabel}>Despesas</Text>
          </View>
          <Text style={styles.sumValue}>{formatCurrencyBRL(report?.expense ?? 0)}</Text>
        </View>
      </View>

      <Card style={styles.balanceRow}>
        <View style={styles.balanceItem}>
          <Text style={styles.balanceLabel}>Saldo do período</Text>
          <Text style={[styles.balanceValue, (report?.balance ?? 0) < 0 && { color: colors.danger }]}>
            {formatCurrencyBRL(report?.balance ?? 0)}
          </Text>
        </View>
        <View style={styles.balanceItem}>
          <Text style={styles.balanceLabel}>Taxa de poupança</Text>
          <Text style={styles.balanceValue}>{(report?.savingsRate ?? 0).toFixed(1)}%</Text>
        </View>
      </Card>

      <View style={styles.tabs}>
        {(hasFullReports ? (['Despesas', 'Tendências', 'Evolução'] as const) : (['Despesas'] as const)).map((item) => (
          <Pressable key={item} style={[styles.tab, tab === item && styles.tabOn]} onPress={() => setTab(item)}>
            <Text style={[styles.tabText, tab === item && styles.tabTextOn]}>{item}</Text>
          </Pressable>
        ))}
      </View>

      <Card style={styles.card}>
        <Text style={styles.cardTitle}>{tab}</Text>
        {reportQuery.isLoading ? <ActivityIndicator color={colors.primaryLight} style={styles.loader} /> : null}
        {reportQuery.isError ? (
          <View>
            <Text style={styles.msg}>Não foi possível gerar o relatório.</Text>
            <Pressable style={styles.retry} onPress={() => reportQuery.refetch()}>
              <Text style={styles.retryText}>Tentar novamente</Text>
            </Pressable>
          </View>
        ) : null}
        {!reportQuery.isLoading && !reportQuery.isError && tab === 'Despesas' ? (
          report?.topCategories.length ? (
            <View style={styles.chartRow}>
              <View style={styles.legendCol}>
                {report.topCategories.slice(0, 4).map((item) => (
                  <View key={item.category} style={styles.legendRow}>
                    <View style={[styles.dot, { backgroundColor: item.color }]} />
                    <Text style={styles.legendText}>{item.category}</Text>
                  </View>
                ))}
              </View>
              <PieChart
                data={pieData}
                donut
                radius={62}
                innerRadius={42}
                centerLabelComponent={() => (
                  <View style={styles.centerPie}>
                    <Text style={styles.centerPieSm}>Total</Text>
                    <Text style={styles.centerPieLg}>{formatCurrencyBRL(report.expense)}</Text>
                  </View>
                )}
              />
            </View>
          ) : (
            <Text style={styles.msg}>Sem despesas suficientes no período.</Text>
          )
        ) : null}
        {!reportQuery.isLoading && !reportQuery.isError && hasFullReports && tab === 'Tendências' ? (
          report?.barSeries.length ? (
            <BarChart data={report.barSeries} barWidth={34} spacing={34} roundedTop yAxisThickness={0} xAxisThickness={0} hideRules noOfSections={3} />
          ) : (
            <Text style={styles.msg}>Sem dados para tendências.</Text>
          )
        ) : null}
        {!reportQuery.isLoading && !reportQuery.isError && hasFullReports && tab === 'Evolução' ? (
          report?.lineSeries.length ? (
            <LineChart
              data={lineData}
              color={colors.primaryLight}
              thickness={3}
              hideDataPoints
              yAxisThickness={0}
              xAxisThickness={0}
              areaChart
              startFillColor={colors.primaryLight}
              startOpacity={0.2}
              endOpacity={0.05}
            />
          ) : (
            <Text style={styles.msg}>Sem dados para evolução.</Text>
          )
        ) : null}
      </Card>

      <Card style={styles.card}>
        <Text style={styles.cardTitle}>Maiores Gastos</Text>
        {reportQuery.isLoading ? <ActivityIndicator color={colors.primaryLight} /> : null}
        {!reportQuery.isLoading && !(report?.topCategories.length) ? <Text style={styles.msg}>Nenhuma categoria encontrada.</Text> : null}
        {(report?.topCategories ?? []).slice(0, 5).map((item, index) => (
          <View key={item.category} style={styles.listItem}>
            <View style={styles.rank}>
              <Text style={styles.rankText}>{index + 1}</Text>
            </View>
            <View style={styles.flex}>
              <View style={styles.listHead}>
                <Text style={styles.listName}>{item.category}</Text>
                <Text style={styles.listValue}>{formatCurrencyBRL(item.amount)}</Text>
              </View>
              <View style={styles.barBg}>
                <View style={[styles.bar, { width: `${Math.min(item.share, 100)}%`, backgroundColor: item.color }]} />
              </View>
              <Text style={styles.share}>{item.share.toFixed(1)}%</Text>
            </View>
          </View>
        ))}
      </Card>

      {hasFullReports ? (
        <Card style={styles.card}>
          <Text style={styles.cardTitle}>Por Forma de Pagamento</Text>
          {reportQuery.isLoading ? <ActivityIndicator color={colors.primaryLight} /> : null}
          {!reportQuery.isLoading && !(report?.paymentMethods.length) ? <Text style={styles.msg}>Nenhuma forma de pagamento encontrada.</Text> : null}
          {(report?.paymentMethods ?? []).map((item) => (
            <View key={item.label} style={styles.pay}>
              <Text style={styles.payLabel}>{item.label}</Text>
              <Text style={styles.payValue}>{formatCurrencyBRL(item.amount)}</Text>
            </View>
          ))}
        </Card>
      ) : (
        <Card style={styles.card}>
          <Text style={styles.cardTitle}>Relatorios completos</Text>
          <Text style={styles.msg}>Tendencias, evolucao e formas de pagamento ficam disponiveis nos planos Intermediario e Pro.</Text>
        </Card>
      )}

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHead}>
              <Text style={styles.sheetTitle}>Período</Text>
              <Pressable onPress={() => setOpen(false)}>
                <X size={24} color={colors.textPrimary} />
              </Pressable>
            </View>
            <View style={styles.tabs}>
              <Pressable style={[styles.tab, sheetMode === 'month' && styles.tabOn]} onPress={() => setSheetMode('month')}>
                <Text style={[styles.tabText, sheetMode === 'month' && styles.tabTextOn]}>Mês</Text>
              </Pressable>
              <Pressable style={[styles.tab, sheetMode === 'range' && styles.tabOn]} onPress={() => setSheetMode('range')}>
                <Text style={[styles.tabText, sheetMode === 'range' && styles.tabTextOn]}>Intervalo</Text>
              </Pressable>
            </View>
            {sheetMode === 'month' ? (
              <ScrollView showsVerticalScrollIndicator={false}>
                {MONTHS.map((label, index) => {
                  const key = `${now.getFullYear()}-${String(index + 1).padStart(2, '0')}`;
                  return (
                    <Pressable key={key} style={styles.monthRow} onPress={() => selectMonth(key)}>
                      <Text style={[styles.monthText, monthKey === key && styles.monthTextOn]}>{label}</Text>
                      {monthKey === key ? <Check size={18} color={colors.primaryLight} /> : null}
                    </Pressable>
                  );
                })}
              </ScrollView>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={styles.inputLabel}>Início do período</Text>
                <Pressable style={[styles.dateBox, selecting === 'from' && styles.dateBoxOn]} onPress={() => setSelecting('from')}>
                  <Text style={styles.dateText}>{fmtDate(tempFrom)}</Text>
                  <Calendar size={18} color={colors.primaryLight} />
                </Pressable>
                <Text style={[styles.inputLabel, styles.inputLabelSpaced]}>Fim do período</Text>
                <Pressable style={[styles.dateBox, selecting === 'to' && styles.dateBoxOn]} onPress={() => setSelecting('to')}>
                  <Text style={styles.dateText}>{fmtDate(tempTo)}</Text>
                  <Calendar size={18} color={colors.primaryLight} />
                </Pressable>
                <View style={styles.calendar}>
                  <RNCalendar
                    current={selecting === 'from' ? tempFrom : tempTo}
                    markedDates={{
                      [tempFrom]: { selected: selecting === 'from', selectedColor: colors.primaryLight },
                      [tempTo]: { selected: selecting === 'to', selectedColor: colors.primaryLight },
                    }}
                    onDayPress={(day) => (selecting === 'from' ? setTempFrom(day.dateString) : setTempTo(day.dateString))}
                    theme={{ todayTextColor: colors.primaryLight, selectedDayBackgroundColor: colors.primaryLight, calendarBackground: colors.surface }}
                    renderArrow={(dir) => (dir === 'left' ? <ChevronLeft size={20} color={colors.primaryLight} /> : <ChevronRight size={20} color={colors.primaryLight} />)}
                  />
                </View>
                <Pressable style={styles.apply} onPress={applyRange}>
                  <Text style={styles.applyText}>Aplicar Período</Text>
                </Pressable>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </PageShell>
  );
}

const createStyles = (colors: AppColors) =>
  StyleSheet.create({
    selector: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      gap: spacing.sm,
    },
    selectorText: {
      ...typography.caption,
      color: colors.textPrimary,
      fontWeight: '600',
    },
    rowGap: {
      flexDirection: 'row',
      gap: spacing.md,
    },
    sum: {
      flex: 1,
      borderRadius: radius.lg,
      padding: spacing.md,
    },
    sumHead: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      marginBottom: spacing.xs,
    },
    sumLabel: {
      ...typography.caption,
      color: colors.white,
      fontWeight: '600',
    },
    sumValue: {
      ...typography.body,
      color: colors.white,
      fontWeight: '800',
    },
    balanceRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: spacing.md,
    },
    balanceItem: {
      flex: 1,
    },
    balanceLabel: {
      ...typography.caption,
      color: colors.textSecondary,
    },
    balanceValue: {
      ...typography.body,
      color: colors.success,
      fontWeight: '800',
      marginTop: 2,
    },
    tabs: {
      flexDirection: 'row',
      borderRadius: radius.md,
      padding: spacing.xs,
      backgroundColor: colors.mutedSurface,
    },
    tab: {
      flex: 1,
      paddingVertical: spacing.sm,
      alignItems: 'center',
      borderRadius: radius.sm,
    },
    tabOn: {
      backgroundColor: colors.surface,
    },
    tabText: {
      ...typography.caption,
      color: colors.textSecondary,
      fontWeight: '600',
    },
    tabTextOn: {
      color: colors.textPrimary,
      fontWeight: '800',
    },
    card: {
      gap: spacing.md,
    },
    cardTitle: {
      ...typography.body,
      color: colors.textPrimary,
      fontWeight: '800',
    },
    loader: {
      marginVertical: spacing.xl,
    },
    msg: {
      ...typography.body,
      color: colors.textSecondary,
      lineHeight: 18,
    },
    retry: {
      alignSelf: 'flex-start',
      backgroundColor: colors.primaryLight,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      marginTop: spacing.md,
    },
    retryText: {
      ...typography.caption,
      color: colors.white,
      fontWeight: '700',
    },
    chartRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.md,
    },
    legendCol: {
      flex: 1,
      gap: spacing.sm,
    },
    legendRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    legendText: {
      ...typography.caption,
      color: colors.textPrimary,
    },
    centerPie: {
      alignItems: 'center',
      width: 76,
    },
    centerPieSm: {
      ...typography.caption,
      color: colors.textSecondary,
      fontSize: 9,
    },
    centerPieLg: {
      ...typography.caption,
      color: colors.textPrimary,
      fontSize: 10,
      fontWeight: '800',
      textAlign: 'center',
    },
    listItem: {
      flexDirection: 'row',
      gap: spacing.md,
      marginBottom: spacing.md,
    },
    rank: {
      width: 26,
      alignItems: 'center',
      paddingTop: 2,
    },
    rankText: {
      ...typography.caption,
      color: colors.textSecondary,
      fontWeight: '700',
    },
    flex: {
      flex: 1,
    },
    listHead: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: spacing.xs,
    },
    listName: {
      ...typography.caption,
      color: colors.textPrimary,
      fontWeight: '700',
    },
    listValue: {
      ...typography.caption,
      color: colors.textPrimary,
      fontWeight: '800',
    },
    barBg: {
      height: 4,
      borderRadius: radius.pill,
      backgroundColor: colors.mutedSurface,
      overflow: 'hidden',
    },
    bar: {
      height: '100%',
      borderRadius: radius.pill,
    },
    share: {
      textAlign: 'right',
      ...typography.caption,
      color: colors.textSecondary,
      marginTop: spacing.xs,
      fontSize: 10,
    },
    pay: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.sm,
    },
    payLabel: {
      ...typography.body,
      color: colors.textSecondary,
    },
    payValue: {
      ...typography.body,
      color: colors.textPrimary,
      fontWeight: '800',
    },
    overlay: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: radius.xl,
      borderTopRightRadius: radius.xl,
      padding: spacing.xl,
      maxHeight: '90%',
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
    monthRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    monthText: {
      ...typography.body,
      color: colors.textPrimary,
    },
    monthTextOn: {
      color: colors.primary,
      fontWeight: '800',
    },
    inputLabel: {
      ...typography.body,
      color: colors.textSecondary,
      marginBottom: spacing.sm,
    },
    inputLabelSpaced: {
      marginTop: 14,
    },
    dateBox: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      padding: 14,
      backgroundColor: colors.surface,
    },
    dateBoxOn: {
      borderColor: colors.primary,
      backgroundColor: colors.primarySoft,
    },
    dateText: {
      ...typography.body,
      color: colors.textPrimary,
    },
    calendar: {
      borderRadius: radius.md,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.border,
      marginTop: spacing.lg,
    },
    apply: {
      backgroundColor: colors.primaryLight,
      borderRadius: radius.md,
      padding: spacing.lg,
      alignItems: 'center',
      marginVertical: spacing.lg,
    },
    applyText: {
      ...typography.body,
      color: colors.white,
      fontWeight: '800',
    },
  });
