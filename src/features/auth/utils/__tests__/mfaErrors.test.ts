import { getMfaErrorMessage } from '../mfaErrors';

describe('getMfaErrorMessage', () => {
  it('localizes known verification failures', () => {
    expect(getMfaErrorMessage({ code: 'mfa_verification_failed' })).toContain('Código inválido');
    expect(getMfaErrorMessage({ message: 'MFA challenge expired' })).toContain('expirou');
  });

  it('never exposes an unknown provider message', () => {
    expect(getMfaErrorMessage(new Error('Internal provider detail'))).toBe(
      'Não foi possível verificar o código. Tente novamente.',
    );
  });
});
