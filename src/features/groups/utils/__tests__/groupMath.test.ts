import type { GroupSettlement, GroupSplit } from '../../../../types/groups';
import {
  computeCurrentUserBalances,
  computeGroupSummary,
  createEqualShares,
  createPercentageShares,
  validateCustomShares,
} from '../groupMath';

describe('groupMath', () => {
  it('splits equal amounts preserving cents', () => {
    expect(createEqualShares(100, ['u1', 'u2', 'u3'])).toEqual([
      { userId: 'u1', amount: 33.34, percentage: 33.3333 },
      { userId: 'u2', amount: 33.33, percentage: 33.3333 },
      { userId: 'u3', amount: 33.33, percentage: 33.3333 },
    ]);
  });

  it('builds percentage shares and distributes remainder', () => {
    expect(
      createPercentageShares(10, [
        { userId: 'u1', percentage: 60 },
        { userId: 'u2', percentage: 40 },
      ]),
    ).toEqual([
      { userId: 'u1', amount: 6, percentage: 60 },
      { userId: 'u2', amount: 4, percentage: 40 },
    ]);
  });

  it('validates custom shares against total', () => {
    expect(
      validateCustomShares(9, [
        { userId: 'u1', amount: 4 },
        { userId: 'u2', amount: 5 },
      ]),
    ).toEqual([
      { userId: 'u1', amount: 4, percentage: 44.4444 },
      { userId: 'u2', amount: 5, percentage: 55.5556 },
    ]);

    expect(() =>
      validateCustomShares(9, [
        { userId: 'u1', amount: 4 },
        { userId: 'u2', amount: 4 },
      ]),
    ).toThrow('A soma dos valores personalizados deve ser igual ao total.');
  });

  it('computes balances and ignores pending settlements in net balance', () => {
    const splits: GroupSplit[] = [
      {
        id: 's1',
        groupId: 'g1',
        createdBy: 'a',
        ownerUserId: 'a',
        title: 'Mercado',
        description: '',
        kind: 'expense',
        splitMode: 'equal',
        totalAmount: 90,
        occurredAt: '2026-03-09T00:00:00.000Z',
        createdAt: '2026-03-09T00:00:00.000Z',
        shares: [
          { id: '1', splitId: 's1', userId: 'a', amount: 30, percentage: 33.3333 },
          { id: '2', splitId: 's1', userId: 'b', amount: 30, percentage: 33.3333 },
          { id: '3', splitId: 's1', userId: 'c', amount: 30, percentage: 33.3333 },
        ],
      },
      {
        id: 's2',
        groupId: 'g1',
        createdBy: 'b',
        ownerUserId: 'b',
        title: 'Bonus',
        description: '',
        kind: 'income',
        splitMode: 'equal',
        totalAmount: 40,
        occurredAt: '2026-03-10T00:00:00.000Z',
        createdAt: '2026-03-10T00:00:00.000Z',
        shares: [
          { id: '4', splitId: 's2', userId: 'a', amount: 20, percentage: 50 },
          { id: '5', splitId: 's2', userId: 'b', amount: 20, percentage: 50 },
        ],
      },
      {
        id: 's3',
        groupId: 'g1',
        createdBy: 'c',
        ownerUserId: 'c',
        title: 'Taxi',
        description: '',
        kind: 'expense',
        splitMode: 'equal',
        totalAmount: 30,
        occurredAt: '2026-03-10T00:00:00.000Z',
        createdAt: '2026-03-10T00:00:00.000Z',
        shares: [
          { id: '6', splitId: 's3', userId: 'a', amount: 15, percentage: 50 },
          { id: '7', splitId: 's3', userId: 'c', amount: 15, percentage: 50 },
        ],
      },
    ];

    const settlements: GroupSettlement[] = [
      {
        id: 'st1',
        groupId: 'g1',
        fromUserId: 'b',
        toUserId: 'a',
        requestedByUserId: 'b',
        confirmedByUserId: 'a',
        amount: 10,
        paymentMethod: 'PIX',
        note: '',
        status: 'confirmed',
        createdAt: '2026-03-10T00:00:00.000Z',
        confirmedAt: '2026-03-10T00:00:00.000Z',
      },
      {
        id: 'st2',
        groupId: 'g1',
        fromUserId: 'c',
        toUserId: 'a',
        requestedByUserId: 'c',
        confirmedByUserId: null,
        amount: 5,
        paymentMethod: 'PIX',
        note: '',
        status: 'pending',
        createdAt: '2026-03-10T00:00:00.000Z',
        confirmedAt: null,
      },
    ];

    const members = [
      { id: 'm1', groupId: 'g1', userId: 'a', fullName: 'Ana', email: 'ana@test.com', role: 'admin' as const, joinedAt: '', removedAt: null },
      { id: 'm2', groupId: 'g1', userId: 'b', fullName: 'Bia', email: 'bia@test.com', role: 'member' as const, joinedAt: '', removedAt: null },
      { id: 'm3', groupId: 'g1', userId: 'c', fullName: 'Caio', email: 'caio@test.com', role: 'member' as const, joinedAt: '', removedAt: null },
    ];

    expect(computeGroupSummary(splits, settlements)).toEqual({
      totalDivided: 160,
      settled: 10,
      pending: 55,
    });

    expect(computeCurrentUserBalances(members, splits, settlements, 'a')).toEqual({
      balances: [
        { userId: 'b', fullName: 'Bia', amount: 40 },
        { userId: 'c', fullName: 'Caio', amount: 15 },
      ],
      currentUserNet: 55,
    });
  });
});
