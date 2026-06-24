import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

import { hasSupabaseConfig, providerConfig } from './env';

export const supabase: SupabaseClient | null = hasSupabaseConfig
  ? createClient(providerConfig.supabaseUrl, providerConfig.supabaseAnonKey, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  : null;

export const getBackendMode = () => {
  if (supabase) {
    return '서비스 연결됨';
  }

  return providerConfig.allowMocks ? '데모 데이터 사용 중' : '연결 확인 필요';
};

export async function clearSupabaseAuthStorage() {
  if (!supabase) {
    return;
  }

  const authClient = supabase.auth as unknown as {
    storage?: { removeItem?: (key: string) => Promise<void> | void };
    storageKey?: string;
  };
  const storageKey = authClient.storageKey;
  const removeItem = authClient.storage?.removeItem?.bind(authClient.storage);

  if (!storageKey || !removeItem) {
    return;
  }

  await Promise.all(
    [storageKey, `${storageKey}-code-verifier`, `${storageKey}-user`].map((key) =>
      Promise.resolve(removeItem(key)).catch(() => undefined),
    ),
  );
}
