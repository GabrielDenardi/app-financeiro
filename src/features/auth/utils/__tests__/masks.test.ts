import {
  digitsOnly,
  formatAddressNumber,
  formatCep,
  formatCpf,
  formatDateBR,
  formatPhoneBR,
} from '../masks';

describe('masks utils', () => {
  it('formats CPF correctly', () => {
    expect(formatCpf('39053344705')).toBe('390.533.447-05');
    expect(formatCpf('390.533.447-05')).toBe('390.533.447-05');
  });

  it('formats BR phone correctly', () => {
    expect(formatPhoneBR('11987654321')).toBe('(11) 98765-4321');
    expect(formatPhoneBR('119876')).toBe('(11) 9876');
  });

  it('formats date and cep correctly', () => {
    expect(formatDateBR('01011990')).toBe('01/01/1990');
    expect(formatCep('12345678')).toBe('12345-678');
  });

  it('keeps only digits when needed', () => {
    expect(digitsOnly('(11) 98765-4321')).toBe('11987654321');
    expect(formatAddressNumber('12A34B')).toBe('1234');
  });
});

