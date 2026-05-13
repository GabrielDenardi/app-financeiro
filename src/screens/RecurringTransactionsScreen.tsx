import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
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
import { useAccounts } from '../features/accounts/hooks/useAccounts';
import { useAuthenticatedUser } from '../features/auth/hooks/useAuthenticatedUser';
import {
  useConfirmRecurringTransactionMutation,
  useCreateRecurringTransactionMutation,
  useDeleteRecurringTransactionMutation,
  useRecurringTransactions,
  useUpdateRecurringTransactionMutation,
} from '../features/recurring/hooks/useRecurring';
import type { RecurringTransaction } from '../features/recurring/types';
import { useFinanceCategories } from '../features/transactions/hooks/useTransactions';
import { radius, spacing, typography, type AppColors, useThemeColors } from '../theme';
import { formatCurrencyBRL } from '../utils/format';

function moneyMask(v: string) {
  const raw = v.replace(/\D/g, '');
  if (!raw) return '';
  return (Number(raw) / 100).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function moneyValue(v: string) {
  return Number((v || '0').replace(/\./g, '').replace(',', '.'));
}

function ruleMonthDate(dayOfMonth: number) {
  const now = new Date();
  const safeDay = Math.min(Math.max(dayOfMonth, 1), 28);
  return new Date(now.getFullYear(), now.getMonth(), safeDay).toISOString().slice(0, 10);
}

export default function RecurringTransactionsScreen() {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const navigation = useNavigation<any>();
  const user = useAuthenticatedUser();
  const recurringQuery = useRecurringTransactions(user?.id);
  const accountsQuery = useAccounts(user?.id);
  const categoriesQuery = useFinanceCategories(user?.id);
  const createMutation = useCreateRecurringTransactionMutation(user?.id);
  const updateMutation = useUpdateRecurringTransactionMutation(user?.id);
  const deleteMutation = useDeleteRecurringTransactionMutation(user?.id);
  const confirmMutation = useConfirmRecurringTransactionMutation(user?.id);

  const transactions = recurringQuery.data ?? [];
  const accounts = (accountsQuery.data ?? []).filter((account) => account.isActive);
  const categories = (categoriesQuery.data ?? []).filter((category) => category.kind !== 'both');

  const [mainModalVisible, setMainModalVisible] = useState(false);
  const [confirmModalVisible, setConfirmModalVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState<RecurringTransaction | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [day, setDay] = useState('1');
  const [isVariable, setIsVariable] = useState(false);
  const [accountId, setAccountId] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [adjustmentValue, setAdjustmentValue] = useState('');

  const summary = useMemo(() => {
    return transactions.reduce(
      (accumulator, item) => {
        if (!item.isActive) {
          return accumulator;
        }

        if (item.type === 'income') {
          accumulator.income += item.amount;
        } else {
          accumulator.expense += item.amount;
        }

        return accumulator;
      },
      { income: 0, expense: 0 },
    );
  }, [transactions]);

  const filteredCategories = useMemo(
    () => categories.filter((category) => category.kind !== (type === 'income' ? 'expense' : 'income')),
    [categories, type],
  );

  const closeMainModal = () => {
    setMainModalVisible(false);
    setEditingId(null);
    setTitle('');
    setAmount('');
    setDay('1');
    setIsVariable(false);
    setAccountId(accounts[0]?.id ?? '');
    setCategoryId(filteredCategories[0]?.id ?? null);
    setNotes('');
  };

  const handleOpenCreate = () => {
    closeMainModal();
    setMainModalVisible(true);
  };

  const handleSave = async () => {
    if (!title || !amount || !accountId) {
      Alert.alert('Erro', 'Preencha os campos obrigatórios.');
      return;
    }

    const payload = {
      accountId,
      categoryId,
      title,
      notes,
      amount: moneyValue(amount),
      type,
      paymentMethod: 'Transferencia' as const,
      dayOfMonth: Number(day || 1),
      isVariable,
    };

    try {
      if (editingId) {
        await updateMutation.mutateAsync({ id: editingId, ...payload });
      } else {
        await createMutation.mutateAsync(payload);
      }
      closeMainModal();
    } catch (error) {
      Alert.alert('Erro', error instanceof Error ? error.message : 'Não foi possível salvar a recorrência.');
    }
  };

  const handleConfirmMonthly = (item: RecurringTransaction) => {
    setSelectedItem(item);
    setAdjustmentValue(item.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    setConfirmModalVisible(true);
  };

  const finalizeTransaction = async () => {
    if (!selectedItem) {
      return;
    }

    try {
      await confirmMutation.mutateAsync({
        ruleId: selectedItem.id,
        amount: moneyValue(adjustmentValue),
        note: selectedItem.notes,
        executionMonth: ruleMonthDate(selectedItem.dayOfMonth),
      });
      Alert.alert('Sucesso', `Lançamento de ${formatCurrencyBRL(moneyValue(adjustmentValue))} confirmado no extrato.`);
      setConfirmModalVisible(false);
      setSelectedItem(null);
    } catch (error) {
      Alert.alert('Erro', error instanceof Error ? error.message : 'Não foi possível confirmar o lançamento.');
    }
  };

  const togglePause = async (item: RecurringTransaction) => {
    try {
      await updateMutation.mutateAsync({ id: item.id, isActive: !item.isActive });
    } catch (error) {
      Alert.alert('Erro', error instanceof Error ? error.message : 'Não foi possível atualizar a recorrência.');
    }
  };

  const handleEdit = (item: RecurringTransaction) => {
    setEditingId(item.id);
    setTitle(item.title);
    setAmount(item.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    setType(item.type);
    setDay(String(item.dayOfMonth));
    setIsVariable(item.isVariable);
    setAccountId(item.accountId);
    setCategoryId(item.categoryId);
    setNotes(item.notes);
    setMainModalVisible(true);
  };

  const handleDelete = (id: string) => {
    Alert.alert('Excluir', 'Deseja remover esta recorrência?', [
      { text: 'Não' },
      {
        text: 'Sim',
        onPress: async () => {
          try {
            await deleteMutation.mutateAsync(id);
          } catch (error) {
            Alert.alert('Erro', error instanceof Error ? error.message : 'Não foi possível remover a recorrência.');
          }
        },
      },
    ]);
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
              <Text style={[styles.summaryValue, { color: colors.success }]}>{formatCurrencyBRL(summary.income)}</Text>
            </View>
            <View style={styles.vDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Despesas</Text>
              <Text style={[styles.summaryValue, { color: colors.danger }]}>{formatCurrencyBRL(summary.expense)}</Text>
            </View>
          </View>
        </Card>

        <Card style={styles.buttonCard}>
          <Pressable style={styles.newButton} onPress={handleOpenCreate}>
            <Plus size={20} color={colors.white} />
            <Text style={styles.newButtonText}>Adicionar Transação</Text>
          </Pressable>
        </Card>

        {recurringQuery.isLoading ? <Card style={styles.card}><ActivityIndicator /></Card> : null}

        {!recurringQuery.isLoading && transactions.map((item) => (
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
                <Text style={styles.cardSubtitle}>
                  Mensal - Dia {item.dayOfMonth} - {item.accountName}
                </Text>
                <Text style={styles.cardSubtitle}>{item.categoryLabel}</Text>
              </View>
              <Text style={[styles.cardAmount, { color: item.type === 'income' ? colors.success : colors.danger }]}>
                {formatCurrencyBRL(item.amount)}
              </Text>
            </View>

            {item.isVariable && item.isActive ? (
              <Pressable style={styles.confirmBtn} onPress={() => handleConfirmMonthly(item)}>
                <Calendar size={14} color={colors.primary} />
                <Text style={styles.confirmBtnText}>Confirmar valor do mês</Text>
              </Pressable>
            ) : null}

            {item.lastExecutionMonth ? (
              <Text style={styles.executionText}>Última confirmação: {item.lastExecutionMonth.split('-').reverse().join('/')}</Text>
            ) : null}

            <View style={styles.cardFooter}>
              <Pressable style={styles.actionBtn} onPress={() => togglePause(item)}>
                {item.isActive ? <Pause size={16} color={colors.textPrimary} /> : <Play size={16} color={colors.success} />}
                <Text style={styles.actionBtnText}>{item.isActive ? 'Pausar' : 'Retomar'}</Text>
              </Pressable>

              <Pressable style={[styles.actionBtn, !item.isActive && styles.inactive]} onPress={() => handleEdit(item)}>
                <Pencil size={16} color={colors.textPrimary} />
                <Text style={styles.actionBtnText}>Editar</Text>
              </Pressable>

              <Pressable onPress={() => handleDelete(item.id)} style={!item.isActive ? styles.inactive : undefined}>
                <Trash2 size={16} color={colors.danger} />
              </Pressable>
            </View>
          </Card>
        ))}

        {!recurringQuery.isLoading && transactions.length === 0 ? (
          <Card style={styles.card}>
            <Text style={styles.emptyText}>Nenhuma recorrência cadastrada ainda.</Text>
          </Card>
        ) : null}
      </PageShell>

      <Modal visible={mainModalVisible} animationType="slide" transparent onRequestClose={closeMainModal}>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>{editingId ? 'Editar Recorrência' : 'Nova Transação Recorrente'}</Text>
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
                onChangeText={(value) => setAmount(moneyMask(value))}
                keyboardType="numeric"
                placeholder="0,00"
                placeholderTextColor={colors.textSecondary}
              />

              <Text style={styles.label}>Conta</Text>
              <View style={styles.wrapRow}>
                {accounts.map((account) => (
                  <Pressable
                    key={account.id}
                    style={[styles.choiceChip, accountId === account.id && styles.choiceChipActive]}
                    onPress={() => setAccountId(account.id)}
                  >
                    <Text style={[styles.choiceChipText, accountId === account.id && styles.choiceChipTextActive]}>{account.name}</Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.label}>Categoria</Text>
              <View style={styles.wrapRow}>
                {filteredCategories.map((category) => (
                  <Pressable
                    key={category.id}
                    style={[styles.choiceChip, categoryId === category.id && styles.choiceChipActive]}
                    onPress={() => setCategoryId(category.id)}
                  >
                    <Text style={[styles.choiceChipText, categoryId === category.id && styles.choiceChipTextActive]}>{category.label}</Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.label}>Dia do mês</Text>
              <TextInput
                style={styles.input}
                value={day}
                onChangeText={setDay}
                keyboardType="numeric"
                placeholder="1"
                placeholderTextColor={colors.textSecondary}
              />

              <Text style={styles.label}>Observação</Text>
              <TextInput
                style={styles.input}
                value={notes}
                onChangeText={setNotes}
                placeholder="Observação opcional"
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
                onChangeText={(value) => setAdjustmentValue(moneyMask(value))}
                keyboardType="numeric"
                autoFocus
              />
            </View>

            <View style={styles.miniModalActions}>
              <Pressable style={styles.cancelMiniBtn} onPress={() => setConfirmModalVisible(false)}>
                <Text style={styles.cancelMiniText}>Cancelar</Text>
              </Pressable>
              <Pressable style={styles.confirmMiniBtn} onPress={finalizeTransaction}>
                {confirmMutation.isPending ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Text style={styles.confirmMiniText}>Confirmar</Text>
                )}
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
    executionText: {
      ...typography.caption,
      color: colors.textSecondary,
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
    emptyText: {
      ...typography.body,
      color: colors.textSecondary,
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
    wrapRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    choiceChip: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    choiceChipActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primarySoft,
    },
    choiceChipText: {
      ...typography.caption,
      color: colors.textSecondary,
      fontWeight: '700',
    },
    choiceChipTextActive: {
      color: colors.primary,
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
