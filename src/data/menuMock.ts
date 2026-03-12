import { 
  CreditCard, 
  Target, 
  PiggyBank, 
  Users, 
  FileText, 
  Bell, 
  Moon, 
  Globe, 
  HelpCircle, 
  Shield, 
  Smartphone,
  Landmark,
  ArrowLeftRight,
  ChartSpline
} from 'lucide-react-native';
import type { MenuSections } from "../types/finance";

export const menuMock: MenuSections[] = [
  {
    title: 'Finanças',
    items: [
      { icon: Landmark, label: 'Minhas Contas', page: 'Accounts' },
      { icon: CreditCard, label: 'Cartões de Crédito', page: 'Cards' },
      { icon: Target, label: 'Metas Financeiras', page: 'Goals' },
      { icon: PiggyBank, label: 'Orçamentos', page: 'Budgets' },
      { icon: Users, label: 'Grupos', page: 'Groups' },
      { icon: ChartSpline, label: 'Relatórios', page: 'Reports' },
      { icon: ArrowLeftRight, label: 'Transações Recorrentes', page: 'RecurringTransactions' },
      { icon: FileText, label: 'Importar Dados', page: 'Import' }
    ]
  },
  {
    title: 'Preferências',
    items: [
      { icon: Bell, label: 'Notificações', page: 'Notifications' },
      { icon: Moon, label: 'Modo Escuro', toggle: true },
      { icon: Globe, label: 'Idioma', value: 'Português' }
    ]
  },
  {
    title: 'Suporte',
    items: [
      { icon: HelpCircle, label: 'Central de Ajuda', page: 'Help' },
      { icon: Shield, label: 'Privacidade e Segurança', page: 'Privacy' },
      { icon: Smartphone, label: 'Sobre o App', page: 'About' }
    ]
  }
];
