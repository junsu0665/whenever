import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { ExternalLink, EyeOff, Flag, Gift, Megaphone, TimerReset, X } from 'lucide-react-native';

import {
  recordRemoteAdClick,
  recordRemoteAdFeedback,
  recordRemoteAdImpression,
  type RemoteAdFeedbackAction,
} from '../services/backend';
import { providerConfig } from '../services/env';
import { useAppState } from '../state/AppStateContext';
import { colors, fonts, radii, spacing, typography } from '../theme';

declare const require: (moduleName: string) => unknown;

export type AdPlacement =
  | 'app_open'
  | 'home_bottom'
  | 'timetable_bottom'
  | 'timetable_ocr_native'
  | 'board_native'
  | 'board_bottom'
  | 'meal_bottom'
  | 'score_analysis_sponsor'
  | 'score_result_banner';

type RevenueCampaign = {
  id: string;
  provider: 'sponsor_direct' | 'programmatic_placeholder';
  advertiserName: string;
  title: string;
  body: string;
  ctaLabel: string;
  destinationUrl: string;
  accent: string;
  background: string;
  eyebrow: string;
};

type GoogleMobileAdsModule = {
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

const sponsorUrl = 'https://wenever.app/sponsors/exam-season';
const androidTestBannerUnitId = 'ca-app-pub-3940256099942544/9214589741';
const iosTestBannerUnitId = 'ca-app-pub-3940256099942544/2435281174';
const androidTestAppOpenUnitId = 'ca-app-pub-3940256099942544/9257395921';
const iosTestAppOpenUnitId = 'ca-app-pub-3940256099942544/5575463023';
const nonPersonalizedRequestOptions = {
  requestNonPersonalizedAdsOnly: true,
};
let googleMobileAdsModule: GoogleMobileAdsModule | null | undefined;
let googleMobileAdsInitPromise: Promise<boolean> | null = null;

const campaignsByPlacement: Record<AdPlacement, RevenueCampaign> = {
  app_open: {
    id: 'direct-exam-season-app-open-2026',
    provider: 'sponsor_direct',
    advertiserName: '시험기간 스폰서',
    title: '중간고사 2주 집중팩',
    body: '오늘 학교 주변 스터디 혜택과 오답노트 템플릿을 확인해 보세요.',
    ctaLabel: '혜택 보기',
    destinationUrl: sponsorUrl,
    accent: colors.blue,
    background: colors.blueSoft,
    eyebrow: '시험기간 캠페인',
  },
  home_bottom: {
    id: 'direct-home-planner-banner-2026',
    provider: 'sponsor_direct',
    advertiserName: '플래너 스폰서',
    title: '오늘 할 일, 10분 단위로 정리하기',
    body: '학교 생활 루틴에 맞춘 플래너팩',
    ctaLabel: '보기',
    destinationUrl: sponsorUrl,
    accent: colors.primary,
    background: colors.primarySoft,
    eyebrow: '학교/지역 배너',
  },
  timetable_bottom: {
    id: 'direct-timetable-studyroom-banner-2026',
    provider: 'sponsor_direct',
    advertiserName: '지역 스터디 스폰서',
    title: '공강 시간에 가까운 학습 공간',
    body: '학교 주변 시험기간 좌석 정보를 확인하세요.',
    ctaLabel: '확인',
    destinationUrl: sponsorUrl,
    accent: colors.coral,
    background: colors.coralSoft,
    eyebrow: '시간표 배너',
  },
  timetable_ocr_native: {
    id: 'direct-capture-native-2026',
    provider: 'sponsor_direct',
    advertiserName: '시간표 등록 스폰서',
    title: '시간표 등록 중 잠깐, 시험 대비 자료 받기',
    body: '사진 인식 화면 하단에 들어가는 네이티브 광고 슬롯입니다.',
    ctaLabel: '자료 보기',
    destinationUrl: sponsorUrl,
    accent: colors.warning,
    background: colors.warningSoft,
    eyebrow: '광고',
  },
  board_native: {
    id: 'direct-board-native-2026',
    provider: 'sponsor_direct',
    advertiserName: '학교생활 스폰서',
    title: '시험기간 간식·문구 쿠폰',
    body: '게시글 흐름을 방해하지 않는 학교 단위 네이티브 광고입니다.',
    ctaLabel: '쿠폰 보기',
    destinationUrl: sponsorUrl,
    accent: colors.primary,
    background: colors.primarySoft,
    eyebrow: '광고',
  },
  board_bottom: {
    id: 'direct-board-bottom-2026',
    provider: 'sponsor_direct',
    advertiserName: '게시판 스폰서',
    title: '학교별 이벤트를 한 번에',
    body: '게시판 하단 배너 광고 슬롯',
    ctaLabel: '보기',
    destinationUrl: sponsorUrl,
    accent: colors.blue,
    background: colors.blueSoft,
    eyebrow: '게시판 배너',
  },
  meal_bottom: {
    id: 'direct-meal-bottom-2026',
    provider: 'sponsor_direct',
    advertiserName: '급식 화면 스폰서',
    title: '하교 후 간식 쿠폰',
    body: '오늘 급식 확인 후 자연스럽게 노출되는 배너',
    ctaLabel: '받기',
    destinationUrl: sponsorUrl,
    accent: colors.coral,
    background: colors.coralSoft,
    eyebrow: '급식 배너',
  },
  score_analysis_sponsor: {
    id: 'direct-score-analysis-sponsor-2026',
    provider: 'sponsor_direct',
    advertiserName: '성적 확인 스폰서',
    title: '분포 계산 중, 시험 대비 체크리스트',
    body: '같은 시험 제보를 기준으로 위치를 계산하는 동안 노출됩니다.',
    ctaLabel: '체크리스트',
    destinationUrl: sponsorUrl,
    accent: colors.warning,
    background: colors.warningSoft,
    eyebrow: '스폰서',
  },
  score_result_banner: {
    id: 'direct-score-result-banner-2026',
    provider: 'sponsor_direct',
    advertiserName: '결과 화면 스폰서',
    title: '다음 시험 준비 자료',
    body: '결과 수치 아래에만 작게 노출되는 배너',
    ctaLabel: '열기',
    destinationUrl: sponsorUrl,
    accent: colors.primary,
    background: colors.primarySoft,
    eyebrow: '결과 배너',
  },
};

function getLocalDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function getGoogleMobileAdsModule() {
  if (Platform.OS === 'web') {
    return null;
  }

  if (googleMobileAdsModule !== undefined) {
    return googleMobileAdsModule;
  }

  try {
    googleMobileAdsModule = require('react-native-google-mobile-ads') as GoogleMobileAdsModule;
  } catch {
    googleMobileAdsModule = null;
  }

  return googleMobileAdsModule;
}

function getPlatformAdUnitId(kind: 'appOpen' | 'banner') {
  const isAndroid = Platform.OS === 'android';
  if (providerConfig.admobUseTestAds) {
    if (kind === 'appOpen') {
      return isAndroid ? androidTestAppOpenUnitId : iosTestAppOpenUnitId;
    }

    return isAndroid ? androidTestBannerUnitId : iosTestBannerUnitId;
  }

  if (kind === 'appOpen') {
    return isAndroid ? providerConfig.admobAndroidAppOpenUnitId || androidTestAppOpenUnitId : providerConfig.admobIosAppOpenUnitId || iosTestAppOpenUnitId;
  }

  return isAndroid ? providerConfig.admobAndroidBannerUnitId || androidTestBannerUnitId : providerConfig.admobIosBannerUnitId || iosTestBannerUnitId;
}

function initializeGoogleMobileAds() {
  if (googleMobileAdsInitPromise) {
    return googleMobileAdsInitPromise;
  }

  const mobileAdsModule = getGoogleMobileAdsModule();
  const mobileAds = mobileAdsModule?.default;

  if (!mobileAds) {
    googleMobileAdsInitPromise = Promise.resolve(false);
    return googleMobileAdsInitPromise;
  }

  googleMobileAdsInitPromise = Promise.resolve()
    .then(() =>
      mobileAds().setRequestConfiguration?.({
        maxAdContentRating: mobileAdsModule.MaxAdContentRating?.PG ?? 'PG',
        tagForUnderAgeOfConsent: true,
        testDeviceIdentifiers: ['EMULATOR'],
      }),
    )
    .then(() => mobileAds().initialize?.())
    .then(() => true)
    .catch(() => false);

  return googleMobileAdsInitPromise;
}

function useGoogleMobileAdsReady() {
  const [state, setState] = useState<'loading' | 'ready' | 'unavailable'>('loading');

  useEffect(() => {
    let active = true;
    void initializeGoogleMobileAds().then((initialized) => {
      if (active) {
        setState(initialized ? 'ready' : 'unavailable');
      }
    });

    return () => {
      active = false;
    };
  }, []);

  return state;
}

function useAdTracking(campaign: RevenueCampaign, placement: AdPlacement, impressionEnabled = true) {
  const { profile } = useAppState();

  const trackImpression = useCallback(() => {
    void recordRemoteAdImpression({
      campaignId: campaign.id,
      placement,
      provider: campaign.provider,
      schoolId: profile.schoolId,
    });
  }, [campaign.id, campaign.provider, placement, profile.schoolId]);

  useEffect(() => {
    if (!impressionEnabled) {
      return;
    }

    trackImpression();
  }, [impressionEnabled, trackImpression]);

  const trackClick = useCallback(() => {
    void recordRemoteAdClick({
      campaignId: campaign.id,
      destinationUrl: campaign.destinationUrl,
      placement,
      provider: campaign.provider,
      schoolId: profile.schoolId,
    });
  }, [campaign.destinationUrl, campaign.id, campaign.provider, placement, profile.schoolId]);

  const trackFeedback = useCallback(
    (action: RemoteAdFeedbackAction, reason?: string) => {
      void recordRemoteAdFeedback({
        action,
        campaignId: campaign.id,
        placement,
        provider: campaign.provider,
        reason,
        schoolId: profile.schoolId,
      });
    },
    [campaign.id, campaign.provider, placement, profile.schoolId],
  );

  return { trackClick, trackFeedback, trackImpression };
}

function openCampaign(campaign: RevenueCampaign, trackClick: () => void) {
  trackClick();
  void Linking.openURL(campaign.destinationUrl).catch(() => undefined);
}

async function showGoogleAppOpenAd() {
  const ready = await initializeGoogleMobileAds();
  const mobileAdsModule = getGoogleMobileAdsModule();
  const appOpenAdFactory = mobileAdsModule?.AppOpenAd;
  const loadedEvent = mobileAdsModule?.AdEventType?.LOADED;
  const errorEvent = mobileAdsModule?.AdEventType?.ERROR;

  if (!ready || !appOpenAdFactory || !loadedEvent || !errorEvent) {
    return false;
  }

  return new Promise<boolean>((resolve) => {
    const appOpenAd = appOpenAdFactory.createForAdRequest(getPlatformAdUnitId('appOpen'), nonPersonalizedRequestOptions);
    const subscriptions: Array<() => void> = [];
    let settled = false;

    const finish = (shown: boolean) => {
      if (settled) {
        return;
      }

      settled = true;
      subscriptions.forEach((unsubscribe) => unsubscribe());
      clearTimeout(timeout);
      resolve(shown);
    };

    const timeout = setTimeout(() => finish(false), 3500);

    subscriptions.push(
      appOpenAd.addAdEventListener(loadedEvent, () => {
        try {
          appOpenAd.show();
          finish(true);
        } catch {
          finish(false);
        }
      }),
    );
    subscriptions.push(appOpenAd.addAdEventListener(errorEvent, () => finish(false)));
    appOpenAd.load();
  });
}

function AdBadge({ label = 'AD' }: { label?: string }) {
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>{label}</Text>
    </View>
  );
}

function AdActions({
  onFeedback,
  onHide,
}: {
  onFeedback: (action: RemoteAdFeedbackAction, reason?: string) => void;
  onHide: () => void;
}) {
  return (
    <View style={styles.adActions}>
      <Pressable
        accessibilityLabel="광고 숨김"
        accessibilityRole="button"
        onPress={() => {
          onFeedback('hide');
          onHide();
        }}
        style={styles.adActionButton}
      >
        <EyeOff color={colors.muted} size={14} />
        <Text style={styles.adActionText}>숨김</Text>
      </Pressable>
      <Pressable
        accessibilityLabel="광고 신고"
        accessibilityRole="button"
        onPress={() => {
          onFeedback('report', '부적절한 광고');
          onHide();
        }}
        style={styles.adActionButton}
      >
        <Flag color={colors.danger} size={14} />
        <Text style={[styles.adActionText, styles.reportText]}>신고</Text>
      </Pressable>
    </View>
  );
}

function GoogleBannerAd({
  onUnavailable,
}: {
  onUnavailable: () => void;
}) {
  const state = useGoogleMobileAdsReady();
  const mobileAdsModule = getGoogleMobileAdsModule();
  const BannerAd = mobileAdsModule?.BannerAd;
  const bannerSize = mobileAdsModule?.BannerAdSize?.ANCHORED_ADAPTIVE_BANNER ?? mobileAdsModule?.BannerAdSize?.BANNER;

  useEffect(() => {
    if (state === 'unavailable' || (state === 'ready' && (!BannerAd || !bannerSize))) {
      onUnavailable();
    }
  }, [BannerAd, bannerSize, onUnavailable, state]);

  if (state !== 'ready' || !BannerAd || !bannerSize) {
    return null;
  }

  return (
    <View style={styles.googleBannerWrap}>
      <BannerAd
        onAdFailedToLoad={onUnavailable}
        requestOptions={nonPersonalizedRequestOptions}
        size={bannerSize}
        unitId={getPlatformAdUnitId('banner')}
      />
    </View>
  );
}

export function BottomBannerAd({
  placement,
  style,
}: {
  placement: Extract<AdPlacement, 'home_bottom' | 'timetable_bottom' | 'board_bottom' | 'meal_bottom' | 'score_result_banner'>;
  style?: StyleProp<ViewStyle>;
}) {
  const [hidden, setHidden] = useState(false);
  const [googleUnavailable, setGoogleUnavailable] = useState(false);
  const campaign = campaignsByPlacement[placement];
  const { trackClick, trackFeedback } = useAdTracking(campaign, placement, !hidden);

  if (hidden) {
    return null;
  }

  if (!googleUnavailable) {
    return (
      <View style={[styles.googleBannerShell, style]}>
        <View style={styles.googleBannerHeader}>
          <View style={styles.adMetaRow}>
            <AdBadge />
            <Text style={styles.advertiser}>Google AdMob</Text>
          </View>
          <AdActions onFeedback={trackFeedback} onHide={() => setHidden(true)} />
        </View>
        <GoogleBannerAd onUnavailable={() => setGoogleUnavailable(true)} />
      </View>
    );
  }

  return (
    <View style={[styles.bottomBanner, { backgroundColor: campaign.background }, style]}>
      <View style={[styles.bannerMark, { backgroundColor: campaign.accent }]} />
      <View style={styles.bannerCopy}>
        <View style={styles.adMetaRow}>
          <AdBadge />
          <Text style={styles.advertiser}>{campaign.advertiserName}</Text>
        </View>
        <Text numberOfLines={1} style={styles.bannerTitle}>
          {campaign.title}
        </Text>
        <Text numberOfLines={2} style={styles.bannerBody}>
          {campaign.body}
        </Text>
      </View>
      <View style={styles.bannerRight}>
        <Pressable
          accessibilityRole="button"
          onPress={() => openCampaign(campaign, trackClick)}
          style={[styles.ctaButton, { borderColor: campaign.accent }]}
        >
          <Text style={[styles.ctaText, { color: campaign.accent }]}>{campaign.ctaLabel}</Text>
        </Pressable>
        <AdActions onFeedback={trackFeedback} onHide={() => setHidden(true)} />
      </View>
    </View>
  );
}

export function NativeAdCard({
  placement = 'timetable_ocr_native',
  style,
}: {
  placement?: Extract<AdPlacement, 'timetable_ocr_native'>;
  style?: StyleProp<ViewStyle>;
}) {
  const [hidden, setHidden] = useState(false);
  const campaign = campaignsByPlacement[placement];
  const { trackClick, trackFeedback } = useAdTracking(campaign, placement, !hidden);

  if (hidden) {
    return null;
  }

  return (
    <View style={[styles.nativeCard, { backgroundColor: campaign.background }, style]}>
      <View style={styles.nativeIcon}>
        <Megaphone color={campaign.accent} size={20} />
      </View>
      <View style={styles.nativeCopy}>
        <View style={styles.adMetaRow}>
          <AdBadge label={campaign.eyebrow} />
          <Text style={styles.advertiser}>{campaign.advertiserName}</Text>
        </View>
        <Text style={styles.nativeTitle}>{campaign.title}</Text>
        <Text style={styles.nativeBody}>{campaign.body}</Text>
        <View style={styles.nativeFooter}>
          <Pressable accessibilityRole="button" onPress={() => openCampaign(campaign, trackClick)} style={styles.nativeCta}>
            <ExternalLink color={campaign.accent} size={14} />
            <Text style={[styles.nativeCtaText, { color: campaign.accent }]}>{campaign.ctaLabel}</Text>
          </Pressable>
          <AdActions onFeedback={trackFeedback} onHide={() => setHidden(true)} />
        </View>
      </View>
    </View>
  );
}

export function AnalysisSponsorCard() {
  const [hidden, setHidden] = useState(false);
  const placement: AdPlacement = 'score_analysis_sponsor';
  const campaign = campaignsByPlacement[placement];
  const { trackClick, trackFeedback } = useAdTracking(campaign, placement, !hidden);

  if (hidden) {
    return (
      <View style={styles.analysisWaiting}>
        <ActivityIndicator color={colors.primary} />
        <Text style={styles.analysisWaitingText}>같은 시험 제보를 기준으로 위치를 계산하고 있어요.</Text>
      </View>
    );
  }

  return (
    <View style={[styles.analysisSponsor, { backgroundColor: campaign.background }]}>
      <View style={styles.analysisWaiting}>
        <ActivityIndicator color={campaign.accent} />
        <View style={styles.analysisWaitingCopy}>
          <Text style={styles.analysisWaitingTitle}>잠시만요</Text>
          <Text style={styles.analysisWaitingText}>같은 시험 제보를 기준으로 위치를 계산하고 있어요.</Text>
        </View>
      </View>
      <View style={styles.analysisDivider} />
      <View style={styles.sponsorRow}>
        <View style={styles.nativeIcon}>
          <Gift color={campaign.accent} size={19} />
        </View>
        <View style={styles.nativeCopy}>
          <View style={styles.adMetaRow}>
            <AdBadge label={campaign.eyebrow} />
            <Text style={styles.advertiser}>{campaign.advertiserName}</Text>
          </View>
          <Text style={styles.nativeTitle}>{campaign.title}</Text>
          <Text style={styles.nativeBody}>{campaign.body}</Text>
          <View style={styles.nativeFooter}>
            <Pressable accessibilityRole="button" onPress={() => openCampaign(campaign, trackClick)} style={styles.nativeCta}>
              <ExternalLink color={campaign.accent} size={14} />
              <Text style={[styles.nativeCtaText, { color: campaign.accent }]}>{campaign.ctaLabel}</Text>
            </Pressable>
            <AdActions onFeedback={trackFeedback} onHide={() => setHidden(true)} />
          </View>
        </View>
      </View>
    </View>
  );
}

export function BoardNativeAd() {
  const [hidden, setHidden] = useState(false);
  const placement: AdPlacement = 'board_native';
  const campaign = campaignsByPlacement[placement];
  const { trackClick, trackFeedback } = useAdTracking(campaign, placement, !hidden);

  if (hidden) {
    return null;
  }

  return (
    <View style={styles.boardNative}>
      <View style={[styles.boardNativeIcon, { backgroundColor: campaign.background }]}>
        <Megaphone color={campaign.accent} size={19} />
      </View>
      <View style={styles.boardNativeCopy}>
        <View style={styles.adMetaRow}>
          <AdBadge />
          <Text style={styles.advertiser}>{campaign.advertiserName}</Text>
        </View>
        <Text style={styles.boardNativeTitle}>{campaign.title}</Text>
        <Text numberOfLines={2} style={styles.boardNativeBody}>
          {campaign.body}
        </Text>
        <View style={styles.nativeFooter}>
          <Pressable accessibilityRole="button" onPress={() => openCampaign(campaign, trackClick)} style={styles.nativeCta}>
            <ExternalLink color={campaign.accent} size={14} />
            <Text style={[styles.nativeCtaText, { color: campaign.accent }]}>{campaign.ctaLabel}</Text>
          </Pressable>
          <AdActions onFeedback={trackFeedback} onHide={() => setHidden(true)} />
        </View>
      </View>
    </View>
  );
}

export function AppOpenAd() {
  const { profile } = useAppState();
  const placement: AdPlacement = 'app_open';
  const campaign = campaignsByPlacement[placement];
  const [visible, setVisible] = useState(false);
  const { trackClick, trackFeedback, trackImpression } = useAdTracking(campaign, placement, visible);

  useEffect(() => {
    if (profile.verificationStatus !== 'approved' || !profile.id) {
      return;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const storageKey = `wenever:app-open-ad:${profile.id}:${getLocalDateKey()}`;

    void AsyncStorage.getItem(storageKey)
      .then((shown) => {
        if (cancelled || shown) {
          return;
        }

        timer = setTimeout(() => {
          void AsyncStorage.setItem(storageKey, 'shown').catch(() => undefined);
          void showGoogleAppOpenAd().then((shown) => {
            if (shown) {
              trackImpression();
              return;
            }

            if (!cancelled) {
              setVisible(true);
            }
          });
        }, 650);
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [profile.id, profile.verificationStatus, trackImpression]);

  const close = () => setVisible(false);

  return (
    <Modal animationType="fade" onRequestClose={close} transparent visible={visible}>
      <View style={styles.modalBackdrop}>
        <View style={styles.appOpenCard}>
          <View style={styles.modalHeader}>
            <View style={styles.adMetaRow}>
              <AdBadge />
              <Text style={styles.advertiser}>{campaign.eyebrow}</Text>
            </View>
            <Pressable accessibilityLabel="광고 닫기" accessibilityRole="button" onPress={close} style={styles.modalCloseButton}>
              <X color={colors.text} size={20} />
            </Pressable>
          </View>
          <View style={[styles.appOpenHero, { backgroundColor: campaign.background }]}>
            <TimerReset color={campaign.accent} size={38} />
            <Text style={styles.appOpenTitle}>{campaign.title}</Text>
            <Text style={styles.appOpenBody}>{campaign.body}</Text>
          </View>
          <View style={styles.modalActions}>
            <Pressable accessibilityRole="button" onPress={close} style={styles.modalSecondaryButton}>
              <Text style={styles.modalSecondaryText}>닫기</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                openCampaign(campaign, trackClick);
                close();
              }}
              style={[styles.modalPrimaryButton, { backgroundColor: campaign.accent }]}
            >
              <Text style={styles.modalPrimaryText}>{campaign.ctaLabel}</Text>
            </Pressable>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              trackFeedback('report', '앱 실행 광고 신고');
              close();
            }}
            style={styles.modalReportButton}
          >
            <Flag color={colors.danger} size={14} />
            <Text style={styles.reportText}>광고 신고</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  adActionButton: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
    minHeight: 28,
    paddingHorizontal: spacing.xs,
  },
  adActions: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  adActionText: {
    color: colors.muted,
    fontFamily: fonts.semibold,
    fontSize: typography.tiny,
    fontWeight: '600',
  },
  adMetaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  advertiser: {
    color: colors.muted,
    fontFamily: fonts.semibold,
    fontSize: typography.tiny,
    fontWeight: '600',
  },
  analysisDivider: {
    backgroundColor: 'rgba(23, 32, 42, 0.08)',
    height: 1,
  },
  analysisSponsor: {
    borderColor: colors.border,
    borderCurve: 'continuous',
    borderRadius: radii.lg,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.md,
  },
  analysisWaiting: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  analysisWaitingCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  analysisWaitingText: {
    color: colors.muted,
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: typography.small,
    lineHeight: 20,
  },
  analysisWaitingTitle: {
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: typography.body,
    fontWeight: '700',
  },
  appOpenBody: {
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: typography.body,
    lineHeight: 23,
    textAlign: 'center',
  },
  appOpenCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderCurve: 'continuous',
    borderRadius: radii.lg,
    borderWidth: 1,
    gap: spacing.lg,
    maxWidth: 360,
    padding: spacing.lg,
    width: '88%',
  },
  appOpenHero: {
    alignItems: 'center',
    borderRadius: radii.lg,
    gap: spacing.md,
    padding: spacing.xl,
  },
  appOpenTitle: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: typography.h2,
    fontWeight: '800',
    lineHeight: 28,
    textAlign: 'center',
  },
  badge: {
    alignItems: 'center',
    backgroundColor: colors.ink,
    borderRadius: radii.sm,
    minHeight: 20,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  badgeText: {
    color: colors.surface,
    fontFamily: fonts.semibold,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0,
  },
  bannerBody: {
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: typography.tiny,
    lineHeight: 17,
  },
  bannerCopy: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
  },
  bannerMark: {
    borderRadius: radii.pill,
    width: 4,
  },
  bannerRight: {
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  bannerTitle: {
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: typography.small,
    fontWeight: '700',
  },
  boardNative: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    paddingVertical: spacing.lg,
  },
  boardNativeBody: {
    color: colors.slate,
    fontFamily: fonts.regular,
    fontSize: typography.small,
    lineHeight: 20,
  },
  boardNativeCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  boardNativeIcon: {
    alignItems: 'center',
    borderRadius: radii.pill,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  boardNativeTitle: {
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: typography.h3,
    fontWeight: '700',
  },
  bottomBanner: {
    borderColor: colors.border,
    borderCurve: 'continuous',
    borderRadius: radii.lg,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 96,
    padding: spacing.md,
  },
  googleBannerHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  googleBannerShell: {
    alignItems: 'stretch',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderCurve: 'continuous',
    borderRadius: radii.lg,
    borderWidth: 1,
    gap: spacing.sm,
    minHeight: 96,
    overflow: 'hidden',
    padding: spacing.sm,
  },
  googleBannerWrap: {
    alignItems: 'center',
    minHeight: 60,
    justifyContent: 'center',
  },
  ctaButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    borderWidth: 1,
    minHeight: 32,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  ctaText: {
    fontFamily: fonts.semibold,
    fontSize: typography.tiny,
    fontWeight: '700',
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  modalBackdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(23, 32, 42, 0.42)',
    flex: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalCloseButton: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: radii.pill,
    borderWidth: 1,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  modalHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalPrimaryButton: {
    alignItems: 'center',
    borderRadius: radii.pill,
    flex: 1,
    minHeight: 46,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  modalPrimaryText: {
    color: colors.surface,
    fontFamily: fonts.semibold,
    fontSize: typography.body,
    fontWeight: '700',
  },
  modalReportButton: {
    alignItems: 'center',
    alignSelf: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
    minHeight: 28,
    paddingHorizontal: spacing.sm,
  },
  modalSecondaryButton: {
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderRadius: radii.pill,
    borderWidth: 1,
    flex: 1,
    minHeight: 46,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  modalSecondaryText: {
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: typography.body,
    fontWeight: '700',
  },
  nativeBody: {
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: typography.small,
    lineHeight: 20,
  },
  nativeCard: {
    borderColor: colors.border,
    borderCurve: 'continuous',
    borderRadius: radii.lg,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
  },
  nativeCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  nativeCta: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
    minHeight: 28,
    paddingRight: spacing.sm,
  },
  nativeCtaText: {
    fontFamily: fonts.semibold,
    fontSize: typography.small,
    fontWeight: '700',
  },
  nativeFooter: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  nativeIcon: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.pill,
    borderWidth: 1,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  nativeTitle: {
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: typography.body,
    fontWeight: '700',
    lineHeight: 22,
  },
  reportText: {
    color: colors.danger,
    fontFamily: fonts.semibold,
    fontSize: typography.tiny,
    fontWeight: '700',
  },
  sponsorRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
});
