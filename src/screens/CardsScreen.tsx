import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AlertTriangle, ChevronLeft, Plus, Receipt } from 'lucide-react-native';

import { AddCardBillsModal } from '../components/AddCardBillsModal';
import { AddCardModal } from '../components/AddCardModal';
import { useAccounts } from '../features/accounts/hooks/useAccounts';
import { useAuthenticatedUser } from '../features/auth/hooks/useAuthenticatedUser';
import {
  useCardInvoices,
  useCards,
  useCreateCardMutation,
  usePayCardInvoiceMutation,
  useRecordCardChargeMutation,
} from '../features/cards/hooks/useCards';
import { useFinanceCategories } from '../features/transactions/hooks/useTransactions';
import { colors, radius, spacing, typography } from '../theme';
import { formatCurrencyBRL } from '../utils/format';

function getGradient(color: string): [string, string] {
  if (color === '#0F172A') {
    return ['#334155', '#0F172A'];
  }

  return [color, `${color}CC`];
}

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
  const urgentAlerts = invoices.filter((invoice) => invoice.isDueSoon);

  useEffect(() => {
    setPaymentAccountId((current) => current || activeAccounts[0]?.id || '');
  }, [activeAccounts]);

  const paymentAccountName = useMemo(
    () => activeAccounts.find((account) => account.id === paymentAccountId)?.name ?? 'Selecione uma conta',
    [activeAccounts, paymentAccountId],
  );

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
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <LinearGradient
            colors={[colors.primary, colors.primary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.headerGradient}
          >
            <SafeAreaView style={styles.safeArea}>
              <View style={styles.headerContent}>
                <View style={styles.headerTop}>
                  <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
                    <ChevronLeft color={colors.white} size={24} />
                  </Pressable>

                  <Text style={styles.headerTitle}>Meus Cartoes</Text>

                  <Pressable style={styles.addButton} onPress={() => setCardModalVisible(true)}>
                    <Plus color={colors.white} size={20} />
                    <Text style={styles.addButtonText}>Novo</Text>
                  </Pressable>
                </View>

                <View style={styles.statsRow}>
                  <View style={styles.statItem}>
                    <Text style={styles.statLabel}>Total Faturas</Text>
                    <Text style={styles.statValue}>{formatCurrencyBRL(totalOpenInvoices)}</Text>
                  </View>

                  <View style={styles.statDivider} />

                  <View style={styles.statItem}>
                    <Text style={styles.statLabel}>Alertas</Text>
                    <Text style={[styles.statValue, styles.alertValue]}>{urgentAlerts.length}</Text>
                  </View>
                </View>
              </View>
            </SafeAreaView>
          </LinearGradient>
        </View>

        <View style={styles.mainContent}>
          {urgentAlerts.length ? (
            <View style={styles.alertCard}>
              <View style={styles.alertIcon}>
                <AlertTriangle color="#D97706" size={20} />
              </View>
              <View style={styles.alertTextContent}>
                <Text style={styles.alertTitle}>{urgentAlerts[0].cardName}</Text>
                <Text style={styles.alertSubtitle}>
                  {urgentAlerts[0].invoiceMonth} • {formatCurrencyBRL(urgentAlerts[0].openAmount)}
                </Text>
              </View>
              <Pressable
                style={styles.alertAction}
                onPress={() => handlePayInvoice(urgentAlerts[0].cardId, urgentAlerts[0].invoiceMonth)}
                disabled={payInvoiceMutation.isPending}
              >
                {payInvoiceMutation.isPending ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Text style={styles.alertActionText}>Pagar</Text>
                )}
              </Pressable>
            </View>
          ) : null}

          <View style={styles.paymentAccountCard}>
            <Text style={styles.paymentTitle}>Conta usada para pagar a fatura</Text>
            <View style={styles.paymentChips}>
              {activeAccounts.map((account) => (
                <Pressable
                  key={account.id}
                  onPress={() => setPaymentAccountId(account.id)}
                  style={[
                    styles.paymentChip,
                    paymentAccountId === account.id && styles.paymentChipActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.paymentChipText,
                      paymentAccountId === account.id && styles.paymentChipTextActive,
                    ]}
                  >
                    {account.name}
                  </Text>
                </Pressable>
              ))}
            </View>
            {!activeAccounts.length ? (
              <Text style={styles.paymentHint}>Cadastre uma conta para pagar faturas.</Text>
            ) : (
              <Text style={styles.paymentHint}>Selecionada: {paymentAccountName}</Text>
            )}
          </View>

          <Text style={styles.sectionLabel}>Cartoes Ativos</Text>

          {cardsQuery.isLoading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator />
            </View>
          ) : cards.length ? (
            cards.map((card) => {
              const limitProgress = card.limitAmount > 0 ? (card.usedLimitAmount / card.limitAmount) * 100 : 0;

              return (
                <View key={card.id} style={styles.cardWrapper}>
                  <Pressable>
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
                          <Text style={styles.cardInst}>{card.institution || 'Cartao'}</Text>
                          <Text style={styles.cardName}>{card.name}</Text>
                        </View>
                        <Text style={styles.cardNetwork}>{card.network}</Text>
                      </View>
                      <Text style={styles.cardDigits}>•••• •••• •••• {card.lastDigits}</Text>
                      <View style={styles.cardFooter}>
                        <View>
                          <Text style={styles.cardLabel}>Vencimento</Text>
                          <Text style={styles.cardInfo}>Dia {card.dueDay}</Text>
                        </View>
                        <View style={styles.cardFooterRight}>
                          <Text style={styles.cardLabel}>Limite Disp.</Text>
                          <Text style={styles.cardInfo}>{formatCurrencyBRL(card.availableLimitAmount)}</Text>
                        </View>
                      </View>
                    </LinearGradient>
                  </Pressable>

                  <View style={styles.cardStatsRow}>
                    <View style={styles.cardMiniStat}>
                      <Text style={styles.miniStatLabel}>Fatura Atual</Text>
                      <Text style={styles.miniStatValue}>{formatCurrencyBRL(card.openAmount)}</Text>
                    </View>
                    <View style={styles.miniStatDivider} />
                    <View style={styles.cardMiniStat}>
                      <Text style={styles.miniStatLabel}>Limite Usado</Text>
                      <View style={styles.progressContainer}>
                        <View style={[styles.progressBar, { width: `${Math.min(limitProgress, 100)}%` }]} />
                      </View>
                    </View>
                  </View>
                </View>
              );
            })
          ) : (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>Nenhum cartao cadastrado</Text>
              <Text style={styles.emptyText}>Cadastre seu primeiro cartao para gerar compras parceladas e faturas reais.</Text>
            </View>
          )}

          <View style={styles.invoiceCard}>
            <Text style={styles.invoiceCardTitle}>Faturas abertas</Text>
            {invoices.length ? (
              invoices.map((invoice) => (
                <View key={`${invoice.cardId}-${invoice.invoiceMonth}`} style={styles.invoiceRow}>
                  <View style={styles.invoiceLeft}>
                    <Text style={styles.invoiceTitle}>{invoice.cardName}</Text>
                    <Text style={styles.invoiceMeta}>
                      {invoice.invoiceMonth} • aberto {formatCurrencyBRL(invoice.openAmount)}
                    </Text>
                  </View>
                  <Pressable
                    style={[styles.invoicePayButton, (payInvoiceMutation.isPending || invoice.openAmount <= 0) && styles.disabledButton]}
                    onPress={() => handlePayInvoice(invoice.cardId, invoice.invoiceMonth)}
                    disabled={payInvoiceMutation.isPending || invoice.openAmount <= 0}
                  >
                    {payInvoiceMutation.isPending ? (
                      <ActivityIndicator size="small" color={colors.white} />
                    ) : (
                      <Text style={styles.invoicePayText}>Pagar</Text>
                    )}
                  </Pressable>
                </View>
              ))
            ) : (
              <Text style={styles.emptyText}>As faturas geradas pelas compras vao aparecer aqui.</Text>
            )}
          </View>

          <Pressable style={styles.quickAddExpense} onPress={() => setChargeModalVisible(true)}>
            <Receipt size={20} color={colors.primary} />
            <Text style={styles.quickAddText}>Lancar compra</Text>
          </Pressable>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    minHeight: 220,
    width: '100%',
    backgroundColor: 'transparent',
  },
  headerGradient: {
    flex: 1,
    paddingTop: Platform.OS === 'ios' ? 0 : spacing.md,
    paddingBottom: spacing.xl + 10,
    borderBottomLeftRadius: radius.lg * 1.5,
    borderBottomRightRadius: radius.lg * 1.5,
  },
  headerContent: {
    paddingHorizontal: spacing.xl,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    marginBottom: spacing.xl,
  },
  headerTitle: {
    ...typography.h2,
    color: colors.white,
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  addButtonText: {
    ...typography.caption,
    color: colors.white,
    fontWeight: '700',
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  statItem: {
    flex: 1,
  },
  statLabel: {
    ...typography.caption,
    color: 'rgba(255,255,255,0.8)',
  },
  statValue: {
    ...typography.h2,
    color: colors.white,
    marginTop: spacing.xs,
  },
  alertValue: {
    color: '#FCD34D',
  },
  statDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.15)',
    marginHorizontal: spacing.md,
  },
  mainContent: {
    paddingHorizontal: spacing.xl,
    marginTop: -28,
    gap: spacing.md,
  },
  alertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF7ED',
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  alertIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFEDD5',
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
  alertAction: {
    minWidth: 64,
    minHeight: 36,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: '#FDBA74',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  alertActionText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '700',
  },
  paymentAccountCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  paymentTitle: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '700',
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
    backgroundColor: '#EFF6FF',
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
  paymentHint: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  sectionLabel: {
    ...typography.h2,
    color: colors.textPrimary,
    marginTop: spacing.sm,
  },
  loadingWrap: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  cardWrapper: {
    gap: spacing.sm,
  },
  cardVisual: {
    borderRadius: 28,
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
    backgroundColor: 'rgba(255,255,255,0.08)',
    top: -70,
    right: -35,
  },
  cardDecorator2: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255,255,255,0.08)',
    bottom: -45,
    left: -15,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardInst: {
    ...typography.caption,
    color: 'rgba(255,255,255,0.8)',
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
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '700',
  },
  cardInfo: {
    ...typography.body,
    color: colors.white,
    fontWeight: '700',
    marginTop: spacing.xs,
  },
  cardStatsRow: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    alignItems: 'center',
  },
  cardMiniStat: {
    flex: 1,
  },
  miniStatLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  miniStatValue: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '700',
    marginTop: spacing.xs,
  },
  miniStatDivider: {
    width: 1,
    height: '100%',
    backgroundColor: colors.border,
    marginHorizontal: spacing.md,
  },
  progressContainer: {
    marginTop: spacing.sm,
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: colors.mutedSurface,
  },
  progressBar: {
    height: '100%',
    backgroundColor: colors.primary,
  },
  invoiceCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.md,
  },
  invoiceCardTitle: {
    ...typography.h2,
    color: colors.textPrimary,
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
  invoicePayButton: {
    minWidth: 76,
    minHeight: 38,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  invoicePayText: {
    ...typography.caption,
    color: colors.white,
    fontWeight: '700',
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
});
