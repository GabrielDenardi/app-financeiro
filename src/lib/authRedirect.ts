import { Platform } from 'react-native';
import * as Linking from 'expo-linking';
import type { EmailOtpType } from '@supabase/supabase-js';

import { appEnv } from '../config/env';
import { supabase } from './supabase';

const AUTH_CALLBACK_PATH = 'auth/callback';

export type AuthCallbackOutcome = {
  type: 'signup' | 'recovery' | 'email_change' | 'magiclink' | 'invite' | 'unknown';
};

const supportedOtpTypes: EmailOtpType[] = [
  'signup',
  'invite',
  'magiclink',
  'recovery',
  'email_change',
  'email',
];

function createRuntimeRedirectUrl() {
  return Linking.createURL(AUTH_CALLBACK_PATH);
}

function isSupportedOtpType(value: string | null): value is EmailOtpType {
  return Boolean(value && supportedOtpTypes.includes(value as EmailOtpType));
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
  const parsedUrl = new URL(url);
  const params = extractParams(url);
  const normalizedPath = parsedUrl.pathname.replace(/^\/+/, '');

  return (
    normalizedPath.endsWith(AUTH_CALLBACK_PATH) ||
    params.has('code') ||
    params.has('token_hash') ||
    params.has('access_token')
  );
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

  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');

  if (accessToken && refreshToken) {
    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    if (error) {
      throw error;
    }
    return { type: callbackType };
  }

  const tokenHash = params.get('token_hash');

  if (tokenHash && isSupportedOtpType(type)) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    });

    if (error) {
      throw error;
    }

    return {
      type: normalizeCallbackType(type),
    };
  }

  return { type: callbackType };
}
