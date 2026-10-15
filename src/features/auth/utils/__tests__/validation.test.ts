import { isAdult, isValidCpf, isValidEmail, isValidPhoneBR, parseDateBR, suggestEmailCorrection } from '../validation';

describe('validation utils', () => {
  it.each([
    ['neves.v1977@gmai.com', 'neves.v1977@gmail.com'],
    [' Pessoa+teste@GMIAL.COM ', 'pessoa+teste@gmail.com'],
    ['pessoa@hotmai.com', 'pessoa@hotmail.com'],
    ['pessoa@outlok.com', 'pessoa@outlook.com'],
    ['pessoa@yaho.com', 'pessoa@yahoo.com'],
    ['pessoa@gmail.con', 'pessoa@gmail.com'],
  ])('suggests a correction for %s without losing the mailbox', (email, expected) => {
    expect(suggestEmailCorrection(email)).toBe(expected);
    expect(isValidEmail(email)).toBe(true);
  });

  it.each([
    'pessoa@gmail.com',
    'pessoa@hotmail.com',
    'pessoa@empresa.com.br',
    'pessoa@mail.empresa.dev',
    'gmai@empresa.com',
    'email-invalido',
    'pessoa@@gmai.com',
    '',
  ])('does not guess a correction for %s', (email) => {
    expect(suggestEmailCorrection(email)).toBeNull();
  });

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

