jest.mock('react-native', () => ({ Platform: { OS: 'ios' } }));
jest.mock('expo-linking', () => ({ createURL: () => 'appfinanceiro://auth/callback' }));

const mockExchangeCodeForSession = jest.fn();
jest.mock('../supabase', () => ({
  supabase: { auth: { exchangeCodeForSession: (...args: unknown[]) => mockExchangeCodeForSession(...args) } },
}));
jest.mock('../../config/env', () => ({
  appEnv: { emailRedirectUrl: 'appfinanceiro://auth/callback' },
}));

import { createSessionFromAuthUrl, isAuthCallbackUrl } from '../authRedirect';

describe('authRedirect', () => {
  beforeEach(() => jest.clearAllMocks());

  it('rejects attacker supplied session tokens even on the callback route', async () => {
    const url = 'appfinanceiro://auth/callback#access_token=attacker&refresh_token=attacker';
    expect(isAuthCallbackUrl(url)).toBe(false);
    await expect(createSessionFromAuthUrl(url)).resolves.toBeNull();
    expect(mockExchangeCodeForSession).not.toHaveBeenCalled();
  });

  it('rejects a PKCE code delivered to an untrusted origin', () => {
    expect(isAuthCallbackUrl('https://evil.example/auth/callback?code=stolen')).toBe(false);
  });

  it('exchanges a PKCE code only on the configured callback target', async () => {
    mockExchangeCodeForSession.mockResolvedValueOnce({ error: null });
    await expect(
      createSessionFromAuthUrl('appfinanceiro://auth/callback?code=bound-code&type=recovery'),
    ).resolves.toEqual({ type: 'recovery' });
    expect(mockExchangeCodeForSession).toHaveBeenCalledWith('bound-code');
  });
});
