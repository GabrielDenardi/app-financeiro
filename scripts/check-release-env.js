const GOOGLE_PLAY_KEY_PREFIX = 'goog_';

const buildProfile = process.env.EAS_BUILD_PROFILE;
const revenueCatKey = (process.env.EXPO_PUBLIC_REVENUECAT_GOOGLE_API_KEY ?? '').trim();

const isGooglePlayKey =
  revenueCatKey.startsWith(GOOGLE_PLAY_KEY_PREFIX) &&
  revenueCatKey.length > GOOGLE_PLAY_KEY_PREFIX.length;

if (buildProfile === 'production' && !isGooglePlayKey) {
  console.error(
    'Build de producao bloqueado: EXPO_PUBLIC_REVENUECAT_GOOGLE_API_KEY precisa ser a chave goog_ da Google Play, nao a da Test Store.',
  );
  process.exit(1);
}
