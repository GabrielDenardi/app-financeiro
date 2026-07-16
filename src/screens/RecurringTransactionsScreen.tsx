import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Pause,
  Pencil,
  Play,
  Plus,
  Trash2,
  Undo2,
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
import { getCategoryIcon } from '../components/TransactionListItem';
import { useAccounts } from '../features/accounts/hooks/useAccounts';
import { useAuthenticatedUser } from '../features/auth/hooks/useAuthenticatedUser';
import {
  useConfirmRecurringTransactionMutation,
  useCreateRecurringTransactionMutation,
  useDeleteRecurringTransactionMutation,
  useRecurringTransactions,
  useUndoRecurringConfirmationMutation,
  useUpdateRecurringTransactionMutation,
} from '../features/recurring/hooks/useRecurring';
import type { RecurringTransaction } from '../features/recurring/types';
import type { PaymentMethod } from '../features/transactions/types';
import { useFinanceCategories } from '../features/transactions/hooks/useTransactions';
import { formatCurrencyInput, formatMonthDate, localIsoDate, normalizeCurrencyInput } from '../features/finance/utils';
import { radius, spacing, typography, type AppColors, useThemeColors } from '../theme';
import { formatCurrencyBRL, getRelativeDueDateInfo } from '../utils/format';

const PAYMENT_METHODS: PaymentMethod[] = [
  'Pix',
  'Transferencia',
  'Dinheiro',
  'Cartao de debito',
  'Boleto',
];

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  Transferencia: 'Transferência',
  'Cartao de debito': 'Cartão de débito',
};

function paymentMethodLabel(method: string) {
  return PAYMENT_METHOD_LABELS[method] ?? method;
}

function currentMonthDate() {
  return formatMonthDate();
}

function isConfirmedThisMonth(lastExecutionMonth: string | null): boolean {
  if (!lastExecutionMonth) return false;
  return lastExecutionMonth === currentMonthDate();
}

/** Vencimento da recorrência no mês atual (dia 31 vira o último dia em meses curtos). */
function dueInfoThisMonth(dayOfMonth: number) {
  const now = new Date();
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const day = Math.min(Math.max(dayOfMonth, 1), lastDay);
  return getRelativeDueDateInfo(localIsoDate(new Date(now.getFullYear(), now.getMonth(), day)));
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
  const undoMutation = useUndoRecurringConfirmationMutation(user?.id);

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
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Pix');
  const [isVariable, setIsVariable] = useState(false);
  const [accountId, setAccountId] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [adjustmentValue, setAdjustmentValue] = useState('');
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);
  // Confirmação em modal próprio: Alert.alert com botões não funciona no web.
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    confirmLabel: string;
    onConfirm: () => void;
  } | null>(null);

  const summary = useMemo(() => {
    return transactions.reduce(
      (accumulator, item) => {
        if (!item.isActive) {
          return accumulator;
        }

        accumulator.activeCount += 1;
        if (isConfirmedThisMonth(item.lastExecutionMonth)) {
          accumulator.confirmedCount += 1;
        }

        if (item.type === 'income') {
          accumulator.income += item.amount;
        } else {
          accumulator.expense += item.amount;
        }

        return accumulator;
      },
      { income: 0, expense: 0, activeCount: 0, confirmedCount: 0 },
    );
  }, [transactions]);

  // Pendentes atrasadas primeiro, depois pendentes no prazo, confirmadas e pausadas.
  const sortedTransactions = useMemo(() => {
    const rank = (item: RecurringTransaction) => {
      if (!item.isActive) return 3;
      if (isConfirmedThisMonth(item.lastExecutionMonth)) return 2;
      return dueInfoThisMonth(item.dayOfMonth).isOverdue ? 0 : 1;
    };

    return [...transactions].sort((left, right) => rank(left) - rank(right) || left.dayOfMonth - right.dayOfMonth);
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
    setPaymentMethod('Pix');
    setIsVariable(false);
    setAccountId(accounts[0]?.id ?? '');
    setCategoryId(filteredCategories[0]?.id ?? null);
    setNotes('');
  };

  const handleOpenCreate = () => {
    closeMainModal();
    setMainModalVisible(true);
  };

  // Trocar o tipo invalida a categoria selecionada (receita × despesa).
  const handleTypeChange = (nextType: 'income' | 'expense') => {
    if (nextType === type) return;
    setType(nextType);
    setCategoryId(null);
  };

  const handleSave = async () => {
    if (!title || !amount || !accountId) {
      Alert.alert('Erro', 'Preencha os campos obrigatórios.');
      return;
    }

    const dayNumber = Number(day);
    if (!Number.isInteger(dayNumber) || dayNumber < 1 || dayNumber > 31) {
      Alert.alert('Erro', 'Informe um dia do mês entre 1 e 31.');
      return;
    }

    const payload = {
      accountId,
      categoryId,
      title,
      notes,
      amount: normalizeCurrencyInput(amount),
      type,
      paymentMethod,
      dayOfMonth: dayNumber,
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
    setPendingActionId(item.id);
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
    } finally {
      setPendingActionId(null);
    }
  };

  const finalizeTransaction = async () => {
    if (!selectedItem) {
      return;
    }

    try {
      await confirmMutation.mutateAsync({
        ruleId: selectedItem.id,
        amount: normalizeCurrencyInput(adjustmentValue),
        note: selectedItem.notes,
        executionMonth: currentMonthDate(),
      });
      Alert.alert('Sucesso', `Lançamento de ${formatCurrencyBRL(normalizeCurrencyInput(adjustmentValue))} confirmado no extrato.`);
      setConfirmModalVisible(false);
      setSelectedItem(null);
    } catch (error) {
      Alert.alert('Erro', error instanceof Error ? error.message : 'Não foi possível confirmar o lançamento.');
    }
  };

  const handleUndoConfirmation = (item: RecurringTransaction) => {
    setConfirmDialog({
      title: 'Desfazer confirmação',
      message: `O lançamento de "${item.title}" deste mês será removido do extrato.`,
      confirmLabel: 'Desfazer',
      onConfirm: async () => {
        setPendingActionId(item.id);
        try {
          await undoMutation.mutateAsync({
            ruleId: item.id,
            executionMonth: currentMonthDate(),
          });
        } catch (error) {
          Alert.alert('Erro', error instanceof Error ? error.message : 'Não foi possível desfazer a confirmação.');
        } finally {
          setPendingActionId(null);
        }
      },
    });
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
    setPaymentMethod(item.paymentMethod);
    setIsVariable(item.isVariable);
    setAccountId(item.accountId);
    setCategoryId(item.categoryId);
    setNotes(item.notes);
    setMainModalVisible(true);
  };

  const handleDelete = (item: RecurringTransaction) => {
    setConfirmDialog({
      title: 'Excluir recorrência',
      message: `"${item.title}" deixará de gerar lançamentos. Os lançamentos já confirmados permanecem no extrato.`,
      confirmLabel: 'Excluir',
      onConfirm: async () => {
        try {
          await deleteMutation.mutateAsync(item.id);
        } catch (error) {
          Alert.alert('Erro', error instanceof Error ? error.message : 'Não foi possível remover a recorrência.');
        }
      },
    });
  };

  return (
    <>
      <PageShell
        refreshControl={
          <RefreshControl
            refreshing={recurringQuery.isRefetching}
            onRefresh={() => recurringQuery.refetch()}
            tintColor={colors.primary}
          />
        }
      >
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
            <View style={styles.vDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Saldo</Text>
              <Text
                style={[
                  styles.summaryValue,
                  { color: summary.income - summary.expense >= 0 ? colors.textPrimary : colors.danger },
                ]}
              >
                {formatCurrencyBRL(summary.income - summary.expense)}
              </Text>
            </View>
          </View>
          {summary.activeCount > 0 ? (
            <Text style={styles.summaryProgress}>
              {summary.confirmedCount} de {summary.activeCount} confirmada{summary.activeCount !== 1 ? 's' : ''} este mês
            </Text>
          ) : null}
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

        {recurringQuery.isError ? (
          <Card style={styles.card}>
            <Text style={styles.emptyText}>Não foi possível carregar as recorrências.</Text>
            <Button label="Tentar novamente" variant="secondary" fullWidth onPress={() => recurringQuery.refetch()} />
          </Card>
        ) : null}

        {!recurringQuery.isLoading && sortedTransactions.map((item) => {
          const confirmed = isConfirmedThisMonth(item.lastExecutionMonth);
          const dueInfo = item.isActive && !confirmed ? dueInfoThisMonth(item.dayOfMonth) : null;
          const isItemPending = pendingActionId === item.id;

          return (
            <Card key={item.id} style={styles.card}>
              <View style={[styles.cardInfo, !item.isActive && styles.inactive]}>
                <View style={[styles.iconBox, { backgroundColor: `${item.categoryColor}1A` }]}>
                  {getCategoryIcon(item.categoryLabel, item.categoryColor)}
                </View>
                <View style={styles.cardBody}>
                  <View style={styles.titleRow}>
                    <Text style={styles.cardTitle}>{item.title}</Text>
                    {item.isVariable ? (
                      <Badge label="VARIÁVEL" tone="neutral" />
                    ) : null}
                    {dueInfo?.isOverdue ? (
                      <Badge label={dueInfo.label} tone="danger" />
                    ) : null}
                  </View>
                  <Text style={styles.cardSubtitle}>
                    Mensal - Dia {item.dayOfMonth} - {item.accountName}
                  </Text>
                  <Text style={styles.cardSubtitle}>
                    {item.categoryLabel} - {paymentMethodLabel(item.paymentMethod)}
                  </Text>
                </View>
                <Text style={[styles.cardAmount, { color: item.type === 'income' ? colors.success : colors.danger }]}>
                  {formatCurrencyBRL(item.amount)}
                </Text>
              </View>

              {item.isActive ? (
                confirmed ? (
                  <View style={styles.confirmedRow}>
                    <View style={styles.confirmedBadge}>
                      <CheckCircle2 size={14} color={colors.success} />
                      <Text style={styles.confirmedBadgeText}>Confirmado este mês</Text>
                    </View>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Desfazer confirmação de ${item.title}`}
                      style={styles.undoBtn}
                      onPress={() => handleUndoConfirmation(item)}
                      disabled={undoMutation.isPending}
                    >
                      {isItemPending ? (
                        <ActivityIndicator size="small" color={colors.textSecondary} />
                      ) : (
                        <Undo2 size={14} color={colors.textSecondary} />
                      )}
                      <Text style={styles.undoBtnText}>Desfazer</Text>
                    </Pressable>
                  </View>
                ) : item.isVariable ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Confirmar valor do mês de ${item.title}`}
                    style={styles.confirmBtn}
                    onPress={() => handleConfirmMonthly(item)}
                  >
                    <Calendar size={14} color={colors.primary} />
                    <Text style={styles.confirmBtnText}>Confirmar valor do mês</Text>
                  </Pressable>
                ) : (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Confirmar lançamento de ${item.title}`}
                    style={styles.confirmBtn}
                    onPress={() => handleConfirmFixed(item)}
                    disabled={confirmMutation.isPending}
                  >
                    {isItemPending ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                      <Calendar size={14} color={colors.primary} />
                    )}
                    <Text style={styles.confirmBtnText}>Confirmar lançamento</Text>
                  </Pressable>
                )
              ) : null}

              <View style={styles.cardFooter}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={item.isActive ? `Pausar ${item.title}` : `Retomar ${item.title}`}
                  style={styles.actionBtn}
                  onPress={() => togglePause(item)}
                >
                  {item.isActive ? <Pause size={16} color={colors.textPrimary} /> : <Play size={16} color={colors.success} />}
                  <Text style={styles.actionBtnText}>{item.isActive ? 'Pausar' : 'Retomar'}</Text>
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Editar ${item.title}`}
                  style={[styles.actionBtn, !item.isActive && styles.inactive]}
                  onPress={() => handleEdit(item)}
                >
                  <Pencil size={16} color={colors.textPrimary} />
                  <Text style={styles.actionBtnText}>Editar</Text>
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Excluir ${item.title}`}
                  hitSlop={spacing.sm}
                  onPress={() => handleDelete(item)}
                  style={[styles.deleteBtn, !item.isActive && styles.inactive]}
                >
                  <Trash2 size={16} color={colors.danger} />
                </Pressable>
              </View>
            </Card>
          );
        })}

        {!recurringQuery.isLoading && !recurringQuery.isError && transactions.length === 0 ? (
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
            onPress={() => handleTypeChange('income')}
            style={styles.typeChip}
          />
          <Chip
            label="Despesa"
            selected={type === 'expense'}
            activeColor={colors.danger}
            onPress={() => handleTypeChange('expense')}
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
            onChangeText={(v) => setAmount(formatCurrencyInput(v))}
          />
          <FieldDivider />
          <FieldRow
            label="Dia do mês"
            placeholder="1"
            keyboardType="numeric"
            value={day}
            onChangeText={(v) => setDay(v.replace(/\D/g, '').slice(0, 2))}
          />
          <FieldDivider />
          <FieldRow
            label="Observação"
            placeholder="Opcional"
            value={notes}
            onChangeText={setNotes}
          />
        </FieldCard>
        <Text style={styles.inputSubtitle}>
          Dia 29 a 31: em meses mais curtos, o vencimento passa a ser o último dia do mês.
        </Text>

        <Text style={styles.sectionLabel}>Método de pagamento</Text>
        <View style={styles.wrapRow}>
          {PAYMENT_METHODS.map((method) => (
            <Chip
              key={method}
              label={paymentMethodLabel(method)}
              selected={paymentMethod === method}
              onPress={() => setPaymentMethod(method)}
            />
          ))}
        </View>

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
                onChangeText={(v) => setAdjustmentValue(formatCurrencyInput(v))}
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

      {/* Diálogo de confirmação de ações destrutivas (desfazer/excluir) */}
      <Modal
        visible={confirmDialog !== null}
        animationType="fade"
        transparent
        onRequestClose={() => setConfirmDialog(null)}
      >
        <View style={styles.miniModalOverlay}>
          <View style={styles.miniModalContent}>
            <AlertTriangle size={40} color={colors.danger} style={styles.miniIcon} />
            <Text style={styles.miniModalTitle}>{confirmDialog?.title}</Text>
            <Text style={[styles.miniModalSubtitle, styles.confirmDialogMessage]}>{confirmDialog?.message}</Text>

            <View style={styles.miniModalActions}>
              <Button label="Cancelar" variant="secondary" fullWidth onPress={() => setConfirmDialog(null)} />
              <Button
                label={confirmDialog?.confirmLabel ?? 'Confirmar'}
                variant="danger"
                fullWidth
                onPress={() => {
                  const action = confirmDialog?.onConfirm;
                  setConfirmDialog(null);
                  action?.();
                }}
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
    summaryProgress: {
      ...typography.caption,
      color: colors.textSecondary,
      textAlign: 'center',
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
    confirmedRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    confirmedBadge: {
      flex: 1,
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
    undoBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    undoBtnText: {
      ...typography.caption,
      color: colors.textSecondary,
      fontWeight: '600',
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
    deleteBtn: {
      padding: spacing.xs,
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
    confirmDialogMessage: {
      textAlign: 'center',
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
