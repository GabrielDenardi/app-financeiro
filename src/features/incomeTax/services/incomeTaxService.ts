import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Linking, Platform } from 'react-native';
import * as XLSX from 'xlsx';

import { requireCurrentUserId } from '../../../lib/auth';
import { supabase } from '../../../lib/supabase';
import { formatCurrencyBRL } from '../../../utils/format';
import { getPlanEntitlements, getUpgradeMessage, normalizePlanId } from '../../plans/plans';
import type { ProfilePlanRow } from '../../plans/types';
import { listTransactionFeed } from '../../transactions/services/transactionsService';
import type { TransactionFeedItem } from '../../transactions/types';
import type {
  IncomeTaxLine,
  IncomeTaxReceipt,
  IncomeTaxReport,
  IncomeTaxSection,
} from '../types';


type AttachmentRow = {
  transaction_id: string | null;
  attachment_kind: string;
  storage_bucket: string;
  storage_path: string;
  file_name: string;
};

const RECEIPTS_BUCKET = 'transaction-receipts';

/** Fontes internas que não representam movimentações reais e ficam fora do relatório fiscal. */
const EXCLUDED_SOURCES = new Set([
  'transfer',
  'group_settlement',
  'goal_contribution',
  'card_payment',
]);

/**
 * Palavras-chave usadas para classificar despesas como potencialmente dedutíveis no IRPF
 * (saúde e educação). É uma heurística sobre as categorias genéricas do app e pode ser
 * refinada com um mapa explícito de código de categoria → seção do IRPF.
 */
const DEDUCTIBLE_KEYWORDS = [
  'saude',
  'medic',
  'plano de saude',
  'hospital',
  'farmacia',
  'odonto',
  'dentista',
  'educacao',
  'escola',
  'faculdade',
  'universidade',
  'mensalidade',
  'curso',
  'previdencia',
];

function normalizeText(value: unknown) {
  return String(value ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

function isDeductibleCategory(category: string) {
  const normalized = normalizeText(category);
  return DEDUCTIBLE_KEYWORDS.some((keyword) => normalized.includes(keyword));
}

function formatBrDate(dateISO: string | null): string {
  if (!dateISO) {
    return '--';
  }

  const [year, month, day] = dateISO.slice(0, 10).split('-');
  if (!year || !month || !day) {
    return '--';
  }

  return `${day}/${month}/${year}`;
}

function buildLines(items: TransactionFeedItem[]): IncomeTaxLine[] {
  const totals = new Map<string, IncomeTaxLine>();

  items.forEach((item) => {
    const current = totals.get(item.category) ?? { category: item.category, amount: 0, count: 0 };
    current.amount += item.amount;
    current.count += 1;
    totals.set(item.category, current);
  });

  return [...totals.values()]
    .map((line) => ({ ...line, amount: Number(line.amount.toFixed(2)) }))
    .sort((left, right) => right.amount - left.amount);
}

function sumAmount(items: TransactionFeedItem[]) {
  return Number(items.reduce((sum, item) => sum + item.amount, 0).toFixed(2));
}

async function ensureExportAllowed(userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('subscription_plan, trial_ends_at')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  const entitlements = getPlanEntitlements(
    normalizePlanId((data as ProfilePlanRow | null)?.subscription_plan),
    (data as ProfilePlanRow | null)?.trial_ends_at,
  );
  if (!entitlements.dataImportExport) {
    throw new Error(getUpgradeMessage('Exportar para o Imposto de Renda'));
  }
}

async function listReceipts(
  userId: string,
  itemsById: Map<string, TransactionFeedItem>,
): Promise<IncomeTaxReceipt[]> {
  const transactionIds = [...itemsById.keys()];
  if (transactionIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from('transaction_attachments')
    .select('transaction_id, attachment_kind, storage_bucket, storage_path, file_name')
    .eq('user_id', userId)
    .in('transaction_id', transactionIds);

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data as AttachmentRow[] | null) ?? [];
  if (rows.length === 0) {
    return [];
  }

  const paths = rows.map((row) => row.storage_path);
  const { data: signed, error: signedError } = await supabase.storage
    .from(RECEIPTS_BUCKET)
    .createSignedUrls(paths, 60 * 60);

  if (signedError) {
    throw new Error(signedError.message);
  }

  const urlByPath = new Map<string, string>();
  (signed ?? []).forEach((entry) => {
    if (entry.path && entry.signedUrl) {
      urlByPath.set(entry.path, entry.signedUrl);
    }
  });

  return rows.map((row) => {
    const transaction = row.transaction_id ? itemsById.get(row.transaction_id) : undefined;
    return {
      transactionTitle: transaction?.title ?? row.file_name,
      date: transaction?.occurredOn ?? transaction?.dateISO ?? null,
      fileName: row.file_name,
      kind: row.attachment_kind,
      url: urlByPath.get(row.storage_path) ?? null,
    };
  });
}

export async function getIncomeTaxReport(year: number): Promise<IncomeTaxReport> {
  const userId = await requireCurrentUserId();
  await ensureExportAllowed(userId);

  const feed = await listTransactionFeed(userId, {
    from: `${year}-01-01`,
    to: `${year}-12-31`,
  });

  const reportable = feed.filter((item) => !EXCLUDED_SOURCES.has(item.sourceType ?? 'manual'));
  const income = reportable.filter((item) => item.type === 'income');
  const expenses = reportable.filter((item) => item.type === 'expense');
  const deductible = expenses.filter((item) => isDeductibleCategory(item.category));
  const others = expenses.filter((item) => !isDeductibleCategory(item.category));

  const sections: IncomeTaxSection[] = [
    {
      key: 'rendimentos',
      title: 'Rendimentos',
      description: 'Entradas recebidas no ano-base, agrupadas por categoria.',
      lines: buildLines(income),
      total: sumAmount(income),
    },
    {
      key: 'dedutiveis',
      title: 'Despesas potencialmente dedutíveis',
      description: 'Gastos com saúde, educação e previdência que costumam ser dedutíveis.',
      lines: buildLines(deductible),
      total: sumAmount(deductible),
    },
    {
      key: 'outras',
      title: 'Outras despesas / pagamentos',
      description: 'Demais saídas do ano-base, agrupadas por categoria.',
      lines: buildLines(others),
      total: sumAmount(others),
    },
  ];

  const itemsById = new Map<string, TransactionFeedItem>();
  reportable.forEach((item) => {
    // Apenas transações reais possuem anexos; parcelas de cartão usam ids prefixados.
    if (!item.id.startsWith('installment-')) {
      itemsById.set(item.id, item);
    }
  });

  const receipts = await listReceipts(userId, itemsById);

  return {
    year,
    sections,
    totalIncome: sumAmount(income),
    totalDeductible: sumAmount(deductible),
    totalExpense: sumAmount(expenses),
    transactionCount: reportable.length,
    receipts,
    generatedAt: new Date().toISOString(),
  };
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildReportHtml(report: IncomeTaxReport): string {
  const sectionsHtml = report.sections
    .map((section) => {
      const rows = section.lines.length
        ? section.lines
            .map(
              (line) =>
                `<tr><td>${escapeHtml(line.category)}</td><td class="num">${line.count}</td><td class="num">${formatCurrencyBRL(line.amount)}</td></tr>`,
            )
            .join('')
        : '<tr><td colspan="3" class="empty">Sem lançamentos nesta seção.</td></tr>';

      return `
        <h2>${escapeHtml(section.title)}</h2>
        <p class="desc">${escapeHtml(section.description)}</p>
        <table>
          <thead><tr><th>Categoria</th><th class="num">Lançamentos</th><th class="num">Total</th></tr></thead>
          <tbody>${rows}</tbody>
          <tfoot><tr><td>Total</td><td></td><td class="num">${formatCurrencyBRL(section.total)}</td></tr></tfoot>
        </table>`;
    })
    .join('');

  const receiptsHtml = report.receipts.length
    ? `<table>
        <thead><tr><th>Transação</th><th>Data</th><th>Arquivo</th><th>Link</th></tr></thead>
        <tbody>${report.receipts
          .map(
            (receipt) =>
              `<tr><td>${escapeHtml(receipt.transactionTitle)}</td><td>${formatBrDate(receipt.date)}</td><td>${escapeHtml(receipt.fileName)}</td><td>${receipt.url ? `<a href="${receipt.url}">abrir</a>` : '--'}</td></tr>`,
          )
          .join('')}</tbody>
      </table>`
    : '<p class="desc">Nenhum comprovante anexado às transações deste ano.</p>';

  return `<!DOCTYPE html>
<html lang="pt-br">
<head>
<meta charset="utf-8" />
<style>
  body { font-family: -apple-system, Helvetica, Arial, sans-serif; color: #1F2937; padding: 24px; }
  h1 { font-size: 22px; margin-bottom: 4px; }
  h2 { font-size: 16px; margin-top: 24px; }
  .sub { color: #6B7280; font-size: 12px; margin: 0 0 16px; }
  .desc { color: #6B7280; font-size: 11px; margin: 2px 0 8px; }
  .totals { display: flex; gap: 12px; margin: 16px 0; }
  .totals div { flex: 1; border: 1px solid #E5E7EB; border-radius: 8px; padding: 10px; }
  .totals span { display: block; font-size: 11px; color: #6B7280; }
  .totals strong { font-size: 15px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #E5E7EB; }
  th.num, td.num { text-align: right; }
  tfoot td { font-weight: 700; border-top: 2px solid #D1D5DB; }
  .empty { color: #9CA3AF; font-style: italic; }
  .note { margin-top: 28px; font-size: 11px; color: #6B7280; border-top: 1px solid #E5E7EB; padding-top: 12px; }
</style>
</head>
<body>
  <h1>Relatório para o Imposto de Renda — ${report.year}</h1>
  <p class="sub">Gerado em ${formatBrDate(report.generatedAt)} · ${report.transactionCount} lançamentos</p>
  <div class="totals">
    <div><span>Rendimentos</span><strong>${formatCurrencyBRL(report.totalIncome)}</strong></div>
    <div><span>Despesas dedutíveis</span><strong>${formatCurrencyBRL(report.totalDeductible)}</strong></div>
    <div><span>Total de despesas</span><strong>${formatCurrencyBRL(report.totalExpense)}</strong></div>
  </div>
  ${sectionsHtml}
  <h2>Comprovantes / Recibos</h2>
  ${receiptsHtml}
  <p class="note">Este é um relatório de apoio para preencher a sua declaração. Ele não importa diretamente
  no programa da Receita Federal — use os valores e comprovantes acima como referência.</p>
</body>
</html>`;
}

export async function generateIncomeTaxPdf(report: IncomeTaxReport): Promise<string> {
  const { uri } = await Print.printToFileAsync({ html: buildReportHtml(report) });
  return uri;
}

export async function generateIncomeTaxXlsx(report: IncomeTaxReport): Promise<string> {
  const workbook = XLSX.utils.book_new();

  const summaryRows = [
    ['Relatório para o Imposto de Renda', String(report.year)],
    ['Gerado em', formatBrDate(report.generatedAt)],
    ['Lançamentos', report.transactionCount],
    [],
    ['Rendimentos', report.totalIncome],
    ['Despesas dedutíveis', report.totalDeductible],
    ['Total de despesas', report.totalExpense],
  ];
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(summaryRows), 'Resumo');

  const incomeSection = report.sections.find((section) => section.key === 'rendimentos');
  const incomeRows = (incomeSection?.lines ?? []).map((line) => ({
    Categoria: line.category,
    Lançamentos: line.count,
    Total: line.amount,
  }));
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(incomeRows.length ? incomeRows : [{ Categoria: '', Lançamentos: '', Total: '' }]),
    'Rendimentos',
  );

  const expenseRows = report.sections
    .filter((section) => section.key !== 'rendimentos')
    .flatMap((section) =>
      section.lines.map((line) => ({
        Seção: section.title,
        Categoria: line.category,
        Lançamentos: line.count,
        Total: line.amount,
      })),
    );
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(
      expenseRows.length ? expenseRows : [{ Seção: '', Categoria: '', Lançamentos: '', Total: '' }],
    ),
    'Despesas',
  );

  const receiptRows = report.receipts.map((receipt) => ({
    Transação: receipt.transactionTitle,
    Data: formatBrDate(receipt.date),
    Arquivo: receipt.fileName,
    Tipo: receipt.kind,
    Link: receipt.url ?? '',
  }));
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(
      receiptRows.length ? receiptRows : [{ Transação: '', Data: '', Arquivo: '', Tipo: '', Link: '' }],
    ),
    'Recibos',
  );

  const base64 = XLSX.write(workbook, { type: 'base64', bookType: 'xlsx' });
  const uri = `${FileSystem.cacheDirectory}imposto-de-renda-${report.year}.xlsx`;
  await FileSystem.writeAsStringAsync(uri, base64, { encoding: FileSystem.EncodingType.Base64 });
  return uri;
}

export async function shareFile(uri: string) {
  if (Platform.OS === 'web') {
    await Linking.openURL(uri);
    return;
  }

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri);
    return;
  }

  await Linking.openURL(uri);
}
