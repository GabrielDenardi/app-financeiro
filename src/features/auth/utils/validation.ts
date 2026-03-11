import { digitsOnly } from './masks';

export function isValidCpf(cpfValue: string): boolean {
  const cpf = digitsOnly(cpfValue);

  if (cpf.length !== 11) {
    return false;
  }

  if (/^(\d)\1{10}$/.test(cpf)) {
    return false;
  }

  const calculateDigit = (sliceLength: number): number => {
    let sum = 0;

    for (let index = 0; index < sliceLength; index += 1) {
      sum += Number(cpf[index]) * (sliceLength + 1 - index);
    }

    const remainder = (sum * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };

  const firstDigit = calculateDigit(9);
  const secondDigit = calculateDigit(10);

  return firstDigit === Number(cpf[9]) && secondDigit === Number(cpf[10]);
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim().toLowerCase());
}

export function isValidPhoneBR(phone: string): boolean {
  return digitsOnly(phone).length === 11;
}

export function isValidCep(cep: string): boolean {
  return digitsOnly(cep).length === 8;
}

export function parseDateBR(dateValue: string): Date | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(dateValue.trim());

  if (!match) {
    return null;
  }

  const [, dayString, monthString, yearString] = match;
  const day = Number(dayString);
  const month = Number(monthString);
  const year = Number(yearString);

  const date = new Date(year, month - 1, day);
  const isSameDate =
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day;

  return isSameDate ? date : null;
}

export function isAdult(date: Date, minimumAge = 18): boolean {
  const now = new Date();
  const threshold = new Date(now.getFullYear() - minimumAge, now.getMonth(), now.getDate());
  return date <= threshold;
}

