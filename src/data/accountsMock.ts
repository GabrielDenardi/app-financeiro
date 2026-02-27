import { 
    Landmark, 
    PiggyBank, 
    CreditCard, 
    TrendingUp, 
    Wallet, 
    MoreHorizontal 
} from 'lucide-react-native';
import { 
    Account, 
    AccountType, 
    AccountConfig 
} from '../types/finance';

export const typeConfig: Record<AccountType, AccountConfig> = {
  checking: { label: 'Conta Corrente', icon: Landmark, gradient: ['#1e293b', '#334155'], light: '#f1f5f9' },
  savings: { label: 'Poupança', icon: PiggyBank, gradient: ['#059669', '#10b981'], light: '#ecfdf5' },
  credit_card: { label: 'Cartão de Crédito', icon: CreditCard, gradient: ['#7c3aed', '#8b5cf6'], light: '#f5f3ff' },
  investment: { label: 'Investimento', icon: TrendingUp, gradient: ['#2563eb', '#3b82f6'], light: '#eff6ff' },
  cash: { label: 'Dinheiro', icon: Wallet, gradient: ['#d97706', '#f59e0b'], light: '#fffbeb' },
  other: { label: 'Outra', icon: MoreHorizontal, gradient: ['#475569', '#64748b'], light: '#f8fafc' },
};

export const accountsMock: Account[] = [
  { id: '1', name: 'Nubank', type: 'checking', balance: 2500.50, institution: 'Nubank', is_active: true },
  { id: '2', name: 'Reserva', type: 'savings', balance: 15000.00, institution: 'Itaú', is_active: true },
  { id: '3', name: 'Carteira', type: 'cash', balance: 120.00, is_active: true },
];