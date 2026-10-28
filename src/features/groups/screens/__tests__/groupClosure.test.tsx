import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { AppThemeProvider } from '../../../../theme';
import { GroupDetailsScreen } from '../GroupDetailsScreen';
import { GroupsScreen } from '../GroupsScreen';

const mockClose = jest.fn();
const mockReopen = jest.fn();
const mockBack = jest.fn();
const mockResult = jest.fn();
const mockSuccess = jest.fn();
let mockDetails: any;
let mockList: any[];

jest.mock('@react-navigation/native', () => ({ ...jest.requireActual('@react-navigation/native'), useNavigation: () => ({ goBack: mockBack, navigate: jest.fn() }) }));
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn() }));
jest.mock('../../../../components/Toast', () => ({ useToast: () => ({ showSuccess: mockSuccess, showError: jest.fn() }) }));
jest.mock('../../../../components/ResultModal', () => ({ useResultModal: () => ({ showResult: mockResult }) }));
jest.mock('../../../../components/PageShell', () => ({ PageShell: ({ children, footer }: any) => <>{children}{footer}</> }));
jest.mock('../../../../components/BottomSheet', () => ({ BottomSheet: () => null }));
jest.mock('../../../../components/ConfirmDialog', () => ({ ConfirmDialog: ({ visible, message, confirmLabel, onConfirm }: any) => {
  const { Text, Pressable } = require('react-native');
  return visible ? <><Text>{message}</Text><Pressable accessibilityLabel={`Confirmar ${confirmLabel}`} onPress={onConfirm}><Text>{confirmLabel}</Text></Pressable></> : null;
} }));
jest.mock('../../../preferences/hooks/usePreferences', () => ({ usePreferences: () => ({ data: {} }) }));
jest.mock('../../../transactions/services/transactionCaptureService', () => ({}));
jest.mock('../../../plans/components/UpgradePaywallSheet', () => ({ UpgradePaywallSheet: () => null }));
jest.mock('../../../plans/hooks', () => ({ useCurrentPlan: () => ({ entitlements: { createGroups: true } }) }));
jest.mock('../../hooks/useGroups', () => ({
  useGroupDetails: () => ({ data: mockDetails }), useGroups: () => ({ data: mockList }),
  useCreateGroupMutation: () => ({}), useJoinGroupMutation: () => ({}),
  useCreateGroupSplitMutation: () => ({}), useRequestSettlementMutation: () => ({}),
  useConfirmSettlementMutation: () => ({}), useRemoveGroupMemberMutation: () => ({}),
  useCloseGroupMutation: () => ({ mutateAsync: mockClose }),
  useReopenGroupMutation: () => ({ mutateAsync: mockReopen }),
}));
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));

const user = { id: 'user', email: 'teste@example.com', fullName: 'Teste' } as any;
const details = () => render(<AppThemeProvider><GroupDetailsScreen currentUser={user} groupId="group" /></AppThemeProvider>);

describe('group closure screens', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockClose.mockResolvedValue('group');
    mockReopen.mockResolvedValue('group');
    mockDetails = {
      group: { id: 'group', title: 'Casa', description: '', status: 'active', shareCode: 'ABC123', closedAt: null, closedBy: null },
      currentUserRole: 'admin', members: [], splits: [], settlements: [], balances: [], currentUserNet: 0,
      summary: { totalDivided: 0, settled: 0, pending: 0 },
    };
    mockList = [mockDetails, { ...mockDetails, group: { ...mockDetails.group, id: 'closed', title: 'Viagem antiga', status: 'inactive', closedAt: '2026-10-20T12:00:00Z' } }];
  });

  it('requires confirmation before closing and returns to the list after success', async () => {
    const ui = details();
    fireEvent.press(ui.getByLabelText('Encerrar grupo'));
    expect(mockClose).not.toHaveBeenCalled();
    expect(ui.getByText(/O grupo será desativado/)).toBeTruthy();
    fireEvent.press(ui.getByLabelText('Confirmar Encerrar'));
    await waitFor(() => expect(mockSuccess).toHaveBeenCalledWith('Grupo encerrado.'));
    expect(mockClose).toHaveBeenCalledTimes(1);
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it.each(['member', 'inactive'])('does not offer closing for %s', value => {
    if (value === 'member') mockDetails.currentUserRole = 'member';
    else mockDetails.group.status = 'inactive';
    expect(details().queryByLabelText('Encerrar grupo')).toBeNull();
  });

  it.each(['balance', 'settlement'])('blocks confirmation for pending %s', pending => {
    if (pending === 'balance') mockDetails.summary.pending = 20;
    else mockDetails.settlements = [{ id: 'pending', status: 'pending' }];
    const ui = details();
    fireEvent.press(ui.getByLabelText('Encerrar grupo'));
    expect(mockResult).toHaveBeenCalledWith(expect.objectContaining({ variant: 'error' }));
    expect(ui.queryByLabelText('Confirmar Encerrar')).toBeNull();
    expect(mockClose).not.toHaveBeenCalled();
  });

  it('shows a backend rejection without leaving the group', async () => {
    mockClose.mockRejectedValue(new Error('Existem saldos em aberto'));
    const ui = details();
    fireEvent.press(ui.getByLabelText('Encerrar grupo'));
    fireEvent.press(ui.getByLabelText('Confirmar Encerrar'));
    await waitFor(() => expect(mockResult).toHaveBeenCalledWith(expect.objectContaining({ message: 'Existem saldos em aberto' })));
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('offers consultation and confirmed reopening to the administrator of an inactive group', async () => {
    mockDetails.group.status = 'inactive';
    const ui = details();
    expect(ui.getByText(/Somente consulta/)).toBeTruthy();
    expect(ui.queryByLabelText('Registrar divisão')).toBeNull();
    fireEvent.press(ui.getByLabelText('Reativar grupo'));
    expect(mockReopen).not.toHaveBeenCalled();
    fireEvent.press(ui.getByLabelText('Confirmar Reativar'));
    await waitFor(() => expect(mockSuccess).toHaveBeenCalledWith('Grupo reativado.'));
  });

  it('separates closed groups from the main list and allows history consultation', () => {
    const ui = render(<AppThemeProvider><GroupsScreen currentUser={user} /></AppThemeProvider>);
    expect(ui.getByLabelText('Abrir grupo Casa')).toBeTruthy();
    expect(ui.queryByLabelText('Abrir grupo Viagem antiga')).toBeNull();
    fireEvent.press(ui.getByText('Encerrados (1)'));
    expect(ui.queryByLabelText('Abrir grupo Casa')).toBeNull();
    expect(ui.getByLabelText('Abrir grupo Viagem antiga')).toBeTruthy();
    expect(ui.getByText('Consultar histórico')).toBeTruthy();
  });
});
