import React, { useState, useCallback, useRef } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TouchableOpacity, 
  Alert, Modal, TextInput, Switch, Platform, KeyboardAvoidingView,
  Dimensions 
} from 'react-native';
import { 
  ArrowLeft, Plus, Briefcase, Home, Pause, Play, 
  Pencil, Trash2, Repeat, X, Calendar, CheckCircle2 
} from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { colors, spacing, radius, typography } from '../theme';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface RecurringTransaction {
  id: string;
  title: string;
  value: string;
  type: 'income' | 'expense';
  day: string;
  category: string;
  isActive: boolean;
  isVariable: boolean; 
}

export default function RecurringTransactionsScreen() {
  const navigation = useNavigation();

  const [transactions, setTransactions] = useState<RecurringTransaction[]>([
    { id: '1', title: 'Salário', value: '2.200,00', type: 'income', day: '5', category: 'Trabalho', isActive: true, isVariable: false },
    { id: '2', title: 'Conta de Luz', value: '150,00', type: 'expense', day: '10', category: 'Casa', isActive: true, isVariable: true },
    { id: '3', title: 'Aluguel', value: '2.500,00', type: 'expense', day: '5', category: 'Moradia', isActive: true, isVariable: false },
  ]);

  const [mainModalVisible, setMainModalVisible] = useState(false);
  const [confirmModalVisible, setConfirmModalVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState<RecurringTransaction | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [day, setDay] = useState('1');
  const [isVariable, setIsVariable] = useState(false);
  const [adjustmentValue, setAdjustmentValue] = useState('');


  const handleSave = () => {
    if (!title || !amount) {
      Alert.alert("Erro", "Preencha os campos obrigatórios.");
      return;
    }

    const data = { title, value: amount, type, day, isVariable, category: 'Geral', isActive: true };

    if (editingId) {
      setTransactions(prev => prev.map(t => t.id === editingId ? { ...t, ...data } : t));
    } else {
      setTransactions(prev => [{ id: Math.random().toString(), ...data }, ...prev]);
    }
    closeMainModal();
  };

  const handleConfirmMonthly = (item: RecurringTransaction) => {
    setSelectedItem(item);
    setAdjustmentValue(item.value);
    setConfirmModalVisible(true);
  };

  const finalizeTransaction = () => {
    Alert.alert("Sucesso", `Lançamento de R$ ${adjustmentValue} confirmado no extrato!`);
    setConfirmModalVisible(false);
  };

  const togglePause = (id: string) => {
    setTransactions(prev => prev.map(t => t.id === id ? { ...t, isActive: !t.isActive } : t));
  };

  const deleteTransaction = (id: string) => {
    Alert.alert("Excluir", "Deseja remover esta recorrência?", [
      { text: "Não" },
      { text: "Sim", onPress: () => setTransactions(prev => prev.filter(t => t.id !== id)) }
    ]);
  };

  const closeMainModal = () => {
    setMainModalVisible(false);
    setEditingId(null);
    setTitle('');
    setAmount('');
    setIsVariable(false);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <ArrowLeft size={25} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.headerTitle}>Transações Recorrentes</Text>
          <Text style={styles.headerSubtitle}>Gerencie suas contas fixas</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Resumo Mensal Previsto</Text>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Receitas</Text>
              <Text style={[styles.summaryValue, { color: colors.success }]}>R$ 2.200</Text>
            </View>
            <View style={styles.vDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Despesas</Text>
              <Text style={[styles.summaryValue, { color: colors.danger }]}>R$ 2.650</Text>
            </View>
          </View>
        </View>

        <View style={styles.buttonCard}> 
          <TouchableOpacity style={styles.newButton} onPress={() => setMainModalVisible(true)}>
            <Plus size={20} color={colors.white} />
            <Text style={styles.newButtonText}>Adicionar Transação</Text>
          </TouchableOpacity>
        </View>

        {transactions.map(item => (
          <View key={item.id} style={styles.card}>
            <View style={[styles.cardInfo, !item.isActive && { opacity: 0.5 }]}>
              <View style={[styles.iconBox, item.type === 'income' ? { backgroundColor: '#DCFCE7' } : { backgroundColor: '#F1F5F9' }]}>
                {item.type === 'income' ? <Briefcase size={20} color={colors.success} /> : <Home size={20} color={colors.textSecondary} />}
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <View style={styles.titleRow}>
                  <Text style={styles.cardTitle}>{item.title}</Text>
                  {item.isVariable && (
                    <View style={styles.variableBadge}>
                      <Text style={styles.variableBadgeText}>VARIÁVEL</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.cardSubtitle}>Mensal • Dia {item.day}</Text>
              </View>
              <Text style={[styles.cardAmount, { color: item.type === 'income' ? colors.success : colors.danger }]}>
                R$ {item.value}
              </Text>
            </View>

            {item.isVariable && item.isActive && (
              <TouchableOpacity style={styles.confirmBtn} onPress={() => handleConfirmMonthly(item)}>
                <Calendar size={14} color={colors.primary} />
                <Text style={styles.confirmBtnText}>Confirmar valor do mês</Text>
              </TouchableOpacity>
            )}

            <View style={styles.cardFooter}>
              <TouchableOpacity style={styles.actionBtn} onPress={() => togglePause(item.id)}>
                {item.isActive ? <Pause size={16} color={colors.textPrimary} /> : <Play size={16} color={colors.success} />}
                <Text style={styles.actionBtnText}>{item.isActive ? "Pausar" : "Retomar"}</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={[styles.actionBtn, !item.isActive && { opacity: 0.5 }]} onPress={() => {
                setEditingId(item.id);
                setTitle(item.title);
                setAmount(item.value);
                setType(item.type);
                setIsVariable(item.isVariable);
                setMainModalVisible(true);
              }}>
                <Pencil size={16} color={colors.textPrimary} />
                <Text style={styles.actionBtnText}>Editar</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={() => deleteTransaction(item.id)} style={[!item.isActive && { opacity: 0.5 }]}>
                <Trash2 size={16} color={colors.danger} />
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </ScrollView>

      <Modal visible={mainModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior="padding" style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>{editingId ? "Editar Conta" : "Nova Transação Recorrente"}</Text>
                <Text style={styles.modalSubTitle}>{editingId ? "Edite sua transação recorrente" : "Crie uma nova transição recorrente"}</Text>
              </View>
              <TouchableOpacity onPress={closeMainModal}><X size={24} color={colors.textPrimary} /></TouchableOpacity>
            </View>

            <View style={styles.typeToggle}>
              <TouchableOpacity style={[styles.typeBtn, type === 'income' && styles.typeBtnActiveIncome]} onPress={() => setType('income')}>
                <Text style={[styles.typeBtnText, type === 'income' && { color: colors.success }]}>Receita</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.typeBtn, type === 'expense' && styles.typeBtnActiveExpense]} onPress={() => setType('expense')}>
                <Text style={[styles.typeBtnText, type === 'expense' && { color: colors.danger }]}>Despesa</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.form}>
              <Text style={styles.label}>Título</Text>
              <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="Ex: Conta de Água" />
              
              <Text style={styles.label}>Valor Base</Text>
              <TextInput style={styles.input} value={amount} onChangeText={setAmount} keyboardType="numeric" placeholder="0,00" />

              <View style={styles.switchRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Valor Variável?</Text>
                  <Text style={styles.inputSubtitle}>O valor muda todo mês (ex: energia)</Text>
                </View>
                <Switch value={isVariable} onValueChange={setIsVariable} trackColor={{ true: colors.primary, false: colors.mutedSurface}}  />
              </View>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={closeMainModal}>
                <Text style={styles.cancelBtnText}>Cencelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
                <Text style={styles.saveBtnText}>Salvar Recorrência</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <Modal visible={confirmModalVisible} animationType="fade" transparent>
        <View style={styles.miniModalOverlay}>
          <View style={styles.miniModalContent}>
            <CheckCircle2 size={40} color={colors.primary} style={{ marginBottom: 12 }} />
            <Text style={styles.miniModalTitle}>Confirmar {selectedItem?.title}</Text>
            <Text style={styles.miniModalSubtitle}>Qual o valor real deste mês?</Text>
            
            <View style={styles.miniInputContainer}>
              <Text style={styles.currencyPrefix}>R$</Text>
              <TextInput 
                style={styles.miniInput} 
                value={adjustmentValue} 
                onChangeText={setAdjustmentValue} 
                keyboardType="numeric"
                autoFocus
              />
            </View>

            <View style={styles.miniModalActions}>
              <TouchableOpacity style={styles.cancelMiniBtn} onPress={() => setConfirmModalVisible(false)}>
                <Text>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmMiniBtn} onPress={finalizeTransaction}>
                <Text style={{ color: colors.white, fontWeight: '700' }}>Confirmar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 25, paddingBottom: 10 },
  headerTitle: { fontSize: 22, fontWeight: '700', color: colors.textPrimary },
  headerSubtitle: { fontSize: 14, color: colors.textSecondary },
  newButton: { backgroundColor: colors.primary, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, gap: 4, height: 50},
  newButtonText: { color: colors.white, fontWeight: '600' },
  backButton: { padding: 4, backgroundColor: colors.white, borderRadius: 30, borderWidth: 1, borderColor: colors.border},
  content: { padding: 20 },

  // Summary
  summaryCard: { backgroundColor: colors.white, borderRadius: 16, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: colors.border },
  summaryTitle: { fontSize: 14, color: colors.textSecondary, marginBottom: 12 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-around' },
  summaryItem: { alignItems: 'center' },
  summaryLabel: { fontSize: 12, color: colors.textSecondary },
  summaryValue: { fontSize: 18, fontWeight: '700', marginTop: 4 },
  vDivider: { width: 1, backgroundColor: colors.border },

  buttonCard: { flex: 1, marginBottom: 10, padding: 10},

  // Cards
  card: { backgroundColor: colors.white, borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: colors.border },
  cardInfo: { flexDirection: 'row', alignItems: 'center' },
  iconBox: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardTitle: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  variableBadge: { backgroundColor: '#F1F5F9', paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4, borderWidth: 1, borderColor: colors.border },
  variableBadgeText: { fontSize: 8, fontWeight: '800', color: colors.textSecondary },
  cardSubtitle: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  cardAmount: { fontSize: 16, fontWeight: '700' },
  
  confirmBtn: { backgroundColor: '#EEF2FF', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 10, borderRadius: 10, marginTop: 12, marginBottom: 2, borderStyle: 'dashed', borderWidth: 1, borderColor: colors.primary },
  confirmBtnText: { color: colors.primary, fontWeight: '600', fontSize: 13 },

  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 15, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionBtnText: { fontSize: 13, color: colors.textPrimary, fontWeight: '500' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, height: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: '700' },
  modalSubTitle: { fontSize: 13, fontWeight: '400' },
  typeToggle: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  typeBtn: { flex: 1, height: 45, borderRadius: 10, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  typeBtnActiveIncome: { backgroundColor: '#DCFCE7', borderColor: colors.success },
  typeBtnActiveExpense: { backgroundColor: '#FEF2F2', borderColor: colors.danger },
  typeBtnText: { fontWeight: '600', color: colors.textSecondary },
  form: { gap: 12 },
  label: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  input: { height: 50, borderRadius: 12, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 16 },
  inputSubtitle: { fontSize: 11, color: colors.textSecondary },
  switchRow: { flexDirection: 'row', alignItems: 'center',  marginTop: 10 },

  modalActions: { flexDirection: 'row', gap: 12, minWidth: 200, borderTopWidth: 1, borderTopColor: colors.border, paddingVertical: 30, position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: colors.white, padding: 20 },

  saveBtn: { flex: 1, height: 55, backgroundColor: colors.primary, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  saveBtnText: { color: colors.white, fontWeight: '600', fontSize: 14 },
  cancelBtn: { flex: 1, height: 55, backgroundColor: colors.mutedSurface, borderRadius: 14, alignItems: 'center', justifyContent: 'center'},
  cancelBtnText: { fontWeight: '600', fontSize: 14},

  // Mini Modal
  miniModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  miniModalActions: { flexDirection: 'row', gap: 12, minWidth: 200, borderTopWidth: 1, borderTopColor: colors.border, paddingVertical: 30, flex: 1},
  miniModalContent: { width: '85%', backgroundColor: colors.white, borderRadius: 24, padding: 24, alignItems: 'center' },
  miniModalTitle: { fontSize: 18, fontWeight: '700', color: colors.textPrimary },
  miniModalSubtitle: { fontSize: 14, color: colors.textSecondary, marginBottom: 20 },
  miniInputContainer: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 2, borderBottomColor: colors.primary, paddingBottom: 8 },
  currencyPrefix: { fontSize: 20, fontWeight: '700', color: colors.textPrimary, marginRight: 8 },
  miniInput: { fontSize: 32, fontWeight: '600', color: colors.textPrimary, maxWidth: 100, flex: 1 },
  cancelMiniBtn: { flex: 1, height: 50, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.mutedSurface },
  confirmMiniBtn: { flex: 1, height: 50, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary },
});