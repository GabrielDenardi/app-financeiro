import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AlertTriangle, CheckCircle2, ChevronRight, Clock, Pencil, Plus, Receipt } from 'lucide-react-native';

import { AddCardBillsModal } from '../components/AddCardBillsModal';
import { AddCardModal } from '../components/AddCardModal';
import { BottomSheet } from '../components/BottomSheet';
import { Button } from '../components/Button';
import { useAccounts } from '../features/accounts/hooks/useAccounts';
import { useAuthenticatedUser } from '../features/auth/hooks/useAuthenticatedUser';
import {
  useCardInvoices,
  useCards,
  useCreateCardMutation,
  useInvoiceCharges,
  usePayCardInvoiceMutation,
  useRecordCardChargeMutation,
  useUpdateCardMutation,
} from '../features/cards/hooks/useCards';
import type { CardInvoiceSummary, CreditCard } from '../features/cards/types';
import { useFinanceCategories } from '../features/transactions/hooks/useTransactions';
import { formatCurrencyInput, normalizeCurrencyInput } from '../features/finance/utils';
import { layout, radius, spacing, typography, type AppColors, useThemeColors } from '../theme';
import {
  formatCurrencyBRL,
  formatMonthYearShort,
  getRelativeDueDateInfo,
} from '../utils/format';

function darkenHex(hex: string, amount: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, (num >> 16) - amount);
  const g = Math.max(0, ((num >> 8) & 0xff) - amount);
  const b = Math.max(0, (num & 0xff) - amount);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

function getGradient(color: string): [string, string] {
  if (color === '#0F172A') return ['#334155', '#0F172A'];
  return [color, darkenHex(color, 40)];
}

function isInvoiceClosed(invoiceMonth: string, closingDay: number): boolean {
  const today = new Date();
  const parts = invoiceMonth.split('-').map(Number);
  const closingDate = new Date(parts[0], parts[1] - 1, closingDay);
  return today >= closingDate;
}

export default function CardsScreen({ navigation }: any) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const currentUser = useAuthenticatedUser();
  const cardsQuery = useCards(currentUser?.id);
  const invoicesQuery = useCardInvoices(currentUser?.id);
  const accountsQuery = useAccounts(currentUser?.id);
  const categoriesQuery = useFinanceCategories(currentUser?.id);
  const createCardMutation = useCreateCardMutation(currentUser?.id);
  const updateCardMutation = useUpdateCardMutation(currentUser?.id);
  const recordChargeMutation = useRecordCardChargeMutation(currentUser?.id);
  const payInvoiceMutation = usePayCardInvoiceMutation(currentUser?.id);

  const [cardModalVisible, setCardModalVisible] = useState(false);
  const [chargeModalVisible, setChargeModalVisible] = useState(false);
  const [editingCard, setEditingCard] = useState<CreditCard | null>(null);
  const [paymentSheetVisible, setPaymentSheetVisible] = useState(false);
  const [pendingPayment, setPendingPayment] = useState<{ cardId: string; invoiceMonth: string; totalAmount: number } | null>(null);
  const [paymentMode, setPaymentMode] = useState<'full' | 'minimum' | 'custom'>('full');
  const [customAmountText, setCustomAmountText] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [payingKey, setPayingKey] = useState<string | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<{ cardId: string; invoiceMonth: string } | null>(null);
  const [historyCardId, setHistoryCardId] = useState<string | null>(null);
  const chargesQuery = useInvoiceCharges(currentUser?.id, selectedInvoice?.cardId, selectedInvoice?.invoiceMonth);

  const cards = cardsQuery.data ?? [];
  const invoices = invoicesQuery.data ?? [];
  const activeAccounts = (accountsQuery.data ?? []).filter((a) => a.isActive);

  const invoicesByCard = useMemo(() => {
    const map = new Map<string, CardInvoiceSummary[]>();
    for (const inv of invoices) {
      const list = map.get(inv.cardId) ?? [];
      list.push(inv);
      map.set(inv.cardId, list);
    }
    return map;
  }, [invoices]);

  const totalOpenAmount = useMemo(
    () => invoices.filter((inv) => inv.openAmount > 0).reduce((sum, inv) => sum + inv.openAmount, 0),
    [invoices],
  );

  const urgentAlerts = useMemo(
    () => invoices.filter((inv) => inv.isDueSoon && inv.openAmount > 0),
    [invoices],
  );

  const historyCard = cards.find((c) => c.id === historyCardId);
  const historyInvoices = historyCardId
    ? (invoicesByCard.get(historyCardId) ?? []).sort((a, b) => b.invoiceMonth.localeCompare(a.invoiceMonth))
    : [];

  const minimumPayment = pendingPayment
    ? Math.max(0.01, Math.ceil(pendingPayment.totalAmount * 0.15 * 100) / 100)
    : 0;

  const paymentOptions: { key: 'full' | 'minimum' | 'custom'; label: string; sub: string | null }[] = [
    { key: 'full', label: 'Total', sub: formatCurrencyBRL(pendingPayment?.totalAmount ?? 0) },
    { key: 'minimum', label: 'Mínimo (15%)', sub: formatCurrencyBRL(minimumPayment) },
    { key: 'custom', label: 'Outro valor', sub: null },
  ];

  const handleCreateCard = async (input: any) => {
    try {
      await createCardMutation.mutateAsync(input);
      setCardModalVisible(false);
    } catch (error) {
      Alert.alert('Erro', error instanceof Error ? error.message : 'Não foi possível criar o cartão.');
    }
  };

  const handleEditCard = async (input: any) => {
    if (!editingCard) return;
    try {
      await updateCardMutation.mutateAsync({ id: editingCard.id, input });
      setEditingCard(null);
    } catch (error) {
      Alert.alert('Erro', error instanceof Error ? error.message : 'Não foi possível atualizar o cartão.');
    }
  };

  const handleCreateCharge = async (input: any) => {
    try {
      await recordChargeMutation.mutateAsync(input);
      setChargeModalVisible(false);
    } catch (error) {
      Alert.alert('Erro', error instanceof Error ? error.message : 'Não foi possível lançar a compra.');
    }
  };

  const doPayInvoice = async (cardId: string, invoiceMonth: string, accountId: string, amount?: number) => {
    const key = `${cardId}-${invoiceMonth}`;
    setPayingKey(key);
    try {
      await payInvoiceMutation.mutateAsync({ cardId, invoiceMonth, accountId, amount });
    } catch (error) {
      Alert.alert('Erro', error instanceof Error ? error.message : 'Não foi possível pagar a fatura.');
    } finally {
      setPayingKey(null);
    }
  };

  const handlePayPress = (cardId: string, invoiceMonth: string, totalAmount: number) => {
    if (!activeAccounts.length) {
      Alert.alert('Conta necessária', 'Cadastre uma conta para pagar faturas.');
      return;
    }
    setPendingPayment({ cardId, invoiceMonth, totalAmount });
    setPaymentMode('full');
    setCustomAmountText('');
    setSelectedAccountId(activeAccounts[0].id);
    setPaymentSheetVisible(true);
  };

  const handleConfirmPayment = () => {
    if (!pendingPayment || !selectedAccountId) return;
    let amount: number | undefined;
    if (paymentMode === 'minimum') {
      amount = minimumPayment;
    } else if (paymentMode === 'custom') {
      const parsed = normalizeCurrencyInput(customAmountText);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        Alert.alert('Valor inválido', 'Digite um valor maior que zero.');
        return;
      }
      amount = parsed;
    }
    setPaymentSheetVisible(false);
    doPayInvoice(pendingPayment.cardId, pendingPayment.invoiceMonth, selectedAccountId, amount);
    setPendingPayment(null);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <Text style={styles.title}>Meus Cartões</Text>
        <Button
          label="Novo"
          size="sm"
          icon={<Plus size={16} color={colors.white} />}
          onPress={() => setCardModalVisible(true)}
        />
      </View>

      {/* ── Resumo fixo ── */}
      <View style={styles.summaryCard}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Em aberto</Text>
            <Text style={[styles.summaryValue, { color: totalOpenAmount > 0 ? colors.danger : colors.textPrimary }]}>
              {formatCurrencyBRL(totalOpenAmount)}
            </Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Alertas</Text>
            <Text style={[styles.summaryValue, { color: urgentAlerts.length > 0 ? colors.warning : colors.textPrimary }]}>
              {urgentAlerts.length === 0 ? 'Nenhum' : String(urgentAlerts.length)}
            </Text>
          </View>
        </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* ── Main Content ── */}
        <View style={styles.mainContent}>
          {urgentAlerts.length > 0 && (
            <View style={styles.alertCard}>
              <View style={styles.alertIcon}>
                <AlertTriangle color={colors.warning} size={20} />
              </View>
              <View style={styles.alertTextContent}>
                <Text style={styles.alertTitle}>
                  {urgentAlerts.length === 1 ? 'Fatura vencendo em breve' : `${urgentAlerts.length} faturas vencendo em breve`}
                </Text>
                <Text style={styles.alertSubtitle}>
                  {urgentAlerts[0].cardName} · {formatCurrencyBRL(urgentAlerts[0].openAmount)}
                  {urgentAlerts.length > 1 ? ` e mais ${urgentAlerts.length - 1}` : ''}
                </Text>
              </View>
            </View>
          )}

          {cardsQuery.isLoading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator />
            </View>
          ) : cards.length ? (
            cards.map((card) => {
              const cardInvoices = (invoicesByCard.get(card.id) ?? []).sort((a, b) =>
                a.invoiceMonth.localeCompare(b.invoiceMonth),
              );
              const closedUnpaid = cardInvoices.filter(
                (inv) => isInvoiceClosed(inv.invoiceMonth, card.closingDay) && inv.openAmount > 0,
              );
              const currentOpen = cardInvoices.find(
                (inv) => !isInvoiceClosed(inv.invoiceMonth, card.closingDay),
              );
              const limitProgress = card.limitAmount > 0 ? (card.usedLimitAmount / card.limitAmount) * 100 : 0;

              return (
                <View key={card.id} style={styles.cardWrapper}>
                  {/* Card Visual */}
                  <LinearGradient
                    colors={getGradient(card.color)}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.cardVisual}
                  >
                    <View style={styles.cardDecorator1} />
                    <View style={styles.cardDecorator2} />
                    <View style={styles.cardHeader}>
                      <View>
                        <Text style={styles.cardInst}>{card.institution || 'Cartão'}</Text>
                        <Text style={styles.cardName}>{card.name}</Text>
                      </View>
                      <View style={styles.cardHeaderRight}>
                        <Text style={styles.cardNetwork}>{card.network}</Text>
                        <Pressable onPress={() => setEditingCard(card)} style={styles.editCardBtn}>
                          <Pencil size={14} color={colors.whiteAlpha80} />
                        </Pressable>
                      </View>
                    </View>
                    <Text style={styles.cardDigits}>•••• •••• •••• {card.lastDigits}</Text>
                    <View style={styles.cardFooter}>
                      <View>
                        <Text style={styles.cardLabel}>Fechamento</Text>
                        <Text style={styles.cardInfo}>Dia {card.closingDay}</Text>
                      </View>
                      <View style={styles.cardFooterRight}>
                        <Text style={styles.cardLabel}>Vencimento</Text>
                        <Text style={styles.cardInfo}>Dia {card.dueDay}</Text>
                      </View>
                    </View>
                  </LinearGradient>

                  {/* Closed unpaid invoices — one panel each, oldest first */}
                  {closedUnpaid.map((inv) => {
                    const invoiceKey = `${card.id}-${inv.invoiceMonth}`;
                    const isThisPaying = payingKey === invoiceKey;
                    const dueDateInfo = getRelativeDueDateInfo(inv.dueDate);
                    return (
                      <View
                        key={inv.invoiceMonth}
                        style={[
                          styles.invoicePanel,
                          dueDateInfo.isOverdue ? styles.invoicePanelOverdue : styles.invoicePanelClosed,
                        ]}
                      >
                        <Pressable
                          style={styles.invoicePanelTop}
                          onPress={() => setSelectedInvoice({ cardId: card.id, invoiceMonth: inv.invoiceMonth })}
                        >
                          <View style={styles.invoicePanelLeft}>
                            <View style={styles.invoicePanelBadgeRow}>
                              <Text style={styles.invoicePanelMonth}>
                                {`Fatura de ${formatMonthYearShort(inv.invoiceMonth)}`}
                              </Text>
                              <View style={[styles.invoiceStateBadge, dueDateInfo.isOverdue ? styles.badgeOverdue : styles.badgeClosed]}>
                                <Text style={[styles.invoiceStateBadgeText, dueDateInfo.isOverdue ? styles.badgeOverdueText : styles.badgeClosedText]}>
                                  {dueDateInfo.isOverdue ? 'Vencida' : 'Fechada'}
                                </Text>
                              </View>
                            </View>
                            <Text style={[styles.invoicePanelDue, dueDateInfo.isOverdue && styles.invoicePanelDueUrgent]}>
                              {dueDateInfo.label || `Vence dia ${card.dueDay}`}
                            </Text>
                          </View>
                          <View style={styles.invoicePanelRight}>
                            <Text style={[styles.invoicePanelAmount, dueDateInfo.isOverdue && styles.invoicePanelAmountUrgent]}>
                              {formatCurrencyBRL(inv.openAmount)}
                            </Text>
                            <ChevronRight size={16} color={colors.textSecondary} />
                          </View>
                        </Pressable>

                        <Pressable
                          style={[
                            styles.panelPayButton,
                            dueDateInfo.isOverdue && styles.panelPayButtonOverdue,
                            (isThisPaying || (payingKey !== null && !isThisPaying)) && styles.disabledButton,
                          ]}
                          onPress={() => handlePayPress(card.id, inv.invoiceMonth, inv.openAmount)}
                          disabled={isThisPaying || payingKey !== null}
                        >
                          {isThisPaying ? (
                            <ActivityIndicator size="small" color={colors.white} />
                          ) : (
                            <Text style={styles.panelPayText}>
                              Pagar {formatCurrencyBRL(inv.openAmount)}
                            </Text>
                          )}
                        </Pressable>
                      </View>
                    );
                  })}

                  {/* Current open invoice */}
                  {currentOpen ? (
                    <Pressable
                      style={[styles.invoicePanel, styles.invoicePanelOpen]}
                      onPress={() => setSelectedInvoice({ cardId: card.id, invoiceMonth: currentOpen.invoiceMonth })}
                    >
                      <View style={styles.invoicePanelTop}>
                        <View style={styles.invoicePanelLeft}>
                          <View style={styles.invoicePanelBadgeRow}>
                            <Text style={styles.invoicePanelMonth}>
                              {`Fatura de ${formatMonthYearShort(currentOpen.invoiceMonth)}`}
                            </Text>
                            <View style={[styles.invoiceStateBadge, styles.badgeOpen]}>
                              <Text style={[styles.invoiceStateBadgeText, styles.badgeOpenText]}>Em aberto</Text>
                            </View>
                          </View>
                          <Text style={styles.invoicePanelDue}>{`Fecha dia ${card.closingDay}`}</Text>
                        </View>
                        <View style={styles.invoicePanelRight}>
                          <Text style={styles.invoicePanelAmount}>
                            {formatCurrencyBRL(currentOpen.openAmount)}
                          </Text>
                          <ChevronRight size={16} color={colors.textSecondary} />
                        </View>
                      </View>
                      <View style={styles.openInvoiceHint}>
                        <Text style={styles.openInvoiceHintText}>
                          Disponível para pagamento após o fechamento
                        </Text>
                      </View>
                    </Pressable>
                  ) : !closedUnpaid.length ? (
                    <View style={styles.noInvoicePanel}>
                      <Text style={styles.noInvoiceText}>Nenhuma compra neste mês</Text>
                    </View>
                  ) : null}

                  {/* Limit bar */}
                  <View style={styles.limitCard}>
                    <View style={styles.limitLabelRow}>
                      <Text style={styles.limitLabel}>Limite usado</Text>
                      <Text style={styles.limitPercent}>{Math.round(limitProgress)}%</Text>
                    </View>
                    <View style={styles.progressContainer}>
                      <View
                        style={[
                          styles.progressBar,
                          {
                            width: `${Math.min(limitProgress, 100)}%`,
                            backgroundColor:
                              limitProgress > 80 ? colors.danger : limitProgress > 60 ? colors.warning : colors.primary,
                          },
                        ]}
                      />
                    </View>
                    <Text style={styles.limitSubtext}>
                      {formatCurrencyBRL(card.availableLimitAmount)} disponível de {formatCurrencyBRL(card.limitAmount)}
                    </Text>
                  </View>

                  {/* History link */}
                  <Pressable onPress={() => setHistoryCardId(card.id)} style={styles.historyLink}>
                    <Clock size={14} color={colors.textSecondary} />
                    <Text style={styles.historyLinkText}>Ver histórico de faturas</Text>
                    <ChevronRight size={14} color={colors.textSecondary} />
                  </Pressable>
                </View>
              );
            })
          ) : (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>Nenhum cartão cadastrado</Text>
              <Text style={styles.emptyText}>
                Cadastre seu primeiro cartão para gerar compras parceladas e faturas reais.
              </Text>
            </View>
          )}

          <Pressable style={styles.quickAddExpense} onPress={() => setChargeModalVisible(true)}>
            <Receipt size={20} color={colors.primary} />
            <Text style={styles.quickAddText}>Lançar compra</Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* ── Payment BottomSheet ── */}
      <BottomSheet
        visible={paymentSheetVisible}
        onClose={() => { setPaymentSheetVisible(false); setPendingPayment(null); }}
        title={pendingPayment ? `Pagar fatura de ${formatMonthYearShort(pendingPayment.invoiceMonth)}` : 'Pagamento'}
        footer={(close) => (
          <>
            <Button label="Cancelar" variant="secondary" fullWidth onPress={close} />
            <Button
              label="Confirmar"
              fullWidth
              disabled={!selectedAccountId || payInvoiceMutation.isPending}
              loading={payInvoiceMutation.isPending}
              onPress={handleConfirmPayment}
            />
          </>
        )}
      >
        <Text style={styles.sheetSectionLabel}>Valor do pagamento</Text>
        <View style={styles.paymentModeRow}>
          {paymentOptions.map((option) => (
            <Pressable
              key={option.key}
              onPress={() => setPaymentMode(option.key)}
              style={[styles.paymentModeChip, paymentMode === option.key && styles.paymentModeChipActive]}
            >
              <Text style={[styles.paymentModeLabel, paymentMode === option.key && styles.paymentModeLabelActive]}>
                {option.label}
              </Text>
              {option.sub ? (
                <Text style={[styles.paymentModeSub, paymentMode === option.key && styles.paymentModeSubActive]}>
                  {option.sub}
                </Text>
              ) : null}
            </Pressable>
          ))}
        </View>

        {paymentMode === 'custom' && (
          <View style={styles.customAmountWrap}>
            <Text style={styles.customAmountPrefix}>R$</Text>
            <TextInput
              style={styles.customAmountInput}
              value={customAmountText}
              onChangeText={(value) => setCustomAmountText(formatCurrencyInput(value))}
              keyboardType="decimal-pad"
              placeholder="0,00"
              placeholderTextColor={colors.textSecondary}
              autoFocus
            />
          </View>
        )}

        {activeAccounts.length > 1 && (
          <>
            <Text style={[styles.sheetSectionLabel, { marginTop: spacing.lg }]}>Conta para débito</Text>
            <View style={styles.paymentChips}>
              {activeAccounts.map((account) => (
                <Pressable
                  key={account.id}
                  onPress={() => setSelectedAccountId(account.id)}
                  style={[styles.paymentChip, selectedAccountId === account.id && styles.paymentChipActive]}
                >
                  <Text style={[styles.paymentChipText, selectedAccountId === account.id && styles.paymentChipTextActive]}>
                    {account.name}
                  </Text>
                </Pressable>
              ))}
            </View>
          </>
        )}

        <View style={styles.sheetSpacer} />
      </BottomSheet>

      {/* ── Invoice charges BottomSheet ── */}
      <BottomSheet
        visible={selectedInvoice !== null}
        onClose={() => setSelectedInvoice(null)}
        title={selectedInvoice ? `Lançamentos de ${formatMonthYearShort(selectedInvoice.invoiceMonth)}` : ''}
      >
        <View style={styles.chargesContent}>
          {!chargesQuery.isLoading && (
            <Text style={styles.chargesSubtitle}>
              {(chargesQuery.data ?? []).length} lançamento{(chargesQuery.data ?? []).length !== 1 ? 's' : ''}
            </Text>
          )}
          {chargesQuery.isLoading ? (
            <View style={styles.chargesLoading}>
              <ActivityIndicator />
            </View>
          ) : chargesQuery.data?.length ? (
            <View style={styles.chargesList}>
              {chargesQuery.data.map((charge) => (
                <View key={`${charge.chargeId}-${charge.installmentNumber}`} style={styles.chargeItem}>
                  <View style={[styles.chargeDot, { backgroundColor: charge.categoryColor ?? colors.border }]} />
                  <View style={styles.chargeContent}>
                    <Text style={styles.chargeItemTitle} numberOfLines={1}>{charge.title}</Text>
                    <Text style={styles.chargeItemMeta}>
                      {charge.categoryLabel ?? 'Sem categoria'}
                      {charge.totalInstallments > 1 ? ` · ${charge.installmentNumber}/${charge.totalInstallments}x` : ''}
                    </Text>
                  </View>
                  <Text style={styles.chargeAmount}>{formatCurrencyBRL(charge.amount)}</Text>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.chargesEmpty}>
              <Text style={styles.chargesEmptyText}>Nenhum lançamento encontrado</Text>
            </View>
          )}
          <View style={styles.sheetSpacer} />
        </View>
      </BottomSheet>

      {/* ── Invoice history BottomSheet ── */}
      <BottomSheet
        visible={historyCardId !== null}
        onClose={() => setHistoryCardId(null)}
        title={historyCard ? `Histórico · ${historyCard.name}` : 'Histórico'}
      >
        <View style={styles.chargesContent}>
          {historyInvoices.length ? (
            <View style={styles.chargesList}>
              {historyInvoices.map((inv) => {
                const isPaidInv = inv.openAmount <= 0;
                const isClosedInv = historyCard ? isInvoiceClosed(inv.invoiceMonth, historyCard.closingDay) : false;
                const dueDateInfoInv = getRelativeDueDateInfo(inv.dueDate);
                const stateLabel = isPaidInv ? 'Paga' : isClosedInv ? (dueDateInfoInv.isOverdue ? 'Vencida' : 'Fechada') : 'Em aberto';
                const badgeStyle = isPaidInv ? styles.badgePaid : isClosedInv ? (dueDateInfoInv.isOverdue ? styles.badgeOverdue : styles.badgeClosed) : styles.badgeOpen;
                const badgeTextStyle = isPaidInv ? styles.badgePaidText : isClosedInv ? (dueDateInfoInv.isOverdue ? styles.badgeOverdueText : styles.badgeClosedText) : styles.badgeOpenText;

                return (
                  <Pressable
                    key={inv.invoiceMonth}
                    style={styles.historyItem}
                    onPress={() => {
                      setHistoryCardId(null);
                      setTimeout(() => setSelectedInvoice({ cardId: inv.cardId, invoiceMonth: inv.invoiceMonth }), 300);
                    }}
                  >
                    <View style={styles.historyItemLeft}>
                      <Text style={styles.historyItemMonth}>{formatMonthYearShort(inv.invoiceMonth)}</Text>
                      <View style={[styles.invoiceStateBadge, badgeStyle]}>
                        <Text style={[styles.invoiceStateBadgeText, badgeTextStyle]}>{stateLabel}</Text>
                      </View>
                    </View>
                    <View style={styles.historyItemRight}>
                      <Text style={styles.historyItemTotal}>{formatCurrencyBRL(inv.invoiceAmount)}</Text>
                      {!isPaidInv && inv.openAmount > 0 && (
                        <Text style={styles.historyItemOpen}>{formatCurrencyBRL(inv.openAmount)} pendente</Text>
                      )}
                    </View>
                    <ChevronRight size={16} color={colors.textSecondary} />
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <View style={styles.chargesEmpty}>
              <Text style={styles.chargesEmptyText}>Nenhum histórico encontrado</Text>
            </View>
          )}
          <View style={styles.sheetSpacer} />
        </View>
      </BottomSheet>

      <AddCardModal
        visible={cardModalVisible}
        submitting={createCardMutation.isPending}
        onClose={() => setCardModalVisible(false)}
        onSubmit={handleCreateCard}
      />

      <AddCardModal
        visible={editingCard !== null}
        submitting={updateCardMutation.isPending}
        onClose={() => setEditingCard(null)}
        onSubmit={handleEditCard}
        initialValues={editingCard ?? undefined}
        title="Editar Cartão"
        submitLabel="Salvar alterações"
      />

      <AddCardBillsModal
        visible={chargeModalVisible}
        cards={cards}
        categories={categoriesQuery.data ?? []}
        submitting={recordChargeMutation.isPending}
        onClose={() => setChargeModalVisible(false)}
        onSubmit={handleCreateCharge}
      />
    </SafeAreaView>
  );
}

const createStyles = (colors: AppColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scrollContent: {
      paddingBottom: spacing.xxl + spacing.sm,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: layout.pageHorizontal,
      paddingTop: layout.pageHeaderTop,
      paddingBottom: spacing.md,
      gap: spacing.md,
    },
    title: {
      ...typography.h1,
      color: colors.textPrimary,
      flex: 1,
    },
    summaryCard: {
      flexDirection: 'row',
      backgroundColor: colors.surface,
      marginHorizontal: layout.pageHorizontal,
      paddingVertical: spacing.lg,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: spacing.lg,
    },
    summaryItem: {
      flex: 1,
      alignItems: 'center',
    },
    summaryLabel: {
      ...typography.caption,
      color: colors.textSecondary,
      marginBottom: spacing.xs,
    },
    summaryValue: {
      ...typography.body,
      fontWeight: '700',
      fontSize: 13,
    },
    summaryDivider: {
      width: 1,
      height: '60%' as any,
      backgroundColor: colors.border,
      alignSelf: 'center',
    },
    mainContent: {
      paddingHorizontal: layout.pageHorizontal,
      gap: spacing.md,
    },
    alertCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.warningSoft,
      borderRadius: radius.lg,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: colors.warning,
    },
    alertIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.warningSoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: spacing.md,
    },
    alertTextContent: {
      flex: 1,
    },
    alertTitle: {
      ...typography.body,
      color: colors.textPrimary,
      fontWeight: '700',
    },
    alertSubtitle: {
      ...typography.caption,
      color: colors.textSecondary,
      marginTop: spacing.xs,
    },
    loadingWrap: {
      paddingVertical: spacing.xl,
      alignItems: 'center',
    },
    cardWrapper: {
      gap: spacing.sm,
    },
    cardVisual: {
      borderRadius: radius.xl,
      padding: spacing.lg,
      minHeight: 210,
      justifyContent: 'space-between',
      overflow: 'hidden',
    },
    cardDecorator1: {
      position: 'absolute',
      width: 180,
      height: 180,
      borderRadius: 90,
      backgroundColor: colors.whiteAlpha08,
      top: -70,
      right: -35,
    },
    cardDecorator2: {
      position: 'absolute',
      width: 140,
      height: 140,
      borderRadius: 70,
      backgroundColor: colors.whiteAlpha08,
      bottom: -45,
      left: -15,
    },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
    },
    cardHeaderRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    cardInst: {
      ...typography.caption,
      color: colors.whiteAlpha80,
      fontWeight: '700',
    },
    cardName: {
      ...typography.h2,
      color: colors.white,
      marginTop: spacing.sm,
    },
    cardNetwork: {
      ...typography.body,
      color: colors.white,
      fontWeight: '700',
    },
    editCardBtn: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: colors.whiteAlpha15,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cardDigits: {
      ...typography.body,
      color: colors.white,
      fontWeight: '700',
      letterSpacing: 2,
    },
    cardFooter: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
    },
    cardFooterRight: {
      alignItems: 'flex-end',
    },
    cardLabel: {
      ...typography.caption,
      color: colors.whiteAlpha80,
      fontWeight: '700',
    },
    cardInfo: {
      ...typography.body,
      color: colors.white,
      fontWeight: '700',
      marginTop: spacing.xs,
    },
    invoicePanel: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.lg,
      gap: spacing.md,
    },
    invoicePanelClosed: {
      borderColor: colors.warning,
    },
    invoicePanelOverdue: {
      borderColor: colors.danger,
      backgroundColor: colors.dangerSoft,
    },
    invoicePanelOpen: {
      borderColor: colors.primaryLight,
    },
    invoicePanelTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
    },
    invoicePanelLeft: {
      flex: 1,
      gap: spacing.xs,
      paddingRight: spacing.sm,
    },
    invoicePanelBadgeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      flexWrap: 'wrap',
    },
    invoicePanelRight: {
      alignItems: 'flex-end',
      gap: spacing.xs,
    },
    invoiceStateBadge: {
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      borderRadius: radius.pill,
    },
    badgePaid: { backgroundColor: colors.successSoft },
    badgeClosed: { backgroundColor: colors.warningSoft },
    badgeOverdue: { backgroundColor: colors.dangerSoft },
    badgeOpen: { backgroundColor: colors.primarySoft },
    invoiceStateBadgeText: {
      ...typography.caption,
      fontWeight: '600',
    },
    badgePaidText: { color: colors.success },
    badgeClosedText: { color: colors.warning },
    badgeOverdueText: { color: colors.danger },
    badgeOpenText: { color: colors.primary },
    invoicePanelMonth: {
      ...typography.caption,
      color: colors.textSecondary,
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    invoicePanelDue: {
      ...typography.h3,
      color: colors.textPrimary,
    },
    invoicePanelDueUrgent: {
      color: colors.danger,
    },
    invoicePanelAmount: {
      ...typography.value,
      color: colors.textPrimary,
    },
    invoicePanelAmountUrgent: {
      color: colors.danger,
    },
    openInvoiceHint: {
      backgroundColor: colors.primarySoft,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    openInvoiceHintText: {
      ...typography.caption,
      color: colors.primary,
      fontWeight: '500',
      textAlign: 'center',
    },
    panelPayButton: {
      height: 48,
      borderRadius: radius.md,
      backgroundColor: colors.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    panelPayButtonOverdue: {
      backgroundColor: colors.danger,
    },
    panelPayText: {
      ...typography.body,
      color: colors.white,
      fontWeight: '700',
    },
    noInvoicePanel: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.lg,
      alignItems: 'center',
    },
    noInvoiceText: {
      ...typography.caption,
      color: colors.textSecondary,
    },
    limitCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.lg,
      gap: spacing.xs,
    },
    limitLabelRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: spacing.xs,
    },
    limitLabel: {
      ...typography.caption,
      color: colors.textSecondary,
    },
    limitPercent: {
      ...typography.caption,
      color: colors.textSecondary,
      fontWeight: '600',
    },
    progressContainer: {
      height: 6,
      borderRadius: 3,
      overflow: 'hidden',
      backgroundColor: colors.mutedSurface,
    },
    progressBar: {
      height: '100%',
      backgroundColor: colors.primary,
    },
    limitSubtext: {
      ...typography.caption,
      color: colors.textSecondary,
      marginTop: spacing.xs,
    },
    historyLink: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.xs,
      alignSelf: 'center',
    },
    historyLinkText: {
      ...typography.caption,
      color: colors.textSecondary,
    },
    quickAddExpense: {
      minHeight: 52,
      borderRadius: radius.lg,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: spacing.sm,
      marginBottom: spacing.xl,
    },
    quickAddText: {
      ...typography.body,
      color: colors.primary,
      fontWeight: '700',
    },
    emptyCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.lg,
    },
    emptyTitle: {
      ...typography.h2,
      color: colors.textPrimary,
    },
    emptyText: {
      ...typography.body,
      color: colors.textSecondary,
      marginTop: spacing.xs,
    },
    disabledButton: {
      opacity: 0.6,
    },
    // Payment sheet
    sheetSectionLabel: {
      ...typography.caption,
      color: colors.textSecondary,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: spacing.md,
    },
    paymentModeRow: {
      flexDirection: 'row',
      gap: spacing.sm,
      flexWrap: 'wrap',
      marginBottom: spacing.md,
    },
    paymentModeChip: {
      flex: 1,
      minWidth: 90,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.sm,
      backgroundColor: colors.surface,
      alignItems: 'center',
    },
    paymentModeChipActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primarySoft,
    },
    paymentModeLabel: {
      ...typography.caption,
      color: colors.textPrimary,
      fontWeight: '600',
      textAlign: 'center',
    },
    paymentModeLabelActive: {
      color: colors.primary,
    },
    paymentModeSub: {
      ...typography.caption,
      color: colors.textSecondary,
      marginTop: spacing.xs,
      textAlign: 'center',
    },
    paymentModeSubActive: {
      color: colors.primary,
      fontWeight: '700',
    },
    customAmountWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      backgroundColor: colors.surface,
      paddingHorizontal: spacing.md,
      marginBottom: spacing.md,
      gap: spacing.sm,
    },
    customAmountPrefix: {
      ...typography.body,
      color: colors.textSecondary,
      fontWeight: '600',
    },
    customAmountInput: {
      flex: 1,
      height: 48,
      ...typography.body,
      color: colors.textPrimary,
    },
    paymentChips: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    paymentChip: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
    paymentChipActive: {
      backgroundColor: colors.primarySoft,
      borderColor: colors.primary,
    },
    paymentChipText: {
      ...typography.caption,
      color: colors.textPrimary,
      fontWeight: '600',
    },
    paymentChipTextActive: {
      color: colors.primary,
    },
    sheetSpacer: {
      height: spacing.xl,
    },
    // Charges & history sheets
    chargesContent: {
      gap: spacing.md,
    },
    chargesSubtitle: {
      ...typography.caption,
      color: colors.textSecondary,
    },
    chargesLoading: {
      paddingVertical: spacing.xl,
      alignItems: 'center',
    },
    chargesList: {
      gap: 0,
    },
    chargeItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      gap: spacing.md,
    },
    chargeDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      flexShrink: 0,
    },
    chargeContent: {
      flex: 1,
      gap: spacing.xs / 2,
    },
    chargeItemTitle: {
      ...typography.body,
      color: colors.textPrimary,
      fontWeight: '600',
    },
    chargeItemMeta: {
      ...typography.caption,
      color: colors.textSecondary,
    },
    chargeAmount: {
      ...typography.body,
      color: colors.textPrimary,
      fontWeight: '700',
    },
    chargesEmpty: {
      paddingVertical: spacing.xl,
      alignItems: 'center',
    },
    chargesEmptyText: {
      ...typography.body,
      color: colors.textSecondary,
    },
    historyItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      gap: spacing.md,
    },
    historyItemLeft: {
      flex: 1,
      gap: spacing.xs,
    },
    historyItemMonth: {
      ...typography.body,
      color: colors.textPrimary,
      fontWeight: '700',
    },
    historyItemRight: {
      alignItems: 'flex-end',
      gap: spacing.xs / 2,
    },
    historyItemTotal: {
      ...typography.body,
      color: colors.textPrimary,
      fontWeight: '700',
    },
    historyItemOpen: {
      ...typography.caption,
      color: colors.warning,
    },
  });
