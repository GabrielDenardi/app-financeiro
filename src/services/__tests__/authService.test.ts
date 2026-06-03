const mockRpc = jest.fn();
const mockSignInWithPassword = jest.fn();
const mockSignUp = jest.fn();
const mockResend = jest.fn();
const mockResetPassword = jest.fn();
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
    rpc: (...args: unknown[]) => mockRpc(...args),
    auth: {
      signInWithPassword: (...args: unknown[]) => mockSignInWithPassword(...args),
      signUp: (...args: unknown[]) => mockSignUp(...args),
      resend: (...args: unknown[]) => mockResend(...args),
      resetPasswordForEmail: (...args: unknown[]) => mockResetPassword(...args),
      updateUser: (...args: unknown[]) => mockUpdateUser(...args),
    },
  },
}));

jest.mock('../../lib/authRedirect', () => ({
  getAuthRedirectUrl: () => 'appfinanceiro://auth/callback',
}));

import {
  AuthServiceError,
  lookupCpf,
  registerWithDraft,
  requestPasswordResetByCpf,
  signInWithCpf,
  updatePassword,
} from '../authService';

describe('authService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('looks up cpf and returns account details', async () => {
    mockRpc.mockResolvedValueOnce({
      data: {
        account_exists: true,
        email: 'cliente@teste.com',
        email_masked: 'cl***e@teste.com',
        email_confirmed: true,
      },
      error: null,
    });

    await expect(lookupCpf('390.533.447-05')).resolves.toEqual({
      account_exists: true,
      email: 'cliente@teste.com',
      email_masked: 'cl***e@teste.com',
      email_confirmed: true,
    });
  });

  it('authenticates existing cpf with password', async () => {
    mockRpc.mockResolvedValueOnce({
      data: {
        account_exists: true,
        email: 'cliente@teste.com',
        email_masked: 'cl***e@teste.com',
        email_confirmed: true,
      },
      error: null,
    });
    mockSignInWithPassword.mockResolvedValueOnce({ error: null });

    await expect(signInWithCpf('39053344705', 'Senha123')).resolves.toBeUndefined();
    expect(mockSignInWithPassword).toHaveBeenCalledWith({
      email: 'cliente@teste.com',
      password: 'Senha123',
    });
  });

  it('throws explicit error for invalid credentials', async () => {
    mockRpc.mockResolvedValueOnce({
      data: {
        account_exists: true,
        email: 'cliente@teste.com',
        email_masked: 'cl***e@teste.com',
        email_confirmed: true,
      },
      error: null,
    });
    mockSignInWithPassword.mockResolvedValueOnce({
      error: { message: 'Invalid login credentials' },
    });

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

  it('sends password reset using cpf lookup', async () => {
    mockRpc.mockResolvedValueOnce({
      data: {
        account_exists: true,
        email: 'cliente@teste.com',
        email_masked: 'cl***e@teste.com',
        email_confirmed: true,
      },
      error: null,
    });
    mockResetPassword.mockResolvedValueOnce({ error: null });

    await expect(requestPasswordResetByCpf('39053344705')).resolves.toBe('password_reset');
    expect(mockResetPassword).toHaveBeenCalledWith(
      'cliente@teste.com',
      expect.objectContaining({ redirectTo: 'appfinanceiro://auth/callback' }),
    );
  });

  it('resends confirmation instead of password reset for unconfirmed email', async () => {
    mockRpc.mockResolvedValueOnce({
      data: {
        account_exists: true,
        email: 'cliente@teste.com',
        email_masked: 'cl***e@teste.com',
        email_confirmed: false,
      },
      error: null,
    });
    mockResend.mockResolvedValueOnce({ error: null });

    await expect(requestPasswordResetByCpf('39053344705')).resolves.toBe('confirmation_resent');
    expect(mockResend).toHaveBeenCalledWith({
      type: 'signup',
      email: 'cliente@teste.com',
      options: {
        emailRedirectTo: 'appfinanceiro://auth/callback',
      },
    });
    expect(mockResetPassword).not.toHaveBeenCalled();
  });

  it('updates the password for a recovery session', async () => {
    mockUpdateUser.mockResolvedValueOnce({ error: null });

    await expect(updatePassword('Senha123')).resolves.toBeUndefined();
    expect(mockUpdateUser).toHaveBeenCalledWith({
      password: 'Senha123',
    });
  });
});
