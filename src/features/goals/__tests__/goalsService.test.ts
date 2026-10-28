const mockRequireUser = jest.fn();
const mockRpc = jest.fn();
jest.mock('../../../lib/auth', () => ({ requireCurrentUserId: () => mockRequireUser() }));
jest.mock('../../../lib/supabase', () => ({ supabase: { rpc: (...args: unknown[]) => mockRpc(...args) } }));

import { withdrawFromGoal } from '../services/goalsService';

describe('goal withdrawals', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireUser.mockResolvedValue('user');
    mockRpc.mockResolvedValue({ data: 'withdrawal-id', error: null });
  });
  it('uses the atomic RPC with normalized currency and note', async () => {
    await expect(withdrawFromGoal({ goalId: 'goal', accountId: 'account', amount: 12.345, note: '  Reserva  ', occurredAt: '2026-10-21T12:00:00Z' })).resolves.toBe('withdrawal-id');
    expect(mockRpc).toHaveBeenCalledWith('withdraw_from_goal', {
      p_goal_id: 'goal', p_account_id: 'account', p_amount: 12.35,
      p_note: 'Reserva', p_occurred_at: '2026-10-21T12:00:00Z',
    });
  });
  it.each([0, -1, NaN, Infinity, 0.001])('rejects invalid amount %s before the RPC', async amount => {
    await expect(withdrawFromGoal({ goalId: 'goal', accountId: 'account', amount })).rejects.toThrow('valor válido');
    expect(mockRpc).not.toHaveBeenCalled();
  });
  it('requires authentication', async () => {
    mockRequireUser.mockRejectedValue(new Error('Entre novamente'));
    await expect(withdrawFromGoal({ goalId: 'goal', accountId: 'account', amount: 1 })).rejects.toThrow('Entre novamente');
    expect(mockRpc).not.toHaveBeenCalled();
  });
  it('preserves a server balance rejection for the UI', async () => {
    mockRpc.mockResolvedValue({ error: { message: 'Saldo da meta insuficiente.' } });
    await expect(withdrawFromGoal({ goalId: 'goal', accountId: 'account', amount: 20 })).rejects.toThrow('Saldo da meta insuficiente.');
  });
});
