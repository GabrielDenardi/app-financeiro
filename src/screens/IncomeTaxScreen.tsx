import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Calendar, Check, ChevronDown, ExternalLink, FileSpreadsheet, FileText, Paperclip } from 'lucide-react-native';

import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { PageHeader } from '../components/PageHeader';
import { PageShell } from '../components/PageShell';
import { useAuthenticatedUser } from '../features/auth/hooks/useAuthenticatedUser';
import { useExportIncomeTax, useIncomeTaxReport } from '../features/incomeTax/hooks/useIncomeTax';
import { UpgradePaywallSheet } from '../features/plans/components/UpgradePaywallSheet';
import { useCurrentPlan } from '../features/plans/hooks';
import { getUpgradeMessage } from '../features/plans/plans';
import { radius, spacing, typography, type AppColors, useThemeColors } from '../theme';
import { formatCurrencyBRL } from '../utils/format';

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, index) => CURRENT_YEAR - index);

export default function IncomeTaxScreen({ navigation }: any) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const user = useAuthenticatedUser();
  const currentPlan = useCurrentPlan(user?.id);
  const allowed = currentPlan.entitlements.dataImportExport;
  const [year, setYear] = useState(CURRENT_YEAR - 1);
  const [yearOpen, setYearOpen] = useState(false);
  const [paywallOpen, setPaywallOpen] = useState(false);
  const reportQuery = useIncomeTaxReport(user?.id, year, allowed);
  const exportMutation = useExportIncomeTax();
  const report = reportQuery.data;

  const [exportingFormat, setExportingFormat] = useState<'pdf' | 'xlsx' | null>(null);

  const onExport = async (format: 'pdf' | 'xlsx') => {
    if (!allowed) {
      setPaywallOpen(true);
      return;
    }

    if (!report) {
      Alert.alert('Aguarde', 'O relatório ainda está sendo carregado.');
      return;
    }

    setExportingFormat(format);
    try {
      await exportMutation.mutateAsync({ report, format });
    } catch (error) {
      Alert.alert('Erro', error instanceof Error ? error.message : 'Não foi possível gerar o arquivo.');
    } finally {
      setExportingFormat(null);
    }
  };

  if (!allowed) {
    return (
      <PageShell>
        <PageHeader title="Imposto de Renda" onBackPress={() => navigation.goBack()} />
        <Card style={styles.card}>
          <View style={styles.icon}>
            <FileText color={colors.textSecondary} size={28} />
          </View>
          <Text style={styles.cardTitle}>Recurso do Plano Pro</Text>
          <Text style={styles.cardSub}>{getUpgradeMessage('Exportação para o Imposto de Renda')}</Text>
          <Pressable
            accessibilityRole="button"
            style={styles.unlockButton}
            onPress={() => setPaywallOpen(true)}
          >
            <Text style={styles.unlockButtonText}>Ver opções de desbloqueio</Text>
          </Pressable>
        </Card>

        <UpgradePaywallSheet
          visible={paywallOpen}
          onClose={() => setPaywallOpen(false)}
          featureTitle="Imposto de Renda"
          description="Gere o relatório anual organizado por categoria e exporte em PDF ou Excel para a sua declaração — recurso do Plano Pro."
        />
      </PageShell>
    );
  }

  return (
    <PageShell
      refreshControl={
        <RefreshControl
          refreshing={reportQuery.isRefetching}
          onRefresh={() => reportQuery.refetch()}
          tintColor={colors.primary}
        />
      }
    >
      <PageHeader title="Imposto de Renda" onBackPress={() => navigation.goBack()} />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Selecionar ano-base, atual ${year}`}
        accessibilityState={{ expanded: yearOpen }}
        style={styles.selector}
        onPress={() => setYearOpen((open) => !open)}
      >
        <Calendar size={16} color={colors.textSecondary} />
        <Text style={styles.selectorText}>Ano-base {year}</Text>
        <ChevronDown size={16} color={colors.textSecondary} />
      </Pressable>

      {yearOpen ? (
        <Card style={styles.yearList}>
          {YEARS.map((option) => (
            <Pressable
              key={option}
              style={styles.yearRow}
              onPress={() => {
                setYear(option);
                setYearOpen(false);
              }}
            >
              <Text style={[styles.yearText, option === year && styles.yearTextOn]}>{option}</Text>
              {option === year ? <Check size={18} color={colors.primaryLight} /> : null}
            </Pressable>
          ))}
        </Card>
      ) : null}

      <View style={styles.rowGap}>
        <View style={[styles.sum, { backgroundColor: colors.success }]}>
          <Text style={styles.sumLabel}>Rendimentos</Text>
          <Text style={styles.sumValue}>{formatCurrencyBRL(report?.totalIncome ?? 0)}</Text>
        </View>
        <View style={[styles.sum, { backgroundColor: colors.danger }]}>
          <Text style={styles.sumLabel}>Despesas</Text>
          <Text style={styles.sumValue}>{formatCurrencyBRL(report?.totalExpense ?? 0)}</Text>
        </View>
      </View>

      <Card style={styles.balanceRow}>
        <View style={styles.flex}>
          <Text style={styles.balanceLabel}>Despesas dedutíveis</Text>
          <Text style={styles.balanceValue}>{formatCurrencyBRL(report?.totalDeductible ?? 0)}</Text>
        </View>
        <View style={styles.flex}>
          <Text style={styles.balanceLabel}>Comprovantes</Text>
          <Text style={styles.balanceValue}>{report?.receipts.length ?? 0}</Text>
        </View>
      </Card>

      {reportQuery.isLoading ? (
        <Card style={styles.cardCenter}>
          <ActivityIndicator color={colors.primaryLight} />
        </Card>
      ) : null}

      {reportQuery.isError ? (
        <Card style={styles.cardCenter}>
          <Text style={styles.cardSub}>Não foi possível carregar os dados do ano.</Text>
          <Pressable style={styles.retry} onPress={() => reportQuery.refetch()}>
            <Text style={styles.retryText}>Tentar novamente</Text>
          </Pressable>
        </Card>
      ) : null}

      {report && !reportQuery.isLoading && report.transactionCount === 0 ? (
        <Card style={styles.cardCenter}>
          <Text style={styles.cardTitle}>Nenhuma movimentação em {year}</Text>
          <Text style={styles.cardSub}>
            Não há lançamentos neste ano-base. Selecione outro ano no seletor acima.
          </Text>
        </Card>
      ) : null}

      {report && !reportQuery.isLoading && report.transactionCount > 0
        ? report.sections.map((section) => (
            <Card key={section.key} style={styles.card}>
              <Text style={styles.section}>{section.title}</Text>
              <Text style={styles.desc}>{section.description}</Text>
              {section.lines.length ? (
                section.lines.map((line) => (
                  <View key={line.category} style={styles.line}>
                    <Text style={styles.lineName}>{line.category}</Text>
                    <Text style={styles.lineValue}>{formatCurrencyBRL(line.amount)}</Text>
                  </View>
                ))
              ) : (
                <Text style={styles.desc}>Sem lançamentos nesta seção.</Text>
              )}
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total</Text>
                <Text style={styles.totalValue}>{formatCurrencyBRL(section.total)}</Text>
              </View>
            </Card>
          ))
        : null}

      {report && report.receipts.length > 0 ? (
        <Card style={styles.card}>
          <View style={styles.noteHead}>
            <Paperclip size={16} color={colors.textSecondary} />
            <Text style={styles.section}>Comprovantes anexados</Text>
          </View>
          {report.receipts.map((receipt, index) => (
            <Pressable
              key={`${receipt.fileName}-${index}`}
              accessibilityRole="button"
              accessibilityLabel={`Abrir comprovante ${receipt.transactionTitle}`}
              style={styles.receiptRow}
              disabled={!receipt.url}
              onPress={() => receipt.url && Linking.openURL(receipt.url)}
            >
              <View style={styles.receiptInfo}>
                <Text style={styles.lineName} numberOfLines={1}>
                  {receipt.transactionTitle}
                </Text>
                <Text style={styles.receiptMeta}>{receipt.fileName}</Text>
              </View>
              {receipt.url ? <ExternalLink size={16} color={colors.primaryLight} /> : null}
            </Pressable>
          ))}
        </Card>
      ) : null}

      <View style={styles.actions}>
        <Button
          label="Exportar PDF"
          icon={<FileText size={18} color={colors.white} />}
          fullWidth
          onPress={() => onExport('pdf')}
          disabled={!report || exportMutation.isPending}
          loading={exportingFormat === 'pdf'}
        />
        <Button
          label="Exportar planilha"
          variant="secondary"
          icon={<FileSpreadsheet size={18} color={colors.primary} />}
          fullWidth
          onPress={() => onExport('xlsx')}
          disabled={!report || exportMutation.isPending}
          loading={exportingFormat === 'xlsx'}
        />
      </View>

      <Card style={styles.card}>
        <View style={styles.noteHead}>
          <Paperclip size={16} color={colors.textSecondary} />
          <Text style={styles.section}>Como usar</Text>
        </View>
        <Text style={styles.desc}>
          Este é um relatório de apoio com seus rendimentos, despesas e comprovantes do ano. Ele não importa
          diretamente no programa da Receita Federal — use os valores e os recibos como referência para
          preencher a sua declaração.
        </Text>
      </Card>
    </PageShell>
  );
}

const createStyles = (colors: AppColors) =>
  StyleSheet.create({
    card: {
      gap: spacing.sm,
    },
    cardCenter: {
      alignItems: 'center',
      gap: spacing.md,
    },
    icon: {
      width: 56,
      height: 56,
      borderRadius: radius.pill,
      backgroundColor: colors.mutedSurface,
      alignItems: 'center',
      justifyContent: 'center',
      alignSelf: 'center',
    },
    cardTitle: {
      ...typography.h2,
      color: colors.textPrimary,
      textAlign: 'center',
    },
    cardSub: {
      ...typography.body,
      color: colors.textSecondary,
      lineHeight: 19,
      textAlign: 'center',
    },
    unlockButton: {
      minHeight: 48,
      borderRadius: radius.md,
      backgroundColor: colors.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: spacing.xs,
    },
    unlockButtonText: {
      ...typography.body,
      color: colors.white,
      fontWeight: '800',
    },
    selector: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      gap: spacing.sm,
    },
    selectorText: {
      ...typography.caption,
      color: colors.textPrimary,
      fontWeight: '600',
    },
    yearList: {
      gap: 0,
    },
    yearRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    yearText: {
      ...typography.body,
      color: colors.textPrimary,
    },
    yearTextOn: {
      color: colors.primary,
      fontWeight: '800',
    },
    rowGap: {
      flexDirection: 'row',
      gap: spacing.md,
    },
    sum: {
      flex: 1,
      borderRadius: radius.lg,
      padding: spacing.md,
      gap: spacing.xs,
    },
    sumLabel: {
      ...typography.caption,
      color: colors.white,
      fontWeight: '600',
    },
    sumValue: {
      ...typography.body,
      color: colors.white,
      fontWeight: '800',
    },
    balanceRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: spacing.md,
    },
    flex: {
      flex: 1,
    },
    balanceLabel: {
      ...typography.caption,
      color: colors.textSecondary,
    },
    balanceValue: {
      ...typography.body,
      color: colors.textPrimary,
      fontWeight: '800',
      marginTop: 2,
    },
    section: {
      ...typography.h2,
      color: colors.textPrimary,
    },
    desc: {
      ...typography.body,
      color: colors.textSecondary,
      lineHeight: 19,
    },
    line: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: spacing.xs,
    },
    lineName: {
      ...typography.body,
      color: colors.textPrimary,
      flex: 1,
    },
    lineValue: {
      ...typography.body,
      color: colors.textPrimary,
      fontWeight: '700',
    },
    totalRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: spacing.sm,
      marginTop: spacing.xs,
    },
    totalLabel: {
      ...typography.body,
      color: colors.textSecondary,
      fontWeight: '700',
    },
    totalValue: {
      ...typography.body,
      color: colors.textPrimary,
      fontWeight: '800',
    },
    actions: {
      gap: spacing.sm,
    },
    receiptRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.md,
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    receiptInfo: {
      flex: 1,
      minWidth: 0,
    },
    receiptMeta: {
      ...typography.caption,
      color: colors.textSecondary,
      marginTop: 2,
    },
    retry: {
      backgroundColor: colors.primaryLight,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    retryText: {
      ...typography.caption,
      color: colors.white,
      fontWeight: '700',
    },
    noteHead: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
  });
