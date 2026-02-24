import type { EntryType } from '../types/finance';

export const HIDDEN_CURRENCY_TEXT = 'R$ *****';

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
});

const shortDateFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
});

export function formatCurrencyBRL(value: number): string {
  return currencyFormatter.format(value);
}

export function formatSignedCurrencyBRL(value: number, type: EntryType): string {
  const sign = type === 'income' ? '+' : '-';
  return `${sign} ${formatCurrencyBRL(Math.abs(value))}`;
}

export function formatHiddenSignedCurrencyBRL(type: EntryType): string {
  const sign = type === 'income' ? '+' : '-';
  return `${sign} ${HIDDEN_CURRENCY_TEXT}`;
}

export function formatShortDate(dateISO: string): string {
  const date = new Date(dateISO);

  if (Number.isNaN(date.getTime())) {
    return '--/--';
  }

  return shortDateFormatter.format(date);
}


export const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

export const formatDateTitle = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
};