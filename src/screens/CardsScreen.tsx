import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ArrowLeft, CreditCard, Plus, Receipt } from 'lucide-react-native';

import { AddCardBillsModal } from '../components/AddCardBillsModal';
import { AddCardModal } from '../components/AddCardModal';
import { useAuthenticatedUser } from '../features/auth/hooks/useAuthenticatedUser';
import { useAccounts } from '../features/accounts/hooks/useAccounts';
import {
  useCardInvoices,
  useCards,
  useCreateCardMutation,
  usePayCardInvoiceMutation,
  useRecordCardChargeMutation,
} from '../features/cards/hooks/useCards';
import { useFinanceCategories } from '../features/transactions/hooks/useTransactions';
import { formatCurrencyBRL } from '../utils/format';
import { colors, radius, spacing, typography } from '../theme';

export default function CardsScreen({ navigation }: any) {
  const currentUser = useAuthenticatedUser();
  const cardsQuery = useCards(currentUser?.id);
  const invoicesQuery = useCardInvoices(currentUser?.id);
  const accountsQuery = useAccounts(currentUser?.id);
  const categoriesQuery = useFinanceCategories(currentUser?.id);
  const createCardMutation = useCreateCardMutation(currentUser?.id);
  const recordChargeMutation = useRecordCardChargeMutation(currentUser?.id);
  const payInvoiceMutation = usePayCardInvoiceMutation(currentUser?.id);

  const [cardModalVisible, setCardModalVisible] = useState(false);
  const [chargeModalVisible, setChargeModalVisible] = useState(false);
  const [paymentAccountId, setPaymentAccountId] = useState('');

  const cards = cardsQuery.data ?? [];
  const invoices = invoicesQuery.data ?? [];
  const activeAccounts = (accountsQuery.data ?? []).filter((account) => account.isActive);
  const totalOpenInvoices = invoices.reduce((sum, invoice) => sum + invoice.openAmount, 0);
  const urgentAlerts = invoices.filter((invoice) => invoice.isDueSoon).length;

  useEffect(() => {
    setPaymentAccountId((current) => current || activeAccounts[0]?.id || '');
  }, [activeAccounts]);

  const handleCreateCard = async (input: any) => {
    try {
      await createCardMutation.mutateAsync(input);
      setCardModalVisible(false);
    } catch (error) {
      Alert.alert('Erro', error instanceof Error ? error.message : 'Nao foi possivel criar o cartao.');
    }
  };

  const handleCreateCharge = async (input: any) => {
    try {
      await recordChargeMutation.mutateAsync(input);
      setChargeModalVisible(false);
    } catch (error) {
      Alert.alert('Erro', error instanceof Error ? error.message : 'Nao foi possivel lancar a compra.');
    }
  };

  const handlePayInvoice = async (cardId: string, invoiceMonth: string) => {
    if (!paymentAccountId) {
      Alert.alert('Conta necessaria', 'Selecione uma conta para pagar a fatura.');
      return;
    }

    try {
      await payInvoiceMutation.mutateAsync({
        cardId,
        invoiceMonth,
        accountId: paymentAccountId,
      });
    } catch (error) {
      Alert.alert('Erro', error instanceof Error ? error.message : 'Nao foi possivel pagar a fatura.');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
            <ArrowLeft size={22} color={colors.textPrimary} />
          </Pressable>
          <View style={styles.headerText}>
            <Text style={styles.title}>Meus cartoes</Text>
            <Text style={styles.subtitle}>Limite, compras parceladas e pagamento de fatura reais.</Text>
          </View>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Faturas em aberto</Text>
          <Text style={styles.summaryValue}>{formatCurrencyBRL(totalOpenInvoices)}</Text>
          <Text style={styles.summaryMeta}>{urgentAlerts} alerta(s) de vencimento nos proximos dias.</Text>
        </View>

        <View style={styles.actionsRow}>
          <Pressable style={styles.primaryAction} onPress={() => setCardModalVisible(true)}>
            <Plus color={colors.white} size={18} />
            <Text style={styles.primaryActionText}>Novo cartao</Text>
          </Pressable>
          <Pressable style={styles.secondaryAction} onPress={() => setChargeModalVisible(true)}>
            <Receipt color={colors.primary} size={18} />
            <Text style={styles.secondaryActionText}>Lancar compra</Text>
          </Pressable>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Conta usada para pagar a fatura</Text>
          <View style={styles.chipsWrap}>
            {activeAccounts.map((account) => (
              <Pressable
                key={account.id}
                onPress={() => setPaymentAccountId(account.id)}
                style={[styles.filterChip, paymentAccountId === account.id && styles.filterChipActive]}
              >
                <Text style={[styles.filterChipText, paymentAccountId === account.id && styles.filterChipTextActive]}>
                  {account.name}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Cartoes ativos</Text>
          {cardsQuery.isLoading ? (
            <ActivityIndicator />
          ) : cards.length ? (
            cards.map((card) => (
              <View key={card.id} style={[styles.cardVisual, { backgroundColor: card.color }]}>
                <View style={styles.cardHeader}>
                  <View>
                    <Text style={styles.cardInstitution}>{card.institution || 'Cartao'}</Text>
                    <Text style={styles.cardName}>{card.name}</Text>
                  </View>
                  <CreditCard color={colors.white} size={20} />
                </View>
                <Text style={styles.cardDigits}>•••• {card.lastDigits}</Text>
                <View style={styles.cardFooter}>
                  <View>
                    <Text style={styles.cardFooterLabel}>Limite usado</Text>
                    <Text style={styles.cardFooterValue}>{formatCurrencyBRL(card.usedLimitAmount)}</Text>
                  </View>
                  <View style={styles.cardFooterRight}>
                    <Text style={styles.cardFooterLabel}>Disponivel</Text>
                    <Text style={styles.cardFooterValue}>{formatCurrencyBRL(card.availableLimitAmount)}</Text>
                  </View>
                </View>
              </View>
            ))
          ) : (
            <Text style={styles.emptyText}>Cadastre seu primeiro cartao para gerar parcelas e faturas.</Text>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Faturas</Text>
          <View style={styles.listCard}>
            {invoices.length ? (
              invoices.map((invoice) => (
                <View key={`${invoice.cardId}-${invoice.invoiceMonth}`} style={styles.invoiceRow}>
                  <View style={styles.invoiceLeft}>
                    <Text style={styles.invoiceTitle}>{invoice.cardName}</Text>
                    <Text style={styles.invoiceMeta}>
                      {invoice.invoiceMonth} • vence {invoice.dueDate ? invoice.dueDate.split('-').reverse().join('/') : '--'}
                    </Text>
                    <Text style={styles.invoiceMeta}>
                      Aberto {formatCurrencyBRL(invoice.openAmount)} de {formatCurrencyBRL(invoice.invoiceAmount)}
                    </Text>
                  </View>
                  <Pressable
                    style={[styles.payButton, payInvoiceMutation.isPending && styles.payButtonDisabled]}
                    onPress={() => handlePayInvoice(invoice.cardId, invoice.invoiceMonth)}
                    disabled={payInvoiceMutation.isPending || invoice.openAmount <= 0}
                  >
                    {payInvoiceMutation.isPending ? (
                      <ActivityIndicator color={colors.white} />
                    ) : (
                      <Text style={styles.payButtonText}>Pagar</Text>
                    )}
                  </Pressable>
                </View>
              ))
            ) : (
              <Text style={styles.emptyText}>As faturas geradas pelas compras vao aparecer aqui.</Text>
            )}
          </View>
        </View>
      </ScrollView>

      <AddCardModal
        visible={cardModalVisible}
        submitting={createCardMutation.isPending}
        onClose={() => setCardModalVisible(false)}
        onSubmit={handleCreateCard}
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

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.xl,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
  },
  title: {
    ...typography.h1,
    color: colors.textPrimary,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  summaryCard: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  summaryLabel: {
    ...typography.caption,
    color: 'rgba(255,255,255,0.85)',
    fontWeight: '700',
  },
  summaryValue: {
    ...typography.h1,
    color: colors.white,
  },
  summaryMeta: {
    ...typography.body,
    color: colors.white,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  primaryAction: {
    flex: 1,
    minHeight: 48,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  primaryActionText: {
    ...typography.body,
    color: colors.white,
    fontWeight: '700',
  },
  secondaryAction: {
    flex: 1,
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  secondaryActionText: {
    ...typography.body,
    color: colors.primary,
    fontWeight: '700',
  },
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  filterChipActive: {
    backgroundColor: '#DBEAFE',
    borderColor: colors.primary,
  },
  filterChipText: {
    ...typography.caption,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: colors.primary,
  },
  cardVisual: {
    borderRadius: 24,
    padding: spacing.lg,
    gap: spacing.lg,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardInstitution: {
    ...typography.caption,
    color: 'rgba(255,255,255,0.85)',
    fontWeight: '700',
  },
  cardName: {
    ...typography.h2,
    color: colors.white,
    marginTop: spacing.xs,
  },
  cardDigits: {
    ...typography.body,
    color: colors.white,
    letterSpacing: 2,
    fontWeight: '700',
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardFooterRight: {
    alignItems: 'flex-end',
  },
  cardFooterLabel: {
    ...typography.caption,
    color: 'rgba(255,255,255,0.8)',
  },
  cardFooterValue: {
    ...typography.body,
    color: colors.white,
    fontWeight: '700',
    marginTop: spacing.xs,
  },
  listCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.md,
  },
  invoiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  invoiceLeft: {
    flex: 1,
  },
  invoiceTitle: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  invoiceMeta: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  payButton: {
    minWidth: 84,
    minHeight: 40,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  payButtonDisabled: {
    opacity: 0.6,
  },
  payButtonText: {
    ...typography.caption,
    color: colors.white,
    fontWeight: '700',
  },
  emptyText: {
    ...typography.body,
    color: colors.textSecondary,
  },
});
