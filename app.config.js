const testAndroidAppId = 'ca-app-pub-3940256099942544~3347511713';
const testIosAppId = 'ca-app-pub-3940256099942544~1458002511';

const requiredProductionEnv = [
  'EXPO_PUBLIC_SUPABASE_URL',
  'EXPO_PUBLIC_SUPABASE_ANON_KEY',
  'EXPO_PUBLIC_OCR_ENDPOINT',
  'EXPO_PUBLIC_SCORE_PREDICTION_ENDPOINT',
  'EXPO_PUBLIC_ACCOUNT_DELETE_ENDPOINT',
  'EXPO_PUBLIC_COMMUNITY_PUSH_ENDPOINT',
  'EXPO_PUBLIC_NEIS_API_KEY',
  'EXPO_PUBLIC_SUPPORT_EMAIL',
  'EXPO_PUBLIC_ADMOB_ANDROID_BANNER_UNIT_ID',
  'EXPO_PUBLIC_ADMOB_IOS_BANNER_UNIT_ID',
  'EXPO_PUBLIC_ADMOB_ANDROID_APP_OPEN_UNIT_ID',
  'EXPO_PUBLIC_ADMOB_IOS_APP_OPEN_UNIT_ID',
];

function assertProductionEnv(androidAppId, iosAppId, appleTeamId) {
  const buildPlatform = process.env.EAS_BUILD_PLATFORM;
  const missing = requiredProductionEnv.filter((name) => !process.env[name]);
  if (!androidAppId) {
    missing.push('ADMOB_ANDROID_APP_ID');
  }
  if (!iosAppId) {
    missing.push('ADMOB_IOS_APP_ID');
  }
  if (buildPlatform === 'ios' && !appleTeamId) {
    missing.push('APPLE_TEAM_ID');
  }

  if (missing.length) {
    throw new Error(`Production build is missing required environment variables: ${missing.join(', ')}`);
  }

  if (process.env.EXPO_PUBLIC_ALLOW_MOCKS !== 'false') {
    throw new Error('Production build requires EXPO_PUBLIC_ALLOW_MOCKS=false.');
  }

  if (process.env.EXPO_PUBLIC_OCR_PROVIDER !== 'endpoint') {
    throw new Error('Production build requires EXPO_PUBLIC_OCR_PROVIDER=endpoint.');
  }

  if (process.env.EXPO_PUBLIC_ADMOB_USE_TEST_ADS !== 'false') {
    throw new Error('Production build requires EXPO_PUBLIC_ADMOB_USE_TEST_ADS=false.');
  }
}

module.exports = ({ config }) => {
  const isProductionBuild = process.env.EAS_BUILD_PROFILE === 'production';
  const androidAppId = process.env.ADMOB_ANDROID_APP_ID || process.env.EXPO_PUBLIC_ADMOB_ANDROID_APP_ID;
  const iosAppId = process.env.ADMOB_IOS_APP_ID || process.env.EXPO_PUBLIC_ADMOB_IOS_APP_ID;
  const appleTeamId = process.env.APPLE_TEAM_ID || process.env.EXPO_APPLE_TEAM_ID;

  if (isProductionBuild) {
    assertProductionEnv(androidAppId, iosAppId, appleTeamId);
  }

  const plugins = (config.plugins ?? []).filter((plugin) => {
    if (plugin === 'react-native-google-mobile-ads') {
      return false;
    }

    return !(Array.isArray(plugin) && plugin[0] === 'react-native-google-mobile-ads');
  });

  return {
    ...config,
    ios: {
      ...config.ios,
      ...(appleTeamId ? { appleTeamId } : {}),
    },
    plugins: [
      ...plugins,
      [
        'react-native-google-mobile-ads',
        {
          androidAppId: androidAppId || testAndroidAppId,
          iosAppId: iosAppId || testIosAppId,
        },
      ],
    ],
  };
};
