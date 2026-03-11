import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { ArrowLeft, Calendar, X } from 'lucide-react-native';

import { useAuthenticatedUser } from '../features/auth/hooks/useAuthenticatedUser';
import { endOfMonth, formatMonthDate, isoDate, startOfMonth } from '../features/finance/utils';
import { useReports } from '../features/reports/hooks/useReports';
import { formatCurrencyBRL } from '../utils/format';
import { colors, radius, spacing, typography } from '../theme';

export default function ReportsScreen({ navigation }: any) {
  const currentUser = useAuthenticatedUser();
  const now = new Date();
  const [filterVisible, setFilterVisible] = useState(false);
  const [from, setFrom] = useState(isoDate(startOfMonth(now)));
  const [to, setTo] = useState(isoDate(endOfMonth(now)));
  const [tempFrom, setTempFrom] = useState(from);
  const [tempTo, setTempTo] = useState(to);
  const reportsQuery = useReports(currentUser?.id, { from, to });

  const report = reportsQuery.data;
  const currentMonthDate = formatMonthDate();

  const handleApply = () => {
    setFrom(tempFrom);
    setTo(tempTo);
    setFilterVisible(false);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
            <ArrowLeft size={22} color={colors.textPrimary} />
          </Pressable>
          <View style={styles.headerText}>
            <Text style={styles.title}>Relatorios</Text>
            <Text style={styles.subtitle}>Receitas, despesas e parcelas por competencia.</Text>
          </View>
          <Pressable style={styles.filterButton} onPress={() => setFilterVisible(true)}>
            <Calendar size={18} color={colors.textPrimary} />
          </Pressable>
        </View>

        <Text style={styles.periodText}>
          Periodo: {from.split('-').reverse().join('/')} ate {to.split('-').reverse().join('/')}
        </Text>

        <View style={styles.summaryRow}>
          <SummaryCard label="Receitas" value={formatCurrencyBRL(report?.income ?? 0)} tone="success" />
          <SummaryCard label="Despesas" value={formatCurrencyBRL(report?.expense ?? 0)} tone="danger" />
        </View>

        <View style={styles.balanceCard}>
          {reportsQuery.isLoading ? (
            <ActivityIndicator />
          ) : (
            <>
              <Text style={styles.balanceLabel}>Saldo do periodo</Text>
              <Text style={[styles.balanceValue, (report?.balance ?? 0) < 0 && styles.dangerText]}>
                {formatCurrencyBRL(report?.balance ?? 0)}
              </Text>
              <Text style={styles.balanceMeta}>Taxa de poupanca: {report?.savingsRate?.toFixed(1) ?? '0.0'}%</Text>
            </>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Maiores categorias</Text>
          <View style={styles.listCard}>
            {report?.topCategories.length ? (
              report.topCategories.map((item) => (
                <View key={item.category} style={styles.categoryRow}>
                  <View style={styles.categoryLabelRow}>
                    <View style={[styles.categoryDot, { backgroundColor: item.color }]} />
                    <Text style={styles.categoryLabel}>{item.category}</Text>
                  </View>
                  <View style={styles.categoryValueRow}>
                    <Text style={styles.categoryValue}>{formatCurrencyBRL(item.amount)}</Text>
                    <Text style={styles.categoryShare}>{item.share.toFixed(1)}%</Text>
                  </View>
                </View>
              ))
            ) : (
              <Text style={styles.emptyText}>Nenhuma categoria encontrada para o periodo.</Text>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Por forma de pagamento</Text>
          <View style={styles.listCard}>
            {report?.paymentMethods.length ? (
              report.paymentMethods.map((item) => (
                <View key={item.label} style={styles.categoryRow}>
                  <Text style={styles.categoryLabel}>{item.label}</Text>
                  <Text style={styles.categoryValue}>{formatCurrencyBRL(item.amount)}</Text>
                </View>
              ))
            ) : (
              <Text style={styles.emptyText}>Nenhum pagamento reportavel encontrado.</Text>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Serie resumida</Text>
          <View style={styles.listCard}>
            {report?.lineSeries.map((point, index) => (
              <View key={`${currentMonthDate}-${index}`} style={styles.seriesRow}>
                <Text style={styles.categoryLabel}>Bloco {index + 1}</Text>
                <Text style={styles.categoryValue}>{formatCurrencyBRL(point.value)}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      <Modal visible={filterVisible} transparent animationType="slide" onRequestClose={() => setFilterVisible(false)}>
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={() => setFilterVisible(false)} />
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filtrar periodo</Text>
              <Pressable onPress={() => setFilterVisible(false)}>
                <X size={22} color={colors.textPrimary} />
              </Pressable>
            </View>
            <TextInput
              placeholder="Inicio (YYYY-MM-DD)"
              value={tempFrom}
              onChangeText={setTempFrom}
              style={styles.modalInput}
              placeholderTextColor={colors.textSecondary}
            />
            <TextInput
              placeholder="Fim (YYYY-MM-DD)"
              value={tempTo}
              onChangeText={setTempTo}
              style={styles.modalInput}
              placeholderTextColor={colors.textSecondary}
            />
            <View style={styles.modalActions}>
              <Pressable style={styles.secondaryButton} onPress={() => setFilterVisible(false)}>
                <Text style={styles.secondaryButtonText}>Cancelar</Text>
              </Pressable>
              <Pressable style={styles.primaryButton} onPress={handleApply}>
                <Text style={styles.primaryButtonText}>Aplicar</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'success' | 'danger';
}) {
  return (
    <View style={[styles.summaryCard, tone === 'success' ? styles.successCard : styles.dangerCard]}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
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
    paddingBottom: 80,
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
  filterButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  periodText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  summaryCard: {
    flex: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.xs,
  },
  successCard: {
    backgroundColor: '#10B981',
  },
  dangerCard: {
    backgroundColor: '#F43F5E',
  },
  summaryLabel: {
    ...typography.caption,
    color: colors.white,
    fontWeight: '700',
  },
  summaryValue: {
    ...typography.body,
    color: colors.white,
    fontWeight: '700',
  },
  balanceCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  balanceLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  balanceValue: {
    ...typography.h1,
    color: colors.textPrimary,
  },
  balanceMeta: {
    ...typography.body,
    color: colors.textSecondary,
  },
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  listCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.md,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  categoryLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  categoryDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  categoryLabel: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  categoryValueRow: {
    alignItems: 'flex-end',
  },
  categoryValue: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  categoryShare: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  seriesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  emptyText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  dangerText: {
    color: colors.danger,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15, 23, 42, 0.35)',
  },
  modalBackdrop: {
    flex: 1,
  },
  modalSheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: spacing.lg,
    gap: spacing.md,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalTitle: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  modalInput: {
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    color: colors.textPrimary,
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  secondaryButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  primaryButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    ...typography.body,
    color: colors.white,
    fontWeight: '700',
  },
});
