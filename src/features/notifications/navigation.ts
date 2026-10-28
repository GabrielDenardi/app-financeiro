import type { UserNotification } from './types';

// Never execute arbitrary routes/URLs provided in notification metadata.
export function notificationDestination(notification: Pick<UserNotification, 'metadata'>):
  { screen: 'Budgets' | 'RecurringTransactions' | 'Reports' | 'Privacy' | 'Groups'; params?: undefined }
  | { screen: 'GroupDetails'; params: { groupId: string } }
  | { screen: 'Chat'; params: { chatId: string; chatTitle: string } }
  | { screen: 'MainTabs'; params: { screen: 'Cards'; params?: { notificationInvoice: { cardId: string; invoiceMonth: string } } } }
  | null {
  const { screen, groupId } = notification.metadata;
  if (screen === 'Chat') {
    const { chatId } = notification.metadata;
    if (typeof chatId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(chatId)) return null;
    return { screen, params: { chatId, chatTitle: 'Atendimento nitin' } };
  }
  if (screen === 'GroupDetails' && typeof groupId === 'string' && /^[0-9a-f-]{36}$/i.test(groupId)) {
    return { screen, params: { groupId } };
  }
  if (screen === 'Cards') {
    const { cardId, invoiceMonth } = notification.metadata;
    if (typeof cardId === 'string' && /^[0-9a-f-]{36}$/i.test(cardId)
      && typeof invoiceMonth === 'string' && /^\d{4}-(0[1-9]|1[0-2])-01$/.test(invoiceMonth)) {
      return { screen: 'MainTabs', params: { screen: 'Cards', params: { notificationInvoice: { cardId, invoiceMonth } } } };
    }
    return { screen: 'MainTabs', params: { screen: 'Cards' } };
  }
  if (screen === 'Budgets' || screen === 'RecurringTransactions' || screen === 'Reports' || screen === 'Privacy' || screen === 'Groups') {
    return { screen };
  }
  return null;
}
