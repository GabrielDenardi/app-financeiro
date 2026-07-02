import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { financeQueryKeys } from '../../finance/queryKeys';
import { createCard, listCardInvoices, listCards, listInvoiceCharges, payCardInvoice, recordCardCharge, updateCard } from '../services/cardsService';
import type { CreateCardInput, PayCardInvoiceInput, RecordCardChargeInput } from '../types';

export function useCards(userId?: string | null) {
  return useQuery({
    queryKey: financeQueryKeys.cards.list(userId),
    queryFn: listCards,
    enabled: Boolean(userId),
  });
}

export function useCardInvoices(userId?: string | null, monthDate?: string | null) {
  return useQuery({
    queryKey: financeQueryKeys.cards.invoices(userId, monthDate),
    queryFn: () => listCardInvoices(monthDate),
    enabled: Boolean(userId),
  });
}

export function useInvoiceCharges(userId?: string | null, cardId?: string | null, invoiceMonth?: string | null) {
  return useQuery({
    queryKey: financeQueryKeys.cards.charges(cardId, invoiceMonth),
    queryFn: () => listInvoiceCharges(cardId!, invoiceMonth!),
    enabled: Boolean(userId) && Boolean(cardId) && Boolean(invoiceMonth),
  });
}

export function useUpdateCardMutation(userId?: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<CreateCardInput> }) =>
      updateCard(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: financeQueryKeys.cards.all });
    },
  });
}

export function useCreateCardMutation(userId?: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateCardInput) => createCard(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: financeQueryKeys.root });
      queryClient.invalidateQueries({ queryKey: financeQueryKeys.cards.all });
    },
  });
}

export function useRecordCardChargeMutation(userId?: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: RecordCardChargeInput) => recordCardCharge(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: financeQueryKeys.root });
      queryClient.invalidateQueries({ queryKey: financeQueryKeys.cards.all });
      queryClient.invalidateQueries({ queryKey: financeQueryKeys.transactions.all });
      queryClient.invalidateQueries({ queryKey: financeQueryKeys.dashboard.all });
      queryClient.invalidateQueries({ queryKey: financeQueryKeys.budgets.all });
      queryClient.invalidateQueries({ queryKey: financeQueryKeys.reports.all });
    },
  });
}

export function usePayCardInvoiceMutation(userId?: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: PayCardInvoiceInput) => payCardInvoice(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: financeQueryKeys.root });
      queryClient.invalidateQueries({ queryKey: financeQueryKeys.cards.all });
      queryClient.invalidateQueries({ queryKey: financeQueryKeys.accounts.all });
      queryClient.invalidateQueries({ queryKey: financeQueryKeys.transactions.all });
      // O pagamento debita uma conta — o saldo exibido na Home precisa atualizar.
      queryClient.invalidateQueries({ queryKey: financeQueryKeys.dashboard.all });
    },
  });
}
