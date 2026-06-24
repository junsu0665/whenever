import { NativeModules } from 'react-native';

import type { GoogleMobileAdsModule } from './google-mobile-ads';

declare const require: (moduleName: string) => unknown;

const nativeModuleName = 'RNGoogleMobileAdsModule';
let cachedModule: GoogleMobileAdsModule | null | undefined;

export function getGoogleMobileAdsModule(): GoogleMobileAdsModule | null {
  if (cachedModule !== undefined) {
    return cachedModule;
  }

  if (!NativeModules[nativeModuleName]) {
    cachedModule = null;
    return cachedModule;
  }

  try {
    cachedModule = require('react-native-google-mobile-ads') as GoogleMobileAdsModule;
  } catch {
    cachedModule = null;
  }

  return cachedModule;
}
