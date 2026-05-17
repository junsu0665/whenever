import { StatusBar } from 'expo-status-bar';
import {
  NotoSansKR_400Regular,
  NotoSansKR_500Medium,
  NotoSansKR_600SemiBold,
  NotoSansKR_700Bold,
  NotoSansKR_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/noto-sans-kr';
import React, { useEffect } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
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

let defaultFontsApplied = false;

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

  useEffect(() => {
    if (activeTab === 'admin' && !showAdmin) {
      setActiveTab('home');
    }
  }, [activeTab, setActiveTab, showAdmin]);

  if (authLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loading}>
          <Text style={styles.loadingText}>웨네버를 불러오는 중입니다.</Text>
        </View>
        <StatusBar style="dark" />
      </SafeAreaView>
    );
  }

  if (launchBlocked) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loading}>
          <Text style={styles.loadingTitle}>운영 설정이 필요합니다.</Text>
          <Text style={styles.loadingText}>
            Supabase URL과 anon key가 없고 mock 사용이 꺼져 있습니다. 배포 환경변수를 설정한 뒤 다시 실행해 주세요.
          </Text>
        </View>
        <StatusBar style="dark" />
      </SafeAreaView>
    );
  }

  if (!isAuthenticated || needsProfile) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <AuthScreen />
        <StatusBar style="dark" />
      </SafeAreaView>
    );
  }

  if (profile.accountStatus === 'suspended') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loading}>
          <Text style={styles.loadingTitle}>계정 사용이 제한되었습니다.</Text>
          <Text style={styles.loadingText}>학교 관리자에게 문의해 주세요.</Text>
        </View>
        <StatusBar style="dark" />
      </SafeAreaView>
    );
  }

  if (profile.verificationStatus !== 'approved') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <VerificationGateScreen />
        <StatusBar style="dark" />
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
          {activeTab === 'profile' ? <ProfileScreen /> : null}
          {activeTab === 'admin' && showAdmin ? <AdminScreen /> : null}
        </View>
        <AppOpenAd />
        <BottomTabs activeTab={activeTab} onChange={setActiveTab} showAdmin={showAdmin} />
      </View>
      <StatusBar style="dark" />
    </SafeAreaView>
  );
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
          <View style={styles.loading} />
          <StatusBar style="dark" />
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

const styles = StyleSheet.create({
  appShell: {
    alignSelf: 'center',
    flex: 1,
    maxWidth: 540,
    width: '100%',
  },
  content: {
    flex: 1,
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
