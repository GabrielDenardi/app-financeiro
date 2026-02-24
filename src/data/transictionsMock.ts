import { RecentTransaction } from '../types/finance';

// Opção A: Tipando o array explicitamente (Recomendado)
export const MOCK_TRANSACTIONS: { date: string, data: RecentTransaction[] }[] = [
  {
    date: '2026-02-17',
    data: [
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
      {
        id: '3',
        title: 'Supermercado',
        date: '18 fev',
        dateISO: '2026-02-18T15:30:00Z',
        amount: 34250,
        category: 'Alimentação',
        paymentMethod: 'Débito',
        type: 'expense'
      },
      {
        id: '4',
        title: 'Salário',
        date: '20 fev',
        dateISO: '2026-02-20T09:00:00Z',
        amount: 850000,
        category: 'Renda',
        paymentMethod: 'Transferência',
        type: 'income'
      },
    ]
  }
];