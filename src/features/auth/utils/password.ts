const MIN_PASSWORD_LENGTH = 8;

function hasSequence(value: string): boolean {
  const lower = value.toLowerCase();
  const sources = ['0123456789', 'abcdefghijklmnopqrstuvwxyz'];

  for (const source of sources) {
    for (let index = 0; index <= source.length - 4; index += 1) {
      const sequence = source.slice(index, index + 4);
      const reversed = sequence.split('').reverse().join('');

      if (lower.includes(sequence) || lower.includes(reversed)) {
        return true;
      }
    }
  }

  return false;
}

export function validatePassword(value: string): string | null {
  const password = value.trim();

  if (password.length < MIN_PASSWORD_LENGTH) {
    return 'A senha deve ter pelo menos 8 caracteres.';
  }

  if (!/[a-z]/i.test(password) || !/\d/.test(password)) {
    return 'Use letras e números na senha.';
  }

  if (hasSequence(password)) {
    return 'Evite sequências simples como 1234 ou abcd.';
  }

  return null;
}

