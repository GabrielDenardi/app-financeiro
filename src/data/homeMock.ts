import type { HomeDashboardData } from '../types/finance';

export const homeDashboardMock: HomeDashboardData = {
  summary: {
    monthLabel: 'Fevereiro 2026',
    balance: 4320.45,
    income: 7850.9,
    expense: 3530.45,
    updatedAtLabel: 'Atualizado hoje',
  },
  weeklyFlow: [
    { weekLabel: 'S1', income: 1800, expense: 950 },
    { weekLabel: 'S2', income: 2150.9, expense: 820.45 },
    { weekLabel: 'S3', income: 1900, expense: 910 },
    { weekLabel: 'S4', income: 2000, expense: 850 },
  ],
  recentTransactions: [
    {
      id: 'tx-1',
      title: 'Salário',
      category: 'Trabalho',
      dateISO: '2026-02-20T09:00:00.000Z',
      type: 'income',
      amount: 5200,
    },
    {
      id: 'tx-2',
      title: 'Supermercado Central',
      category: 'Alimentação',
      dateISO: '2026-02-21T18:30:00.000Z',
      type: 'expense',
      amount: 286.47,
    },
    {
      id: 'tx-3',
      title: 'Freelance App Landing',
      category: 'Extra',
      dateISO: '2026-02-22T14:15:00.000Z',
      type: 'income',
      amount: 950.9,
    },
    {
      id: 'tx-4',
      title: 'Assinatura Streaming',
      category: 'Assinaturas',
      dateISO: '2026-02-22T22:10:00.000Z',
      type: 'expense',
      amount: 39.9,
    },
    {
      id: 'tx-5',
      title: 'Combustível',
      category: 'Transporte',
      dateISO: '2026-02-23T08:00:00.000Z',
      type: 'expense',
      amount: 180,
    },
  ],
};
