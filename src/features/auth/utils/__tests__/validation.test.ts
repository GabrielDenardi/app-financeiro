import { isAdult, isValidCpf, isValidEmail, isValidPhoneBR, parseDateBR } from '../validation';

describe('validation utils', () => {
  it('validates CPF digits correctly', () => {
    expect(isValidCpf('39053344705')).toBe(true);
    expect(isValidCpf('11111111111')).toBe(false);
    expect(isValidCpf('39053344706')).toBe(false);
  });

  it('validates email and phone formats', () => {
    expect(isValidEmail('cliente@empresa.com')).toBe(true);
    expect(isValidEmail('email-invalido')).toBe(false);
    expect(isValidPhoneBR('11987654321')).toBe(true);
    expect(isValidPhoneBR('1198765432')).toBe(false);
  });

  it('parses and validates minimum age', () => {
    const adultDate = parseDateBR('01/01/1990');
    const underageDate = parseDateBR('01/01/2012');

    expect(adultDate).not.toBeNull();
    expect(underageDate).not.toBeNull();
    expect(adultDate ? isAdult(adultDate) : false).toBe(true);
    expect(underageDate ? isAdult(underageDate) : true).toBe(false);
  });
});

