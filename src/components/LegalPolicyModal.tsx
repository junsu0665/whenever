import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { X } from 'lucide-react-native';

import { providerConfig } from '../services/env';
import { colors, fonts, radii, spacing, typography } from '../theme';

interface LegalPolicyModalProps {
  visible: boolean;
  onClose: () => void;
}

const policySections = [
  {
    title: '서비스 이용 조건',
    body: '학교, 학년, 반 프로필과 학생증 인증이 승인된 사용자만 웨네버를 사용할 수 있습니다. 허위 인증, 타인 사칭, 개인정보 노출, 괴롭힘, 광고/도배, 불법 행위는 제한될 수 있습니다.',
  },
  {
    title: '개인정보 처리',
    body: '이메일, 이름, 학교, 학년, 반, 학생증 이미지, 시간표 이미지 또는 OCR 결과, 성적 제보, 게시글/댓글/신고 기록, 알림 토큰, 광고 이벤트를 서비스 제공과 운영 안전 목적으로 처리합니다.',
  },
  {
    title: '학생증 이미지',
    body: '학생증 이미지는 학생 인증 검수와 이의제기 대응 목적으로만 사용합니다. 공개 게시판이나 프로필에는 노출하지 않으며, 탈퇴 시 삭제 대상입니다.',
  },
  {
    title: '성적 제보',
    body: '성적 점수는 같은 학교/학년/과목/시험명 단위의 익명 집계와 참고 예측에만 사용합니다. 제보 수가 5명 미만이면 개별 점수 목록과 상위 점수 통계를 표시하지 않습니다.',
  },
  {
    title: '광고와 스폰서십',
    body: '광고에는 광고 라벨을 표시합니다. 광고 타겟팅은 학교, 지역, 시험기간 같은 단위로만 운영하며 개인 성적, 반, 시간표, 학생증 이미지는 광고 타겟팅에 사용하지 않습니다.',
  },
  {
    title: '탈퇴와 삭제',
    body: '계정 삭제를 요청하면 인증 이미지, 시간표 업로드, 프로필, 알림 토큰 등 계정 연결 데이터가 삭제됩니다. 법령상 별도 보관이 필요한 항목이 생기면 보관 항목과 기간을 고지합니다.',
  },
];

export function LegalPolicyModal({ visible, onClose }: LegalPolicyModalProps) {
  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible={visible}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>약관과 개인정보</Text>
              <Text style={styles.subtitle}>웨네버 운영 정책 요약</Text>
            </View>
            <Pressable accessibilityLabel="닫기" accessibilityRole="button" onPress={onClose} style={styles.closeButton}>
              <X color={colors.text} size={20} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            {policySections.map((section) => (
              <View key={section.title} style={styles.section}>
                <Text style={styles.sectionTitle}>{section.title}</Text>
                <Text style={styles.sectionBody}>{section.body}</Text>
              </View>
            ))}
            <View style={styles.contactBox}>
              <Text style={styles.contactTitle}>문의</Text>
              <Text style={styles.contactBody}>
                개인정보 열람/정정/삭제 요청, 신고 이의제기, 운영 문의는 {providerConfig.supportEmail} 로 접수합니다.
              </Text>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: 'rgba(23, 32, 42, 0.36)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  closeButton: {
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderRadius: radii.pill,
    borderWidth: 1,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  contactBody: {
    color: colors.primaryDark,
    fontFamily: fonts.regular,
    fontSize: typography.small,
    lineHeight: 21,
  },
  contactBox: {
    backgroundColor: colors.primarySoft,
    borderColor: '#CBECE6',
    borderRadius: radii.md,
    borderWidth: 1,
    padding: spacing.md,
  },
  contactTitle: {
    color: colors.primaryDark,
    fontFamily: fonts.semibold,
    fontSize: typography.small,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  content: {
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  section: {
    borderTopColor: colors.dividerSoft,
    borderTopWidth: 1,
    paddingTop: spacing.md,
  },
  sectionBody: {
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: typography.small,
    lineHeight: 21,
    marginTop: spacing.xs,
  },
  sectionTitle: {
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: typography.body,
    fontWeight: '600',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    maxHeight: '86%',
    padding: spacing.xl,
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
    fontSize: typography.h2,
    fontWeight: '700',
  },
});
