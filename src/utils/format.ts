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

const shortMonthYearFormatter = new Intl.DateTimeFormat('pt-BR', {
  month: 'short',
  year: 'numeric',
});

const timeFormatter = new Intl.DateTimeFormat('pt-BR', {
  hour: '2-digit',
  minute: '2-digit',
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
  if (!dateISO) return '--/--';
  // Parse only the date part (YYYY-MM-DD) using local time components to avoid
  // the UTC-offset gotcha: new Date('2026-06-01') = UTC midnight → May 31 in UTC-3.
  const datePart = dateISO.split('T')[0];
  const [y, m, d] = datePart.split('-').map(Number);
  if (!y || !m || !d) return '--/--';
  const date = new Date(y, m - 1, d);
  if (Number.isNaN(date.getTime())) return '--/--';
  return shortDateFormatter.format(date);
}

export function formatDateInput(dateISO?: string | null): string {
  if (!dateISO || dateISO.length < 10) return '';
  const [year, month, day] = dateISO.slice(0, 10).split('-');
  return `${day}/${month}/${year}`;
}

export function parseDateInput(displayDate: string): string | null {
  const [dayText, monthText, yearText] = displayDate.split('/');
  if (!dayText || !monthText || yearText?.length !== 4) return null;

  const day = Number(dayText);
  const month = Number(monthText);
  const year = Number(yearText);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return `${yearText}-${monthText.padStart(2, '0')}-${dayText.padStart(2, '0')}`;
}

export function maskDateInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  return digits.replace(/^(\d{2})(\d)/, '$1/$2').replace(/^(\d{2}\/\d{2})(\d)/, '$1/$2');
}

export function formatTime(dateLike: string | Date): string {
  const date = typeof dateLike === 'string' ? new Date(dateLike) : dateLike;
  return Number.isNaN(date.getTime()) ? '--:--' : timeFormatter.format(date);
}

export function formatMonthYearShort(monthDate: string): string {
  const [year, month] = monthDate.split('-').map(Number);
  if (!year || !month) return '';
  const formatted = shortMonthYearFormatter.format(new Date(year, month - 1, 1));
  const normalized = formatted.replace('.', '').replace(' de ', '/');
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

export function getRelativeDueDateInfo(dueDate: string | null): {
  label: string;
  isOverdue: boolean;
} {
  if (!dueDate) return { label: '', isOverdue: false };
  const [year, month, day] = dueDate.split('T')[0].split('-').map(Number);
  const due = new Date(year, month - 1, day);
  if (Number.isNaN(due.getTime())) return { label: '', isOverdue: false };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((due.getTime() - today.getTime()) / 86_400_000);
  if (diffDays < 0) {
    const overdueDays = Math.abs(diffDays);
    return {
      label: `Vencida há ${overdueDays} dia${overdueDays !== 1 ? 's' : ''}`,
      isOverdue: true,
    };
  }
  if (diffDays === 0) return { label: 'Vence hoje', isOverdue: true };
  if (diffDays === 1) return { label: 'Vence amanhã', isOverdue: false };
  return { label: `Vence em ${diffDays} dias`, isOverdue: false };
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
