import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Switch,
  Text,
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
} from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';

import { Card } from '../components/Card';
import { PageHeader } from '../components/PageHeader';
import { PageShell } from '../components/PageShell';
import { BottomSheet } from '../components/BottomSheet';
import { Button } from '../components/Button';
import { Badge } from '../components/Badge';
import { Chip } from '../components/Chip';
import { FieldCard, FieldDivider, FieldRow } from '../components/FormField';
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

function currentMonthDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}-01`;
}

function isConfirmedThisMonth(lastExecutionMonth: string | null): boolean {
  if (!lastExecutionMonth) return false;
  const now = new Date();
  const prefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  return lastExecutionMonth.startsWith(prefix);
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

  const handleConfirmFixed = async (item: RecurringTransaction) => {
    try {
      await confirmMutation.mutateAsync({
        ruleId: item.id,
        amount: item.amount,
        note: item.notes,
        executionMonth: currentMonthDate(),
      });
      Alert.alert('Confirmado', `${item.title} (${formatCurrencyBRL(item.amount)}) lançado no extrato.`);
    } catch (error) {
      Alert.alert('Erro', error instanceof Error ? error.message : 'Não foi possível confirmar o lançamento.');
    }
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
        executionMonth: currentMonthDate(),
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
          <Button
            label="Adicionar Transação"
            icon={<Plus size={20} color={colors.white} />}
            onPress={handleOpenCreate}
            fullWidth
          />
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
                    <Badge label="VARIÁVEL" tone="neutral" />
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

            {item.isActive ? (
              isConfirmedThisMonth(item.lastExecutionMonth) ? (
                <View style={styles.confirmedBadge}>
                  <CheckCircle2 size={14} color={colors.success} />
                  <Text style={styles.confirmedBadgeText}>Confirmado este mês</Text>
                </View>
              ) : item.isVariable ? (
                <Pressable style={styles.confirmBtn} onPress={() => handleConfirmMonthly(item)}>
                  <Calendar size={14} color={colors.primary} />
                  <Text style={styles.confirmBtnText}>Confirmar valor do mês</Text>
                </Pressable>
              ) : (
                <Pressable
                  style={styles.confirmBtn}
                  onPress={() => handleConfirmFixed(item)}
                  disabled={confirmMutation.isPending}
                >
                  <Calendar size={14} color={colors.primary} />
                  <Text style={styles.confirmBtnText}>Confirmar lançamento</Text>
                </Pressable>
              )
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

      {/* Formulário de criação/edição */}
      <BottomSheet
        visible={mainModalVisible}
        onClose={closeMainModal}
        title={editingId ? 'Editar Recorrência' : 'Nova Transação Recorrente'}
        subtitle={editingId ? 'Edite sua transação recorrente' : 'Crie uma nova transação recorrente'}
        maxHeightRatio={0.92}
        footer={(close) => (
          <>
            <Button label="Cancelar" variant="secondary" fullWidth onPress={close} />
            <Button label="Salvar" fullWidth onPress={handleSave} />
          </>
        )}
      >
        <View style={styles.typeToggle}>
          <Chip
            label="Receita"
            selected={type === 'income'}
            activeColor={colors.success}
            onPress={() => setType('income')}
            style={styles.typeChip}
          />
          <Chip
            label="Despesa"
            selected={type === 'expense'}
            activeColor={colors.danger}
            onPress={() => setType('expense')}
            style={styles.typeChip}
          />
        </View>

        <FieldCard>
          <FieldRow
            label="Título"
            placeholder="Ex: Conta de Água"
            value={title}
            onChangeText={setTitle}
          />
          <FieldDivider />
          <FieldRow
            label="Valor Base"
            prefix="R$"
            placeholder="0,00"
            keyboardType="numeric"
            value={amount}
            onChangeText={(v) => setAmount(moneyMask(v))}
          />
          <FieldDivider />
          <FieldRow
            label="Dia do mês"
            placeholder="1"
            keyboardType="numeric"
            value={day}
            onChangeText={setDay}
          />
          <FieldDivider />
          <FieldRow
            label="Observação"
            placeholder="Opcional"
            value={notes}
            onChangeText={setNotes}
          />
        </FieldCard>

        <Text style={styles.sectionLabel}>Conta</Text>
        <View style={styles.wrapRow}>
          {accounts.map((account) => (
            <Chip
              key={account.id}
              label={account.name}
              selected={accountId === account.id}
              onPress={() => setAccountId(account.id)}
            />
          ))}
        </View>

        <Text style={styles.sectionLabel}>Categoria</Text>
        <View style={styles.wrapRow}>
          {filteredCategories.map((category) => (
            <Chip
              key={category.id}
              label={category.label}
              selected={categoryId === category.id}
              onPress={() => setCategoryId(category.id)}
            />
          ))}
        </View>

        <View style={styles.switchRow}>
          <View style={styles.switchCopy}>
            <Text style={styles.switchLabel}>Valor variável?</Text>
            <Text style={styles.inputSubtitle}>Use para contas cujo valor muda todo mês.</Text>
          </View>
          <Switch
            value={isVariable}
            onValueChange={setIsVariable}
            trackColor={{ true: `${colors.primary}66`, false: colors.border }}
            thumbColor={isVariable ? colors.primaryLight : colors.white}
          />
        </View>

        <View style={styles.bottomSpacer} />
      </BottomSheet>

      {/* Diálogo de confirmação de valor variável */}
      <Modal visible={confirmModalVisible} animationType="fade" transparent onRequestClose={() => setConfirmModalVisible(false)}>
        <View style={styles.miniModalOverlay}>
          <View style={styles.miniModalContent}>
            <CheckCircle2 size={40} color={colors.primary} style={styles.miniIcon} />
            <Text style={styles.miniModalTitle}>Confirmar {selectedItem?.title}</Text>
            <Text style={styles.miniModalSubtitle}>Qual o valor real deste mês?</Text>

            <View style={styles.miniInputContainer}>
              <Text style={styles.currencyPrefix}>R$</Text>
              <FieldRow
                label=""
                placeholder="0,00"
                keyboardType="numeric"
                value={adjustmentValue}
                onChangeText={(v) => setAdjustmentValue(moneyMask(v))}
                autoFocus
                inputStyle={styles.miniInput}
              />
            </View>

            <View style={styles.miniModalActions}>
              <Button label="Cancelar" variant="secondary" fullWidth onPress={() => setConfirmModalVisible(false)} />
              <Button
                label="Confirmar"
                fullWidth
                onPress={finalizeTransaction}
                loading={confirmMutation.isPending}
              />
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
    confirmedBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.sm,
      borderRadius: radius.md,
      backgroundColor: colors.successSoft,
    },
    confirmedBadgeText: {
      ...typography.caption,
      color: colors.success,
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
    typeToggle: {
      flexDirection: 'row',
      gap: spacing.md,
      marginBottom: spacing.lg,
    },
    typeChip: {
      flex: 1,
      justifyContent: 'center',
    },
    sectionLabel: {
      ...typography.caption,
      fontWeight: '700',
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginTop: spacing.lg,
      marginBottom: spacing.sm,
    },
    wrapRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    inputSubtitle: {
      ...typography.caption,
      color: colors.textSecondary,
    },
    switchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      marginTop: spacing.lg,
    },
    switchCopy: {
      flex: 1,
      gap: spacing.xs,
    },
    switchLabel: {
      ...typography.body,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    bottomSpacer: {
      height: spacing.lg,
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
      borderRadius: radius.xl,
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
      width: '100%',
    },
    currencyPrefix: {
      ...typography.value,
      color: colors.textPrimary,
      fontWeight: '700',
      marginRight: spacing.sm,
    },
    miniInput: {
      fontSize: 32,
      fontWeight: '700',
      flex: 1,
    },
    miniModalActions: {
      flexDirection: 'row',
      gap: spacing.md,
      width: '100%',
      marginTop: spacing.md,
    },
  });
