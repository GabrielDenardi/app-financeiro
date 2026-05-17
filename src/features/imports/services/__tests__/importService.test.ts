jest.mock('expo-file-system/legacy', () => ({
  readAsStringAsync: jest.fn(),
  EncodingType: {
    Base64: 'base64',
  },
}));

jest.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
  },
}));

jest.mock('xlsx', () => ({
  read: jest.fn(),
  utils: {
    sheet_to_json: jest.fn(),
  },
}));

jest.mock('../../../../lib/auth', () => ({
  requireCurrentUserId: jest.fn(),
}));

jest.mock('../../../../lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
    rpc: jest.fn(),
  },
}));

jest.mock('../../../transactions/services/transactionsService', () => ({
  listCategories: jest.fn(),
}));

import { parseAmount, parseRow } from '../importService';

describe('importService amount parsing', () => {
  it.each([
    ['10.50', 10.5],
    ['10,50', 10.5],
    ['1,234.56', 1234.56],
    ['1.234,56', 1234.56],
    ['R$ 1.234,56', 1234.56],
    ['1 234,56', 1234.56],
    ['-10.50', -10.5],
    ['', 0],
    ['abc', 0],
  ])('parses %s as %d', (input, expected) => {
    expect(parseAmount(input)).toBe(expected);
  });

  it('treats a single separator followed by three digits as thousands separator', () => {
    expect(parseAmount('1.234')).toBe(1234);
    expect(parseAmount('12,345')).toBe(12345);
  });
});

describe('importService row parsing', () => {
  it('uses amount field with point decimal without inflating the value', () => {
    expect(
      parseRow({
        amount: '10.50',
        description: 'Salario',
        date: '2026-05-17',
      }),
    ).toMatchObject({
      title: 'Salario',
      amount: 10.5,
      type: 'income',
      occurredOn: '2026-05-17',
    });
  });

  it('supports alternate value columns from imported spreadsheets', () => {
    expect(
      parseRow({
        value: '1,234.56',
        title: 'Freela',
        date: '2026-05-17',
      }),
    ).toMatchObject({
      title: 'Freela',
      amount: 1234.56,
    });

    expect(
      parseRow({
        valor: '1.234,56',
        descricao: 'Mercado',
        data: '17/05/2026',
        tipo: 'despesa',
      }),
    ).toMatchObject({
      title: 'Mercado',
      amount: 1234.56,
      type: 'expense',
      occurredOn: '2026-05-17',
    });
  });
});
