import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { Plus, Trash2, X, Pencil, PiggyBank } from 'lucide-react-native';

// --- DESIGN SYSTEM ---
const COLORS = {
  primary: '#1E3A8A',
  primaryLight: '#2563EB',
  success: '#16A34A',
  danger: '#DC2626',
  background: '#F8FAFC',
  surface: '#FFFFFF',
  textPrimary: '#0F172A',
  textSecondary: '#64748B',
  border: '#E2E8F0',
  modalOverlay: 'rgba(15, 23, 42, 0.5)',
};

interface Budget {
  id: string;
  category: string;
  spent: number;
  limit: number;
}

const BudgetsScreen = () => {
  // --- 1. ESTADOS (STATES) ---
  const [budgets, setBudgets] = useState<Budget[]>([
    { id: '1', category: 'Streaming', spent: 0, limit: 5000 },
    { id: '2', category: 'Supermercado', spent: 1000, limit: 1500 },
  ]);

  const [isModalVisible, setIsModalVisible] = useState(false);
  const [newCategory, setNewCategory] = useState('');
  const [newLimit, setNewLimit] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null); // Estado para controlar edição

  // --- 2. CÁLCULOS ---
  const totals = useMemo(() => {
    const budgeted = budgets.reduce((acc, curr) => acc + curr.limit, 0);
    const spent = budgets.reduce((acc, curr) => acc + curr.spent, 0);
    return { budgeted, spent };
  }, [budgets]);

  // --- 3. FUNÇÕES DE AÇÃO ---

  // Prepara o modal para edição
  const handleEditPress = (item: Budget) => {
    setEditingId(item.id);
    setNewCategory(item.category);
    setNewLimit(item.limit.toString().replace('.', ',')); 
    setIsModalVisible(true);
  };

  // Salva (Cria ou Edita)
  const handleSaveBudget = () => {
    if (!newCategory || !newLimit) {
      Alert.alert('Erro', 'Preencha todos os campos');
      return;
    }

    const value = parseFloat(newLimit.replace(',', '.'));
    if (isNaN(value)) {
      Alert.alert('Erro', 'Valor inválido');
      return;
    }

    if (editingId) {
      // Lógica de Edição
      setBudgets(prev => prev.map(item => 
        item.id === editingId 
          ? { ...item, category: newCategory, limit: value } 
          : item
      ));
    } else {
      // Lógica de Criação
      const newItem: Budget = {
        id: Math.random().toString(),
        category: newCategory,
        spent: 0,
        limit: value,
      };
      setBudgets([...budgets, newItem]);
    }
    closeModal();
  };

  const deleteBudget = (id: string) => {
    const performDelete = () => setBudgets(prev => prev.filter(b => b.id !== id));
    
    if (Platform.OS === 'web') {
      if (window.confirm("Deseja excluir este orçamento?")) performDelete();
    } else {
      Alert.alert('Excluir', 'Deseja remover este orçamento?', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Excluir', style: 'destructive', onPress: performDelete },
      ]);
    }
  };

  const closeModal = () => {
    setIsModalVisible(false);
    setNewCategory('');
    setNewLimit('');
    setEditingId(null); // Reseta o ID de edição ao fechar
  };

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  // --- 4. RENDERIZAÇÃO ---
  const renderBudgetItem = ({ item }: { item: Budget }) => {
  const percentage = Math.min((item.spent / item.limit) * 100, 100);
  const isOverLimit = item.spent > item.limit;

  return (
    // Mudamos de TouchableOpacity para View para o card não ser mais clicável
    <View style={styles.card}> 
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.h2}>{item.category}</Text>
          <Text style={styles.bodyText}>
            <Text style={{ fontWeight: '700', color: isOverLimit ? COLORS.danger : COLORS.textPrimary }}>
              {formatCurrency(item.spent)}
            </Text>
            {' / '}{formatCurrency(item.limit)}
          </Text>
        </View>

        <View style={styles.actionButtons}>
          {/* O CLIQUE DE EDITAR FICA APENAS AQUI */}
          <TouchableOpacity 
            onPress={() => handleEditPress(item)} 
            style={styles.iconButton}
          >
            <Pencil size={18} color={COLORS.primaryLight} />
          </TouchableOpacity>

          <TouchableOpacity 
            onPress={() => deleteBudget(item.id)} 
            style={styles.iconButton}
          >
            <Trash2 size={18} color={COLORS.danger} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.progressBarBg}>
        <View 
          style={[
            styles.progressBarFill, 
            { width: `${percentage}%`, backgroundColor: isOverLimit ? COLORS.danger : COLORS.primary }
          ]} 
        />
      </View>

      <View style={styles.cardFooter}>
        <Text style={styles.caption}>{Math.round(percentage)}% usado</Text>
        <Text style={[
          styles.caption, 
          { 
            color: percentage >= 80 ? COLORS.danger : COLORS.success,
            fontWeight: '600' // Opcional: deixa um pouco mais negrito para destacar
          }
        ]}>
          Restam {formatCurrency(item.limit - item.spent)}
        </Text>
      </View>
    </View>
  );
};

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.h2}>Orçamentos</Text>
          <Text style={styles.caption}>fevereiro de 2026</Text>
        </View>
        <TouchableOpacity style={styles.btnHeader} onPress={() => setIsModalVisible(true)}>
          <Plus size={18} color="#FFF" />
          <Text style={styles.btnHeaderText}>Novo</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.summaryBox}>
        <View style={styles.summaryItem}>
          <Text style={styles.caption}>Total Orçado</Text>
          <Text style={styles.h1}>{formatCurrency(totals.budgeted)}</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.caption}>Total Gasto</Text>
          <Text style={[styles.h1, { color: totals.spent > totals.budgeted ? COLORS.danger : COLORS.success }]}>
            {formatCurrency(totals.spent)}
          </Text>
        </View>
      </View>

      <FlatList
        data={budgets}
        keyExtractor={(item) => item.id}
        renderItem={renderBudgetItem}
        contentContainerStyle={styles.listContainer}
        ItemSeparatorComponent={() => <View style={{ height: 16 }} />}
      />

      <Modal visible={isModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.h2}>{editingId ? 'Editar Orçamento' : 'Novo Orçamento'}</Text>
              <TouchableOpacity onPress={closeModal}><X size={24} color={COLORS.textPrimary} /></TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Categoria</Text>
            <TextInput style={styles.input} placeholder="Ex: Supermercado" value={newCategory} onChangeText={setNewCategory} />

            <Text style={styles.inputLabel}>Limite Mensal</Text>
            <TextInput style={styles.input} placeholder="R$ 0,00" keyboardType="numeric" value={newLimit} onChangeText={setNewLimit} />

            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.btnBase, styles.btnCancel]} onPress={closeModal}>
                <Text style={styles.btnTextCancel}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btnBase, styles.btnCreate]} onPress={handleSaveBudget}>
                <Text style={styles.btnTextCreate}>{editingId ? 'Salvar' : 'Criar'}</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 24 },
  btnHeader: { flexDirection: 'row', backgroundColor: COLORS.textPrimary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, alignItems: 'center', gap: 8 },
  btnHeaderText: { color: '#FFF', fontWeight: 'bold' },
  summaryBox: { flexDirection: 'row', backgroundColor: COLORS.surface, marginHorizontal: 24, padding: 20, borderRadius: 16, marginBottom: 24 },
  summaryItem: { flex: 1, alignItems: 'center' },
  h1: { fontSize: 24, fontWeight: '700', color: COLORS.textPrimary },
  h2: { fontSize: 18, fontWeight: '600', color: COLORS.textPrimary },
  caption: { fontSize: 12, color: COLORS.textSecondary },
  bodyText: { fontSize: 14, color: COLORS.textSecondary, marginTop: 4 },
  listContainer: { paddingHorizontal: 24, paddingBottom: 40 },
  card: { backgroundColor: COLORS.surface, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  progressBarBg: { height: 6, backgroundColor: COLORS.border, borderRadius: 3, overflow: 'hidden', marginVertical: 12 },
  progressBarFill: { height: '100%' },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between' },
  modalOverlay: { flex: 1, backgroundColor: COLORS.modalOverlay, justifyContent: 'flex-end' },
  modalContent: { backgroundColor: COLORS.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },
  inputLabel: { fontSize: 12, fontWeight: '700', color: COLORS.textSecondary, marginBottom: 8 },
  input: { height: 48, borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, paddingHorizontal: 16, marginBottom: 16 },
  modalActions: { flexDirection: 'row', gap: 12 },
  btnBase: { flex: 1, height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  btnCreate: { backgroundColor: '#10B981' },
  btnCancel: { borderWidth: 1, borderColor: COLORS.border },
  btnTextCreate: { color: '#FFF', fontWeight: 'bold' },
  btnTextCancel: { color: COLORS.textPrimary, fontWeight: 'bold' },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8, // Espaço entre os ícones
  },
  iconButton: {
    padding: 8,
    backgroundColor: '#F1F5F9', // Um fundo cinza bem clarinho para dar destaque
    borderRadius: 8,
  },
});

export default BudgetsScreen;