import { notificationDestination } from '../navigation';

describe('notification destinations', () => {
  it('opens support conversations only with a valid ID', () => {
    const chatId = '00000000-0000-4000-8000-000000000001';
    expect(notificationDestination({ metadata: { screen: 'Chat', chatId } }))
      .toEqual({ screen: 'Chat', params: { chatId, chatTitle: 'Atendimento nitin' } });
    expect(notificationDestination({ metadata: { screen: 'Chat', chatId: '../../other' } })).toBeNull();
  });
  it('rejects arbitrary links, routes, and malformed group IDs', () => {
    expect(notificationDestination({ metadata: { screen: 'https://example.com' } })).toBeNull();
    expect(notificationDestination({ metadata: { screen: 'GroupDetails', groupId: '../../secret' } })).toBeNull();
    expect(notificationDestination({ metadata: {} })).toBeNull();
  });
  it('opens authenticated destinations including the nested cards tab', () => {
    expect(notificationDestination({ metadata: { screen: 'Cards' } })).toEqual({ screen: 'MainTabs', params: { screen: 'Cards' } });
    expect(notificationDestination({ metadata: { screen: 'Budgets' } })).toEqual({ screen: 'Budgets' });
    expect(notificationDestination({ metadata: { screen: 'GroupDetails', groupId: '00000000-0000-0000-0000-000000000001' } }))
      .toEqual({ screen: 'GroupDetails', params: { groupId: '00000000-0000-0000-0000-000000000001' } });
  });
  it('opens a specific invoice only for valid metadata', () => {
    const cardId = '00000000-0000-0000-0000-000000000001';
    expect(notificationDestination({ metadata: { screen: 'Cards', cardId, invoiceMonth: '2026-10-01' } }))
      .toEqual({ screen: 'MainTabs', params: { screen: 'Cards', params: { notificationInvoice: { cardId, invoiceMonth: '2026-10-01' } } } });
    expect(notificationDestination({ metadata: { screen: 'Cards', cardId, invoiceMonth: '2026-99-01' } }))
      .toEqual({ screen: 'MainTabs', params: { screen: 'Cards' } });
  });
});
