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
const rawTermsOfUseUrl = (process.env.EXPO_PUBLIC_TERMS_OF_USE_URL ?? '').trim();
const rawEmailRedirectUrl = (process.env.EXPO_PUBLIC_EMAIL_REDIRECT_URL ?? '').trim();
const rawRevenueCatGoogleApiKey = (
  process.env.EXPO_PUBLIC_REVENUECAT_GOOGLE_API_KEY ?? ''
).trim();

export const appEnv = {
  supabaseUrl: rawSupabaseUrl,
  supabaseAnonKey: rawSupabaseAnonKey,
  privacyPolicyUrl: sanitizePublicUrl(rawPrivacyPolicyUrl),
  termsOfUseUrl: sanitizePublicUrl(rawTermsOfUseUrl),
  emailRedirectUrl: sanitizePublicUrl(rawEmailRedirectUrl),
  revenueCatGoogleApiKey: rawRevenueCatGoogleApiKey,
} as const;

export const hasSupabaseEnv =
  appEnv.supabaseUrl.length > 0 && appEnv.supabaseAnonKey.length > 0;

function hasPrefixWithBody(value: string, prefix: string): boolean {
  return value.startsWith(prefix) && value.length > prefix.length;
}

export function getRevenueCatKeyStatus(apiKey: string, isDevelopmentBuild: boolean) {
  const isGooglePlayKey = hasPrefixWithBody(apiKey, 'goog_');
  const isTestStore = isDevelopmentBuild && hasPrefixWithBody(apiKey, 'test_');

  return {
    isConfigured: isGooglePlayKey || isTestStore,
    isTestStore,
  };
}

const revenueCatKeyStatus = getRevenueCatKeyStatus(appEnv.revenueCatGoogleApiKey, __DEV__);

export const hasRevenueCatGoogleEnv = revenueCatKeyStatus.isConfigured;

export const isRevenueCatTestStore = revenueCatKeyStatus.isTestStore;

if (rawEmailRedirectUrl && !appEnv.emailRedirectUrl) {
  console.warn(
    '[Env] EXPO_PUBLIC_EMAIL_REDIRECT_URL invalida ou placeholder. O Supabase usara a Site URL padrao do projeto.',
  );
}
