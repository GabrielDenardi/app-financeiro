import { requireCurrentUserId } from '../../../lib/auth';
import { supabase } from '../../../lib/supabase';
import { formatMonthDate, toNumber } from '../../finance/utils';
import type { CardInvoiceSummary, CreateCardInput, CreditCard, PayCardInvoiceInput, RecordCardChargeInput } from '../types';

type CreditCardRow = {
  id: string;
  name: string;
  institution: string;
  network: string;
  last_digits: string;
  limit_amount: number | string;
  due_day: number;
  closing_day: number;
  color: string;
  is_active: boolean;
};

type InvoiceSummaryRow = {
  card_id: string;
  name: string;
  institution: string;
  network: string;
  last_digits: string;
  color: string;
  invoice_month: string | null;
  due_date: string | null;
  invoice_amount: number | string | null;
  open_amount: number | string | null;
  paid_amount: number | string | null;
  used_limit_amount: number | string | null;
};

function isDueSoon(dueDate: string | null, openAmount: number) {
  if (!dueDate || openAmount <= 0) {
    return false;
  }

  const now = new Date();
  const due = new Date(dueDate);
  const diffInDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  return diffInDays >= 0 && diffInDays <= 7;
}

export async function listCards(): Promise<CreditCard[]> {
  const userId = await requireCurrentUserId();

  const [{ data: cardsData, error: cardsError }, { data: invoicesData, error: invoicesError }] =
    await Promise.all([
      supabase
        .from('credit_cards')
        .select('id, name, institution, network, last_digits, limit_amount, due_day, closing_day, color, is_active')
        .eq('user_id', userId)
        .order('created_at', { ascending: false }),
      supabase
        .from('v_card_invoice_summary')
        .select('card_id, invoice_month, open_amount, used_limit_amount')
        .eq('user_id', userId),
    ]);

  if (cardsError || invoicesError) {
    throw new Error(cardsError?.message ?? invoicesError?.message ?? 'Nao foi possivel carregar os cartoes.');
  }

  const invoiceByCard = new Map<string, { openAmount: number; usedLimitAmount: number }>();

  ((invoicesData as InvoiceSummaryRow[] | null) ?? []).forEach((row) => {
    const current = invoiceByCard.get(row.card_id) ?? { openAmount: 0, usedLimitAmount: 0 };
    current.openAmount += toNumber(row.open_amount);
    current.usedLimitAmount = Math.max(current.usedLimitAmount, toNumber(row.used_limit_amount));
    invoiceByCard.set(row.card_id, current);
  });

  return ((cardsData as CreditCardRow[] | null) ?? []).map((row) => {
    const summary = invoiceByCard.get(row.id) ?? { openAmount: 0, usedLimitAmount: 0 };
    const limitAmount = toNumber(row.limit_amount);

    return {
      id: row.id,
      name: row.name,
      institution: row.institution ?? '',
      network: row.network,
      lastDigits: row.last_digits,
      limitAmount,
      dueDay: row.due_day,
      closingDay: row.closing_day,
      color: row.color,
      usedLimitAmount: summary.usedLimitAmount,
      openAmount: summary.openAmount,
      availableLimitAmount: Number((limitAmount - summary.usedLimitAmount).toFixed(2)),
      isActive: Boolean(row.is_active),
    };
  });
}

export async function listCardInvoices(monthDate?: string | null): Promise<CardInvoiceSummary[]> {
  const userId = await requireCurrentUserId();
  let query = supabase
    .from('v_card_invoice_summary')
    .select('card_id, name, institution, network, last_digits, color, invoice_month, due_date, invoice_amount, open_amount, paid_amount, used_limit_amount')
    .eq('user_id', userId)
    .not('invoice_month', 'is', null)
    .order('invoice_month', { ascending: true });

  if (monthDate) {
    query = query.eq('invoice_month', monthDate);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return ((data as InvoiceSummaryRow[] | null) ?? []).map((row) => {
    const openAmount = toNumber(row.open_amount);

    return {
      cardId: row.card_id,
      cardName: row.name,
      institution: row.institution ?? '',
      network: row.network,
      lastDigits: row.last_digits,
      color: row.color,
      invoiceMonth: row.invoice_month ?? formatMonthDate(),
      dueDate: row.due_date,
      invoiceAmount: toNumber(row.invoice_amount),
      openAmount,
      paidAmount: toNumber(row.paid_amount),
      usedLimitAmount: toNumber(row.used_limit_amount),
      isDueSoon: isDueSoon(row.due_date, openAmount),
    };
  });
}

export async function createCard(input: CreateCardInput): Promise<string> {
  const userId = await requireCurrentUserId();
  const { data, error } = await supabase
    .from('credit_cards')
    .insert({
      user_id: userId,
      name: input.name.trim(),
      institution: input.institution.trim(),
      network: input.network,
      last_digits: input.lastDigits,
      limit_amount: Number(input.limitAmount.toFixed(2)),
      due_day: input.dueDay,
      closing_day: input.closingDay,
      color: input.color,
      is_active: true,
    })
    .select('id')
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return (data as { id: string }).id;
}

export async function recordCardCharge(input: RecordCardChargeInput): Promise<string> {
  const { data, error } = await supabase.rpc('record_card_charge', {
    p_card_id: input.cardId,
    p_title: input.title.trim(),
    p_total_amount: Number(input.totalAmount.toFixed(2)),
    p_category_id: input.categoryId,
    p_purchase_date: input.purchaseDate,
    p_installment_count: input.installmentCount,
    p_notes: input.notes?.trim() ?? '',
  });

  if (error) {
    throw new Error(error.message);
  }

  return data as string;
}

export async function payCardInvoice(input: PayCardInvoiceInput): Promise<string> {
  const { data, error } = await supabase.rpc('pay_card_invoice', {
    p_card_id: input.cardId,
    p_invoice_month: input.invoiceMonth,
    p_account_id: input.accountId,
    p_amount: input.amount ? Number(input.amount.toFixed(2)) : null,
    p_note: input.note?.trim() ?? '',
  });

  if (error) {
    throw new Error(error.message);
  }

  return data as string;
}
