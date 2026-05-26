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
    if (
      parsed.protocol === 'http:' ||
      parsed.protocol === 'https:' ||
      parsed.protocol === 'appfinanceiro:' ||
      parsed.protocol === 'exp:' ||
      parsed.protocol === 'exps:'
    ) {
      return url;
    }
  } catch {
    return '';
  }

  return '';
}

const rawSupabaseUrl = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').trim();
const rawSupabaseAnonKey = (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '').trim();
const rawPrivacyPolicyUrl = (process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL ?? '').trim();
const rawEmailRedirectUrl = (process.env.EXPO_PUBLIC_EMAIL_REDIRECT_URL ?? '').trim();

export const appEnv = {
  supabaseUrl: rawSupabaseUrl,
  supabaseAnonKey: rawSupabaseAnonKey,
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
