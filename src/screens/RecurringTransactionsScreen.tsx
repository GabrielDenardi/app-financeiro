import React, { useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  Briefcase,
  Calendar,
  CheckCircle2,
  Home,
  Pause,
  Pencil,
  Play,
  Plus,
  Trash2,
  X,
} from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';

import { Card } from '../components/Card';
import { PageHeader } from '../components/PageHeader';
import { PageShell } from '../components/PageShell';
import { radius, spacing, typography, type AppColors, useThemeColors } from '../theme';

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
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const navigation = useNavigation<any>();
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
      Alert.alert('Erro', 'Preencha os campos obrigatórios.');
      return;
    }

    const data = { title, value: amount, type, day, isVariable, category: 'Geral', isActive: true };

    if (editingId) {
      setTransactions((prev) => prev.map((item) => (item.id === editingId ? { ...item, ...data } : item)));
    } else {
      setTransactions((prev) => [{ id: Math.random().toString(), ...data }, ...prev]);
    }

    closeMainModal();
  };

  const handleConfirmMonthly = (item: RecurringTransaction) => {
    setSelectedItem(item);
    setAdjustmentValue(item.value);
    setConfirmModalVisible(true);
  };

  const finalizeTransaction = () => {
    Alert.alert('Sucesso', `Lançamento de R$ ${adjustmentValue} confirmado no extrato.`);
    setConfirmModalVisible(false);
  };

  const togglePause = (id: string) => {
    setTransactions((prev) => prev.map((item) => (item.id === id ? { ...item, isActive: !item.isActive } : item)));
  };

  const deleteTransaction = (id: string) => {
    Alert.alert('Excluir', 'Deseja remover esta recorrência?', [
      { text: 'Não' },
      { text: 'Sim', onPress: () => setTransactions((prev) => prev.filter((item) => item.id !== id)) },
    ]);
  };

  const closeMainModal = () => {
    setMainModalVisible(false);
    setEditingId(null);
    setTitle('');
    setAmount('');
    setDay('1');
    setIsVariable(false);
  };

  return (
    <>
      <PageShell>
        <PageHeader
          title="Transações Recorrentes"
          subtitle="Gerencie suas contas fixas"
          onBackPress={() => navigation.goBack()}
        />

        <Card style={styles.summaryCard}>
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
        </Card>

        <Card style={styles.buttonCard}>
          <Pressable style={styles.newButton} onPress={() => setMainModalVisible(true)}>
            <Plus size={20} color={colors.white} />
            <Text style={styles.newButtonText}>Adicionar Transação</Text>
          </Pressable>
        </Card>

        {transactions.map((item) => (
          <Card key={item.id} style={styles.card}>
            <View style={[styles.cardInfo, !item.isActive && styles.inactive]}>
              <View style={[styles.iconBox, item.type === 'income' ? styles.iconIncome : styles.iconExpense]}>
                {item.type === 'income' ? (
                  <Briefcase size={20} color={colors.success} />
                ) : (
                  <Home size={20} color={colors.textSecondary} />
                )}
              </View>
              <View style={styles.cardBody}>
                <View style={styles.titleRow}>
                  <Text style={styles.cardTitle}>{item.title}</Text>
                  {item.isVariable ? (
                    <View style={styles.variableBadge}>
                      <Text style={styles.variableBadgeText}>VARIÁVEL</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.cardSubtitle}>Mensal - Dia {item.day}</Text>
              </View>
              <Text style={[styles.cardAmount, { color: item.type === 'income' ? colors.success : colors.danger }]}>
                R$ {item.value}
              </Text>
            </View>

            {item.isVariable && item.isActive ? (
              <Pressable style={styles.confirmBtn} onPress={() => handleConfirmMonthly(item)}>
                <Calendar size={14} color={colors.primary} />
                <Text style={styles.confirmBtnText}>Confirmar valor do mês</Text>
              </Pressable>
            ) : null}

            <View style={styles.cardFooter}>
              <Pressable style={styles.actionBtn} onPress={() => togglePause(item.id)}>
                {item.isActive ? <Pause size={16} color={colors.textPrimary} /> : <Play size={16} color={colors.success} />}
                <Text style={styles.actionBtnText}>{item.isActive ? 'Pausar' : 'Retomar'}</Text>
              </Pressable>

              <Pressable
                style={[styles.actionBtn, !item.isActive && styles.inactive]}
                onPress={() => {
                  setEditingId(item.id);
                  setTitle(item.title);
                  setAmount(item.value);
                  setType(item.type);
                  setDay(item.day);
                  setIsVariable(item.isVariable);
                  setMainModalVisible(true);
                }}
              >
                <Pencil size={16} color={colors.textPrimary} />
                <Text style={styles.actionBtnText}>Editar</Text>
              </Pressable>

              <Pressable onPress={() => deleteTransaction(item.id)} style={!item.isActive ? styles.inactive : undefined}>
                <Trash2 size={16} color={colors.danger} />
              </Pressable>
            </View>
          </Card>
        ))}
      </PageShell>

      <Modal visible={mainModalVisible} animationType="slide" transparent onRequestClose={closeMainModal}>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>{editingId ? 'Editar Conta' : 'Nova Transação Recorrente'}</Text>
                <Text style={styles.modalSubTitle}>
                  {editingId ? 'Edite sua transação recorrente' : 'Crie uma nova transação recorrente'}
                </Text>
              </View>
              <Pressable onPress={closeMainModal}>
                <X size={24} color={colors.textPrimary} />
              </Pressable>
            </View>

            <View style={styles.typeToggle}>
              <Pressable style={[styles.typeBtn, type === 'income' && styles.typeBtnActiveIncome]} onPress={() => setType('income')}>
                <Text style={[styles.typeBtnText, type === 'income' && { color: colors.success }]}>Receita</Text>
              </Pressable>
              <Pressable style={[styles.typeBtn, type === 'expense' && styles.typeBtnActiveExpense]} onPress={() => setType('expense')}>
                <Text style={[styles.typeBtnText, type === 'expense' && { color: colors.danger }]}>Despesa</Text>
              </Pressable>
            </View>

            <View style={styles.form}>
              <Text style={styles.label}>Título</Text>
              <TextInput
                style={styles.input}
                value={title}
                onChangeText={setTitle}
                placeholder="Ex: Conta de Água"
                placeholderTextColor={colors.textSecondary}
              />

              <Text style={styles.label}>Valor Base</Text>
              <TextInput
                style={styles.input}
                value={amount}
                onChangeText={setAmount}
                keyboardType="numeric"
                placeholder="0,00"
                placeholderTextColor={colors.textSecondary}
              />

              <Text style={styles.label}>Dia do mês</Text>
              <TextInput
                style={styles.input}
                value={day}
                onChangeText={setDay}
                keyboardType="numeric"
                placeholder="1"
                placeholderTextColor={colors.textSecondary}
              />

              <View style={styles.switchRow}>
                <View style={styles.switchCopy}>
                  <Text style={styles.label}>Valor variável?</Text>
                  <Text style={styles.inputSubtitle}>Use para contas cujo valor muda todo mês.</Text>
                </View>
                <Switch
                  value={isVariable}
                  onValueChange={setIsVariable}
                  trackColor={{ true: `${colors.primary}66`, false: colors.border }}
                  thumbColor={isVariable ? colors.primaryLight : colors.white}
                />
              </View>
            </View>

            <View style={styles.modalActions}>
              <Pressable style={styles.cancelBtn} onPress={closeMainModal}>
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </Pressable>
              <Pressable style={styles.saveBtn} onPress={handleSave}>
                <Text style={styles.saveBtnText}>Salvar Recorrência</Text>
              </Pressable>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <Modal visible={confirmModalVisible} animationType="fade" transparent onRequestClose={() => setConfirmModalVisible(false)}>
        <View style={styles.miniModalOverlay}>
          <View style={styles.miniModalContent}>
            <CheckCircle2 size={40} color={colors.primary} style={styles.miniIcon} />
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
              <Pressable style={styles.cancelMiniBtn} onPress={() => setConfirmModalVisible(false)}>
                <Text style={styles.cancelMiniText}>Cancelar</Text>
              </Pressable>
              <Pressable style={styles.confirmMiniBtn} onPress={finalizeTransaction}>
                <Text style={styles.confirmMiniText}>Confirmar</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const createStyles = (colors: AppColors) =>
  StyleSheet.create({
    summaryCard: {
      gap: spacing.md,
    },
    summaryTitle: {
      ...typography.body,
      color: colors.textSecondary,
      fontWeight: '600',
    },
    summaryRow: {
      flexDirection: 'row',
      justifyContent: 'space-around',
    },
    summaryItem: {
      alignItems: 'center',
      flex: 1,
    },
    summaryLabel: {
      ...typography.caption,
      color: colors.textSecondary,
    },
    summaryValue: {
      ...typography.h2,
      marginTop: spacing.xs,
    },
    vDivider: {
      width: 1,
      backgroundColor: colors.border,
    },
    buttonCard: {
      padding: spacing.sm,
    },
    newButton: {
      backgroundColor: colors.primaryLight,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      borderRadius: radius.md,
      gap: spacing.sm,
      minHeight: 50,
    },
    newButtonText: {
      ...typography.body,
      color: colors.white,
      fontWeight: '700',
    },
    card: {
      gap: spacing.md,
    },
    cardInfo: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    inactive: {
      opacity: 0.5,
    },
    iconBox: {
      width: 44,
      height: 44,
      borderRadius: radius.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconIncome: {
      backgroundColor: colors.successSoft,
    },
    iconExpense: {
      backgroundColor: colors.surfaceMuted,
    },
    cardBody: {
      flex: 1,
      marginLeft: spacing.md,
      gap: 2,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    cardTitle: {
      ...typography.body,
      color: colors.textPrimary,
      fontWeight: '700',
    },
    variableBadge: {
      backgroundColor: colors.surfaceMuted,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
      borderWidth: 1,
      borderColor: colors.border,
    },
    variableBadgeText: {
      ...typography.caption,
      fontSize: 8,
      fontWeight: '800',
      color: colors.textSecondary,
    },
    cardSubtitle: {
      ...typography.caption,
      color: colors.textSecondary,
      marginTop: 2,
    },
    cardAmount: {
      ...typography.body,
      fontWeight: '700',
    },
    confirmBtn: {
      backgroundColor: colors.primarySoft,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.sm,
      borderRadius: radius.md,
      borderStyle: 'dashed',
      borderWidth: 1,
      borderColor: colors.primary,
    },
    confirmBtnText: {
      ...typography.caption,
      color: colors.primary,
      fontWeight: '700',
    },
    cardFooter: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: spacing.xs,
      paddingTop: spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    actionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    actionBtnText: {
      ...typography.caption,
      color: colors.textPrimary,
      fontWeight: '600',
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: 'flex-end',
    },
    modalSheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: spacing.xl,
      minHeight: '75%',
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: spacing.lg,
      gap: spacing.md,
    },
    modalTitle: {
      ...typography.h2,
      color: colors.textPrimary,
    },
    modalSubTitle: {
      ...typography.body,
      color: colors.textSecondary,
      marginTop: spacing.xs,
    },
    typeToggle: {
      flexDirection: 'row',
      gap: spacing.md,
      marginBottom: spacing.lg,
    },
    typeBtn: {
      flex: 1,
      minHeight: 45,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
    },
    typeBtnActiveIncome: {
      backgroundColor: colors.successSoft,
      borderColor: colors.success,
    },
    typeBtnActiveExpense: {
      backgroundColor: colors.dangerSoft,
      borderColor: colors.danger,
    },
    typeBtnText: {
      ...typography.body,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    form: {
      gap: spacing.md,
      paddingBottom: spacing.xxl,
    },
    label: {
      ...typography.body,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    input: {
      minHeight: 50,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: spacing.md,
      color: colors.textPrimary,
      backgroundColor: colors.surface,
    },
    inputSubtitle: {
      ...typography.caption,
      color: colors.textSecondary,
    },
    switchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      marginTop: spacing.xs,
    },
    switchCopy: {
      flex: 1,
      gap: spacing.xs,
    },
    modalActions: {
      flexDirection: 'row',
      gap: spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: spacing.lg,
      backgroundColor: colors.surface,
    },
    saveBtn: {
      flex: 1,
      minHeight: 52,
      backgroundColor: colors.primaryLight,
      borderRadius: radius.lg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    saveBtnText: {
      ...typography.body,
      color: colors.white,
      fontWeight: '700',
    },
    cancelBtn: {
      flex: 1,
      minHeight: 52,
      backgroundColor: colors.surfaceMuted,
      borderRadius: radius.lg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cancelBtnText: {
      ...typography.body,
      color: colors.textPrimary,
      fontWeight: '600',
    },
    miniModalOverlay: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: 'center',
      alignItems: 'center',
      padding: spacing.lg,
    },
    miniModalContent: {
      width: '100%',
      maxWidth: 360,
      backgroundColor: colors.surface,
      borderRadius: 24,
      padding: spacing.xl,
      alignItems: 'center',
      gap: spacing.sm,
    },
    miniIcon: {
      marginBottom: spacing.xs,
    },
    miniModalTitle: {
      ...typography.h2,
      color: colors.textPrimary,
    },
    miniModalSubtitle: {
      ...typography.body,
      color: colors.textSecondary,
      marginBottom: spacing.md,
    },
    miniInputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      borderBottomWidth: 2,
      borderBottomColor: colors.primary,
      paddingBottom: spacing.sm,
    },
    currencyPrefix: {
      ...typography.value,
      color: colors.textPrimary,
      fontWeight: '700',
      marginRight: spacing.sm,
    },
    miniInput: {
      ...typography.value,
      fontSize: 32,
      color: colors.textPrimary,
      maxWidth: 120,
      flex: 1,
    },
    miniModalActions: {
      flexDirection: 'row',
      gap: spacing.md,
      width: '100%',
      marginTop: spacing.md,
    },
    cancelMiniBtn: {
      flex: 1,
      minHeight: 50,
      borderRadius: radius.md,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceMuted,
    },
    cancelMiniText: {
      ...typography.body,
      color: colors.textPrimary,
      fontWeight: '600',
    },
    confirmMiniBtn: {
      flex: 1,
      minHeight: 50,
      borderRadius: radius.md,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primaryLight,
    },
    confirmMiniText: {
      ...typography.body,
      color: colors.white,
      fontWeight: '700',
    },
  });
