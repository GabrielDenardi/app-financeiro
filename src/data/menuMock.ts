import {
  ArrowLeftRight,
  Bell,
  ChartSpline,
  Crown,
  CreditCard,
  FileText,
  Globe,
  HelpCircle,
  Landmark,
  MessageCircle,
  Moon,
  PiggyBank,
  Receipt,
  Shield,
  Smartphone,
  Users,
} from 'lucide-react-native';

import type { MenuSections } from '../types/finance';

export const menuMock: MenuSections[] = [
  {
    title: 'Finanças',
    items: [
      { icon: Landmark, label: 'Minhas Contas', page: 'Accounts' },
      { icon: CreditCard, label: 'Cartões de Crédito', page: 'Cards' },
      { icon: PiggyBank, label: 'Orçamentos', page: 'Budgets' },
      { icon: Users, label: 'Grupos', page: 'Groups' },
      { icon: ChartSpline, label: 'Relatórios', page: 'Reports' },
      { icon: ArrowLeftRight, label: 'Transações Recorrentes', page: 'RecurringTransactions' },
      { icon: FileText, label: 'Importar Dados', page: 'Import' },
      { icon: Receipt, label: 'Imposto de Renda', page: 'IncomeTax' },
      { icon: Crown, label: 'Planos', page: 'Plans' },
    ],
  },
  {
    title: 'Preferências',
    items: [
      { icon: Bell, label: 'Notificações', page: 'Notifications' },
      { id: 'dark-mode', icon: Moon, label: 'Modo Escuro', toggle: true },
      { icon: Globe, label: 'Idioma', value: 'Português' },
    ],
  },
  {
    title: 'Suporte',
    items: [
      { icon: HelpCircle, label: 'Central de Ajuda', page: 'Help' },
      { icon: MessageCircle, label: 'Chat de Suporte', page: 'ListChat' },
      { icon: Shield, label: 'Privacidade e Segurança', page: 'Privacy' },
      { icon: Smartphone, label: 'Sobre o App', page: 'About' },
    ],
  },
];
