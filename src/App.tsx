import { StatusBar } from 'expo-status-bar';
import {
  NotoSansKR_400Regular,
  NotoSansKR_500Medium,
  NotoSansKR_600SemiBold,
  NotoSansKR_700Bold,
  NotoSansKR_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/noto-sans-kr';
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Image, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { BottomTabs } from './components/BottomTabs';
import { AppOpenAd } from './components/RevenueAds';
import { AdminScreen } from './screens/AdminScreen';
import { AuthScreen } from './screens/AuthScreen';
import { BoardScreen } from './screens/BoardScreen';
import { GradeScreen } from './screens/GradeScreen';
import { HomeScreen } from './screens/HomeScreen';
import { MealScreen } from './screens/MealScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { TimetableScreen } from './screens/TimetableScreen';
import { VerificationGateScreen } from './screens/VerificationGateScreen';
import { recordRemoteAnalyticsEvent } from './services/backend';
import { AppStateProvider, useAppState } from './state/AppStateContext';
import { colors, fonts } from './theme';
import { TabKey } from './types';

let defaultFontsApplied = false;
const launchLogoSource = require('../assets/wenever-symbol.png') as number;
const launchLogoWidth = 190;
const launchLogoHeight = Math.round((launchLogoWidth * 365) / 734);

type ErrorHandler = (error: Error, isFatal?: boolean) => void;

function applyDefaultFonts() {
  if (defaultFontsApplied) {
    return;
  }

  const textComponent = Text as typeof Text & { defaultProps?: { style?: unknown; allowFontScaling?: boolean } };
  const textInputComponent = TextInput as typeof TextInput & { defaultProps?: { style?: unknown; allowFontScaling?: boolean } };

  textComponent.defaultProps = textComponent.defaultProps ?? {};
  textInputComponent.defaultProps = textInputComponent.defaultProps ?? {};
  textComponent.defaultProps.allowFontScaling = false;
  textInputComponent.defaultProps.allowFontScaling = false;
  textComponent.defaultProps.style = [{ fontFamily: fonts.regular }, textComponent.defaultProps.style];
  textInputComponent.defaultProps.style = [{ fontFamily: fonts.regular }, textInputComponent.defaultProps.style];
  defaultFontsApplied = true;
}

function AppContent() {
  const { activeTab, authError, authLoading, isAdminMode, isAuthenticated, launchBlocked, needsProfile, profile, setActiveTab } = useAppState();
  const showAdmin = isAdminMode;
  const settingsOpen = activeTab === 'settings';
  const previousMainTab = useRef<TabKey>('home');

  useEffect(() => {
    if (activeTab === 'admin' && !showAdmin) {
      setActiveTab('home');
    }
  }, [activeTab, setActiveTab, showAdmin]);

  useEffect(() => {
    if (activeTab !== 'settings') {
      previousMainTab.current = activeTab;
    }
  }, [activeTab]);

  const closeSettings = () => {
    setActiveTab(previousMainTab.current === 'settings' ? 'home' : previousMainTab.current);
  };

  if (authLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <LaunchBlank />
        <AppStatusBar />
      </SafeAreaView>
    );
  }

  if (launchBlocked) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loading}>
          <Text style={styles.loadingTitle}>서비스를 준비하고 있어요.</Text>
          <Text style={styles.loadingText}>
            잠시 후 다시 시도해 주세요. 문제가 계속되면 고객지원에 문의해 주세요.
          </Text>
        </View>
        <AppStatusBar />
      </SafeAreaView>
    );
  }

  if (!isAuthenticated || needsProfile) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <AuthScreen />
        <AppStatusBar />
      </SafeAreaView>
    );
  }

  if (profile.accountStatus === 'suspended') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loading}>
          <Text style={styles.loadingTitle}>계정 사용이 제한됐어요.</Text>
          <Text style={styles.loadingText}>학교 관리자에게 문의해 주세요.</Text>
        </View>
        <AppStatusBar />
      </SafeAreaView>
    );
  }

  if (profile.verificationStatus !== 'approved') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <VerificationGateScreen />
        <AppStatusBar />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.appShell}>
        {authError ? (
          <View style={styles.errorBanner}>
            <Text selectable style={styles.errorBannerText}>
              {authError}
            </Text>
          </View>
        ) : null}
        <View style={styles.content}>
          {activeTab === 'home' ? <HomeScreen /> : null}
          {activeTab === 'timetable' ? <TimetableScreen /> : null}
          {activeTab === 'board' ? <BoardScreen /> : null}
          {activeTab === 'meal' ? <MealScreen /> : null}
          {activeTab === 'grades' ? <GradeScreen /> : null}
          {settingsOpen ? <ProfileScreen onClose={closeSettings} /> : null}
          {activeTab === 'admin' && showAdmin ? <AdminScreen /> : null}
        </View>
        <AppOpenAd />
        {settingsOpen ? null : <BottomTabs activeTab={activeTab} onChange={setActiveTab} showAdmin={showAdmin} />}
      </View>
      <AppStatusBar />
    </SafeAreaView>
  );
}

function AppStatusBar() {
  return <StatusBar backgroundColor={colors.background} style="dark" translucent={false} />;
}

export default function WeneverApp() {
  const [fontsLoaded] = useFonts({
    NotoSansKR_400Regular,
    NotoSansKR_500Medium,
    NotoSansKR_600SemiBold,
    NotoSansKR_700Bold,
    NotoSansKR_800ExtraBold,
  });

  useEffect(() => {
    if (fontsLoaded) {
      applyDefaultFonts();
    }
  }, [fontsLoaded]);

  useEffect(() => {
    const errorUtils = (globalThis as typeof globalThis & {
      ErrorUtils?: {
        getGlobalHandler?: () => ErrorHandler;
        setGlobalHandler?: (handler: ErrorHandler) => void;
      };
    }).ErrorUtils;
    const originalHandler = errorUtils?.getGlobalHandler?.();

    errorUtils?.setGlobalHandler?.((error, isFatal) => {
      void recordRemoteAnalyticsEvent('app_error', {
        isFatal: Boolean(isFatal),
        message: error.message,
        stack: error.stack?.slice(0, 1600),
      }).catch(() => undefined);
      originalHandler?.(error, isFatal);
    });

    return () => {
      if (originalHandler) {
        errorUtils?.setGlobalHandler?.(originalHandler);
      }
    };
  }, []);

  if (!fontsLoaded) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.safeArea}>
          <LaunchBlank />
          <AppStatusBar />
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <AppStateProvider>
        <AppContent />
      </AppStateProvider>
    </SafeAreaProvider>
  );
}

function LaunchBlank() {
  return (
    <View style={styles.launchBlank}>
      <DrawnLaunchLogo />
    </View>
  );
}

function DrawnLaunchLogo() {
  const draw = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(draw, {
            duration: 1320,
            easing: Easing.bezier(0.18, 0.82, 0.24, 1),
            toValue: 1,
            useNativeDriver: false,
          }),
          Animated.timing(pulse, {
            duration: 900,
            easing: Easing.out(Easing.cubic),
            toValue: 1,
            useNativeDriver: true,
          }),
        ]),
        Animated.delay(520),
        Animated.parallel([
          Animated.timing(draw, {
            duration: 0,
            toValue: 0,
            useNativeDriver: false,
          }),
          Animated.timing(pulse, {
            duration: 0,
            toValue: 0,
            useNativeDriver: true,
          }),
        ]),
      ]),
    );

    animation.start();
    return () => animation.stop();
  }, [draw, pulse]);

  const logoOpacity = draw.interpolate({
    inputRange: [0, 0.08, 1],
    outputRange: [0, 1, 1],
    extrapolate: 'clamp',
  });
  const revealWidth = draw.interpolate({
    inputRange: [0, 0.95],
    outputRange: [0, launchLogoWidth],
    extrapolate: 'clamp',
  });
  const tipTranslate = draw.interpolate({
    inputRange: [0, 0.95],
    outputRange: [-10, launchLogoWidth - 8],
    extrapolate: 'clamp',
  });
  const pulseStyle = {
    opacity: pulse.interpolate({
      inputRange: [0, 0.45, 1],
      outputRange: [0.06, 0.18, 0.08],
      extrapolate: 'clamp',
    }),
    transform: [
      {
        scale: pulse.interpolate({
          inputRange: [0, 1],
          outputRange: [0.96, 1.05],
          extrapolate: 'clamp',
        }),
      },
    ],
  };

  return (
    <Animated.View style={[styles.launchLogoWrap, { opacity: logoOpacity }]}>
      <Animated.View style={[styles.launchLogoHalo, pulseStyle]} />
      <Animated.View style={[styles.launchLogoReveal, { width: revealWidth }]}>
        <Image
          accessibilityIgnoresInvertColors
          accessible={false}
          resizeMode="contain"
          source={launchLogoSource}
          style={styles.launchLogoImage}
        />
      </Animated.View>
      <Animated.View style={[styles.launchLogoTip, { transform: [{ translateX: tipTranslate }] }]} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  appShell: {
    alignSelf: 'center',
    flex: 1,
    maxWidth: 540,
    width: '100%',
  },
  content: {
    flex: 1,
    overflow: 'hidden',
  },
  safeArea: {
    backgroundColor: colors.background,
    flex: 1,
  },
  loading: {
    alignItems: 'center',
    backgroundColor: colors.background,
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  launchBlank: {
    alignItems: 'center',
    backgroundColor: colors.background,
    flex: 1,
    justifyContent: 'center',
  },
  launchLogoHalo: {
    backgroundColor: colors.primarySoft,
    borderRadius: 96,
    height: 192,
    position: 'absolute',
    width: 192,
  },
  launchLogoImage: {
    height: launchLogoHeight,
    width: launchLogoWidth,
  },
  launchLogoReveal: {
    height: launchLogoHeight,
    overflow: 'hidden',
    width: launchLogoWidth,
  },
  launchLogoTip: {
    backgroundColor: colors.primary,
    borderRadius: 6,
    height: launchLogoHeight + 6,
    opacity: 0.16,
    position: 'absolute',
    width: 12,
  },
  launchLogoWrap: {
    alignItems: 'center',
    height: launchLogoHeight,
    justifyContent: 'center',
    overflow: 'hidden',
    width: launchLogoWidth,
  },
  loadingText: {
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
  },
  loadingTitle: {
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: 22,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  errorBanner: {
    backgroundColor: colors.dangerSoft,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  errorBannerText: {
    color: colors.danger,
    fontFamily: fonts.semibold,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 19,
    textAlign: 'center',
  },
});
