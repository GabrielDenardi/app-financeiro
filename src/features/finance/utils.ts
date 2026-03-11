import { formatDateTitle } from '../../utils/format';
import type { TransactionFeedItem, TransactionSection } from '../transactions/types';

export function formatMonthDate(date = new Date()): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  return `${year}-${month}-01`;
}

export function monthDateFromIso(isoDate: string): string {
  const date = new Date(isoDate);
  return formatMonthDate(date);
}

export function startOfMonth(date = new Date()): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
}

export function endOfMonth(date = new Date()): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

export function isoDate(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export function isoDateTime(date = new Date()): string {
  return date.toISOString();
}

export function monthLabel(dateLike: string | Date): string {
  const date = typeof dateLike === 'string' ? new Date(dateLike) : dateLike;

  return new Intl.DateTimeFormat('pt-BR', {
    month: 'long',
    year: 'numeric',
  }).format(date);
}

export function weekBucket(dateLike: string): 'S1' | 'S2' | 'S3' | 'S4' | 'S5' {
  const day = new Date(dateLike).getDate();

  if (day <= 7) {
    return 'S1';
  }

  if (day <= 14) {
    return 'S2';
  }

  if (day <= 21) {
    return 'S3';
  }

  if (day <= 28) {
    return 'S4';
  }

  return 'S5';
}

export function groupTransactionsByDate(items: TransactionFeedItem[]): TransactionSection[] {
  const sections = new Map<string, TransactionFeedItem[]>();

  items.forEach((item) => {
    const key = item.occurredOn ?? item.dateISO ?? new Date().toISOString().slice(0, 10);
    const current = sections.get(key) ?? [];
    current.push(item);
    sections.set(key, current);
  });

  return [...sections.entries()]
    .sort(([left], [right]) => (left < right ? 1 : -1))
    .map(([date, data]) => ({
      date: formatDateTitle(date),
      data,
    }));
}

export function toNumber(value: number | string | null | undefined): number {
  return Number(value ?? 0);
}

export function clampPercent(value: number): number {
  if (value <= 0) {
    return 0;
  }

  if (value >= 100) {
    return 100;
  }

  return value;
}

export function formatInstallmentLabel(current: number, total: number): string | undefined {
  if (total <= 1) {
    return undefined;
  }

  return `${current}/${total}`;
}

export function normalizeCurrencyInput(value: string): number {
  const normalized = value.replace(/\./g, '').replace(',', '.').trim();
  return Number(normalized || 0);
}

export function formatCurrencyInput(value: string): string {
  const digits = value.replace(/\D/g, '');
  const numberValue = Number(digits || 0) / 100;
  return numberValue.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
