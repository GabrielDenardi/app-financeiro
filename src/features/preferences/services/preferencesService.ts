import { Platform } from 'react-native';

import { requireCurrentUserId } from '../../../lib/auth';
import { supabase } from '../../../lib/supabase';
import type { LoginEvent, MfaEnrollment, UserPreferences } from '../types';

type PreferencesRow = {
  user_id: string;
  hide_values_home: boolean;
  biometric_enabled: boolean;
  login_alerts_enabled: boolean;
  share_anonymous_stats: boolean;
  two_factor_enabled: boolean;
};

type LoginEventRow = {
  id: string;
  event_type: string;
  device_label: string;
  platform: string;
  created_at: string;
};

function mapPreferences(row: PreferencesRow): UserPreferences {
  return {
    userId: row.user_id,
    hideValuesHome: Boolean(row.hide_values_home),
    biometricEnabled: Boolean(row.biometric_enabled),
    loginAlertsEnabled: Boolean(row.login_alerts_enabled),
    shareAnonymousStats: Boolean(row.share_anonymous_stats),
    twoFactorEnabled: Boolean(row.two_factor_enabled),
  };
}

function mapLoginEvent(row: LoginEventRow): LoginEvent {
  return {
    id: row.id,
    eventType: row.event_type,
    deviceLabel: row.device_label,
    platform: row.platform,
    createdAt: row.created_at,
  };
}

export async function getPreferences(): Promise<UserPreferences> {
  const userId = await requireCurrentUserId();
  const { data, error } = await supabase
    .from('user_preferences')
    .select('user_id, hide_values_home, biometric_enabled, login_alerts_enabled, share_anonymous_stats, two_factor_enabled')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    const { error: ensureError } = await supabase.rpc('ensure_user_preferences', {
      p_user_id: userId,
    });

    if (ensureError) {
      throw new Error(ensureError.message);
    }

    return getPreferences();
  }

  return mapPreferences(data as PreferencesRow);
}

export async function updatePreferences(patch: Partial<UserPreferences>): Promise<UserPreferences> {
  const userId = await requireCurrentUserId();
  const payload: Record<string, unknown> = {};

  if (typeof patch.hideValuesHome === 'boolean') {
    payload.hide_values_home = patch.hideValuesHome;
  }

  if (typeof patch.biometricEnabled === 'boolean') {
    payload.biometric_enabled = patch.biometricEnabled;
  }

  if (typeof patch.loginAlertsEnabled === 'boolean') {
    payload.login_alerts_enabled = patch.loginAlertsEnabled;
  }

  if (typeof patch.shareAnonymousStats === 'boolean') {
    payload.share_anonymous_stats = patch.shareAnonymousStats;
  }

  if (typeof patch.twoFactorEnabled === 'boolean') {
    payload.two_factor_enabled = patch.twoFactorEnabled;
  }

  const { data, error } = await supabase
    .from('user_preferences')
    .update(payload)
    .eq('user_id', userId)
    .select('user_id, hide_values_home, biometric_enabled, login_alerts_enabled, share_anonymous_stats, two_factor_enabled')
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return mapPreferences(data as PreferencesRow);
}

export async function listLoginEvents(): Promise<LoginEvent[]> {
  const userId = await requireCurrentUserId();
  const { data, error } = await supabase
    .from('auth_login_events')
    .select('id, event_type, device_label, platform, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    throw new Error(error.message);
  }

  return ((data as LoginEventRow[] | null) ?? []).map(mapLoginEvent);
}

export async function registerLoginEvent(
  eventType: 'sign_in' | 'sign_out' | 'mfa_enabled' | 'mfa_disabled' | 'password_reset',
) {
  const userId = await requireCurrentUserId();
  const { error } = await supabase.from('auth_login_events').insert({
    user_id: userId,
    event_type: eventType,
    device_label: `App ${Platform.OS}`,
    platform: Platform.OS,
    metadata: {
      locale:
        typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().locale : 'unknown',
    },
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function enrollTotpFactor(): Promise<MfaEnrollment> {
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: 'totp',
    friendlyName: `app-financeiro-${Platform.OS}`,
    issuer: 'app-financeiro',
  });

  if (error || !data) {
    throw new Error(error?.message ?? 'Nao foi possivel iniciar o MFA.');
  }

  return {
    factorId: data.id,
    qrCode: data.totp.qr_code,
    secret: data.totp.secret,
    uri: data.totp.uri,
  };
}

export async function verifyTotpFactor(factorId: string, code: string): Promise<void> {
  const { error } = await supabase.auth.mfa.challengeAndVerify({
    factorId,
    code: code.trim(),
  });

  if (error) {
    throw new Error(error.message);
  }

  await updatePreferences({ twoFactorEnabled: true });
  await registerLoginEvent('mfa_enabled');
}

export async function disableTotpFactor(factorId: string): Promise<void> {
  const { error } = await supabase.auth.mfa.unenroll({
    factorId,
  });

  if (error) {
    throw new Error(error.message);
  }

  await updatePreferences({ twoFactorEnabled: false });
  await registerLoginEvent('mfa_disabled');
}

export async function listTotpFactors() {
  const { data, error } = await supabase.auth.mfa.listFactors();

  if (error) {
    throw new Error(error.message);
  }

  return data.totp.filter((factor) => factor.status === 'verified');
}

export async function requestDataExport(): Promise<string | null> {
  const userId = await requireCurrentUserId();
  const { data, error } = await supabase
    .from('data_export_requests')
    .insert({
      user_id: userId,
      status: 'pending',
    })
    .select('id')
    .single();

  if (error) {
    throw new Error(error.message);
  }

  const { error: invokeError } = await supabase.functions.invoke('export-user-data', {
    body: {
      requestId: (data as { id: string }).id,
    },
  });

  if (invokeError) {
    throw new Error(invokeError.message);
  }

  const { data: requestData, error: requestFetchError } = await supabase
    .from('data_export_requests')
    .select('storage_path')
    .eq('id', (data as { id: string }).id)
    .eq('user_id', userId)
    .maybeSingle();

  if (requestFetchError) {
    throw new Error(requestFetchError.message);
  }

  if (!(requestData as { storage_path?: string | null } | null)?.storage_path) {
    return null;
  }

  const { data: signedUrlData, error: signedUrlError } = await supabase.storage
    .from('user-data-exports')
    .createSignedUrl((requestData as { storage_path: string }).storage_path, 60 * 60);

  if (signedUrlError) {
    throw new Error(signedUrlError.message);
  }

  return signedUrlData.signedUrl;
}

export async function requestAccountDeletion(reason: string, password: string): Promise<void> {
  const userId = await requireCurrentUserId();
  const { data, error } = await supabase
    .from('account_deletion_requests')
    .insert({
      user_id: userId,
      reason: reason.trim(),
      status: 'pending',
    })
    .select('id')
    .single();

  if (error) {
    throw new Error(error.message);
  }

  const { error: invokeError } = await supabase.functions.invoke('delete-user-account', {
    body: {
      requestId: (data as { id: string }).id,
      password,
    },
  });

  if (invokeError) {
    throw new Error(invokeError.message);
  }

  await supabase.auth.signOut();
}
