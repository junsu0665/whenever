import React, { ReactNode, useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  Ban,
  CheckCircle2,
  Eye,
  EyeOff,
  Flag,
  IdCard,
  MessageSquareText,
  Shield,
  Trash2,
  UserCheck,
  Users,
  XCircle,
} from 'lucide-react-native';

import { Card } from '../components/Card';
import { Screen } from '../components/Screen';
import { SectionHeader } from '../components/SectionHeader';
import { SegmentedControl } from '../components/SegmentedControl';
import { colors, fonts, radii, spacing, typography } from '../theme';
import { useAppState } from '../state/AppStateContext';
import { AccountStatus, CommunityReport, Post, PostComment, Profile, StudentVerificationRequest, VerificationStatus } from '../types';
import { formatGradeClass } from '../utils/profile';

type AdminView = 'dashboard' | 'reports' | 'users' | 'posts' | 'verifications';
type Tone = 'primary' | 'danger' | 'neutral' | 'warning';

const adminSegments: Array<{ key: AdminView; label: string }> = [
  { key: 'dashboard', label: '지표' },
  { key: 'reports', label: '신고' },
  { key: 'users', label: '사용자' },
  { key: 'posts', label: '글' },
  { key: 'verifications', label: '학생증' },
];

const verificationLabel: Record<VerificationStatus, string> = {
  approved: '승인',
  not_submitted: '미제출',
  pending: '대기',
  rejected: '반려',
};

const accountLabel: Record<AccountStatus, string> = {
  active: '정상',
  suspended: '정지',
};

const formatDate = (value?: string) => {
  if (!value) {
    return '기록 없음';
  }

  return new Date(value).toLocaleString('ko-KR', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const getUserName = (users: Profile[], userId: string) => users.find((user) => user.id === userId)?.name ?? userId;

export function AdminScreen() {
  const {
    adminDeleteComment,
    adminDeletePost,
    adminDismissReport,
    adminReviewStudentVerification,
    adminSetCommentHidden,
    adminSetPostHidden,
    adminSetUserAccountStatus,
    comments,
    posts,
    profile,
    reports,
    studentVerifications,
    users,
  } = useAppState();
  const [view, setView] = useState<AdminView>('dashboard');

  const metrics = useMemo(
    () => [
      { label: '학생증 대기', value: studentVerifications.filter((verification) => verification.status === 'pending').length },
      { label: '신고 접수', value: reports.length },
      { label: '숨김 콘텐츠', value: posts.filter((post) => post.hidden).length + comments.filter((comment) => comment.hidden).length },
      { label: '정지 사용자', value: users.filter((user) => user.accountStatus === 'suspended').length },
    ],
    [comments, posts, reports.length, studentVerifications, users],
  );

  return (
    <Screen>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>관리자</Text>
          <Text style={styles.subtitle}>{profile.schoolName} 운영 관리</Text>
        </View>
        <View style={styles.adminMark}>
          <Shield color={colors.primary} size={18} />
          <Text style={styles.adminMarkText}>Admin</Text>
        </View>
      </View>

      <View style={styles.metricGrid}>
        {metrics.map((metric) => (
          <View key={metric.label} style={styles.metricTile}>
            <Text style={styles.metricValue}>{metric.value}</Text>
            <Text style={styles.metricLabel}>{metric.label}</Text>
          </View>
        ))}
      </View>

      <SegmentedControl onChange={setView} segments={adminSegments} value={view} />

      {view === 'dashboard' ? (
        <DashboardPanel comments={comments} posts={posts} reports={reports} studentVerifications={studentVerifications} users={users} />
      ) : null}

      {view === 'reports' ? (
        <ReportsPanel
          comments={comments}
          onDeleteComment={adminDeleteComment}
          onDeletePost={adminDeletePost}
          onDismiss={adminDismissReport}
          onSetCommentHidden={adminSetCommentHidden}
          onSetPostHidden={adminSetPostHidden}
          posts={posts}
          reports={reports}
          users={users}
        />
      ) : null}

      {view === 'users' ? (
        <UsersPanel
          currentUserId={profile.id}
          onReviewVerification={adminReviewStudentVerification}
          onSetAccountStatus={adminSetUserAccountStatus}
          users={users}
        />
      ) : null}

      {view === 'posts' ? (
        <PostsPanel onDeletePost={adminDeletePost} onSetPostHidden={adminSetPostHidden} posts={posts} users={users} />
      ) : null}

      {view === 'verifications' ? (
        <VerificationsPanel
          onReviewVerification={adminReviewStudentVerification}
          studentVerifications={studentVerifications}
          users={users}
        />
      ) : null}
    </Screen>
  );
}

function DashboardPanel({
  comments,
  posts,
  reports,
  studentVerifications,
  users,
}: {
  comments: PostComment[];
  posts: Post[];
  reports: CommunityReport[];
  studentVerifications: StudentVerificationRequest[];
  users: Profile[];
}) {
  const reasonCounts = [...reports.reduce((counts, report) => counts.set(report.reason, (counts.get(report.reason) ?? 0) + 1), new Map<string, number>())]
    .sort((first, second) => second[1] - first[1])
    .slice(0, 5);
  const reportedAuthorCounts = reports.reduce((counts, report) => {
    const post = report.targetType === 'post' ? posts.find((item) => item.id === report.targetId) : undefined;
    const comment = report.targetType === 'comment' ? comments.find((item) => item.id === report.targetId) : undefined;
    const authorId = post?.authorId ?? comment?.authorId;
    return authorId ? counts.set(authorId, (counts.get(authorId) ?? 0) + 1) : counts;
  }, new Map<string, number>());
  const reporterCounts = reports.reduce(
    (counts, report) => counts.set(report.reporterId, (counts.get(report.reporterId) ?? 0) + 1),
    new Map<string, number>(),
  );
  const flaggedUsers = users
    .map((user) => ({
      user,
      received: reportedAuthorCounts.get(user.id) ?? 0,
      submitted: reporterCounts.get(user.id) ?? 0,
    }))
    .filter((entry) => entry.received >= 3 || entry.submitted >= 5 || entry.user.accountStatus === 'suspended')
    .sort((first, second) => second.received + second.submitted - (first.received + first.submitted))
    .slice(0, 6);

  return (
    <>
      <Card>
        <SectionHeader action={<Shield color={colors.primary} size={22} />} title="운영 지표" />
        <View style={styles.statGrid}>
          <Metric label="전체 사용자" value={users.length} />
          <Metric label="승인 학생" value={users.filter((user) => user.verificationStatus === 'approved').length} />
          <Metric label="게시글" value={posts.length} />
          <Metric label="댓글" value={comments.length} />
          <Metric label="학생증 대기" value={studentVerifications.filter((item) => item.status === 'pending').length} />
          <Metric label="신고 누적" value={reports.length} />
        </View>
      </Card>

      <Card>
        <SectionHeader action={<Flag color={colors.danger} size={22} />} title="신고 사유 통계" />
        {reasonCounts.length ? (
          reasonCounts.map(([reason, count]) => (
            <View key={reason} style={styles.reasonStatRow}>
              <Text style={styles.reasonStatLabel}>{reason}</Text>
              <Text style={styles.reasonStatValue}>{count}건</Text>
            </View>
          ))
        ) : (
          <EmptyState icon={<Flag color={colors.subtle} size={24} />} text="아직 신고 통계가 없습니다." />
        )}
      </Card>

      <Card>
        <SectionHeader action={<Ban color={colors.danger} size={22} />} title="부정 사용 신호" />
        {flaggedUsers.length ? (
          flaggedUsers.map(({ user, received, submitted }) => (
            <View key={user.id} style={styles.row}>
              <View style={styles.rowHeader}>
                <View style={styles.rowTitleWrap}>
                  <Text style={styles.rowTitle}>{user.name}</Text>
                  <Text style={styles.rowBody}>
                    신고 대상 {received}건 · 신고 제출 {submitted}건 · {accountLabel[user.accountStatus ?? 'active']}
                  </Text>
                </View>
                <StatusBadge label={user.accountStatus === 'suspended' ? '정지' : '검토'} tone={user.accountStatus === 'suspended' ? 'danger' : 'warning'} />
              </View>
            </View>
          ))
        ) : (
          <EmptyState icon={<Users color={colors.subtle} size={24} />} text="주의가 필요한 사용자가 없습니다." />
        )}
      </Card>
    </>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.statTile}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function ReportsPanel({
  comments,
  onDeleteComment,
  onDeletePost,
  onDismiss,
  onSetCommentHidden,
  onSetPostHidden,
  posts,
  reports,
  users,
}: {
  comments: PostComment[];
  onDeleteComment: (commentId: string) => void;
  onDeletePost: (postId: string) => void;
  onDismiss: (reportId: string) => void;
  onSetCommentHidden: (commentId: string, hidden: boolean) => void;
  onSetPostHidden: (postId: string, hidden: boolean) => void;
  posts: Post[];
  reports: CommunityReport[];
  users: Profile[];
}) {
  const sortedReports = [...reports].sort((first, second) => new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime());

  return (
    <Card>
      <SectionHeader action={<Flag color={colors.danger} size={22} />} title="신고 관리" />
      {sortedReports.length ? (
        sortedReports.map((report) => {
          const post = report.targetType === 'post' ? posts.find((item) => item.id === report.targetId) : undefined;
          const comment = report.targetType === 'comment' ? comments.find((item) => item.id === report.targetId) : undefined;
          const parentPost = comment ? posts.find((item) => item.id === comment.postId) : undefined;
          const targetHidden = report.targetType === 'post' ? Boolean(post?.hidden) : Boolean(comment?.hidden);
          const title = post?.title ?? parentPost?.title ?? '삭제된 대상';
          const body = post?.body ?? comment?.body ?? '대상을 찾을 수 없습니다.';

          return (
            <View key={report.id} style={styles.row}>
              <View style={styles.rowHeader}>
                <View style={styles.rowTitleWrap}>
                  <Text style={styles.rowTitle}>{title}</Text>
                  <Text numberOfLines={2} style={styles.rowBody}>
                    {body}
                  </Text>
                </View>
                <StatusBadge label={report.targetType === 'post' ? '게시글' : '댓글'} tone={targetHidden ? 'danger' : 'warning'} />
              </View>
              <Text style={styles.metaText}>
                {report.reason} · 신고자 {getUserName(users, report.reporterId)} · {formatDate(report.createdAt)}
              </Text>
              <View style={styles.actionRow}>
                {report.targetType === 'post' && post ? (
                  <>
                    <AdminActionButton
                      icon={targetHidden ? <Eye color={colors.primary} size={15} /> : <EyeOff color={colors.warning} size={15} />}
                      label={targetHidden ? '복구' : '숨김'}
                      onPress={() => onSetPostHidden(post.id, !targetHidden)}
                      tone={targetHidden ? 'primary' : 'warning'}
                    />
                    <AdminActionButton
                      icon={<Trash2 color={colors.danger} size={15} />}
                      label="삭제"
                      onPress={() => onDeletePost(post.id)}
                      tone="danger"
                    />
                  </>
                ) : null}
                {report.targetType === 'comment' && comment ? (
                  <>
                    <AdminActionButton
                      icon={targetHidden ? <Eye color={colors.primary} size={15} /> : <EyeOff color={colors.warning} size={15} />}
                      label={targetHidden ? '복구' : '숨김'}
                      onPress={() => onSetCommentHidden(comment.id, !targetHidden)}
                      tone={targetHidden ? 'primary' : 'warning'}
                    />
                    <AdminActionButton
                      icon={<Trash2 color={colors.danger} size={15} />}
                      label="삭제"
                      onPress={() => onDeleteComment(comment.id)}
                      tone="danger"
                    />
                  </>
                ) : null}
                <AdminActionButton
                  icon={<CheckCircle2 color={colors.primary} size={15} />}
                  label="처리완료"
                  onPress={() => onDismiss(report.id)}
                  tone="primary"
                />
              </View>
            </View>
          );
        })
      ) : (
        <EmptyState icon={<Flag color={colors.subtle} size={24} />} text="처리할 신고가 없습니다." />
      )}
    </Card>
  );
}

function UsersPanel({
  currentUserId,
  onReviewVerification,
  onSetAccountStatus,
  users,
}: {
  currentUserId: string;
  onReviewVerification: (userId: string, status: Extract<VerificationStatus, 'approved' | 'rejected'>, rejectionReason?: string) => void;
  onSetAccountStatus: (userId: string, status: AccountStatus) => void;
  users: Profile[];
}) {
  const sortedUsers = [...users].sort((first, second) => {
    if (first.isAdmin !== second.isAdmin) {
      return first.isAdmin ? -1 : 1;
    }
    return first.name.localeCompare(second.name, 'ko-KR');
  });

  return (
    <Card>
      <SectionHeader action={<Users color={colors.primary} size={22} />} title="사용자 관리" />
      {sortedUsers.map((user) => {
        const suspended = user.accountStatus === 'suspended';
        const self = user.id === currentUserId;

        return (
          <View key={user.id} style={styles.row}>
            <View style={styles.rowHeader}>
              <View style={styles.rowTitleWrap}>
                <Text style={styles.rowTitle}>
                  {user.name}
                  {user.isAdmin ? ' · 관리자' : ''}
                </Text>
                <Text style={styles.rowBody}>
                  {formatGradeClass(user.grade, user.className)} · 최근 {formatDate(user.lastActiveAt)}
                </Text>
              </View>
              <View style={styles.badgeStack}>
                <StatusBadge label={verificationLabel[user.verificationStatus]} tone={verificationTone(user.verificationStatus)} />
                <StatusBadge label={accountLabel[user.accountStatus ?? 'active']} tone={suspended ? 'danger' : 'primary'} />
              </View>
            </View>
            <View style={styles.actionRow}>
              {user.verificationStatus === 'pending' ? (
                <>
                  <AdminActionButton
                    icon={<UserCheck color={colors.primary} size={15} />}
                    label="승인"
                    onPress={() => onReviewVerification(user.id, 'approved')}
                    tone="primary"
                  />
                  <AdminActionButton
                    icon={<XCircle color={colors.danger} size={15} />}
                    label="반려"
                    onPress={() => onReviewVerification(user.id, 'rejected', '학생증 정보가 선명하지 않습니다.')}
                    tone="danger"
                  />
                </>
              ) : null}
              <AdminActionButton
                disabled={self}
                icon={suspended ? <UserCheck color={colors.primary} size={15} /> : <Ban color={colors.danger} size={15} />}
                label={self ? '본인' : suspended ? '정지 해제' : '정지'}
                onPress={() => onSetAccountStatus(user.id, suspended ? 'active' : 'suspended')}
                tone={suspended ? 'primary' : 'danger'}
              />
            </View>
          </View>
        );
      })}
    </Card>
  );
}

function PostsPanel({
  onDeletePost,
  onSetPostHidden,
  posts,
  users,
}: {
  onDeletePost: (postId: string) => void;
  onSetPostHidden: (postId: string, hidden: boolean) => void;
  posts: Post[];
  users: Profile[];
}) {
  const sortedPosts = [...posts].sort((first, second) => new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime());

  return (
    <Card>
      <SectionHeader action={<MessageSquareText color={colors.primary} size={22} />} title="글 관리" />
      {sortedPosts.length ? (
        sortedPosts.map((post) => (
          <View key={post.id} style={styles.row}>
            <View style={styles.rowHeader}>
              <View style={styles.rowTitleWrap}>
                <Text style={styles.rowTitle}>{post.title}</Text>
                <Text numberOfLines={2} style={styles.rowBody}>
                  {post.body}
                </Text>
              </View>
              <StatusBadge label={post.hidden ? '숨김' : post.scope === 'school' ? '학교' : '수강자'} tone={post.hidden ? 'danger' : 'neutral'} />
            </View>
            <Text style={styles.metaText}>
              작성자 {getUserName(users, post.authorId)} · 신고 {post.reportCount} · 댓글 {post.commentCount} · 조회 {post.viewCount}
            </Text>
            <View style={styles.actionRow}>
              <AdminActionButton
                icon={post.hidden ? <Eye color={colors.primary} size={15} /> : <EyeOff color={colors.warning} size={15} />}
                label={post.hidden ? '복구' : '숨김'}
                onPress={() => onSetPostHidden(post.id, !post.hidden)}
                tone={post.hidden ? 'primary' : 'warning'}
              />
              <AdminActionButton
                icon={<Trash2 color={colors.danger} size={15} />}
                label="삭제"
                onPress={() => onDeletePost(post.id)}
                tone="danger"
              />
            </View>
          </View>
        ))
      ) : (
        <EmptyState icon={<MessageSquareText color={colors.subtle} size={24} />} text="관리할 글이 없습니다." />
      )}
    </Card>
  );
}

function VerificationsPanel({
  onReviewVerification,
  studentVerifications,
  users,
}: {
  onReviewVerification: (userId: string, status: Extract<VerificationStatus, 'approved' | 'rejected'>, rejectionReason?: string) => void;
  studentVerifications: StudentVerificationRequest[];
  users: Profile[];
}) {
  const sortedVerifications = [...studentVerifications].sort((first, second) => {
    if (first.status !== second.status) {
      return first.status === 'pending' ? -1 : 1;
    }
    return new Date(second.submittedAt).getTime() - new Date(first.submittedAt).getTime();
  });

  return (
    <Card>
      <SectionHeader action={<IdCard color={colors.primary} size={22} />} title="학생증 인증 관리" />
      {sortedVerifications.length ? (
        sortedVerifications.map((verification) => {
          const user = users.find((item) => item.id === verification.userId);
          const pending = verification.status === 'pending';

          return (
            <View key={verification.id} style={styles.row}>
              <View style={styles.verificationRow}>
                {verification.displayUri ? (
                  <Image source={{ uri: verification.displayUri }} style={styles.studentCardImage} />
                ) : (
                  <View style={styles.studentCardEmpty}>
                    <IdCard color={colors.subtle} size={22} />
                  </View>
                )}
                <View style={styles.rowTitleWrap}>
                  <View style={styles.inlineTitle}>
                    <Text style={styles.rowTitle}>{user?.name ?? verification.userId}</Text>
                    <StatusBadge label={verificationLabel[verification.status]} tone={verificationTone(verification.status)} />
                  </View>
                  <Text style={styles.rowBody}>
                    {user ? `${user.schoolName} · ${formatGradeClass(user.grade, user.className)}` : '사용자 정보를 찾을 수 없습니다.'}
                  </Text>
                  <Text style={styles.metaText}>제출 {formatDate(verification.submittedAt)}</Text>
                  {verification.rejectionReason ? <Text style={styles.reasonText}>{verification.rejectionReason}</Text> : null}
                </View>
              </View>
              {pending ? (
                <View style={styles.actionRow}>
                  <AdminActionButton
                    icon={<CheckCircle2 color={colors.primary} size={15} />}
                    label="승인"
                    onPress={() => onReviewVerification(verification.userId, 'approved')}
                    tone="primary"
                  />
                  <AdminActionButton
                    icon={<XCircle color={colors.danger} size={15} />}
                    label="반려"
                    onPress={() => onReviewVerification(verification.userId, 'rejected', '학생증 정보가 선명하지 않습니다.')}
                    tone="danger"
                  />
                </View>
              ) : null}
            </View>
          );
        })
      ) : (
        <EmptyState icon={<IdCard color={colors.subtle} size={24} />} text="검수할 학생증이 없습니다." />
      )}
    </Card>
  );
}

function AdminActionButton({
  disabled,
  icon,
  label,
  onPress,
  tone,
}: {
  disabled?: boolean;
  icon: ReactNode;
  label: string;
  onPress: () => void;
  tone: Tone;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[styles.actionButton, getActionToneStyle(tone), disabled ? styles.actionButtonDisabled : null]}
    >
      {icon}
      <Text style={[styles.actionButtonText, tone === 'danger' ? styles.actionButtonTextDanger : null]}>{label}</Text>
    </Pressable>
  );
}

function EmptyState({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <View style={styles.emptyState}>
      {icon}
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

function StatusBadge({ label, tone }: { label: string; tone: Tone }) {
  return (
    <View style={[styles.badge, getBadgeToneStyle(tone)]}>
      <Text style={[styles.badgeText, tone === 'danger' ? styles.badgeTextDanger : null]}>{label}</Text>
    </View>
  );
}

function verificationTone(status: VerificationStatus): Tone {
  if (status === 'approved') {
    return 'primary';
  }
  if (status === 'rejected') {
    return 'danger';
  }
  if (status === 'pending') {
    return 'warning';
  }
  return 'neutral';
}

function getActionToneStyle(tone: Tone) {
  if (tone === 'primary') {
    return styles.primaryAction;
  }
  if (tone === 'danger') {
    return styles.dangerAction;
  }
  if (tone === 'warning') {
    return styles.warningAction;
  }
  return styles.neutralAction;
}

function getBadgeToneStyle(tone: Tone) {
  if (tone === 'primary') {
    return styles.primaryBadge;
  }
  if (tone === 'danger') {
    return styles.dangerBadge;
  }
  if (tone === 'warning') {
    return styles.warningBadge;
  }
  return styles.neutralBadge;
}

const styles = StyleSheet.create({
  actionButton: {
    alignItems: 'center',
    borderRadius: radii.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.xs,
    minHeight: 34,
    paddingHorizontal: spacing.md,
  },
  actionButtonDisabled: {
    opacity: 0.45,
  },
  actionButtonText: {
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: typography.small,
    fontWeight: '600',
  },
  actionButtonTextDanger: {
    color: colors.danger,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  adminMark: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: radii.pill,
    flexDirection: 'row',
    gap: spacing.xs,
    minHeight: 34,
    paddingHorizontal: spacing.md,
  },
  adminMarkText: {
    color: colors.primary,
    fontFamily: fonts.semibold,
    fontSize: typography.small,
    fontWeight: '600',
  },
  badge: {
    alignItems: 'center',
    borderRadius: radii.pill,
    minHeight: 28,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  badgeStack: {
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  badgeText: {
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: typography.tiny,
    fontWeight: '600',
  },
  badgeTextDanger: {
    color: colors.danger,
  },
  dangerAction: {
    backgroundColor: colors.dangerSoft,
    borderColor: colors.dangerSoft,
  },
  dangerBadge: {
    backgroundColor: colors.dangerSoft,
  },
  emptyState: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xl,
  },
  emptyText: {
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: typography.body,
    lineHeight: 22,
    textAlign: 'center',
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  inlineTitle: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  metaText: {
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: typography.small,
    lineHeight: 20,
    marginTop: spacing.xs,
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  metricLabel: {
    color: colors.muted,
    fontFamily: fonts.semibold,
    fontSize: typography.small,
    fontWeight: '600',
  },
  metricTile: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    flexBasis: '48%',
    flexGrow: 1,
    gap: spacing.xs,
    minHeight: 82,
    padding: spacing.md,
  },
  metricValue: {
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: typography.h1,
    fontWeight: '600',
  },
  neutralAction: {
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
  },
  neutralBadge: {
    backgroundColor: colors.surfaceAlt,
  },
  primaryAction: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primarySoft,
  },
  primaryBadge: {
    backgroundColor: colors.primarySoft,
  },
  reasonText: {
    color: colors.danger,
    fontFamily: fonts.semibold,
    fontSize: typography.small,
    fontWeight: '600',
    lineHeight: 20,
    marginTop: spacing.xs,
  },
  reasonStatLabel: {
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: typography.body,
    fontWeight: '600',
  },
  reasonStatRow: {
    alignItems: 'center',
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
  },
  reasonStatValue: {
    color: colors.danger,
    fontFamily: fonts.semibold,
    fontSize: typography.body,
    fontWeight: '600',
  },
  row: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    paddingVertical: spacing.lg,
  },
  rowBody: {
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: typography.small,
    lineHeight: 20,
    marginTop: spacing.xs,
  },
  rowHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  rowTitle: {
    color: colors.text,
    flexShrink: 1,
    fontFamily: fonts.semibold,
    fontSize: typography.body,
    fontWeight: '600',
    lineHeight: 23,
  },
  rowTitleWrap: {
    flex: 1,
  },
  studentCardEmpty: {
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderStyle: 'dashed',
    borderWidth: 1,
    height: 72,
    justifyContent: 'center',
    width: 108,
  },
  studentCardImage: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.md,
    height: 72,
    width: 108,
  },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  statLabel: {
    color: colors.muted,
    fontFamily: fonts.semibold,
    fontSize: typography.small,
    fontWeight: '600',
  },
  statTile: {
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    flexBasis: '31%',
    flexGrow: 1,
    gap: spacing.xs,
    minHeight: 74,
    padding: spacing.md,
  },
  statValue: {
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: typography.h2,
    fontWeight: '600',
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
  verificationRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  warningAction: {
    backgroundColor: colors.warningSoft,
    borderColor: colors.warningSoft,
  },
  warningBadge: {
    backgroundColor: colors.warningSoft,
  },
});
