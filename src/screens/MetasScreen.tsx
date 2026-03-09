import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  FlatList, 
  SafeAreaView, 
  Modal, 
  TextInput, 
  ScrollView,
  Alert,
} from 'react-native';
import { 
  Plus, 
  Car, 
  Target, 
  ChevronLeft, 
  X, 
  Home, 
  Plane, 
  GraduationCap, 
  Smartphone, 
  Landmark, 
  Gift,
  Trash2,
  Calendar as CalendarIcon,
  ChevronRight,
  ChevronLeft as ChevronLeftIcon
} from 'lucide-react-native';
import { Calendar, CalendarUtils } from 'react-native-calendars';

// --- CONSTANTES E UTILITÁRIOS ---

const INITIAL_DATE = CalendarUtils.getCalendarDateString(new Date());

const toCurrencyBRL = (value: number) => {
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const maskCurrency = (value: string) => {
  let v = value.replace(/\D/g, "");
  v = (Number(v) / 100).toFixed(2).replace(".", ",");
  v = v.replace(/(\d)(\d{3})(\d{3}),/g, "$1.$2.$3,");
  v = v.replace(/(\d)(\d{3}),/g, "$1.$2,");
  return v;
};

const parseCurrencyToFloat = (value: string) => {
  if (!value) return 0;
  return parseFloat(value.replace(/\./g, '').replace(',', '.'));
};

const ICON_COMPONENTS: any = {
  geral: Target, carro: Car, casa: Home, viagem: Plane,
  educacao: GraduationCap, presente: Gift, eletronico: Smartphone, reserva: Landmark,
};

const ICONS_OPTIONS = [
  { id: 'geral', label: 'Geral', icon: Target },
  { id: 'carro', label: 'Carro', icon: Car },
  { id: 'casa', label: 'Casa', icon: Home },
  { id: 'viagem', label: 'Viagem', icon: Plane },
  { id: 'educacao', label: 'Educação', icon: GraduationCap },
  { id: 'presente', label: 'Presente', icon: Gift },
  { id: 'eletronico', label: 'Eletrônico', icon: Smartphone },
  { id: 'reserva', label: 'Reserva', icon: Landmark },
];

const COLORS = ['#10B981', '#3B82F6', '#8B5CF6', '#F43F5E', '#F59E0B', '#06B6D4'];

export default function MetasScreen({ navigation }: any) {
  // --- ESTADOS ---
  const [tabAtiva, setTabAtiva] = useState<'active' | 'completed'>('active');
  const [modalNovaMetaVisible, setModalNovaMetaVisible] = useState(false);
  const [modalAdicionarVisible, setModalAdicionarVisible] = useState(false);
  const [modalEditarPrazoVisible, setModalEditarPrazoVisible] = useState(false);
  
  const [goals, setGoals] = useState([
    {
      id: '1', title: 'Carro Novo', 
      currentValue: 200, totalValue: 12000,
      monthlyEstimate: "1.268,81", status: 'active',
      iconId: 'carro', color: '#E11D48', deadline: INITIAL_DATE
    }
  ]);

  // Estados Form Nova Meta
  const [nome, setNome] = useState('');
  const [valorAlvo, setValorAlvo] = useState('');
  const [valorGuardado, setValorGuardado] = useState('');
  const [selectedDate, setSelectedDate] = useState(INITIAL_DATE);
  const [selectedIcon, setSelectedIcon] = useState('carro');
  const [selectedColor, setSelectedColor] = useState('#10B981');

  // Estados Auxiliares para Edição e Depósito
  const [selectedGoal, setSelectedGoal] = useState<any>(null);
  const [valorDeposito, setValorDeposito] = useState('');
  const [tempDate, setTempDate] = useState(INITIAL_DATE);

  // --- FUNÇÕES DE AÇÃO ---

  const handleCreateGoal = () => {
    if (!nome || !valorAlvo) {
      Alert.alert("Atenção", "Por favor, preencha o nome e o valor alvo.");
      return;
    }
    const vAlvo = parseCurrencyToFloat(valorAlvo);
    const vGuardado = parseCurrencyToFloat(valorGuardado);

    const newGoal = {
      id: Math.random().toString(),
      title: nome,
      currentValue: vGuardado,
      totalValue: vAlvo,
      monthlyEstimate: toCurrencyBRL((vAlvo - vGuardado) / 12),
      status: vGuardado >= vAlvo ? 'completed' : 'active',
      iconId: selectedIcon,
      color: selectedColor,
      deadline: selectedDate
    };

    setGoals([newGoal, ...goals]);
    setModalNovaMetaVisible(false);
    resetNovaMetaForm();
  };

  const handleUpdateDeadline = () => {
    if (!selectedGoal) return;
    setGoals(prev => prev.map(g => 
      g.id === selectedGoal.id ? { ...g, deadline: tempDate } : g
    ));
    setModalEditarPrazoVisible(false);
  };

  const resetNovaMetaForm = () => {
    setNome(''); setValorAlvo(''); setValorGuardado(''); 
    setSelectedDate(INITIAL_DATE); setSelectedIcon('carro'); setSelectedColor('#10B981');
  };

  const handleDeleteGoal = (id: string) => {
    Alert.alert("Excluir Meta", "Tem certeza que deseja apagar?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Excluir", style: "destructive", onPress: () => setGoals(prev => prev.filter(g => g.id !== id)) }
    ]);
  };

  const handleConfirmarDeposito = () => {
    const valor = parseCurrencyToFloat(valorDeposito);
    if (valor <= 0 || !selectedGoal) return;

    setGoals(prev => prev.map(g => {
      if (g.id === selectedGoal.id) {
        const novoValor = g.currentValue + valor;
        return { 
          ...g, 
          currentValue: novoValor,
          status: novoValor >= g.totalValue ? 'completed' : 'active'
        };
      }
      return g;
    }));

    setModalAdicionarVisible(false);
    setValorDeposito('');
    setSelectedGoal(null);
  };

  const renderGoalCard = ({ item }: { item: any }) => {
    const progress = (item.currentValue / item.totalValue) * 100;
    const isCompleted = item.status === 'completed';
    const IconTag = ICON_COMPONENTS[item.iconId] || Target;

    return (
      <View style={[styles.card, { borderTopColor: item.color, borderTopWidth: 4 }]}>
        <View style={styles.cardHeader}>
          <View style={[styles.cardIconBox, { backgroundColor: item.color }]}>
            <IconTag size={22} color="#FFF" />
          </View>
          <View style={styles.cardHeaderText}>
            <Text style={styles.cardTitle}>{item.title}</Text>
            {!isCompleted && <Text style={styles.cardSubTitle}>Prazo: {item.deadline.split('-').reverse().join('/')}</Text>}
          </View>
          
          <View style={{ flexDirection: 'row' }}>
            <TouchableOpacity 
              onPress={() => { setSelectedGoal(item); setTempDate(item.deadline); setModalEditarPrazoVisible(true); }} 
              style={[styles.trashBtn, { marginRight: 8 }]}
            >
              <CalendarIcon size={18} color="#6567ef" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleDeleteGoal(item.id)} style={styles.trashBtn}>
              <Trash2 size={18} color="#FF4D4D" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.cardValuesRow}>
          <Text style={styles.cardValueText}>R$ {toCurrencyBRL(item.currentValue)}</Text>
          <Text style={styles.cardValueText}>R$ {toCurrencyBRL(item.totalValue)}</Text>
        </View>

        <View style={styles.cardProgressBg}>
          <View style={[styles.cardProgressFill, { width: `${Math.min(progress, 100)}%`, backgroundColor: isCompleted ? '#10B981' : '#000' }]} />
        </View>
        <Text style={styles.cardProgressPercent}>{progress.toFixed(1)}% alcançado</Text>

        {!isCompleted && (
          <>
            <View style={styles.cardEstimateBox}>
              <Text style={styles.cardEstimateText}>
                Guarde <Text style={{ fontWeight: 'bold' }}>R$ {item.monthlyEstimate}</Text>/mês para alcançar
              </Text>
            </View>
            <TouchableOpacity style={styles.cardAddBtn} onPress={() => { setSelectedGoal(item); setModalAdicionarVisible(true); }}>
              <Plus size={18} color="#000" />
              <Text style={styles.cardAddBtnText}>Adicionar</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* HEADER PRINCIPAL */}
      <View style={styles.mainHeader}>
        <TouchableOpacity><ChevronLeft color="#000" /></TouchableOpacity>
        <View style={{ alignItems: 'center' }}>
          <Text style={styles.mainHeaderTitle}>Metas Financeiras</Text>
          <Text style={styles.mainHeaderSub}>{goals.filter(g => g.status === 'active').length} ativa(s)</Text>
        </View>
        <TouchableOpacity style={styles.btnNovaMetaHeader} onPress={() => setModalNovaMetaVisible(true)}>
          <Plus size={16} color="#FFF" /><Text style={styles.btnNovaMetaHeaderText}>Nova Meta</Text>
        </TouchableOpacity>
      </View>

      {/* ABAS */}
      <View style={styles.tabContainer}>
        <TouchableOpacity style={[styles.tab, tabAtiva === 'active' && styles.tabActive]} onPress={() => setTabAtiva('active')}>
          <Text style={[styles.tabText, tabAtiva === 'active' && styles.tabTextActive]}>Ativas ({goals.filter(g => g.status === 'active').length})</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, tabAtiva === 'completed' && styles.tabActive]} onPress={() => setTabAtiva('completed')}>
          <Text style={[styles.tabText, tabAtiva === 'completed' && styles.tabTextActive]}>Concluídas ({goals.filter(g => g.status === 'completed').length})</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={goals.filter(g => g.status === tabAtiva)}
        renderItem={renderGoalCard}
        keyExtractor={item => item.id}
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      />

      {/* MODAL NOVA META */}
      <Modal animationType="slide" transparent visible={modalNovaMetaVisible}>
        <View style={styles.overlayNovaMeta}>
          <View style={styles.contentNovaMeta}>
            <View style={styles.headerNovaMeta}>
              <Text style={styles.titleNovaMeta}>Nova Meta</Text>
              <TouchableOpacity onPress={() => setModalNovaMetaVisible(false)}><X size={24} color="#000" /></TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 50 }}>
              <Text style={styles.fieldLabel}>Nome da Meta</Text>
              <TextInput value={nome} onChangeText={setNome} placeholder="Ex: Viagem para Europa" style={styles.fieldInput} />
              
              <Text style={styles.fieldLabel}>Valor Alvo</Text>
              <View style={styles.fieldInputRow}>
                <Text style={styles.fieldPrefix}>R$</Text>
                <TextInput value={valorAlvo} onChangeText={(t) => setValorAlvo(maskCurrency(t))} keyboardType="numeric" style={styles.fieldInputRaw} />
              </View>

              <Text style={styles.fieldLabel}>Já Guardado</Text>
              <View style={styles.fieldInputRow}>
                <Text style={styles.fieldPrefix}>R$</Text>
                <TextInput value={valorGuardado} onChangeText={(t) => setValorGuardado(maskCurrency(t))} keyboardType="numeric" style={styles.fieldInputRaw} />
              </View>

              <Text style={styles.fieldLabel}>Selecione o Prazo</Text>
              <View style={styles.calendarWrapper}>
                <Calendar
                  current={INITIAL_DATE}
                  minDate={INITIAL_DATE}
                  onDayPress={(day) => setSelectedDate(day.dateString)}
                  markedDates={{ [selectedDate]: { selected: true, selectedColor: '#6567ef' } }}
                  style={styles.calendarComponent}
                  theme={{
                    todayTextColor: '#6567ef',
                    textMonthFontWeight: 'bold',
                    textDayHeaderFontWeight: 'bold',
                    textMonthFontSize: 18,
                    selectedDayBackgroundColor: '#6567ef',
                  }}
                  renderArrow={direction => (
                    <View style={styles.calendarButton}>
                      {direction === 'left' ? <ChevronLeftIcon size={20} color="#6567ef" /> : <ChevronRight size={20} color="#6567ef" />}
                    </View>
                  )}
                />
              </View>
              
              <Text style={styles.fieldLabel}>Ícone</Text>
              <View style={styles.iconGrid}>{ICONS_OPTIONS.map((item) => (
                <TouchableOpacity key={item.id} onPress={() => setSelectedIcon(item.id)} style={[styles.iconItem, selectedIcon === item.id && styles.iconItemActive]}>
                  <item.icon size={20} color={selectedIcon === item.id ? '#6567ef' : '#666'} />
                  <Text style={[styles.iconLabel, selectedIcon === item.id && { color: '#6567ef', fontWeight: 'bold' }]}>{item.label}</Text>
                </TouchableOpacity>
              ))}</View>
              
              <Text style={styles.fieldLabel}>Cor</Text>
              <View style={styles.colorRow}>{COLORS.map((color) => (
                <TouchableOpacity key={color} onPress={() => setSelectedColor(color)} style={[styles.colorCircle, { backgroundColor: color }, selectedColor === color && styles.colorCircleActive]} />
              ))}</View>
              
              <TouchableOpacity style={styles.btnConfirmarMeta} onPress={handleCreateGoal}>
                <Text style={styles.btnConfirmarMetaText}>Criar Meta</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* MODAL ADICIONAR VALOR */}
      <Modal animationType="fade" transparent visible={modalAdicionarVisible}>
        <View style={styles.overlayAdicionar}>
          <View style={styles.contentAdicionar}>
            <View style={styles.headerAdicionar}>
              <Text style={styles.titleAdicionar}>Adicionar Valor</Text>
              <TouchableOpacity onPress={() => setModalAdicionarVisible(false)}><X size={18} color="#999" /></TouchableOpacity>
            </View>
            <Text style={styles.labelAdicionarMeta}>Adicionando a: <Text style={{ fontWeight: 'bold' }}>{selectedGoal?.title}</Text></Text>
            <View style={styles.inputContainerAdicionar}>
              <Text style={styles.prefixAdicionar}>R$</Text>
              <TextInput style={styles.inputAdicionar} placeholder="0,00" keyboardType="numeric" value={valorDeposito} onChangeText={(t) => setValorDeposito(maskCurrency(t))} autoFocus />
            </View>
            <View style={styles.footerAdicionar}>
              <TouchableOpacity style={styles.btnCancelAdicionar} onPress={() => setModalAdicionarVisible(false)}><Text style={{ color: '#666', fontWeight: 'bold' }}>Cancelar</Text></TouchableOpacity>
              <TouchableOpacity style={styles.btnConfirmAdicionar} onPress={handleConfirmarDeposito}><Text style={{ color: '#FFF', fontWeight: 'bold' }}>Adicionar</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL EDITAR PRAZO */}
      <Modal animationType="slide" transparent visible={modalEditarPrazoVisible}>
        <View style={styles.overlayNovaMeta}>
          <View style={[styles.contentNovaMeta, { height: '60%' }]}>
            <View style={styles.headerNovaMeta}>
              <Text style={styles.titleNovaMeta}>Editar Prazo</Text>
              <TouchableOpacity onPress={() => setModalEditarPrazoVisible(false)}><X size={24} color="#000" /></TouchableOpacity>
            </View>
            <Text style={{ marginBottom: 15, color: '#666' }}>Nova data para: <Text style={{ fontWeight: 'bold' }}>{selectedGoal?.title}</Text></Text>
            <Calendar
              current={tempDate}
              minDate={INITIAL_DATE}
              onDayPress={(day) => setTempDate(day.dateString)}
              markedDates={{ [tempDate]: { selected: true, selectedColor: '#6567ef' } }}
              theme={{ todayTextColor: '#6567ef', selectedDayBackgroundColor: '#6567ef', arrowColor: '#6567ef' }}
            />
            <TouchableOpacity style={styles.btnConfirmarMeta} onPress={handleUpdateDeadline}>
              <Text style={styles.btnConfirmarMetaText}>Salvar Novo Prazo</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  mainHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  mainHeaderTitle: { fontSize: 18, fontWeight: 'bold' },
  mainHeaderSub: { fontSize: 12, color: '#666' },
  btnNovaMetaHeader: { backgroundColor: '#111', flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, alignItems: 'center' },
  btnNovaMetaHeaderText: { color: '#FFF', marginLeft: 5, fontWeight: '600' },
  
  tabContainer: { flexDirection: 'row', backgroundColor: '#EEE', marginHorizontal: 16, marginVertical: 16, borderRadius: 12, padding: 4 },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 10 },
  tabActive: { backgroundColor: '#FFF', elevation: 2 },
  tabText: { color: '#999', fontWeight: 'bold' },
  tabTextActive: { color: '#000' },

  card: { backgroundColor: '#FFF', borderRadius: 20, padding: 16, marginBottom: 16, marginHorizontal: 16, elevation: 2 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  cardIconBox: { padding: 10, borderRadius: 12 },
  cardHeaderText: { marginLeft: 12, flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: 'bold' },
  cardSubTitle: { fontSize: 12, color: '#AAA' },
  trashBtn: { padding: 5 },
  
  cardValuesRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  cardValueText: { fontSize: 14, fontWeight: 'bold' },
  cardProgressBg: { height: 8, backgroundColor: '#EEE', borderRadius: 4, overflow: 'hidden' },
  cardProgressFill: { height: '100%', borderRadius: 4 },
  cardProgressPercent: { textAlign: 'center', fontSize: 11, color: '#AAA', marginTop: 8 },
  cardEstimateBox: { backgroundColor: '#F8F9FA', padding: 14, borderRadius: 12, marginTop: 15 },
  cardEstimateText: { fontSize: 13, color: '#555', textAlign: 'center' },
  cardAddBtn: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 12, marginTop: 15, borderTopWidth: 1, borderTopColor: '#F0F0F0' },
  cardAddBtnText: { marginLeft: 8, fontWeight: 'bold' },

  overlayNovaMeta: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  contentNovaMeta: { backgroundColor: '#FFF', borderTopLeftRadius: 35, borderTopRightRadius: 35, height: '92%', padding: 24 },
  headerNovaMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  titleNovaMeta: { fontSize: 22, fontWeight: 'bold' },
  
  fieldLabel: { fontSize: 14, fontWeight: 'bold', color: '#333', marginTop: 18, marginBottom: 8 },
  fieldInput: { borderWidth: 1, borderColor: '#F0F0F0', borderRadius: 12, padding: 15, backgroundColor: '#FAFAFA' },
  fieldInputRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#F0F0F0', borderRadius: 12, backgroundColor: '#FAFAFA' },
  fieldPrefix: { marginLeft: 15, fontWeight: 'bold', color: '#666' },
  fieldInputRaw: { flex: 1, padding: 15 },

  calendarWrapper: { paddingHorizontal: 0, marginTop: 10 },
  calendarComponent: { borderRadius: 24, overflow: 'hidden', backgroundColor: '#FFF', elevation: 1 },
  calendarButton: { backgroundColor: '#e9e5fe', padding: 8, borderRadius: 100 },

  iconGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: 5 },
  iconItem: { width: '48%', flexDirection: 'row', alignItems: 'center', padding: 15, borderRadius: 12, borderWidth: 1.5, borderColor: '#F0F0F0', marginBottom: 10 },
  iconItemActive: { borderColor: '#6567ef', backgroundColor: '#F5F3FF' },
  iconLabel: { marginLeft: 10, fontSize: 14, color: '#666' },
  
  colorRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 10 },
  colorCircle: { width: 42, height: 42, borderRadius: 21, marginRight: 12, marginBottom: 12 },
  colorCircleActive: { borderWidth: 3, borderColor: '#DDD' },
  
  btnConfirmarMeta: { backgroundColor: '#6567ef', padding: 20, borderRadius: 999, alignItems: 'center', marginTop: 30 },
  btnConfirmarMetaText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },

  overlayAdicionar: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  contentAdicionar: { backgroundColor: '#FFF', borderRadius: 16, width: '85%', padding: 20 },
  headerAdicionar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  titleAdicionar: { fontSize: 18, fontWeight: 'bold' },
  labelAdicionarMeta: { fontSize: 13, color: '#666', marginBottom: 12 },
  inputContainerAdicionar: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#DDD', borderRadius: 10, paddingHorizontal: 15, height: 50 },
  prefixAdicionar: { fontSize: 16, color: '#666', marginRight: 5 },
  inputAdicionar: { flex: 1, fontSize: 16 },
  footerAdicionar: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 20, gap: 10 },
  btnCancelAdicionar: { paddingVertical: 10, paddingHorizontal: 15, borderRadius: 8, borderWidth: 1, borderColor: '#EEE' },
  btnConfirmAdicionar: { backgroundColor: '#10B981', paddingVertical: 10, paddingHorizontal: 15, borderRadius: 8 },
});