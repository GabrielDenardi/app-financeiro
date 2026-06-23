import { hasSupabaseEnv } from '../config/env';
import { digitsOnly } from '../features/auth/utils/masks';
import { getAuthRedirectUrl } from '../lib/authRedirect';
import { supabase } from '../lib/supabase';
import type { RegistrationDraft } from '../types/auth';

export type AuthServiceErrorCode =
  | 'missing_env'
  | 'invalid_credentials'
  | 'email_not_confirmed'
  | 'missing_recovery_session'
  | 'unknown';

export type PasswordRecoveryResult = 'password_reset' | 'confirmation_resent';

export class AuthServiceError extends Error {
  code: AuthServiceErrorCode;

  constructor(code: AuthServiceErrorCode, message: string) {
    super(message);
    this.name = 'AuthServiceError';
    this.code = code;
  }
}

function ensureSupabaseEnv() {
  if (!hasSupabaseEnv) {
    throw new AuthServiceError(
      'missing_env',
      'Configure EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_ANON_KEY antes de usar autenticação.',
    );
  }
}

function mapAuthError(errorMessage: string): AuthServiceError {
  const text = errorMessage.toLowerCase();

  if (text.includes('email not confirmed') || text.includes('confirm')) {
    return new AuthServiceError(
      'email_not_confirmed',
      'Seu e-mail ainda não foi confirmado. Verifique sua caixa de entrada.',
    );
  }

  if (text.includes('invalid login credentials') || text.includes('invalid')) {
    return new AuthServiceError('invalid_credentials', 'Senha inválida. Tente novamente.');
  }

  return new AuthServiceError('unknown', errorMessage);
}

async function getFunctionErrorDetails(error: unknown): Promise<{ message: string; status?: number }> {
  const candidate = error && typeof error === 'object'
    ? (error as {
        message?: unknown;
        context?: {
          status?: unknown;
          json?: () => Promise<unknown>;
        };
      })
    : null;
  const fallbackMessage =
    typeof candidate?.message === 'string' ? candidate.message : 'Falha ao acessar o serviço de autenticação.';
  const status = typeof candidate?.context?.status === 'number' ? candidate.context.status : undefined;

  if (typeof candidate?.context?.json === 'function') {
    try {
      const body = await candidate.context.json();
      const responseMessage =
        body && typeof body === 'object' && typeof (body as { error?: unknown }).error === 'string'
          ? (body as { error: string }).error
          : null;
      if (responseMessage) return { message: responseMessage, status };
    } catch {
      // Keep the SDK error as a safe fallback when the response body is unavailable.
    }
  }

  return { message: fallbackMessage, status };
}

function mapRecoveryError(errorMessage: string): AuthServiceError {
  const text = errorMessage.toLowerCase();

  if (text.includes('error sending recovery email')) {
    return new AuthServiceError(
      'unknown',
      'Nao foi possivel enviar o e-mail de redefinicao agora. Se a conta ainda nao foi confirmada, reenvie primeiro o e-mail de confirmacao.',
    );
  }

  return new AuthServiceError('unknown', errorMessage);
}

function mapPasswordUpdateError(errorMessage: string): AuthServiceError {
  const text = errorMessage.toLowerCase();

  if (text.includes('auth session missing') || text.includes('session_not_found')) {
    return new AuthServiceError(
      'missing_recovery_session',
      'Sua sessao de recuperacao expirou. Solicite um novo e-mail para redefinir a senha.',
    );
  }

  return new AuthServiceError('unknown', errorMessage);
}

export async function signInWithCpf(cpfDigits: string, password: string): Promise<void> {
  ensureSupabaseEnv();
  const { data, error } = await supabase.functions.invoke('cpf-auth', {
    body: {
      action: 'sign_in',
      cpf: digitsOnly(cpfDigits),
      password,
    },
  });

  if (error) {
    const details = await getFunctionErrorDetails(error);
    if (details.status === 429) {
      throw new AuthServiceError('unknown', 'Muitas tentativas. Tente novamente mais tarde.');
    }
    throw mapAuthError('Invalid login credentials');
  }

  const session = (data as {
    session?: { access_token?: string; refresh_token?: string };
  } | null)?.session;
  if (!session?.access_token || !session.refresh_token) {
    throw new AuthServiceError('invalid_credentials', 'CPF ou senha inválidos.');
  }

  const { error: sessionError } = await supabase.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  });
  if (sessionError) {
    throw mapAuthError(sessionError.message);
  }
}

export async function registerWithDraft(draft: RegistrationDraft): Promise<void> {
  ensureSupabaseEnv();
  const normalizedEmail = draft.email.trim().toLowerCase();
  const normalizedCpf = digitsOnly(draft.cpf);
  const normalizedPhone = digitsOnly(draft.phone);
  const redirectTo = getAuthRedirectUrl();

  const { data, error } = await supabase.auth.signUp({
    email: normalizedEmail,
    password: draft.password,
    options: {
      emailRedirectTo: redirectTo,
      data: {
        cpf: normalizedCpf,
        full_name: draft.fullName.trim(),
        phone: normalizedPhone,
        birth_date: draft.birthDate,
        birth_country: draft.birthCountry,
        mother_name: draft.motherName.trim(),
        cep: digitsOnly(draft.cep),
        street: draft.street.trim(),
        address_number: draft.addressNumber.trim(),
        complement: draft.complement.trim(),
        city: draft.city.trim(),
        state: draft.state.trim(),
        consent_accepted: draft.consentAccepted,
      },
    },
  });

  if (error) {
    throw mapAuthError(error.message);
  }
}

export async function resendConfirmation(email: string): Promise<void> {
  ensureSupabaseEnv();
  const normalizedEmail = email.trim().toLowerCase();
  const redirectTo = getAuthRedirectUrl();

  const { data, error } = await supabase.auth.resend({
    type: 'signup',
    email: normalizedEmail,
    options: {
      emailRedirectTo: redirectTo,
    },
  });

  if (error) {
    throw mapRecoveryError(error.message);
  }
}

export async function requestPasswordResetByCpf(cpfDigits: string): Promise<PasswordRecoveryResult> {
  ensureSupabaseEnv();
  const { error } = await supabase.functions.invoke('cpf-auth', {
    body: {
      action: 'recover',
      cpf: digitsOnly(cpfDigits),
    },
  });

  if (error) {
    const details = await getFunctionErrorDetails(error);
    if (details.status === 429) {
      throw new AuthServiceError('unknown', 'Muitas tentativas. Tente novamente mais tarde.');
    }
    throw mapRecoveryError(details.message);
  }

  return 'password_reset';
}

export async function updatePassword(password: string): Promise<void> {
  ensureSupabaseEnv();

  const { error } = await supabase.auth.updateUser({
    password,
  });

  if (error) {
    throw mapPasswordUpdateError(error.message);
  }
}
