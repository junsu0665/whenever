import * as ImagePicker from 'expo-image-picker';
import React, { useMemo, useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Bell, Database, FileQuestion, FileText, IdCard, LogOut, ShieldAlert, ShieldCheck, Trash2, UserRound } from 'lucide-react-native';

import { Card } from '../components/Card';
import { LegalPolicyModal } from '../components/LegalPolicyModal';
import { PrimaryButton } from '../components/PrimaryButton';
import { Screen } from '../components/Screen';
import { SectionHeader } from '../components/SectionHeader';
import { SegmentedControl } from '../components/SegmentedControl';
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

export function ProfileScreen() {
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
    setNotificationSetting,
    setShareStatus,
    signOut,
    studentVerifications,
    submitStudentCard,
  } = useAppState();
  const [error, setError] = useState<string | null>(null);
  const [legalVisible, setLegalVisible] = useState(false);
  const [uploading, setUploading] = useState(false);
  const status = statusCopy[profile.verificationStatus];
  const latestVerification = studentVerifications.find((verification) => verification.userId === profile.id);
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
      setError('학생증 사진 접근 권한이 필요합니다.');
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
        setError(nextError instanceof Error ? nextError.message : '학생증 업로드에 실패했습니다.');
      } finally {
        setUploading(false);
      }
    }
  };

  const confirmDeleteAccount = () => {
    Alert.alert('계정 삭제', '계정과 연결된 인증 이미지, 시간표, 프로필, 알림 정보가 삭제됩니다.', [
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
    <Screen>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>내정보</Text>
          <Text style={styles.subtitle}>
            {profile.schoolName} · {formatGradeClass(profile.grade, profile.className)}
          </Text>
        </View>
      </View>

      <Card>
        <SectionHeader action={statusIcon} title={status.title} />
        <View style={styles.identityRow}>
          {studentCardUri ? <Image source={{ uri: studentCardUri }} style={styles.studentCardImage} /> : <View style={styles.emptyCard} />}
          <View style={styles.identityCopy}>
            <Text style={styles.identityTitle}>학생증 사진</Text>
            <Text style={styles.identityMeta}>
              {profile.verificationStatus === 'approved'
                ? '승인된 학생만 웨네버를 사용할 수 있습니다.'
                : profile.verificationStatus === 'pending'
                  ? '승인 대기중이에요!'
                  : rejectionReason
                    ? `반려 사유: ${rejectionReason}`
                    : '학생증 사진을 제출해야 앱을 사용할 수 있습니다.'}
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
            label={uploading ? '업로드 중' : profile.verificationStatus === 'pending' ? '승인 대기중' : '학생증 업로드'}
            onPress={pickStudentCard}
            style={styles.primaryGap}
          />
        )}
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </Card>

      {profile.isAdmin ? (
        <Card>
          <SectionHeader action={<UserRound color={colors.primary} size={22} />} title="계정 모드" />
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
          </View>
        </Card>
      ) : null}

      <Card>
        <SectionHeader action={<Bell color={colors.primary} size={22} />} title="알림 설정" />
        <ToggleRow
          description={`수업 시작 ${notificationSettings.timetableReminderMinutes}분 전에 알림을 받습니다.`}
          onValueChange={(value) => setNotificationSetting('timetable', value)}
          title="시간표 알림"
          value={notificationSettings.timetable}
        />
        <ToggleRow
          description={`중식 ${notificationSettings.lunchReminderTime} · 석식 ${notificationSettings.dinnerReminderTime}`}
          onValueChange={(value) => setNotificationSetting('meal', value)}
          title="급식 알림"
          value={notificationSettings.meal}
        />
        <ToggleRow
          description="내 글 댓글과 학교 인기글 알림을 받습니다."
          onValueChange={(value) => setNotificationSetting('community', value)}
          title="게시판 알림"
          value={notificationSettings.community}
        />
      </Card>

      <Card>
        <SectionHeader title="친구 시간표 공개" />
        <ToggleRow
          description="친구가 내 시간표와 겹치는 시간을 볼 수 있어요."
          onValueChange={(value) => setShareStatus('timetableShareStatus', value ? 'enabled' : 'disabled')}
          title="내 시간표 공유"
          value={profile.timetableShareStatus === 'enabled'}
        />
        <ToggleRow
          description="내가 친구의 공개 시간표를 볼 수 있어요."
          onValueChange={(value) => setShareStatus('friendTimetableViewStatus', value ? 'enabled' : 'disabled')}
          title="친구 시간표 보기"
          value={profile.friendTimetableViewStatus === 'enabled'}
        />
      </Card>

      <Card>
        <SectionHeader action={<Database color={colors.primary} size={22} />} title="연동 상태" />
        <View style={styles.integrationRow}>
          <Text style={styles.integrationLabel}>백엔드</Text>
          <Text style={styles.integrationValue}>{backendMode}</Text>
        </View>
        <View style={styles.integrationRow}>
          <Text style={styles.integrationLabel}>학생 인증</Text>
          <Text style={styles.integrationValue}>Storage 업로드 준비</Text>
        </View>
        <View style={styles.integrationRow}>
          <Text style={styles.integrationLabel}>급식</Text>
          <Text style={styles.integrationValue}>NEIS API fallback</Text>
        </View>
      </Card>

      <Card>
        <SectionHeader action={<FileText color={colors.primary} size={22} />} title="약관과 개인정보" />
        <Text style={styles.legalText}>
          학생증 이미지는 학생 인증 검수 목적으로만 사용하며, 승인 또는 반려 후 운영 보관 기간이 끝나면 삭제 대상입니다.
          탈퇴하면 인증 이미지, 시간표 업로드, 프로필, 알림 토큰 등 계정 연결 데이터가 삭제됩니다.
        </Text>
        <Pressable accessibilityRole="button" onPress={() => setLegalVisible(true)} style={styles.legalLink}>
          <Text style={styles.legalLinkText}>운영 정책 보기</Text>
        </Pressable>
      </Card>

      <Card>
        <SectionHeader action={<FileQuestion color={colors.primary} size={22} />} title="고객센터" />
        <Text style={styles.legalText}>
          문의, 신고 이의제기, 개인정보 요청은 {providerConfig.supportEmail} 로 접수합니다.
        </Text>
      </Card>

      <Card>
        <SectionHeader title="계정" />
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
        {authError ? <Text style={styles.errorText}>{authError}</Text> : null}
      </Card>
      <LegalPolicyModal onClose={() => setLegalVisible(false)} visible={legalVisible} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  accountActions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  accountButton: {
    flex: 1,
  },
  emptyCard: {
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderCurve: 'continuous',
    borderRadius: radii.lg,
    borderStyle: 'dashed',
    borderWidth: 1,
    height: 72,
    width: 108,
  },
  errorText: {
    color: colors.danger,
    fontSize: typography.small,
    fontWeight: '600',
    marginTop: spacing.md,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
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
  studentCardImage: {
    backgroundColor: colors.surfaceAlt,
    borderCurve: 'continuous',
    borderRadius: radii.lg,
    height: 72,
    width: 108,
  },
  subtitle: {
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: typography.small,
    marginTop: spacing.xs,
  },
  title: {
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: typography.h1,
    fontWeight: '600',
  },
});
