type RuntimeEnv = Record<string, string | undefined>;

declare const process: { env: RuntimeEnv };

const runtimeEnv = ((globalThis as typeof globalThis & { process?: { env?: RuntimeEnv } }).process?.env ?? {});
const buildTimeEnv: RuntimeEnv = {
  EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
  EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  EXPO_PUBLIC_OCR_PROVIDER: process.env.EXPO_PUBLIC_OCR_PROVIDER,
  EXPO_PUBLIC_OCR_ENDPOINT: process.env.EXPO_PUBLIC_OCR_ENDPOINT,
  EXPO_PUBLIC_OCR_API_KEY: process.env.EXPO_PUBLIC_OCR_API_KEY,
  EXPO_PUBLIC_COMMUNITY_PUSH_ENDPOINT: process.env.EXPO_PUBLIC_COMMUNITY_PUSH_ENDPOINT,
  EXPO_PUBLIC_SCORE_PREDICTION_ENDPOINT: process.env.EXPO_PUBLIC_SCORE_PREDICTION_ENDPOINT,
  EXPO_PUBLIC_AUTH_EMAIL_DOMAIN: process.env.EXPO_PUBLIC_AUTH_EMAIL_DOMAIN,
  EXPO_PUBLIC_ALLOW_MOCKS: process.env.EXPO_PUBLIC_ALLOW_MOCKS,
  EXPO_PUBLIC_NEIS_API_KEY: process.env.EXPO_PUBLIC_NEIS_API_KEY,
  EXPO_PUBLIC_ACCOUNT_DELETE_ENDPOINT: process.env.EXPO_PUBLIC_ACCOUNT_DELETE_ENDPOINT,
  EXPO_PUBLIC_SUPPORT_EMAIL: process.env.EXPO_PUBLIC_SUPPORT_EMAIL,
  EXPO_PUBLIC_ENABLE_APP_OPEN_ADS: process.env.EXPO_PUBLIC_ENABLE_APP_OPEN_ADS,
  EXPO_PUBLIC_ADMOB_USE_TEST_ADS: process.env.EXPO_PUBLIC_ADMOB_USE_TEST_ADS,
  EXPO_PUBLIC_ADMOB_ANDROID_BANNER_UNIT_ID: process.env.EXPO_PUBLIC_ADMOB_ANDROID_BANNER_UNIT_ID,
  EXPO_PUBLIC_ADMOB_IOS_BANNER_UNIT_ID: process.env.EXPO_PUBLIC_ADMOB_IOS_BANNER_UNIT_ID,
  EXPO_PUBLIC_ADMOB_ANDROID_APP_OPEN_UNIT_ID: process.env.EXPO_PUBLIC_ADMOB_ANDROID_APP_OPEN_UNIT_ID,
  EXPO_PUBLIC_ADMOB_IOS_APP_OPEN_UNIT_ID: process.env.EXPO_PUBLIC_ADMOB_IOS_APP_OPEN_UNIT_ID,
};

function definedEnvValues(values: RuntimeEnv): RuntimeEnv {
  return Object.fromEntries(Object.entries(values).filter(([, value]) => value !== undefined)) as RuntimeEnv;
}

export const env: RuntimeEnv = {
  ...definedEnvValues(buildTimeEnv),
  ...definedEnvValues(runtimeEnv),
};

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
  authEmailDomain: env.EXPO_PUBLIC_AUTH_EMAIL_DOMAIN ?? '',
  allowMocks: (env.EXPO_PUBLIC_ALLOW_MOCKS ?? 'false') === 'true',
  neisApiKey: env.EXPO_PUBLIC_NEIS_API_KEY ?? env.NEIS_API_KEY ?? '',
  accountDeleteEndpoint: env.EXPO_PUBLIC_ACCOUNT_DELETE_ENDPOINT ?? '',
  supportEmail: env.EXPO_PUBLIC_SUPPORT_EMAIL ?? 'support@wenever.app',
  enableAppOpenAds: (env.EXPO_PUBLIC_ENABLE_APP_OPEN_ADS ?? 'false') === 'true',
  admobUseTestAds: (env.EXPO_PUBLIC_ADMOB_USE_TEST_ADS ?? 'true') === 'true',
  admobAndroidBannerUnitId: env.EXPO_PUBLIC_ADMOB_ANDROID_BANNER_UNIT_ID ?? '',
  admobIosBannerUnitId: env.EXPO_PUBLIC_ADMOB_IOS_BANNER_UNIT_ID ?? '',
  admobAndroidAppOpenUnitId: env.EXPO_PUBLIC_ADMOB_ANDROID_APP_OPEN_UNIT_ID ?? '',
  admobIosAppOpenUnitId: env.EXPO_PUBLIC_ADMOB_IOS_APP_OPEN_UNIT_ID ?? '',
};

export const hasSupabaseConfig = Boolean(providerConfig.supabaseUrl && providerConfig.supabaseAnonKey);
