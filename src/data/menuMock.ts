import {
  Bell,
  Globe,
  HelpCircle,
  Moon,
  Shield,
  Smartphone,
} from 'lucide-react-native';

import type { MenuSections } from '../types/finance';

export const menuMock: MenuSections[] = [
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
      { icon: Shield, label: 'Privacidade e Segurança', page: 'Privacy' },
      { icon: Smartphone, label: 'Sobre o App', page: 'About' },
    ],
  },
];
