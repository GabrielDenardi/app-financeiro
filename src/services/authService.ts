import { hasSupabaseEnv } from '../config/env';
import { digitsOnly } from '../features/auth/utils/masks';
import { getAuthRedirectUrl } from '../lib/authRedirect';
import { supabase } from '../lib/supabase';
import type { CpfLookupResult, RegistrationDraft } from '../types/auth';

export type AuthServiceErrorCode =
  | 'missing_env'
  | 'cpf_not_found'
  | 'invalid_credentials'
  | 'email_not_confirmed'
  | 'unknown';

export class AuthServiceError extends Error {
  code: AuthServiceErrorCode;

  constructor(code: AuthServiceErrorCode, message: string) {
    super(message);
    this.name = 'AuthServiceError';
    this.code = code;
  }
}

type LookupRpcRow = {
  account_exists: boolean;
  email: string | null;
  email_masked: string | null;
  email_confirmed: boolean;
};

function ensureSupabaseEnv() {
  if (!hasSupabaseEnv) {
    throw new AuthServiceError(
      'missing_env',
      'Configure EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_ANON_KEY antes de usar autenticação.',
    );
  }
}

function normalizeLookupPayload(value: LookupRpcRow | LookupRpcRow[] | null): CpfLookupResult {
  if (!value) {
    return {
      account_exists: false,
      email: null,
      email_masked: null,
      email_confirmed: false,
    };
  }

  const row = Array.isArray(value) ? value[0] : value;
  return {
    account_exists: Boolean(row?.account_exists),
    email: row?.email ?? null,
    email_masked: row?.email_masked ?? null,
    email_confirmed: Boolean(row?.email_confirmed),
  };
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

export async function lookupCpf(cpfDigits: string): Promise<CpfLookupResult> {
  ensureSupabaseEnv();

  const normalizedCpf = digitsOnly(cpfDigits);

  // Compatibility fallback: some databases expose lookup_account_by_cpf(cpf text)
  // while others use lookup_account_by_cpf(p_cpf text).
  let response = await supabase.rpc('lookup_account_by_cpf', {
    p_cpf: normalizedCpf,
  });

  if (response.error) {
    const message = response.error.message.toLowerCase();
    const canRetryWithLegacyParam =
      message.includes('lookup_account_by_cpf(p_cpf)') ||
      message.includes('could not find the function');

    if (canRetryWithLegacyParam) {
      response = await supabase.rpc('lookup_account_by_cpf', {
        cpf: normalizedCpf,
      });
    }
  }

  if (response.error) {
    const lowered = response.error.message.toLowerCase();

    if (lowered.includes('could not find the function')) {
      throw new AuthServiceError(
        'unknown',
        'Função lookup_account_by_cpf não encontrada no Supabase. Rode a migration SQL de onboarding no seu projeto.',
      );
    }

    throw new AuthServiceError('unknown', response.error.message);
  }

  return normalizeLookupPayload(response.data as LookupRpcRow | LookupRpcRow[] | null);
}

export async function signInWithCpf(cpfDigits: string, password: string): Promise<void> {
  ensureSupabaseEnv();

  const lookup = await lookupCpf(cpfDigits);
  if (!lookup.account_exists || !lookup.email) {
    throw new AuthServiceError('cpf_not_found', 'Não existe conta para este CPF.');
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: lookup.email,
    password,
  });

  if (error) {
    throw mapAuthError(error.message);
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
    throw new AuthServiceError('unknown', error.message);
  }
}

export async function requestPasswordResetByCpf(cpfDigits: string): Promise<void> {
  ensureSupabaseEnv();
  const redirectTo = getAuthRedirectUrl();

  const lookup = await lookupCpf(cpfDigits);
  if (!lookup.account_exists || !lookup.email) {
    throw new AuthServiceError('cpf_not_found', 'Não existe conta para este CPF.');
  }

  const { error } = await supabase.auth.resetPasswordForEmail(lookup.email, {
    redirectTo,
  });

  if (error) {
    throw new AuthServiceError('unknown', error.message);
  }
}
