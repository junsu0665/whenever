import type React from 'react';

export type GoogleMobileAdsModule = {
  default?: () => {
    initialize?: () => Promise<unknown>;
    setRequestConfiguration?: (config: Record<string, unknown>) => Promise<unknown>;
  };
  AdEventType?: {
    CLOSED?: string;
    ERROR?: string;
    LOADED?: string;
  };
  AppOpenAd?: {
    createForAdRequest: (unitId: string, options?: Record<string, unknown>) => {
      addAdEventListener: (eventType: string, listener: (error?: unknown) => void) => () => void;
      load: () => void;
      show: () => void;
    };
  };
  BannerAd?: React.ComponentType<Record<string, unknown>>;
  BannerAdSize?: {
    ANCHORED_ADAPTIVE_BANNER?: string;
    BANNER?: string;
  };
  MaxAdContentRating?: {
    PG?: string;
  };
};

export function getGoogleMobileAdsModule(): GoogleMobileAdsModule | null {
  return null;
}
