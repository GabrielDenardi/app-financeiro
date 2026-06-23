const mockInvoke = jest.fn();
const mockSetSession = jest.fn();
const mockSignUp = jest.fn();
const mockResend = jest.fn();
const mockUpdateUser = jest.fn();

jest.mock('../../config/env', () => ({
  hasSupabaseEnv: true,
  appEnv: {
    supabaseUrl: 'https://test.supabase.co',
    supabaseAnonKey: 'anon-key',
    privacyPolicyUrl: 'https://example.com/privacy',
    emailRedirectUrl: 'appfinanceiro://auth/callback',
  },
}));

jest.mock('../../lib/supabase', () => ({
    supabase: {
    functions: {
      invoke: (...args: unknown[]) => mockInvoke(...args),
    },
    auth: {
      setSession: (...args: unknown[]) => mockSetSession(...args),
      signUp: (...args: unknown[]) => mockSignUp(...args),
      resend: (...args: unknown[]) => mockResend(...args),
      updateUser: (...args: unknown[]) => mockUpdateUser(...args),
    },
  },
}));

jest.mock('../../lib/authRedirect', () => ({
  getAuthRedirectUrl: () => 'appfinanceiro://auth/callback',
}));

import {
  AuthServiceError,
  registerWithDraft,
  requestPasswordResetByCpf,
  signInWithCpf,
  updatePassword,
} from '../authService';

describe('authService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('authenticates CPF through the non-enumerating Edge Function', async () => {
    mockInvoke.mockResolvedValueOnce({
      data: { session: { access_token: 'access', refresh_token: 'refresh' } },
      error: null,
    });
    mockSetSession.mockResolvedValueOnce({ error: null });

    await expect(signInWithCpf('39053344705', 'Senha123')).resolves.toBeUndefined();
    expect(mockInvoke).toHaveBeenCalledWith('cpf-auth', {
      body: { action: 'sign_in', cpf: '39053344705', password: 'Senha123' },
    });
    expect(mockSetSession).toHaveBeenCalledWith({ access_token: 'access', refresh_token: 'refresh' });
  });

  it('throws explicit error for invalid credentials', async () => {
    mockInvoke.mockResolvedValueOnce({ data: null, error: { message: 'Unauthorized' } });

    await expect(signInWithCpf('39053344705', 'errada')).rejects.toBeInstanceOf(AuthServiceError);
  });

  it('registers new account with draft metadata', async () => {
    mockSignUp.mockResolvedValueOnce({ error: null });

    await expect(
      registerWithDraft({
        cpf: '39053344705',
        email: 'novo@teste.com',
        phone: '11987654321',
        fullName: 'Cliente Novo',
        birthDate: '01/01/1990',
        birthCountry: 'Brasil',
        motherName: 'Maria de Souza',
        cep: '01001000',
        street: 'Praca da Se',
        addressNumber: '10',
        complement: 'Sala 2',
        city: 'Sao Paulo',
        state: 'SP',
        password: 'Senha123',
        consentAccepted: true,
      }),
    ).resolves.toBeUndefined();

    expect(mockSignUp).toHaveBeenCalledTimes(1);
    expect(mockSignUp).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({
          data: expect.objectContaining({
            consent_accepted: true,
          }),
        }),
      }),
    );
  });

  it('requests recovery without exposing account state', async () => {
    mockInvoke.mockResolvedValueOnce({ data: { accepted: true }, error: null });

    await expect(requestPasswordResetByCpf('39053344705')).resolves.toBe('password_reset');
    expect(mockInvoke).toHaveBeenCalledWith('cpf-auth', {
      body: { action: 'recover', cpf: '39053344705' },
    });
  });

  it('updates the password for a recovery session', async () => {
    mockUpdateUser.mockResolvedValueOnce({ error: null });

    await expect(updatePassword('Senha123')).resolves.toBeUndefined();
    expect(mockUpdateUser).toHaveBeenCalledWith({
      password: 'Senha123',
    });
  });
});
