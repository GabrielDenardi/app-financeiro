import { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Modal, StatusBar } from 'react-native';
import { Calendar as CustomCalendar, LocaleConfig } from 'react-native-calendars'; 
import { BarChart, PieChart, LineChart } from "react-native-gifted-charts";
import { ArrowLeft, Calendar, ChevronDown, TrendingUp, TrendingDown, MoreHorizontal, X, Check, ChevronRight, ChevronLeft, Fuel, ShoppingCart } from 'lucide-react-native';

// Configuração de idioma para o calendário
LocaleConfig.locales['pt-br'] = {
  monthNames: ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'],
  monthNamesShort: ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'],
  dayNames: ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'],
  dayNamesShort: ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'],
  today: 'Hoje'
};
LocaleConfig.defaultLocale = 'pt-br';

const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

export default function ReportsScreen({ navigation }: any) {
  const [activeTab, setActiveTab] = useState('Evolução'); 
  const [isModalVisible, setModalVisible] = useState(false);
  const [filterMode, setFilterMode] = useState('Intervalo'); 
  const [selectedMonth, setSelectedMonth] = useState('Março');

  const [startDate, setStartDate] = useState('2026-03-01');
  const [endDate, setEndDate] = useState('2026-03-31');
  const [tempStartDate, setTempStartDate] = useState('2026-03-01');
  const [tempEndDate, setTempEndDate] = useState('2026-03-31');
  const [selectingDate, setSelectingDate] = useState<'start' | 'end'>('start');

  // Dados dinâmicos baseados no período
  const reportData = useMemo(() => {
    const monthIndex = filterMode === 'Mensal' ? meses.indexOf(selectedMonth) + 1 : new Date(startDate).getMonth() + 1;
    const weight = monthIndex * 0.75;
    
    return {
      receitas: 325.00 * weight,
      despesas: 2250.00 * weight,
      combustivel: 1250.00 * weight,
      supermercado: 1000.00 * weight,
      chartLine: [{value: 400 * weight}, {value: 1200 * weight}, {value: 800 * weight}, {value: 2000 * weight}],
      chartBar: [
        {value: 2800 * weight, label: 'Rec', frontColor: '#10b981'},
        {value: 1950 * weight, label: 'Des', frontColor: '#f43f5e'}
      ]
    };
  }, [selectedMonth, startDate, endDate, filterMode]);

  const saldo = reportData.receitas - reportData.despesas;

  const formatDateDisplay = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
  };

  const handleApplyFilter = () => {
    setStartDate(tempStartDate);
    setEndDate(tempEndDate);
    setModalVisible(false);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={styles.headerSafe}>
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => navigation?.goBack()}><ArrowLeft size={24} color="#000" /></TouchableOpacity>
          <Text style={styles.headerTitle}>Relatórios</Text>
        </View>
      </SafeAreaView>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 }}>
        
        {/* Seletor de Período Principal */}
        <TouchableOpacity style={styles.periodSelector} onPress={() => setModalVisible(true)}>
          <Calendar size={16} color="#64748B" />
          <Text style={styles.periodText}>
            {filterMode === 'Mensal' ? selectedMonth : `${formatDateDisplay(startDate)} - ${formatDateDisplay(endDate)}`}
          </Text>
          <ChevronDown size={16} color="#64748B" />
        </TouchableOpacity>

        {/* Cards de Resumo */}
        <View style={styles.summaryRow}>
          <View style={[styles.card, { backgroundColor: '#10b981' }]}>
            <View style={styles.cardHeader}><TrendingUp size={12} color="#fff" /><Text style={styles.cardLabel}>Receitas</Text></View>
            <Text style={styles.cardValue}>R$ {reportData.receitas.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</Text>
          </View>
          <View style={[styles.card, { backgroundColor: '#f43f5e' }]}>
            <View style={styles.cardHeader}><TrendingDown size={12} color="#fff" /><Text style={styles.cardLabel}>Despesas</Text></View>
            <Text style={styles.cardValue}>R$ {reportData.despesas.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</Text>
          </View>
        </View>

        {/* Info de Saldo */}
        <View style={styles.balanceRow}>
          <View style={styles.balanceItem}>
            <Text style={styles.balanceLabel}>Saldo do Período</Text>
            <Text style={[styles.balanceValue, {color: saldo >= 0 ? '#10b981' : '#f43f5e'}]}>
               R$ {saldo.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
            </Text>
          </View>
          <View style={styles.balanceItem}>
            <Text style={styles.balanceLabel}>Taxa de Poupança</Text>
            <Text style={styles.balanceValue}>15.4%</Text>
          </View>
        </View>

        {/* Tabs */}
        <View style={styles.tabBar}>
          {['Despesas', 'Tendências', 'Evolução'].map((tab) => (
            <TouchableOpacity key={tab} style={[styles.tabItem, activeTab === tab && styles.tabActive]} onPress={() => setActiveTab(tab)}>
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{tab}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Gráficos */}
        <View style={styles.chartContainer}>
          <Text style={styles.sectionTitle}>{activeTab}</Text>
          {activeTab === 'Despesas' ? (
            <View style={styles.chartRow}>
              <View style={styles.legendCol}>
                <View style={styles.legendItem}><View style={[styles.dot, {backgroundColor: '#10b981'}]} /><Text style={styles.legendText}>Combustível</Text></View>
                <View style={styles.legendItem}><View style={[styles.dot, {backgroundColor: '#005bb2'}]} /><Text style={styles.legendText}>Mercado</Text></View>
              </View>
              <PieChart 
                data={[{value: reportData.combustivel, color: '#10b981'}, {value: reportData.supermercado, color: '#005bb2'}]}
                donut radius={50} innerRadius={35}
                centerLabelComponent={() => <View style={{alignItems:'center'}}><Text style={{fontSize:8}}>Total</Text><Text style={{fontSize:9, fontWeight:'bold'}}>R$ {(reportData.combustivel + reportData.supermercado).toFixed(0)}</Text></View>}
              />
              <View style={styles.valuesCol}>
                <Text style={styles.valueRow}><Text style={styles.valPerc}>55.6%</Text> R$ {reportData.combustivel.toFixed(0)}</Text>
                <Text style={styles.valueRow}><Text style={styles.valPerc}>44.4%</Text> R$ {reportData.supermercado.toFixed(0)}</Text>
              </View>
            </View>
          ) : activeTab === 'Tendências' ? (
            <BarChart data={reportData.chartBar} barWidth={30} noOfSections={3} hideRules />
          ) : (
            <LineChart data={reportData.chartLine} color="#3b82f6" areaChart startFillColor="rgba(59, 130, 246, 0.1)" />
          )}
        </View>

        {/* --- SEÇÃO: MAIORES GASTOS (NOVO) --- */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Maiores Gastos</Text>
          
          <View style={styles.listItem}>
            <View style={styles.listIconContainer}>
              <Text style={styles.listNumber}>1</Text>
              <View style={[styles.iconCircle, {backgroundColor: '#FEF3C7'}]}><Fuel size={18} color="#D97706" /></View>
            </View>
            <View style={styles.listBody}>
              <View style={styles.listHeaderRow}>
                <Text style={styles.listName}>Combustível</Text>
                <Text style={styles.listValue}>R$ {reportData.combustivel.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</Text>
              </View>
              <View style={styles.progressContainer}>
                <View style={[styles.progressBar, { width: '55.6%' }]} />
              </View>
              <Text style={styles.listPercentText}>55.6%</Text>
            </View>
          </View>

          <View style={styles.listItem}>
            <View style={styles.listIconContainer}>
              <Text style={styles.listNumber}>2</Text>
              <View style={[styles.iconCircle, {backgroundColor: '#DCFCE7'}]}><ShoppingCart size={18} color="#10B981" /></View>
            </View>
            <View style={styles.listBody}>
              <View style={styles.listHeaderRow}>
                <Text style={styles.listName}>Supermercado</Text>
                <Text style={styles.listValue}>R$ {reportData.supermercado.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</Text>
              </View>
              <View style={styles.progressContainer}>
                <View style={[styles.progressBar, { width: '44.4%' }]} />
              </View>
              <Text style={styles.listPercentText}>44.4%</Text>
            </View>
          </View>
        </View>

        {/* --- SEÇÃO: POR FORMA DE PAGAMENTO (NOVO) --- */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Por Forma de Pagamento</Text>
          <View style={styles.paymentRow}>
            <Text style={styles.paymentLabel}>PIX</Text>
            <Text style={styles.paymentValue}>R$ {reportData.despesas.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</Text>
          </View>
        </View>

      </ScrollView>

      {/* MODAL DE FILTRO */}
      <Modal visible={isModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Período</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}><X size={24} color="#1E293B" /></TouchableOpacity>
            </View>

            <View style={styles.modalTabRow}>
              <TouchableOpacity style={[styles.modalTab, filterMode === 'Mensal' && styles.modalTabActive]} onPress={() => setFilterMode('Mensal')}>
                <Text style={[styles.modalTabText, filterMode === 'Mensal' && styles.modalTabTextActive]}>Mês</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalTab, filterMode === 'Intervalo' && styles.modalTabActive]} onPress={() => setFilterMode('Intervalo')}>
                <Text style={[styles.modalTabText, filterMode === 'Intervalo' && styles.modalTabTextActive]}>Intervalo</Text>
              </TouchableOpacity>
            </View>

            {filterMode === 'Mensal' ? (
              <ScrollView showsVerticalScrollIndicator={false}>
                {meses.map((mes) => (
                  <TouchableOpacity key={mes} style={styles.modalItem} onPress={() => { setSelectedMonth(mes); setModalVisible(false); }}>
                    <Text style={[styles.modalItemText, selectedMonth === mes && { color: '#3b82f6', fontWeight: 'bold' }]}>{mes}</Text>
                    {selectedMonth === mes && <Check size={18} color="#3b82f6" />}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={styles.inputLabel}>Início do Período</Text>
                <TouchableOpacity style={[styles.dateInputWrapper, selectingDate === 'start' && styles.dateInputWrapperActive]} onPress={() => setSelectingDate('start')}>
                  <Text style={styles.dateInputText}>{formatDateDisplay(tempStartDate)}</Text>
                  <Calendar size={20} color="#3b82f6" />
                </TouchableOpacity>

                <Text style={[styles.inputLabel, { marginTop: 15 }]}>Fim do Período</Text>
                <TouchableOpacity style={[styles.dateInputWrapper, selectingDate === 'end' && styles.dateInputWrapperActive]} onPress={() => setSelectingDate('end')}>
                  <Text style={styles.dateInputText}>{formatDateDisplay(tempEndDate)}</Text>
                  <Calendar size={20} color="#3b82f6" />
                </TouchableOpacity>

                <View style={styles.calendarBox}>
                  <CustomCalendar
                    current={selectingDate === 'start' ? tempStartDate : tempEndDate}
                    onDayPress={(day) => selectingDate === 'start' ? setTempStartDate(day.dateString) : setTempEndDate(day.dateString)}
                    markedDates={{[selectingDate === 'start' ? tempStartDate : tempEndDate]: { selected: true, selectedColor: '#3b82f6' }}}
                    theme={{ todayTextColor: '#3b82f6', selectedDayBackgroundColor: '#3b82f6', arrowColor: '#3b82f6' }}
                    renderArrow={(dir) => dir === 'left' ? <ChevronLeft size={20} color="#3b82f6" /> : <ChevronRight size={20} color="#3b82f6" />}
                  />
                </View>

                <TouchableOpacity style={styles.applyBtn} onPress={handleApplyFilter}><Text style={styles.applyBtnText}>Aplicar Período</Text></TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  headerSafe: { backgroundColor: '#fff' },
  headerContent: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  headerTitle: { fontSize: 16, fontWeight: 'bold' },
  periodSelector: { flexDirection: 'row', alignItems: 'center', alignSelf: 'center', backgroundColor: '#fff', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0', marginTop: 10 },
  periodText: { fontSize: 13, marginHorizontal: 8, color: '#1E293B' },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', padding: 16, gap: 12 },
  card: { flex: 1, padding: 12, borderRadius: 10 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
  cardLabel: { color: '#fff', fontSize: 11 },
  cardValue: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
  balanceRow: { flexDirection: 'row', justifyContent: 'space-around', paddingBottom: 16 },
  balanceItem: { alignItems: 'center' },
  balanceLabel: { fontSize: 10, color: '#94A3B8' },
  balanceValue: { fontSize: 14, fontWeight: 'bold' },
  tabBar: { flexDirection: 'row', marginHorizontal: 16, backgroundColor: '#F1F5F9', borderRadius: 8, padding: 4, marginBottom: 16 },
  tabItem: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 6 },
  tabActive: { backgroundColor: '#fff' },
  tabText: { fontSize: 12, color: '#64748B' },
  tabTextActive: { color: '#1E293B', fontWeight: 'bold' },
  chartContainer: { backgroundColor: '#fff', marginHorizontal: 16, borderRadius: 12, padding: 16, marginBottom: 12 },
  chartRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  legendCol: { gap: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11 },
  valuesCol: { alignItems: 'flex-end', gap: 8 },
  valueRow: { fontSize: 11, fontWeight: 'bold' },
  valPerc: { color: '#94A3B8', fontWeight: 'normal' },
  sectionCard: { backgroundColor: '#fff', marginHorizontal: 16, borderRadius: 12, padding: 16, marginBottom: 12 },
  sectionTitle: { fontSize: 14, fontWeight: 'bold', marginBottom: 16 },
  
  // Estilos da Lista de Gastos
  listItem: { flexDirection: 'row', marginBottom: 20 },
  listIconContainer: { flexDirection: 'row', alignItems: 'center', gap: 12, marginRight: 12 },
  listNumber: { fontSize: 12, color: '#94A3B8', width: 10 },
  iconCircle: { padding: 8, borderRadius: 8 },
  listBody: { flex: 1 },
  listHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  listName: { fontSize: 13, fontWeight: 'bold', color: '#1E293B' },
  listValue: { fontSize: 13, fontWeight: 'bold', color: '#1E293B' },
  progressContainer: { height: 4, backgroundColor: '#F1F5F9', borderRadius: 2, marginBottom: 4 },
  progressBar: { height: '100%', backgroundColor: '#f43f5e', borderRadius: 2 },
  listPercentText: { fontSize: 10, color: '#94A3B8', textAlign: 'right' },
  
  // Pagamento
  paymentRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  paymentLabel: { fontSize: 13, color: '#64748B' },
  paymentValue: { fontSize: 14, fontWeight: 'bold', color: '#1E293B' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 25, borderTopRightRadius: 25, padding: 20, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: 'bold' },
  modalTabRow: { flexDirection: 'row', backgroundColor: '#F1F5F9', borderRadius: 10, padding: 4, marginBottom: 20 },
  modalTab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
  modalTabActive: { backgroundColor: '#fff' },
  modalTabText: { color: '#64748B' },
  modalTabTextActive: { color: '#3b82f6', fontWeight: 'bold' },
  modalItem: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  modalItemText: { fontSize: 16 },
  inputLabel: { fontSize: 14, color: '#64748B', marginBottom: 8 },
  dateInputWrapper: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0', padding: 14, borderRadius: 12 },
  dateInputWrapperActive: { borderColor: '#3b82f6', backgroundColor: '#F0F7FF' },
  dateInputText: { fontSize: 16 },
  calendarBox: { marginTop: 20, marginBottom: 10, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#F1F5F9' },
  applyBtn: { backgroundColor: '#3b82f6', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 10, marginBottom: 20 },
  applyBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 }
});