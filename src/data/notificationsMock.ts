import type { NotificationItem } from "../types/notifications";

export const notificationsMock: NotificationItem[] = [
  {
    id: "1",
    title: "Transferência concluída",
    description: "Sua transferência de R$ 250,00 foi concluída com sucesso.",
    date: "Hoje, 14:30",
    read: false,
    icon: "success",
  },
  {
    id: "2",
    title: "Novo acesso detectado",
    description: "Identificamos um novo login na sua conta em outro dispositivo.",
    date: "Hoje, 09:12",
    read: false,
    icon: "security",
  },
  {
    id: "3",
    title: "Meta atualizada",
    description: "Sua meta 'Reserva de Emergência' atingiu 72% do valor total.",
    date: "Ontem, 18:45",
    read: true,
    icon: "info",
  },
  {
    id: "4",
    title: "Fatura próxima do vencimento",
    description: "A fatura do seu cartão vence em 3 dias.",
    date: "Ontem, 08:20",
    read: false,
    icon: "warning",
  },
];