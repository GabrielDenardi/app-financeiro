import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import * as XLSX from 'xlsx';

import { requireCurrentUserId } from '../../../lib/auth';
import { supabase } from '../../../lib/supabase';
import { listCategories } from '../../transactions/services/transactionsService';
import type { ImportBatch, ImportPreviewRow } from '../types';

type ImportBatchRow = {
  id: string;
  file_name: string;
  file_type: string;
  row_count: number;
  imported_count: number;
  duplicate_count: number;
  failed_count: number;
  status: ImportBatch['status'];
  created_at: string;
  finalized_at: string | null;
};

type PickedAsset = {
  uri: string;
  name: string;
  mimeType?: string | null;
};

type ParsedRow = {
  title: string;
  amount: number;
  type: 'income' | 'expense';
  category: string;
  paymentMethod: string;
  occurredOn: string | null;
  rawData: Record<string, unknown>;
};

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');
}

function normalizeText(value: unknown) {
  return String(value ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function normalizeNumericString(value: string) {
  const sanitized = value.replace(/\s/g, '').replace(/[^0-9,.-]/g, '');

  if (!sanitized) {
    return '';
  }

  const isNegative = sanitized.includes('-');
  const unsignedValue = sanitized.replace(/-/g, '');
  const lastDot = unsignedValue.lastIndexOf('.');
  const lastComma = unsignedValue.lastIndexOf(',');

  let normalized = unsignedValue;

  if (lastDot >= 0 && lastComma >= 0) {
    const decimalSeparator = lastDot > lastComma ? '.' : ',';
    const thousandsSeparator = decimalSeparator === '.' ? ',' : '.';
    normalized = unsignedValue.replace(new RegExp(`\\${thousandsSeparator}`, 'g'), '').replace(decimalSeparator, '.');
  } else if (lastDot >= 0 || lastComma >= 0) {
    const separator = lastDot >= 0 ? '.' : ',';
    const parts = unsignedValue.split(separator);
    const decimalPart = parts[parts.length - 1] ?? '';
    const hasDecimalPart = decimalPart.length > 0 && decimalPart.length <= 2;

    normalized = hasDecimalPart ? `${parts.slice(0, -1).join('')}.${decimalPart}` : parts.join('');
  }

  const collapsed = normalized.replace(/(?!^)-/g, '');
  return isNegative ? `-${collapsed}` : collapsed;
}

export function parseAmount(value: unknown) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  const raw = normalizeNumericString(String(value ?? ''));

  const amount = Number(raw || 0);
  return Number.isFinite(amount) ? amount : 0;
}

/** Converte um número serial do Excel (dias desde 30/12/1899) para 'YYYY-MM-DD'. */
function parseExcelSerial(serial: number): string | null {
  // Seriais válidos vão de 1 (01/01/1900) a ~2958465 (31/12/9999).
  // Faixa prática para datas reais: até ~100 000 (cobre o ano 2173).
  if (!Number.isInteger(serial) || serial < 1 || serial > 2958465) {
    return null;
  }
  // O Excel usa o sistema de data de 1900 e inclui o dia inválido 29/02/1900.
  // Ajustamos datas maiores que o erro de bisexto de 1900.
  const epoch = Date.UTC(1899, 11, 31);
  const date = new Date(epoch + serial * 86_400_000);

  if (serial > 60) {
    date.setUTCDate(date.getUTCDate() - 1);
  }

  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

function parseDate(value: unknown): string | null {
  const isValidUtcDate = (year: number, month: number, day: number) => {
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() + 1 === month && date.getUTCDate() === day;
  };

  const formatDate = (year: number, month: number, day: number) =>
    `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;

  // Objeto Date (ex: xlsx com cellDates:true)
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString().slice(0, 10);
  }

  // Número: serial do Excel (xlsx sem cellDates:true retorna números para células de data)
  if (typeof value === 'number') {
    return parseExcelSerial(value);
  }

  const text = String(value ?? '').trim();

  if (!text) {
    return null;
  }

  // ISO: YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const [year, month, day] = text.split('-').map(Number);
    return isValidUtcDate(year, month, day) ? text : null;
  }

  // BR/PT: DD/MM/YYYY
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(text)) {
    const [day, month, year] = text.split('/').map(Number);
    return isValidUtcDate(year, month, day) ? formatDate(year, month, day) : null;
  }

  // String numérica pura → pode ser serial Excel representado como texto
  if (/^\d+$/.test(text)) {
    return parseExcelSerial(Number(text));
  }

  // ISO datetime estrito
  if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(text)) {
    const [datePart] = text.split(/[T ]/);
    const [year, month, day] = datePart.split('-').map(Number);
    if (!isValidUtcDate(year, month, day)) {
      return null;
    }

    const date = new Date(text);
    return Number.isNaN(date.getTime()) ? null : datePart;
  }

  return null;
}

function parseType(value: unknown, amount: number): 'income' | 'expense' {
  const normalized = normalizeText(value);
  if (normalized.includes('income') || normalized.includes('receita') || normalized.includes('entrada')) {
    return 'income';
  }

  if (normalized.includes('expense') || normalized.includes('despesa') || normalized.includes('saida')) {
    return 'expense';
  }

  return amount >= 0 ? 'income' : 'expense';
}

function buildFingerprint(row: ParsedRow) {
  return [
    row.occurredOn,
    row.type,
    Math.abs(row.amount).toFixed(2),
    normalizeText(row.title),
  ].join('|');
}

async function readAssetRows(asset: PickedAsset): Promise<Record<string, unknown>[]> {
  if (Platform.OS === 'web') {
    const fileBuffer = await fetch(asset.uri).then((response) => response.arrayBuffer());
    const workbook = XLSX.read(fileBuffer, { type: 'array', cellDates: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
  }

  const lowerName = asset.name.toLowerCase();

  if (lowerName.endsWith('.csv')) {
    const csvContent = await FileSystem.readAsStringAsync(asset.uri);

    const workbook = XLSX.read(csvContent, { type: 'string', cellDates: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
  }

  const base64Content = await FileSystem.readAsStringAsync(asset.uri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const workbook = XLSX.read(base64Content, { type: 'base64', cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
}

function normalizeRawRow(rawRow: Record<string, unknown>): Record<string, unknown> {
  return Object.entries(rawRow).reduce<Record<string, unknown>>((accumulator, [key, value]) => {
    accumulator[normalizeHeader(key)] = value;
    return accumulator;
  }, {});
}

export function parseRow(rawRow: Record<string, unknown>): ParsedRow {
  const row = normalizeRawRow(rawRow);
  const amount = parseAmount(row.amount ?? row.value ?? row.valor);
  const type = parseType(row.type ?? row.tipo, amount);

  return {
    title: String(row.description ?? row.descricao ?? row.title ?? row.titulo ?? '').trim(),
    amount: Math.abs(amount),
    type,
    category: String(row.category ?? row.categoria ?? 'other').trim(),
    paymentMethod: String(row.payment_method ?? row.metodo ?? row.method ?? 'Transferência').trim(),
    occurredOn: parseDate(row.date ?? row.data ?? row.occurred_on),
    rawData: row,
  };
}

async function existingFingerprints(userId: string, rows: ParsedRow[]) {
  if (rows.length === 0) {
    return new Set<string>();
  }

  const validDates = rows.map((row) => row.occurredOn).filter((d): d is string => d !== null);
  if (validDates.length === 0) {
    return new Set<string>();
  }

  const sortedDates = validDates.sort();
  const from = sortedDates[0];
  const to = sortedDates[sortedDates.length - 1];

  const { data, error } = await supabase
    .from('personal_transactions')
    .select('title, amount, type, occurred_on')
    .eq('user_id', userId)
    .gte('occurred_on', from)
    .lte('occurred_on', to);

  if (error) {
    throw new Error(error.message);
  }

  return new Set(
    ((data as Array<{ title: string; amount: number | string; type: 'income' | 'expense'; occurred_on: string }> | null) ??
      []
    ).map((row) =>
      [
        row.occurred_on,
        row.type,
        Math.abs(Number(row.amount)).toFixed(2),
        normalizeText(row.title),
      ].join('|'),
    ),
  );
}

export async function listImportBatches(): Promise<ImportBatch[]> {
  const userId = await requireCurrentUserId();
  const { data, error } = await supabase
    .from('import_batches')
    .select('id, file_name, file_type, row_count, imported_count, duplicate_count, failed_count, status, created_at, finalized_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return ((data as ImportBatchRow[] | null) ?? []).map((row) => ({
    id: row.id,
    fileName: row.file_name,
    fileType: row.file_type,
    rowCount: row.row_count,
    importedCount: row.imported_count,
    duplicateCount: row.duplicate_count,
    failedCount: row.failed_count,
    status: row.status,
    createdAt: row.created_at,
    finalizedAt: row.finalized_at,
  }));
}

export async function importTransactionsFromAsset(asset: PickedAsset) {
  const userId = await requireCurrentUserId();
  const categories = await listCategories();
  const categoryByName = new Map<string, string>(
    categories.flatMap((category) => [
      [normalizeText(category.label), category.code],
      [normalizeText(category.code), category.code],
    ]),
  );

  const rawRows = await readAssetRows(asset);
  const parsedRows = rawRows.map(parseRow);
  const existing = await existingFingerprints(userId, parsedRows);
  const inBatchFingerprints = new Set<string>();

  const previewRows: ImportPreviewRow[] = parsedRows.map((row, index) => {
    const fingerprint = buildFingerprint(row);
    const duplicate = existing.has(fingerprint) || inBatchFingerprints.has(fingerprint);
    const categoryCode = categoryByName.get(normalizeText(row.category)) ?? 'other';
    const hasRequiredFields = Boolean(row.title && row.amount > 0 && row.occurredOn);
    const status = !hasRequiredFields ? 'failed' : duplicate ? 'duplicate' : 'accepted';
    const errorMessage = !hasRequiredFields
      ? row.occurredOn === null && row.title && row.amount > 0
        ? 'Data inválida ou em formato não reconhecido.'
        : 'Linha inválida ou incompleta.'
      : duplicate
        ? 'Transação já existente.'
        : '';

    inBatchFingerprints.add(fingerprint);

    return {
      rowIndex: index + 1,
      fingerprint,
      title: row.title,
      amount: row.amount,
      type: row.type,
      categoryCode,
      paymentMethod: row.paymentMethod || 'Transferência',
      occurredOn: row.occurredOn,
      status,
      errorMessage,
      rawData: row.rawData,
    };
  });

  const { data: batchData, error: batchError } = await supabase
    .from('import_batches')
    .insert({
      user_id: userId,
      file_name: asset.name,
      file_type: asset.mimeType ?? 'application/octet-stream',
      status: 'processing',
      row_count: previewRows.length,
    })
    .select('id')
    .single();

  if (batchError) {
    throw new Error(batchError.message);
  }

  const batchId = (batchData as { id: string }).id;
  const { error: rowsError } = await supabase.from('import_batch_rows').insert(
    previewRows.map((row) => ({
      batch_id: batchId,
      user_id: userId,
      row_index: row.rowIndex,
      fingerprint: row.fingerprint,
      raw_data: row.rawData,
      normalized_title: row.title,
      normalized_amount: Number(row.amount.toFixed(2)),
      normalized_type: row.type,
      normalized_category_code: row.categoryCode,
      normalized_payment_method: row.paymentMethod,
      occurred_on: row.occurredOn,
      status: row.status,
      error_message: row.errorMessage,
    })),
  );

  if (rowsError) {
    throw new Error(rowsError.message);
  }

  const { error: finalizeError } = await supabase.rpc('finalize_import_batch', {
    p_batch_id: batchId,
  });

  if (finalizeError) {
    throw new Error(finalizeError.message);
  }

  return {
    batchId,
    previewRows,
  };
}
