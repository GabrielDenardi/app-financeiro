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
        id: '1', 
        title: 'Outras Receitas', 
        date: '17 fev', 
        dateISO: '2026-02-17T10:00:00Z',
        amount: 200, 
        category: 'Outras Receitas', 
        paymentMethod: 'PIX', 
        type: 'income' 
      },
      { 
        id: '2', 
        title: 'Combustível', 
        date: '17 fev', 
        dateISO: '2026-02-17T12:00:00Z',
        amount: 1250, 
        category: 'Transporte', 
        paymentMethod: 'Crédito', 
        type: 'expense' 
      },
  ],
};
