function readEnv(name: string): string {
  return (process.env[name] ?? '').trim();
}

function isLikelyPlaceholderUrl(url: string): boolean {
  const normalized = url.toLowerCase();
  return (
    normalized.includes('example.com') ||
    normalized.includes('your-project') ||
    normalized.includes('your_supabase')
  );
}

function sanitizePublicUrl(url: string): string {
  if (!url || isLikelyPlaceholderUrl(url)) {
    return '';
  }

  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return url;
    }
  } catch {
    return '';
  }

  return '';
}

const rawPrivacyPolicyUrl = readEnv('EXPO_PUBLIC_PRIVACY_POLICY_URL');
const rawEmailRedirectUrl = readEnv('EXPO_PUBLIC_EMAIL_REDIRECT_URL');

export const appEnv = {
  supabaseUrl: readEnv('EXPO_PUBLIC_SUPABASE_URL'),
  supabaseAnonKey: readEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY'),
  privacyPolicyUrl: sanitizePublicUrl(rawPrivacyPolicyUrl),
  emailRedirectUrl: sanitizePublicUrl(rawEmailRedirectUrl),
} as const;

export const hasSupabaseEnv =
  appEnv.supabaseUrl.length > 0 && appEnv.supabaseAnonKey.length > 0;

if (rawEmailRedirectUrl && !appEnv.emailRedirectUrl) {
  console.warn(
    '[Env] EXPO_PUBLIC_EMAIL_REDIRECT_URL invalida ou placeholder. O Supabase usara a Site URL padrao do projeto.',
  );
}
