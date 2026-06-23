type MfaErrorLike = {
  code?: unknown;
  message?: unknown;
};

export function getMfaErrorMessage(error: unknown): string {
  const candidate = error && typeof error === 'object' ? (error as MfaErrorLike) : null;
  const code = typeof candidate?.code === 'string' ? candidate.code.toLowerCase() : '';
  const message = typeof candidate?.message === 'string' ? candidate.message.toLowerCase() : '';
  const searchable = `${code} ${message}`;

  if (searchable.includes('expired')) {
    return 'O código expirou. Gere um novo código no aplicativo autenticador.';
  }
  if (searchable.includes('factor') && searchable.includes('not found')) {
    return 'Nenhum fator de autenticação verificado foi encontrado.';
  }
  if (
    searchable.includes('invalid') ||
    searchable.includes('verification') ||
    searchable.includes('challenge')
  ) {
    return 'Código inválido. Confira o aplicativo autenticador e tente novamente.';
  }

  return 'Não foi possível verificar o código. Tente novamente.';
}
