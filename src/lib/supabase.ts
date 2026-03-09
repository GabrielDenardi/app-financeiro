import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';

import { appEnv, hasSupabaseEnv } from '../config/env';

if (!hasSupabaseEnv) {
  console.warn(
    '[Supabase] Variaveis EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_ANON_KEY nao configuradas.',
  );
}

const fallbackUrl = appEnv.supabaseUrl || 'https://placeholder.supabase.co';
const fallbackAnonKey = appEnv.supabaseAnonKey || 'placeholder-anon-key';

const inMemoryStorage = new Map<string, string>();

function getWebStorage(): Storage | null {
  if (typeof globalThis === 'undefined' || !('localStorage' in globalThis)) {
    return null;
  }

  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

const safeStorage = {
  async getItem(key: string): Promise<string | null> {
    const webStorage = getWebStorage();
    if (webStorage) {
      const webValue = webStorage.getItem(key);
      if (typeof webValue === 'string' || webValue === null) {
        return webValue;
      }
    }

    return inMemoryStorage.get(key) ?? null;
  },
  async setItem(key: string, value: string): Promise<void> {
    const webStorage = getWebStorage();
    if (webStorage) {
      webStorage.setItem(key, value);
      return;
    }

    inMemoryStorage.set(key, value);
  },
  async removeItem(key: string): Promise<void> {
    const webStorage = getWebStorage();
    if (webStorage) {
      webStorage.removeItem(key);
      return;
    }

    inMemoryStorage.delete(key);
  },
};

export const supabase = createClient(fallbackUrl, fallbackAnonKey, {
  auth: {
    storage: safeStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
