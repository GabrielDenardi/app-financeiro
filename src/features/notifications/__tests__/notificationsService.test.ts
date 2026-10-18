const mockRequireUser = jest.fn();
const mockFrom = jest.fn();
const mockInvoke = jest.fn();
jest.mock('../../../lib/auth', () => ({ requireCurrentUserId: () => mockRequireUser() }));
jest.mock('../../../lib/supabase', () => ({ supabase: { from: (...args: unknown[]) => mockFrom(...args), functions: { invoke: (...args: unknown[]) => mockInvoke(...args) } } }));

import { deleteNotification, generateNotificationRecommendation, listUserNotifications, markNotificationAsRead } from '../services/notificationsService';

describe('notification ownership and errors', () => {
  beforeEach(() => { jest.clearAllMocks(); mockRequireUser.mockResolvedValue('current-user'); });
  it('scopes reads to the authenticated user and maps server metadata', async () => {
    const query: any = {};
    for (const method of ['select', 'eq', 'order']) query[method] = jest.fn(() => query);
    query.then = (resolve: any) => Promise.resolve({ data: [{ id: 'notice', title: 'Title', description: 'Body', icon: 'warning', read_at: null, created_at: '2026-10-18', source_type: 'budgets', metadata: { screen: 'Budgets' } }], error: null }).then(resolve);
    mockFrom.mockReturnValue(query);
    const notifications = await listUserNotifications();
    expect(query.eq).toHaveBeenCalledWith('user_id', 'current-user');
    expect(notifications[0]).toMatchObject({ read: false, category: 'budgets', metadata: { screen: 'Budgets' } });
  });
  it('requires a user before modifying a single notification', async () => {
    mockRequireUser.mockRejectedValue(new Error('Autenticação necessária'));
    await expect(deleteNotification('someone-elses-notification')).rejects.toThrow('Autenticação necessária');
    await expect(markNotificationAsRead('notice')).rejects.toThrow('Autenticação necessária');
    expect(mockFrom).not.toHaveBeenCalled();
  });
  it('scopes deletion and read mutations and surfaces database errors', async () => {
    const query: any = {};
    for (const method of ['delete', 'update', 'eq', 'is']) query[method] = jest.fn(() => query);
    query.then = (resolve: any) => Promise.resolve({ error: { message: 'Connection failed' } }).then(resolve);
    mockFrom.mockReturnValue(query);
    await expect(deleteNotification('notice')).rejects.toThrow('Connection failed');
    expect(query.eq).toHaveBeenCalledWith('user_id', 'current-user');
    await expect(markNotificationAsRead('notice')).rejects.toThrow('Connection failed');
    expect(query.is).toHaveBeenCalledWith('read_at', null);
  });
  it('preserves quota/consent errors returned by the recommendation function', async () => {
    mockInvoke.mockResolvedValue({ error: { context: { json: async () => ({ error: 'Autorize as recomendações' }) } } });
    await expect(generateNotificationRecommendation()).rejects.toThrow('Autorize as recomendações');
    mockInvoke.mockResolvedValue({ error: { context: { json: async () => { throw new Error('invalid JSON'); } } } });
    await expect(generateNotificationRecommendation()).rejects.toThrow('Não foi possível gerar uma recomendação agora.');
  });
});
