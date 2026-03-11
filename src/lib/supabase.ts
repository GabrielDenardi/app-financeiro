import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

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
    if (Platform.OS !== 'web') {
      try {
        return await AsyncStorage.getItem(key);
      } catch {
        return inMemoryStorage.get(key) ?? null;
      }
    }

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
    if (Platform.OS !== 'web') {
      try {
        await AsyncStorage.setItem(key, value);
        return;
      } catch {
        inMemoryStorage.set(key, value);
        return;
      }
    }

    const webStorage = getWebStorage();
    if (webStorage) {
      webStorage.setItem(key, value);
      return;
    }

    inMemoryStorage.set(key, value);
  },
  async removeItem(key: string): Promise<void> {
    if (Platform.OS !== 'web') {
      try {
        await AsyncStorage.removeItem(key);
      } finally {
        inMemoryStorage.delete(key);
      }
      return;
    }

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
