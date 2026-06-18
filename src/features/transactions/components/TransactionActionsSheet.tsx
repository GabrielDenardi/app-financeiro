import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { AlertTriangle, Info, Trash2 } from 'lucide-react-native';

import { BottomSheet } from '../../../components/BottomSheet';
import { Button } from '../../../components/Button';
import { FieldCard, FieldDivider, FieldRow } from '../../../components/FormField';
import { radius, spacing, typography, type AppColors, useThemeColors } from '../../../theme';
import { formatCurrencyBRL } from '../../../utils/format';
import {
  useDeleteTransactionMutation,
  useDeleteTransferMutation,
  useReverseCardPaymentMutation,
  useUpdateTransactionMutation,
} from '../hooks/useTransactions';
import type { EntryType, FinanceCategory, TransactionFeedItem } from '../types';

const PAYMENT_METHODS = [
  { label: 'Pix', value: 'Pix' },
  { label: 'Transferência', value: 'Transferencia' },
  { label: 'Dinheiro', value: 'Dinheiro' },
  { label: 'Cartão de débito', value: 'Cartao de debito' },
  { label: 'Cartão de crédito', value: 'Cartao de credito' },
  { label: 'Boleto', value: 'Boleto' },
];

function formatCentsToDisplay(cents: string): string {
  const num = parseInt(cents || '0', 10);
  return isNaN(num)
    ? '0,00'
    : (num / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function dateISOToDisplay(iso?: string | null): string {
  if (!iso || iso.length < 10) return '';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

function displayToISO(display: string): string | null {
  const parts = display.split('/');
  if (parts.length !== 3 || parts[2].length !== 4) return null;
  const iso = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
  return isNaN(Date.parse(iso)) ? null : iso;
}

function maskDate(text: string): string {
  const digits = text.replace(/\D/g, '').slice(0, 8);
  let result = '';
  for (let i = 0; i < digits.length; i++) {
    if (i === 2 || i === 4) result += '/';
    result += digits[i];
  }
  return result;
}

function reversePaymentMethodLabel(label: string): string {
  return PAYMENT_METHODS.find((m) => m.label === label)?.value ?? label;
}

type Step = 'actions' | 'edit' | 'confirm_delete';

type Props = {
  visible: boolean;
  transaction: TransactionFeedItem | null;
  categories: FinanceCategory[];
  onClose: () => void;
};

export function TransactionActionsSheet({ visible, transaction, categories, onClose }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [step, setStep] = useState<Step>('actions');
  const [confirmTitle, setConfirmTitle] = useState('');
  const [confirmMessage, setConfirmMessage] = useState('');
  const pendingDeleteRef = useRef<(() => void) | null>(null);

  const [editType, setEditType] = useState<EntryType>('expense');
  const [editTitle, setEditTitle] = useState('');
  const [amountDigits, setAmountDigits] = useState('0');
  const [editDateDisplay, setEditDateDisplay] = useState('');
  const [editCategoryId, setEditCategoryId] = useState<string | null>(null);
  const [editPaymentMethod, setEditPaymentMethod] = useState('Pix');
  const [editNotes, setEditNotes] = useState('');

  const updateMutation = useUpdateTransactionMutation();
  const deleteMutation = useDeleteTransactionMutation();
  const deleteTransferMutation = useDeleteTransferMutation();
  const reverseCardPaymentMutation = useReverseCardPaymentMutation();

  const isDeleting =
    deleteMutation.isPending || deleteTransferMutation.isPending || reverseCardPaymentMutation.isPending;

  useEffect(() => {
    if (!visible) {
      const timer = setTimeout(() => setStep('actions'), 320);
      return () => clearTimeout(timer);
    }
    if (!transaction) return;
    setEditType(transaction.type);
    setEditTitle(transaction.title);
    setAmountDigits(Math.round(transaction.amount * 100).toString());
    setEditDateDisplay(dateISOToDisplay(transaction.dateISO ?? transaction.occurredOn));
    setEditCategoryId(transaction.categoryId ?? null);
    setEditPaymentMethod(reversePaymentMethodLabel(transaction.paymentMethod));
    setEditNotes(transaction.notes ?? '');
  }, [visible, transaction]);

  const filteredCategories = useMemo(
    () => categories.filter((c) => c.kind === 'both' || c.kind === editType),
    [categories, editType],
  );

  function requestDelete(title: string, message: string, deleteFn: () => void) {
    pendingDeleteRef.current = deleteFn;
    setConfirmTitle(title);
    setConfirmMessage(message);
    setStep('confirm_delete');
  }

  function handleConfirmDelete() {
    pendingDeleteRef.current?.();
    pendingDeleteRef.current = null;
  }

  function handleSave() {
    if (!transaction) return;
    const isoDate = displayToISO(editDateDisplay);
    if (!editTitle.trim()) {
      Alert.alert('Atenção', 'O título é obrigatório.');
      return;
    }
    const amount = parseInt(amountDigits || '0', 10) / 100;
    if (amount <= 0) {
      Alert.alert('Atenção', 'Informe um valor maior que zero.');
      return;
    }
    if (!isoDate) {
      Alert.alert('Atenção', 'Informe uma data válida no formato DD/MM/AAAA.');
      return;
    }
    updateMutation.mutate(
      {
        id: transaction.id,
        input: {
          title: editTitle,
          amount,
          type: editType,
          paymentMethod: editPaymentMethod,
          occurredAt: `${isoDate}T12:00:00.000Z`,
          categoryId: editCategoryId,
          notes: editNotes,
        },
      },
      {
        onSuccess: () => onClose(),
        onError: (err) => Alert.alert('Erro', err.message),
      },
    );
  }

  const isGroupTransaction =
    !!transaction?.groupId ||
    transaction?.sourceType === 'group_split' ||
    transaction?.sourceType === 'group_settlement';

  const isNormalTransaction =
    !isGroupTransaction &&
    (transaction?.sourceType === 'manual' ||
      transaction?.sourceType === 'voice' ||
      transaction?.sourceType === 'ocr' ||
      transaction?.sourceType === 'imported' ||
      !transaction?.sourceType);

  const sheetTitle =
    step === 'edit'
      ? 'Editar Transação'
      : step === 'confirm_delete'
        ? confirmTitle
        : 'Ações';

  const footerNode =
    step === 'edit' ? (
      <>
        <Button label="Cancelar" variant="secondary" fullWidth onPress={() => setStep('actions')} />
        <Button label="Salvar" fullWidth onPress={handleSave} loading={updateMutation.isPending} />
      </>
    ) : step === 'confirm_delete' ? (
      <>
        <Button label="Cancelar" variant="secondary" fullWidth onPress={() => setStep('actions')} />
        <Button label="Confirmar" variant="danger" fullWidth onPress={handleConfirmDelete} loading={isDeleting} />
      </>
    ) : undefined;

  return (
    <BottomSheet visible={visible} onClose={onClose} title={sheetTitle} footer={footerNode}>
      {/* ── STEP: ACTIONS ── */}
      {step === 'actions' ? (
        <View>
          {transaction ? (
            <>
              <View style={styles.previewRow}>
                <View style={[styles.colorDot, { backgroundColor: transaction.categoryColor ?? '#94A3B8' }]} />
                <View style={styles.previewTexts}>
                  <Text style={styles.previewTitle} numberOfLines={1}>
                    {transaction.title}
                  </Text>
                  <Text style={styles.previewCategory}>{transaction.category}</Text>
                </View>
                <Text
                  style={[
                    styles.previewAmount,
                    { color: transaction.type === 'income' ? colors.success : colors.danger },
                  ]}
                >
                  {transaction.type === 'income' ? '+' : '-'}{formatCurrencyBRL(transaction.amount)}
                </Text>
              </View>
              <View style={styles.separator} />
            </>
          ) : null}

          {transaction?.sourceType === 'card_installment' && (
            <View style={styles.infoBox}>
              <Info size={16} color={colors.primary} />
              <Text style={styles.infoText}>
                Esta parcela é gerenciada pela fatura do cartão. Acesse a tela de Cartões para ver ou gerenciar esta cobrança.
              </Text>
            </View>
          )}

          {transaction?.sourceType === 'transfer' && (
            <>
              <View style={styles.warningBox}>
                <AlertTriangle size={16} color={colors.warning} />
                <Text style={styles.warningText}>
                  Esta transferência possui dois lançamentos vinculados. Ao excluir, ambos serão removidos.
                </Text>
              </View>
              <Button
                label="Excluir transferência"
                variant="danger"
                fullWidth
                onPress={() =>
                  requestDelete(
                    'Excluir transferência',
                    'Os dois lançamentos desta transferência (débito e crédito) serão excluídos definitivamente.',
                    () =>
                      deleteTransferMutation.mutate(transaction.id, {
                        onSuccess: () => onClose(),
                        onError: (err) => Alert.alert('Erro', err.message),
                      }),
                  )
                }
              />
            </>
          )}

          {transaction?.sourceType === 'card_payment' && (
            <>
              <View style={styles.infoBox}>
                <Info size={16} color={colors.primary} />
                <Text style={styles.infoText}>
                  Este lançamento representa o pagamento de uma fatura de cartão.
                </Text>
              </View>
              <Button
                label="Desfazer pagamento"
                variant="danger"
                fullWidth
                onPress={() =>
                  requestDelete(
                    'Desfazer pagamento',
                    'O pagamento desta fatura será revertido e ela voltará a aparecer como pendente.',
                    () =>
                      reverseCardPaymentMutation.mutate(transaction.id, {
                        onSuccess: () => onClose(),
                        onError: (err) => Alert.alert('Erro', err.message),
                      }),
                  )
                }
              />
            </>
          )}

          {transaction?.sourceType === 'goal_contribution' && (
            <View style={styles.infoBox}>
              <Info size={16} color={colors.primary} />
              <Text style={styles.infoText}>
                Este aporte está vinculado a uma meta financeira. Acesse a tela de Metas para gerenciá-lo.
              </Text>
            </View>
          )}

          {isGroupTransaction && (
            <>
              <View style={styles.warningBox}>
                <AlertTriangle size={16} color={colors.warning} />
                <Text style={styles.warningText}>
                  Esta transação está vinculada a um grupo. Alterações afetam o saldo dos membros.
                </Text>
              </View>
              <View style={styles.buttonColumn}>
                <Button label="Editar" variant="secondary" fullWidth onPress={() => setStep('edit')} />
                <Button
                  label="Excluir"
                  variant="danger"
                  fullWidth
                  onPress={() =>
                    requestDelete(
                      'Excluir do grupo',
                      'Esta transação será excluída. O saldo do grupo pode ser afetado.',
                      () =>
                        deleteMutation.mutate(transaction!.id, {
                          onSuccess: () => onClose(),
                          onError: (err) => Alert.alert('Erro', err.message),
                        }),
                    )
                  }
                />
              </View>
            </>
          )}

          {isNormalTransaction && (
            <View style={styles.buttonColumn}>
              <Button label="Editar" variant="secondary" fullWidth onPress={() => setStep('edit')} />
              <Button
                label="Excluir"
                variant="danger"
                fullWidth
                onPress={() =>
                  requestDelete(
                    'Excluir transação',
                    'Esta transação será excluída definitivamente. Esta ação não pode ser desfeita.',
                    () =>
                      deleteMutation.mutate(transaction!.id, {
                        onSuccess: () => onClose(),
                        onError: (err) => Alert.alert('Erro', err.message),
                      }),
                  )
                }
              />
            </View>
          )}

          <View style={styles.bottomSpacer} />
        </View>
      ) : null}

      {/* ── STEP: CONFIRM DELETE ── */}
      {step === 'confirm_delete' ? (
        <View>
          <View style={styles.confirmBox}>
            <View style={styles.confirmIconWrap}>
              <Trash2 size={28} color={colors.danger} />
            </View>
            <Text style={styles.confirmMessage}>{confirmMessage}</Text>
          </View>
          <View style={styles.bottomSpacer} />
        </View>
      ) : null}

      {/* ── STEP: EDIT ── */}
      {step === 'edit' ? (
        <View>
          <View style={styles.typeRow}>
            <TypeChip
              label="Despesa"
              active={editType === 'expense'}
              activeColor={colors.danger}
              styles={styles}
              onPress={() => setEditType('expense')}
            />
            <TypeChip
              label="Receita"
              active={editType === 'income'}
              activeColor={colors.success}
              styles={styles}
              onPress={() => setEditType('income')}
            />
          </View>

          <FieldCard>
            <FieldRow
              label="Título"
              placeholder="Ex: Mercado, Salário..."
              value={editTitle}
              onChangeText={setEditTitle}
            />
            <FieldDivider />
            <FieldRow
              label="Valor"
              prefix="R$"
              placeholder="0,00"
              keyboardType="numeric"
              value={formatCentsToDisplay(amountDigits)}
              onChangeText={(text) => {
                const digits = text.replace(/\D/g, '').replace(/^0+/, '');
                setAmountDigits(digits || '0');
              }}
            />
            <FieldDivider />
            <FieldRow
              label="Data"
              placeholder="DD/MM/AAAA"
              keyboardType="numeric"
              maxLength={10}
              value={editDateDisplay}
              onChangeText={(text) => setEditDateDisplay(maskDate(text))}
            />
          </FieldCard>

          <Text style={styles.sectionLabel}>Categoria</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.hScroll}
            contentContainerStyle={styles.hScrollContent}
          >
            <TouchableOpacity
              style={[styles.catChip, editCategoryId === null && styles.catChipActive]}
              onPress={() => setEditCategoryId(null)}
            >
              <Text style={[styles.catChipText, editCategoryId === null && styles.catChipTextActive]}>
                Sem categoria
              </Text>
            </TouchableOpacity>
            {filteredCategories.map((cat) => {
              const active = editCategoryId === cat.id;
              return (
                <TouchableOpacity
                  key={cat.id}
                  style={[styles.catChip, active && { backgroundColor: cat.color + '20', borderColor: cat.color }]}
                  onPress={() => setEditCategoryId(cat.id)}
                >
                  <View style={[styles.catDot, { backgroundColor: cat.color }]} />
                  <Text style={[styles.catChipText, active && { color: cat.color }]}>{cat.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <Text style={styles.sectionLabel}>Meio de pagamento</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.hScroll}
            contentContainerStyle={styles.hScrollContent}
          >
            {PAYMENT_METHODS.map((m) => {
              const active = editPaymentMethod === m.value;
              return (
                <TouchableOpacity
                  key={m.value}
                  style={[styles.catChip, active && styles.catChipActive]}
                  onPress={() => setEditPaymentMethod(m.value)}
                >
                  <Text style={[styles.catChipText, active && styles.catChipTextActive]}>{m.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <Text style={styles.sectionLabel}>Observações</Text>
          <View style={styles.notesCard}>
            <TextInput
              style={styles.notesInput}
              placeholder="Adicionar observações (opcional)"
              placeholderTextColor={colors.textSecondary}
              value={editNotes}
              onChangeText={setEditNotes}
              multiline
              textAlignVertical="top"
            />
          </View>

          <View style={styles.bottomSpacer} />
        </View>
      ) : null}
    </BottomSheet>
  );
}

function TypeChip({
  label,
  active,
  activeColor,
  styles,
  onPress,
}: {
  label: string;
  active: boolean;
  activeColor: string;
  styles: ReturnType<typeof createStyles>;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.typeChip, active && { backgroundColor: activeColor + '20', borderColor: activeColor }]}
      onPress={onPress}
    >
      <Text style={[styles.typeChipText, active && { color: activeColor }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const createStyles = (colors: AppColors) =>
  StyleSheet.create({
    previewRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      marginBottom: spacing.lg,
    },
    colorDot: {
      width: 12,
      height: 12,
      borderRadius: 6,
      flexShrink: 0,
    },
    previewTexts: {
      flex: 1,
    },
    previewTitle: {
      ...typography.body,
      color: colors.textPrimary,
      fontWeight: '600',
    },
    previewCategory: {
      ...typography.caption,
      color: colors.textSecondary,
      marginTop: 2,
    },
    previewAmount: {
      ...typography.body,
      fontWeight: '700',
    },
    separator: {
      height: 1,
      backgroundColor: colors.border,
      marginBottom: spacing.lg,
    },
    infoBox: {
      flexDirection: 'row',
      gap: spacing.sm,
      backgroundColor: colors.primarySoft,
      borderRadius: radius.md,
      padding: spacing.md,
      marginBottom: spacing.md,
    },
    infoText: {
      ...typography.caption,
      color: colors.primary,
      flex: 1,
      lineHeight: 18,
    },
    warningBox: {
      flexDirection: 'row',
      gap: spacing.sm,
      backgroundColor: colors.warningSoft,
      borderRadius: radius.md,
      padding: spacing.md,
      marginBottom: spacing.md,
    },
    warningText: {
      ...typography.caption,
      color: colors.warning,
      flex: 1,
      lineHeight: 18,
    },
    buttonColumn: {
      gap: spacing.sm,
    },
    confirmBox: {
      alignItems: 'center',
      paddingVertical: spacing.xl,
      gap: spacing.lg,
    },
    confirmIconWrap: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: colors.dangerSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    confirmMessage: {
      ...typography.body,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 22,
    },
    bottomSpacer: {
      height: spacing.lg,
    },
    typeRow: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginBottom: spacing.lg,
    },
    typeChip: {
      flex: 1,
      paddingVertical: spacing.sm,
      borderRadius: radius.md,
      borderWidth: 1.5,
      borderColor: colors.border,
      alignItems: 'center',
    },
    typeChipText: {
      ...typography.body,
      fontWeight: '600',
      color: colors.textSecondary,
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
    hScroll: {
      marginHorizontal: -spacing.xl,
    },
    hScrollContent: {
      paddingHorizontal: spacing.xl,
      gap: spacing.sm,
      paddingVertical: spacing.xs,
    },
    catChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingHorizontal: spacing.md,
      paddingVertical: 6,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
    catChipActive: {
      backgroundColor: colors.primarySoft,
      borderColor: colors.primary,
    },
    catDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    catChipText: {
      ...typography.caption,
      color: colors.textSecondary,
      fontWeight: '600',
    },
    catChipTextActive: {
      color: colors.primary,
    },
    notesCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.lg,
    },
    notesInput: {
      ...typography.body,
      color: colors.textPrimary,
      minHeight: 80,
      textAlignVertical: 'top',
    },
  });
