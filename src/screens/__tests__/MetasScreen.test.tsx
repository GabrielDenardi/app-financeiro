import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { AppThemeProvider } from '../../theme';
import MetasScreen from '../MetasScreen';

const mockWithdraw = jest.fn();
const mockContribute = jest.fn();
const mockSuccess = jest.fn();
const mockError = jest.fn();
let mockGoals: any[];
let mockAccounts: any[];
jest.mock('@react-navigation/native', () => ({ ...jest.requireActual('@react-navigation/native'), useNavigation: () => ({ navigate: jest.fn() }) }));
jest.mock('../../features/auth/hooks/useAuthenticatedUser', () => ({ useAuthenticatedUser: () => ({ id: 'user' }) }));
jest.mock('../../features/accounts/hooks/useAccounts', () => ({ useAccounts: () => ({ data: mockAccounts }) }));
jest.mock('../../features/goals/hooks/useGoals', () => ({
  useGoals: () => ({ data: mockGoals }),
  useCreateGoalMutation: () => ({}), useDeleteGoalMutation: () => ({}), useUpdateGoalMutation: () => ({}),
  useGoalContributionMutation: () => ({ mutateAsync: mockContribute }),
  useGoalWithdrawalMutation: () => ({ mutateAsync: mockWithdraw }),
}));
jest.mock('../../components/Toast', () => ({ useToast: () => ({ showSuccess: mockSuccess, showError: mockError }) }));
jest.mock('../../components/PageShell', () => ({ PageShell: ({ children }: any) => children }));
jest.mock('../../components/BottomSheet', () => ({ BottomSheet: ({ visible, title, children, footer, onClose }: any) => {
  const { View, Text } = require('react-native');
  return visible ? <View><Text>{title}</Text>{children}{footer?.(onClose)}</View> : null;
} }));
jest.mock('../../components/ConfirmDialog', () => ({ ConfirmDialog: () => null }));
jest.mock('react-native-calendars', () => ({ Calendar: () => null, CalendarUtils: { getCalendarDateString: () => '2026-10-21' } }));
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));

const screen = () => render(<AppThemeProvider><MetasScreen /></AppThemeProvider>);
describe('goal movement modal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGoals = [{ id: 'goal', title: 'Reserva', currentAmount: 100, targetAmount: 500, progressPercent: 20, status: 'active', icon: 'wallet', color: '#338855', targetDate: null }];
    mockAccounts = [{ id: 'account', name: 'Conta corrente', isActive: true }];
    mockWithdraw.mockResolvedValue('withdrawal'); mockContribute.mockResolvedValue('contribution');
  });
  it('blocks an amount larger than the balance without submitting', async () => {
    const ui = screen();
    fireEvent.press(ui.getByLabelText('Retirar valor de Reserva'));
    fireEvent.changeText(ui.getByLabelText('Valor da movimentação'), '10001');
    fireEvent.press(ui.getByLabelText('Confirmar retirada'));
    expect(mockError).toHaveBeenCalledWith('O valor da retirada não pode ser maior que o saldo da meta.');
    expect(ui.getByRole('alert')).toHaveTextContent('O valor da retirada não pode ser maior que o saldo da meta.');
    expect(mockWithdraw).not.toHaveBeenCalled();
    expect(ui.getByText('Retirar Valor')).toBeTruthy();
  });
  it('allows the full balance and prevents repeated taps during submission', async () => {
    let resolve!: (value: string) => void;
    mockWithdraw.mockImplementation(() => new Promise<string>(done => { resolve = done; }));
    const ui = screen();
    fireEvent.press(ui.getByLabelText('Retirar valor de Reserva'));
    fireEvent.changeText(ui.getByLabelText('Valor da movimentação'), '10000');
    fireEvent.changeText(ui.getByLabelText('Observação da movimentação'), 'Emergência');
    fireEvent.press(ui.getByLabelText('Confirmar retirada'));
    fireEvent.press(ui.getByLabelText('Confirmar retirada'));
    expect(mockWithdraw).toHaveBeenCalledTimes(1);
    expect(mockWithdraw).toHaveBeenCalledWith({ goalId: 'goal', accountId: 'account', amount: 100, note: 'Emergência' });
    await act(async () => resolve('withdrawal'));
    expect(mockSuccess).toHaveBeenCalledWith('Retirada registrada.');
    expect(ui.queryByText('Retirar Valor')).toBeNull();
  });
  it('preserves the entered amount when the server rejects a changed balance', async () => {
    mockWithdraw.mockRejectedValue(new Error('Saldo atualizado insuficiente'));
    const ui = screen();
    fireEvent.press(ui.getByLabelText('Retirar valor de Reserva'));
    fireEvent.changeText(ui.getByLabelText('Valor da movimentação'), '5000');
    fireEvent.press(ui.getByLabelText('Confirmar retirada'));
    await waitFor(() => expect(mockError).toHaveBeenCalledWith('Saldo atualizado insuficiente'));
    expect(ui.getByLabelText('Valor da movimentação').props.value).toBe('50,00');
    expect(ui.getByText('Retirar Valor')).toBeTruthy();
  });
  it('disables withdrawal for an empty goal', () => {
    mockGoals[0].currentAmount = 0;
    expect(screen().getByLabelText('Retirar valor de Reserva')).toBeDisabled();
  });
  it('offers withdrawal from completed goals', () => {
    mockGoals[0].status = 'completed';
    const ui = screen();
    fireEvent.press(ui.getByText('Concluídas (1)'));
    fireEvent.press(ui.getByLabelText('Retirar valor de Reserva'));
    expect(ui.getByText('Retirar Valor')).toBeTruthy();
  });
  it('requires an active destination account', () => {
    mockAccounts[0].isActive = false;
    const ui = screen();
    fireEvent.press(ui.getByLabelText('Retirar valor de Reserva'));
    expect(ui.getByLabelText('Confirmar retirada')).toBeDisabled();
  });
  it('keeps the existing contribution flow', async () => {
    const ui = screen();
    fireEvent.press(ui.getByLabelText('Adicionar valor a Reserva'));
    fireEvent.changeText(ui.getByLabelText('Valor da movimentação'), '2500');
    fireEvent.press(ui.getByLabelText('Confirmar aporte'));
    await waitFor(() => expect(mockSuccess).toHaveBeenCalledWith('Aporte registrado.'));
    expect(mockContribute).toHaveBeenCalledWith({ goalId: 'goal', accountId: 'account', amount: 25, note: '' });
    expect(mockWithdraw).not.toHaveBeenCalled();
  });
});
