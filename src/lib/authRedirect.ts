import { Platform } from 'react-native';
import * as Linking from 'expo-linking';
import { appEnv } from '../config/env';
import { supabase } from './supabase';

const AUTH_CALLBACK_PATH = 'auth/callback';
const NATIVE_AUTH_CALLBACK_URL = 'appfinanceiro://auth/callback';

export type AuthCallbackOutcome = {
  type: 'signup' | 'recovery' | 'email_change' | 'magiclink' | 'invite' | 'unknown';
};

function createRuntimeRedirectUrl() {
  if (Platform.OS !== 'web') {
    return NATIVE_AUTH_CALLBACK_URL;
  }

  return Linking.createURL(AUTH_CALLBACK_PATH);
}

function normalizeCallbackType(value: string | null): AuthCallbackOutcome['type'] {
  if (
    value === 'signup' ||
    value === 'recovery' ||
    value === 'email_change' ||
    value === 'magiclink' ||
    value === 'invite'
  ) {
    return value;
  }

  return 'unknown';
}

function extractParams(url: string) {
  const parsedUrl = new URL(url);
  const params = new URLSearchParams(parsedUrl.search);
  const hashParams = new URLSearchParams(parsedUrl.hash.startsWith('#') ? parsedUrl.hash.slice(1) : '');

  hashParams.forEach((value, key) => {
    if (!params.has(key)) {
      params.set(key, value);
    }
  });

  return params;
}

export function isAuthCallbackUrl(url: string) {
  try {
    const candidate = new URL(url);
    const expected = new URL(getAuthRedirectUrl());
    const sameTarget =
      candidate.protocol === expected.protocol &&
      candidate.hostname === expected.hostname &&
      candidate.port === expected.port &&
      candidate.pathname.replace(/\/+$/, '') === expected.pathname.replace(/\/+$/, '');

    return sameTarget && extractParams(url).has('code');
  } catch {
    return false;
  }
}

export function getAuthRedirectUrl() {
  if (appEnv.emailRedirectUrl) {
    return appEnv.emailRedirectUrl;
  }

  if (Platform.OS === 'web') {
    return createRuntimeRedirectUrl();
  }

  return createRuntimeRedirectUrl();
}

export async function createSessionFromAuthUrl(url: string): Promise<AuthCallbackOutcome | null> {
  if (!isAuthCallbackUrl(url)) {
    return null;
  }

  const params = extractParams(url);
  const code = params.get('code');
  const type = params.get('type');
  const callbackType = normalizeCallbackType(type);

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      throw error;
    }
    return { type: callbackType };
  }

  return null;
}
