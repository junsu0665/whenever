import * as ImagePicker from 'expo-image-picker';
import React, { useMemo, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { Clock3, IdCard, ShieldCheck, Upload } from 'lucide-react-native';

import { Card } from '../components/Card';
import { PrimaryButton } from '../components/PrimaryButton';
import { Screen } from '../components/Screen';
import { colors, fonts, radii, spacing, typography } from '../theme';
import { useAppState } from '../state/AppStateContext';
import { formatGradeClass } from '../utils/profile';

export function VerificationGateScreen() {
  const { profile, studentVerifications, submitStudentCard } = useAppState();
  const [error, setError] = useState<string | null>(null);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const pending = profile.verificationStatus === 'pending';
  const rejected = profile.verificationStatus === 'rejected';
  const latestVerification = [...studentVerifications]
    .filter((verification) => verification.userId === profile.id)
    .sort((first, second) => new Date(second.submittedAt).getTime() - new Date(first.submittedAt).getTime())[0];
  const studentCardUri = previewUri ?? latestVerification?.displayUri ?? profile.studentCardUri;
  const rejectionReason = latestVerification?.rejectionReason ?? profile.studentVerificationRejectionReason;

  const copy = useMemo(() => {
    if (pending) {
      return {
        title: '승인 대기 중이에요.',
        body: '관리자가 학생증을 확인하고 있어요. 승인 전에는 일부 기능이 제한돼요.',
        button: '제출 완료',
      };
    }

    if (rejected) {
      return {
        title: '학생증을 다시 제출해 주세요',
        body: rejectionReason
          ? `반려 사유: ${rejectionReason}`
          : '이름, 학교명, 얼굴 또는 학번이 선명하게 보이는 사진으로 다시 올려 주세요.',
        button: '학생증 다시 업로드',
      };
    }

    return {
      title: '학생증 인증이 필요해요.',
      body: '학교 인증이 끝나면 시간표, 급식, 게시판을 모두 사용할 수 있어요. 먼저 학생증 사진을 제출해 주세요.',
      button: '학생증 업로드',
    };
  }, [pending, rejected, rejectionReason]);

  const pickStudentCard = async () => {
    if (pending) {
      return;
    }

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

    if (result.canceled) {
      return;
    }

    const selectedUri = result.assets[0]?.uri;
    if (!selectedUri) {
      setError('선택한 사진을 읽지 못했어요. 다른 사진으로 다시 시도해 주세요.');
      return;
    }

    setPreviewUri(selectedUri);
    setUploading(true);
    try {
      await submitStudentCard(selectedUri);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : '학생증 업로드에 실패했어요.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Screen>
      <View style={styles.wrap}>
        <View style={styles.iconCircle}>
          {pending ? <Clock3 color={colors.primary} size={34} /> : <IdCard color={colors.primary} size={34} />}
        </View>
        <Text style={styles.title}>{copy.title}</Text>
        <Text style={styles.body}>{copy.body}</Text>
      </View>

      <Card style={styles.card}>
        <View style={styles.identityRow}>
          {studentCardUri ? (
            <Image resizeMode="cover" source={{ uri: studentCardUri }} style={styles.studentCardImage} />
          ) : (
            <View style={styles.emptyCard}>
              <Upload color={colors.subtle} size={22} />
            </View>
          )}
          <View style={styles.identityCopy}>
            <Text style={styles.identityTitle}>
              {profile.schoolName} · {formatGradeClass(profile.grade, profile.className)}
            </Text>
            <Text style={styles.identityMeta}>
              {pending
                ? '제출한 학생증을 검수 중입니다.'
                : rejected
                  ? '반려 사유를 확인한 뒤 새 사진으로 재제출해 주세요.'
                  : '학생증 앞면이 잘 보이는 사진을 올려 주세요.'}
            </Text>
          </View>
        </View>

        <PrimaryButton
          disabled={pending || uploading}
          icon={pending ? <ShieldCheck color={colors.disabled} size={20} /> : <IdCard color={colors.surface} size={20} />}
          label={uploading ? '업로드 중' : copy.button}
          onPress={pickStudentCard}
          style={styles.button}
        />
        {error ? <Text selectable style={styles.errorText}>{error}</Text> : null}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: {
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: typography.body,
    lineHeight: 24,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  button: {
    marginTop: spacing.lg,
  },
  card: {
    gap: spacing.md,
  },
  emptyCard: {
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderCurve: 'continuous',
    borderRadius: radii.md,
    borderStyle: 'dashed',
    borderWidth: 1,
    height: 78,
    justifyContent: 'center',
    width: 118,
  },
  errorText: {
    color: colors.danger,
    fontFamily: fonts.semibold,
    fontSize: typography.small,
    fontWeight: '600',
    lineHeight: 20,
  },
  iconCircle: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: radii.pill,
    height: 72,
    justifyContent: 'center',
    width: 72,
  },
  identityCopy: {
    flex: 1,
  },
  identityMeta: {
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: typography.small,
    lineHeight: 20,
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
    lineHeight: 23,
  },
  studentCardImage: {
    backgroundColor: colors.surfaceAlt,
    borderCurve: 'continuous',
    borderRadius: radii.md,
    height: 78,
    width: 118,
  },
  title: {
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: typography.h1,
    fontWeight: '600',
    lineHeight: 34,
    marginTop: spacing.lg,
    textAlign: 'center',
  },
  wrap: {
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xxl,
  },
});
