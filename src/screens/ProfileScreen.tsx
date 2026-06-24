import * as ImagePicker from 'expo-image-picker';
import React, { useMemo, useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Bell, Clock3, Database, FileText, IdCard, LogOut, ShieldAlert, ShieldCheck, Trash2, UserRound, X } from 'lucide-react-native';

import { Card } from '../components/Card';
import { LegalPolicyModal } from '../components/LegalPolicyModal';
import { PrimaryButton } from '../components/PrimaryButton';
import { ReminderMinuteChips } from '../components/ReminderMinuteChips';
import { Screen } from '../components/Screen';
import { ScreenHeader } from '../components/ScreenHeader';
import { SectionHeader } from '../components/SectionHeader';
import { SegmentedControl } from '../components/SegmentedControl';
import { TimetablePeriodSettings } from '../components/TimetablePeriodSettings';
import { ToggleRow } from '../components/ToggleRow';
import { colors, fonts, radii, spacing, typography } from '../theme';
import { useAppState } from '../state/AppStateContext';
import { providerConfig } from '../services/env';
import { AccountMode, VerificationStatus } from '../types';
import { formatGradeClass } from '../utils/profile';

const statusCopy: Record<VerificationStatus, { title: string; label: string; tone: 'primary' | 'warning' | 'danger' | 'neutral' }> = {
  approved: { title: '학생 인증 완료', label: '승인 완료', tone: 'primary' },
  not_submitted: { title: '학생증 인증 필요', label: '미제출', tone: 'neutral' },
  pending: { title: '학생증 검수 중', label: '승인 대기', tone: 'warning' },
  rejected: { title: '학생증 재제출 필요', label: '반려', tone: 'danger' },
};

const accountModeSegments: Array<{ key: AccountMode; label: string }> = [
  { key: 'user', label: '사용자' },
  { key: 'admin', label: '관리자' },
];

function formatReminderMinutes(minutes: number) {
  return minutes === 0 ? '정시에' : `${minutes}분 전에`;
}

export function ProfileScreen({ onClose }: { onClose?: () => void }) {
  const {
    accountMode,
    authError,
    authLoading,
    backendMode,
    deleteAccount,
    isAdminMode,
    notificationSettings,
    profile,
    setAccountMode,
    setNotificationPreferences,
    setNotificationSetting,
    setShareStatus,
    setTimetablePeriodTimes,
    signOut,
    studentVerifications,
    submitStudentCard,
    timetable,
  } = useAppState();
  const [error, setError] = useState<string | null>(null);
  const [legalVisible, setLegalVisible] = useState(false);
  const [uploading, setUploading] = useState(false);
  const status = statusCopy[profile.verificationStatus];
  const latestVerification = [...studentVerifications]
    .filter((verification) => verification.userId === profile.id)
    .sort((first, second) => new Date(second.submittedAt).getTime() - new Date(first.submittedAt).getTime())[0];
  const studentCardUri = latestVerification?.displayUri ?? profile.studentCardUri;
  const rejectionReason = latestVerification?.rejectionReason ?? profile.studentVerificationRejectionReason;

  const statusIcon = useMemo(() => {
    if (profile.verificationStatus === 'approved') {
      return <ShieldCheck color={colors.primary} size={34} />;
    }
    if (profile.verificationStatus === 'rejected') {
      return <ShieldAlert color={colors.danger} size={34} />;
    }
    return <IdCard color={colors.primary} size={34} />;
  }, [profile.verificationStatus]);

  const pickStudentCard = async () => {
    setError(null);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError('학생증 사진 접근 권한이 필요해요.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      aspect: [3, 2],
      mediaTypes: ['images'],
      quality: 0.78,
    });

    if (!result.canceled) {
      setUploading(true);
      try {
        await submitStudentCard(result.assets[0].uri);
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : '학생증 업로드에 실패했어요.');
      } finally {
        setUploading(false);
      }
    }
  };

  const confirmDeleteAccount = () => {
    Alert.alert('계정 삭제', '계정과 연결된 인증 이미지, 시간표, 프로필, 알림 정보가 삭제돼요.', [
      { text: '취소', style: 'cancel' },
      {
        text: '계정 삭제',
        style: 'destructive',
        onPress: () => {
          void deleteAccount();
        },
      },
    ]);
  };

  return (
    <Screen contentStyle={onClose ? styles.settingsWindowContent : undefined}>
      <ScreenHeader
        action={
          onClose ? (
            <Pressable
              accessibilityLabel="설정 나가기"
              accessibilityRole="button"
              onPress={onClose}
              style={({ pressed }) => [styles.closeButton, pressed && styles.closeButtonPressed]}
            >
              <X color={colors.text} size={22} strokeWidth={2.3} />
            </Pressable>
          ) : null
        }
        subtitle={`${profile.schoolName} · ${formatGradeClass(profile.grade, profile.className)}`}
        title="설정"
      />

      <Card>
        <SectionHeader action={<UserRound color={colors.primary} size={22} />} title="내 정보" />
        <View style={styles.profileSummary}>
          <View style={styles.profileAvatar}>
            <Text style={styles.profileAvatarText}>{profile.name.trim().slice(0, 1) || '나'}</Text>
          </View>
          <View style={styles.profileCopy}>
            <Text style={styles.profileName}>{profile.name}</Text>
            <Text style={styles.profileMeta}>
              {profile.anonymousName} · {formatGradeClass(profile.grade, profile.className)}
            </Text>
          </View>
        </View>
        <View style={styles.accountActions}>
          <PrimaryButton
            disabled={authLoading}
            icon={<LogOut color={authLoading ? colors.disabled : colors.primary} size={20} />}
            label="로그아웃"
            onPress={() => {
              void signOut();
            }}
            style={styles.accountButton}
            variant="secondary"
          />
          <PrimaryButton
            disabled={authLoading}
            icon={<Trash2 color={authLoading ? colors.disabled : colors.danger} size={20} />}
            label="계정 삭제"
            onPress={confirmDeleteAccount}
            style={styles.accountButton}
            variant="danger"
          />
        </View>
        {authError ? <Text selectable style={styles.errorText}>{authError}</Text> : null}
      </Card>

      <Card>
        <SectionHeader action={statusIcon} title={status.title} />
        <View style={styles.identityRow}>
          {studentCardUri ? (
            <Image resizeMode="cover" source={{ uri: studentCardUri }} style={styles.studentCardImage} />
          ) : (
            <View style={styles.emptyCard}>
              <IdCard color={colors.subtle} size={22} />
            </View>
          )}
          <View style={styles.identityCopy}>
            <Text style={styles.identityTitle}>학생증 사진</Text>
            <Text style={styles.identityMeta}>
              {profile.verificationStatus === 'approved'
                ? '승인된 학생만 웨네버를 사용할 수 있어요.'
                : profile.verificationStatus === 'pending'
                  ? '승인 대기 중이에요.'
                  : rejectionReason
                    ? `반려 사유: ${rejectionReason}`
                    : '학생증 사진을 제출하면 앱을 사용할 수 있어요.'}
            </Text>
          </View>
        </View>
        {profile.verificationStatus === 'approved' ? (
          <PrimaryButton
            disabled
            icon={<ShieldCheck color={colors.disabled} size={20} />}
            label="인증 완료"
            onPress={pickStudentCard}
            variant="secondary"
            style={styles.primaryGap}
          />
        ) : (
          <PrimaryButton
            disabled={uploading || profile.verificationStatus === 'pending'}
            icon={<IdCard color={profile.verificationStatus === 'pending' ? colors.disabled : colors.surface} size={20} />}
            label={uploading ? '업로드 중' : profile.verificationStatus === 'pending' ? '승인 대기 중' : '학생증 업로드'}
            onPress={pickStudentCard}
            style={styles.primaryGap}
          />
        )}
        {error ? <Text selectable style={styles.errorText}>{error}</Text> : null}
      </Card>

      <Card>
        <SectionHeader action={<Bell color={colors.primary} size={22} />} title="알림 설정" />
        <ToggleRow
          description={
            notificationSettings.timetable
              ? `수업 시작 ${formatReminderMinutes(notificationSettings.timetableReminderMinutes)} 받아요.`
              : '수업 시작 알림을 받지 않아요.'
          }
          onValueChange={(value) => setNotificationSetting('timetable', value)}
          title="수업 시작 알림"
          value={notificationSettings.timetable}
        />
        {notificationSettings.timetable ? (
          <View style={styles.reminderPanel}>
            <Text style={styles.settingLabel}>알림 시점</Text>
            <ReminderMinuteChips
              onChange={(timetableReminderMinutes) => setNotificationPreferences({ timetableReminderMinutes })}
              value={notificationSettings.timetableReminderMinutes}
            />
          </View>
        ) : null}
        <ToggleRow
          description={`중식 ${notificationSettings.lunchReminderTime} · 석식 ${notificationSettings.dinnerReminderTime}`}
          onValueChange={(value) => setNotificationSetting('meal', value)}
          title="급식 알림"
          value={notificationSettings.meal}
        />
        <ToggleRow
          description="내 글 댓글과 학교 인기글 알림을 받아요."
          onValueChange={(value) => setNotificationSetting('community', value)}
          title="게시판 알림"
          value={notificationSettings.community}
        />
      </Card>

      <Card>
        <SectionHeader action={<Clock3 color={colors.primary} size={22} />} title="시간표 설정" />
        <TimetablePeriodSettings onChange={setTimetablePeriodTimes} timetable={timetable} />
      </Card>

      <Card>
        <SectionHeader title="공개 설정" />
        <ToggleRow
          description="같은 수업을 듣는 사람이 겹치는 수업 여부만 볼 수 있어요."
          onValueChange={(value) => setShareStatus('timetableShareStatus', value ? 'enabled' : 'disabled')}
          title="내 시간표 공개"
          value={profile.timetableShareStatus === 'enabled'}
        />
        <ToggleRow
          description="공개한 학생 중 나와 같은 수업을 듣는 사람만 볼 수 있어요."
          onValueChange={(value) => setShareStatus('friendTimetableViewStatus', value ? 'enabled' : 'disabled')}
          title="같이 듣는 사람 보기"
          value={profile.friendTimetableViewStatus === 'enabled'}
        />
      </Card>

      {profile.isAdmin ? (
        <Card>
          <SectionHeader action={<Database color={colors.primary} size={22} />} title="관리자" />
          <SegmentedControl onChange={setAccountMode} segments={accountModeSegments} value={accountMode} />
          <View style={styles.modeDetails}>
            <View style={styles.integrationRow}>
              <Text style={styles.integrationLabel}>계정 권한</Text>
              <Text style={styles.integrationValue}>관리자</Text>
            </View>
            <View style={styles.integrationRow}>
              <Text style={styles.integrationLabel}>현재 모드</Text>
              <Text style={styles.integrationValue}>{isAdminMode ? '관리자' : '사용자'}</Text>
            </View>
            <View style={styles.integrationRow}>
              <Text style={styles.integrationLabel}>서비스 상태</Text>
              <Text style={styles.integrationValue}>{backendMode}</Text>
            </View>
            <View style={styles.integrationRow}>
              <Text style={styles.integrationLabel}>학생 인증</Text>
              <Text style={styles.integrationValue}>검수 가능</Text>
            </View>
            <View style={styles.integrationRow}>
              <Text style={styles.integrationLabel}>급식</Text>
              <Text style={styles.integrationValue}>자동 동기화</Text>
            </View>
          </View>
        </Card>
      ) : null}

      <Card>
        <SectionHeader action={<FileText color={colors.primary} size={22} />} title="약관과 개인정보" />
        <Text style={styles.legalText}>
          학생증 이미지는 학생 인증 검수 목적으로만 사용해요. 승인 또는 반려 후 운영 보관 기간이 끝나면 삭제 대상이에요.
          탈퇴하면 인증 이미지, 시간표 업로드, 프로필, 알림 토큰 등 계정 연결 데이터가 삭제돼요. 문의는 {providerConfig.supportEmail} 로 보내 주세요.
        </Text>
        <Pressable accessibilityRole="button" onPress={() => setLegalVisible(true)} style={styles.legalLink}>
          <Text style={styles.legalLinkText}>운영 정책 보기</Text>
        </Pressable>
      </Card>
      <LegalPolicyModal onClose={() => setLegalVisible(false)} visible={legalVisible} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  accountActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  accountButton: {
    flex: 1,
    minWidth: 136,
  },
  closeButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderCurve: 'continuous',
    borderRadius: radii.pill,
    borderWidth: 1,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  closeButtonPressed: {
    backgroundColor: colors.surfacePressed,
  },
  emptyCard: {
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderCurve: 'continuous',
    borderRadius: radii.lg,
    borderStyle: 'dashed',
    borderWidth: 1,
    height: 72,
    justifyContent: 'center',
    width: 108,
  },
  errorText: {
    color: colors.danger,
    fontSize: typography.small,
    fontWeight: '600',
    marginTop: spacing.md,
  },
  identityCopy: {
    flex: 1,
  },
  identityMeta: {
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: typography.small,
    lineHeight: 18,
    marginTop: spacing.xs,
  },
  identityRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  identityTitle: {
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: typography.body,
    fontWeight: '600',
  },
  integrationLabel: {
    color: colors.muted,
    fontFamily: fonts.semibold,
    fontSize: typography.body,
    fontWeight: '600',
  },
  integrationRow: {
    alignItems: 'center',
    borderTopColor: colors.dividerSoft,
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
  },
  integrationValue: {
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: typography.body,
    fontWeight: '600',
  },
  legalText: {
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: typography.small,
    lineHeight: 21,
  },
  legalLink: {
    alignSelf: 'flex-start',
    marginTop: spacing.md,
    paddingVertical: spacing.xs,
  },
  legalLinkText: {
    color: colors.primary,
    fontFamily: fonts.semibold,
    fontSize: typography.small,
    fontWeight: '600',
  },
  modeDetails: {
    marginTop: spacing.sm,
  },
  primaryGap: {
    marginTop: spacing.lg,
  },
  profileAvatar: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: radii.md,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  profileAvatarText: {
    color: colors.primary,
    fontFamily: fonts.semibold,
    fontSize: typography.h3,
    fontWeight: '700',
  },
  profileCopy: {
    flex: 1,
    minWidth: 0,
  },
  profileMeta: {
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: typography.small,
    marginTop: spacing.xs,
  },
  profileName: {
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: typography.h3,
    fontWeight: '700',
  },
  profileSummary: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  reminderPanel: {
    borderTopColor: colors.dividerSoft,
    borderTopWidth: 1,
    gap: spacing.sm,
    paddingTop: spacing.md,
  },
  settingsWindowContent: {
    paddingBottom: spacing.xl,
  },
  settingLabel: {
    color: colors.muted,
    fontFamily: fonts.semibold,
    fontSize: typography.small,
    fontWeight: '600',
  },
  studentCardImage: {
    backgroundColor: colors.surfaceAlt,
    borderCurve: 'continuous',
    borderRadius: radii.lg,
    height: 72,
    width: 108,
  },
});
