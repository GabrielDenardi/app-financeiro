const mockRpc = jest.fn();

jest.mock('../../../../config/env', () => ({
  hasSupabaseEnv: true,
}));

jest.mock('../../../../lib/supabase', () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
    from: jest.fn(),
  },
}));

import {
  confirmGroupSettlement,
  createGroup,
  joinGroupByCode,
  removeGroupMember,
  requestGroupSettlement,
} from '../groupsService';

describe('groupsService rpc wrappers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates group with trimmed payload', async () => {
    mockRpc.mockResolvedValueOnce({ data: 'group-1', error: null });

    await expect(
      createGroup({
        title: '  Casa compartilhada  ',
        description: '  Despesas da casa  ',
      }),
    ).resolves.toBe('group-1');

    expect(mockRpc).toHaveBeenCalledWith('create_group', {
      p_title: 'Casa compartilhada',
      p_description: 'Despesas da casa',
    });
  });

  it('joins group with normalized share code', async () => {
    mockRpc.mockResolvedValueOnce({ data: 'group-2', error: null });

    await expect(joinGroupByCode(' casa01 ')).resolves.toBe('group-2');

    expect(mockRpc).toHaveBeenCalledWith('join_group_by_code', {
      p_share_code: 'CASA01',
    });
  });

  it('requests settlement with rounded amount', async () => {
    mockRpc.mockResolvedValueOnce({ data: 'settlement-1', error: null });

    await expect(
      requestGroupSettlement({
        groupId: 'group-1',
        toUserId: 'user-b',
        amount: 12.345,
        paymentMethod: 'PIX',
        note: '  Pago via pix  ',
      }),
    ).resolves.toBe('settlement-1');

    expect(mockRpc).toHaveBeenCalledWith('request_group_settlement', {
      p_group_id: 'group-1',
      p_to_user_id: 'user-b',
      p_amount: 12.35,
      p_payment_method: 'PIX',
      p_note: 'Pago via pix',
    });
  });

  it('confirms settlement by rpc id', async () => {
    mockRpc.mockResolvedValueOnce({ data: 'group-1', error: null });

    await expect(confirmGroupSettlement('settlement-1')).resolves.toBe('group-1');

    expect(mockRpc).toHaveBeenCalledWith('confirm_group_settlement', {
      p_settlement_id: 'settlement-1',
    });
  });

  it('removes group member by rpc', async () => {
    mockRpc.mockResolvedValueOnce({ data: true, error: null });

    await expect(removeGroupMember('group-1', 'user-b')).resolves.toBe(true);

    expect(mockRpc).toHaveBeenCalledWith('remove_group_member', {
      p_group_id: 'group-1',
      p_user_id: 'user-b',
    });
  });
});
