type RuntimeEnv = Record<string, string | undefined>;

export const env: RuntimeEnv =
  ((globalThis as typeof globalThis & { process?: { env?: RuntimeEnv } }).process?.env ?? {});

export const providerConfig = {
  supabaseUrl: env.EXPO_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey: env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
  ocrProvider:
    env.EXPO_PUBLIC_OCR_PROVIDER ??
    env.OCR_PROVIDER ??
    (env.EXPO_PUBLIC_OCR_ENDPOINT ? 'endpoint' : 'mock'),
  ocrEndpoint: env.EXPO_PUBLIC_OCR_ENDPOINT ?? env.OCR_ENDPOINT ?? '',
  ocrApiKey: env.EXPO_PUBLIC_OCR_API_KEY ?? env.OCR_API_KEY ?? '',
  communityPushEndpoint: env.EXPO_PUBLIC_COMMUNITY_PUSH_ENDPOINT ?? '',
  scorePredictionEndpoint: env.EXPO_PUBLIC_SCORE_PREDICTION_ENDPOINT ?? '',
  passProvider: env.EXPO_PUBLIC_PASS_PROVIDER ?? env.PASS_PROVIDER ?? 'mock',
  allowMocks: (env.EXPO_PUBLIC_ALLOW_MOCKS ?? 'false') === 'true',
  neisApiKey: env.EXPO_PUBLIC_NEIS_API_KEY ?? env.NEIS_API_KEY ?? '',
  accountDeleteEndpoint: env.EXPO_PUBLIC_ACCOUNT_DELETE_ENDPOINT ?? '',
  supportEmail: env.EXPO_PUBLIC_SUPPORT_EMAIL ?? 'support@wenever.app',
  admobUseTestAds: (env.EXPO_PUBLIC_ADMOB_USE_TEST_ADS ?? 'true') === 'true',
  admobAndroidBannerUnitId: env.EXPO_PUBLIC_ADMOB_ANDROID_BANNER_UNIT_ID ?? '',
  admobIosBannerUnitId: env.EXPO_PUBLIC_ADMOB_IOS_BANNER_UNIT_ID ?? '',
  admobAndroidAppOpenUnitId: env.EXPO_PUBLIC_ADMOB_ANDROID_APP_OPEN_UNIT_ID ?? '',
  admobIosAppOpenUnitId: env.EXPO_PUBLIC_ADMOB_IOS_APP_OPEN_UNIT_ID ?? '',
};

export const hasSupabaseConfig = Boolean(providerConfig.supabaseUrl && providerConfig.supabaseAnonKey);
