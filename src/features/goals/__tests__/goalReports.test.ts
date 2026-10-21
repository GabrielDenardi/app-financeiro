const mockFeed = jest.fn();
jest.mock('../../../lib/auth', () => ({ requireCurrentUserId: async () => 'user' }));
jest.mock('../../transactions/services/transactionsService', () => ({ listTransactionFeed: (...args: unknown[]) => mockFeed(...args) }));
import { getReportsSummary } from '../../reports/services/reportsService';

it('does not inflate reported income when savings return to an account', async () => {
  mockFeed.mockResolvedValue([
    { id: 'salary', title: 'Salário', amount: 2000, type: 'income', category: 'Salário', sourceType: 'manual', paymentMethod: 'Pix', occurredOn: '2026-10-21' },
    { id: 'withdrawal', title: 'Retirada da meta', amount: 500, type: 'income', category: 'Outros', sourceType: 'goal_withdrawal', paymentMethod: 'Transferencia', occurredOn: '2026-10-21' },
    { id: 'contribution', title: 'Aporte', amount: 100, type: 'expense', category: 'Outros', sourceType: 'goal_contribution', paymentMethod: 'Transferencia', occurredOn: '2026-10-21' },
  ]);
  const result = await getReportsSummary({ from: '2026-10-01', to: '2026-10-31' });
  expect(result.income).toBe(2000);
  expect(result.expense).toBe(0);
  expect(result.balance).toBe(2000);
  expect(result.barSeries[0].value).toBe(2000);
});
