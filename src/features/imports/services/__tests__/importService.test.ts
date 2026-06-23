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

jest.mock('@e965/xlsx', () => ({
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

import { MAX_IMPORT_ROWS, parseAmount, parseRow, XLSX_SHEET_ROW_LIMIT } from '../importService';

// Serial Excel 46_000 → data correta: 09/12/2025 no sistema 1900 do Excel.
const EXCEL_SERIAL_46000_DATE = '2025-12-09';

it('reserves one header row plus one overflow sentinel when reading spreadsheets', () => {
  expect(XLSX_SHEET_ROW_LIMIT).toBe(MAX_IMPORT_ROWS + 2);
});

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

describe('importService date parsing via parseRow', () => {
  it('converte serial numérico do Excel para a data correta', () => {
    const row = parseRow({ amount: '10', description: 'Teste', date: 46_000 });
    expect(row.occurredOn).toBe(EXCEL_SERIAL_46000_DATE);
  });

  it('converte serial Excel representado como string numérica', () => {
    const row = parseRow({ amount: '10', description: 'Teste', date: '46000' });
    expect(row.occurredOn).toBe(EXCEL_SERIAL_46000_DATE);
  });

  it('retorna null para formato de data não reconhecido (sem fallback para hoje)', () => {
    const row = parseRow({ amount: '10', description: 'Teste', date: 'data-errada' });
    expect(row.occurredOn).toBeNull();
  });

  it('retorna null para data ISO inválida', () => {
    const row = parseRow({ amount: '10', description: 'Teste', date: '2026-02-31' });
    expect(row.occurredOn).toBeNull();
  });

  it('retorna null para formato ISO incompleto ou ambíguo sem correspondência exata', () => {
    const row = parseRow({ amount: '10', description: 'Teste', date: '05-06-2026' });
    expect(row.occurredOn).toBeNull();
  });

  it('preserva a data de origem em datetime ISO com offset', () => {
    const row = parseRow({ amount: '10', description: 'Teste', date: '2024-05-01T00:30:00+14:00' });
    expect(row.occurredOn).toBe('2024-05-01');
  });

  it('retorna null para data vazia', () => {
    const row = parseRow({ amount: '10', description: 'Teste', date: '' });
    expect(row.occurredOn).toBeNull();
  });

  it('aceita objeto Date válido', () => {
    const row = parseRow({ amount: '10', description: 'Teste', date: new Date('2026-03-15T12:00:00Z') });
    expect(row.occurredOn).toBe('2026-03-15');
  });

  it('retorna null para objeto Date inválido', () => {
    const row = parseRow({ amount: '10', description: 'Teste', date: new Date('invalid') });
    expect(row.occurredOn).toBeNull();
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
