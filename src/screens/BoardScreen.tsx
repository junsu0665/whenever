import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  ArrowLeft,
  Bookmark,
  ChevronRight,
  Eye,
  Flag,
  Flame,
  LockKeyhole,
  MessageCircle,
  MessageSquarePlus,
  RefreshCcw,
  Search,
  Send,
  ThumbsUp,
  Trash2,
  X,
} from 'lucide-react-native';

import { Card } from '../components/Card';
import { PrimaryButton } from '../components/PrimaryButton';
import { BoardNativeAd, BottomBannerAd } from '../components/RevenueAds';
import { Screen } from '../components/Screen';
import { SectionHeader } from '../components/SectionHeader';
import { SegmentedControl } from '../components/SegmentedControl';
import { colors, fonts, radii, spacing, typography } from '../theme';
import { useAppState } from '../state/AppStateContext';
import { Post, PostScope } from '../types';

type BoardView = 'hot' | 'mine' | 'myComments' | 'bookmarks' | PostScope;
type ComposeCourse = { id: string; subject: string; meta: string };
type ReportTarget = { type: 'post' | 'comment'; id: string; label: string };

const boardSegments: Array<{ key: BoardView; label: string }> = [
  { key: 'hot', label: '인기' },
  { key: 'school', label: '학교' },
  { key: 'course', label: '수강자' },
  { key: 'mine', label: '내 글' },
  { key: 'myComments', label: '내 댓글' },
  { key: 'bookmarks', label: '저장' },
];

const pageSize = 12;

const composeScopeSegments: Array<{ key: PostScope; label: string }> = [
  { key: 'school', label: '학교 전체' },
  { key: 'course', label: '수강자' },
];

const reportReasons = ['욕설/비방', '개인정보 노출', '광고/도배', '부적절한 내용'];

const formatTime = (value: string) =>
  new Date(value).toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
  });

const isHotPost = (post: Post) => post.hot || post.likeCount >= 8 || post.commentCount >= 5;

const getPostRankScore = (post: Post) => {
  const ageHours = Math.max(1, (Date.now() - new Date(post.createdAt).getTime()) / 36e5);
  return post.likeCount * 3 + post.commentCount * 2 + post.viewCount * 0.15 - Math.log(ageHours) * 1.5;
};

export function BoardScreen() {
  const {
    closePost,
    comments,
    communityActions,
    createComment,
    createPost,
    bookmarkPost,
    deleteComment,
    deletePost,
    likeComment,
    likePost,
    openPost,
    posts,
    profile,
    refreshRemoteData,
    reportComment,
    reportPost,
    selectedPostId,
    selectedPostScope,
    setSelectedPostScope,
    timetable,
  } = useAppState();
  const [boardView, setBoardView] = useState<BoardView>(selectedPostScope);
  const [composeScope, setComposeScope] = useState<PostScope>('school');
  const [composeCourseId, setComposeCourseId] = useState<string | null>(null);
  const [selectedBoardCourseId, setSelectedBoardCourseId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [commentBody, setCommentBody] = useState('');
  const [composerOpen, setComposerOpen] = useState(false);
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(pageSize);
  const verified = profile.verificationStatus === 'approved';
  const courseOptions = useMemo<ComposeCourse[]>(() => {
    const courses = new Map<string, ComposeCourse>();
    timetable.slots.forEach((slot) => {
      if (!slot.courseId || courses.has(slot.courseId)) {
        return;
      }

      courses.set(slot.courseId, {
        id: slot.courseId,
        subject: slot.subject,
        meta: [slot.teacher, slot.room].filter(Boolean).join(' · '),
      });
    });

    return [...courses.values()];
  }, [timetable.slots]);
  const selectedBoardCourse = courseOptions.find((course) => course.id === selectedBoardCourseId) ?? courseOptions[0];
  const selectedComposeCourse = courseOptions.find((course) => course.id === composeCourseId) ?? selectedBoardCourse ?? courseOptions[0];
  const selectedPost = posts.find((post) => post.id === selectedPostId && !post.hidden);
  const postComments = comments
    .filter((comment) => comment.postId === selectedPostId && !comment.hidden)
    .sort((first, second) => new Date(first.createdAt).getTime() - new Date(second.createdAt).getTime());
  const visiblePosts = useMemo(
    () => {
      const myCommentPostIds = new Set(comments.filter((comment) => comment.authorId === profile.id).map((comment) => comment.postId));
      const normalizedQuery = searchQuery.trim().toLowerCase();

      return posts
        .filter((post) => {
          if (post.hidden) {
            return false;
          }

          if (boardView === 'hot') {
            return isHotPost(post);
          }

          if (boardView === 'mine') {
            return post.authorId === profile.id;
          }

          if (boardView === 'myComments') {
            return myCommentPostIds.has(post.id);
          }

          if (boardView === 'bookmarks') {
            return communityActions.bookmarkedPostIds.includes(post.id);
          }

          if (post.scope !== boardView) {
            return false;
          }

          if (boardView === 'school') {
            return true;
          }

          return Boolean(selectedBoardCourse && post.courseId === selectedBoardCourse.id);
        })
        .filter((post) => {
          if (!normalizedQuery) {
            return true;
          }

          return `${post.title} ${post.body}`.toLowerCase().includes(normalizedQuery);
        })
        .sort((first, second) => {
          if (boardView === 'hot') {
            return getPostRankScore(second) - getPostRankScore(first);
          }

          return new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime();
        });
    },
    [boardView, comments, communityActions.bookmarkedPostIds, posts, profile.id, searchQuery, selectedBoardCourse],
  );
  const pagedPosts = visiblePosts.slice(0, visibleCount);
  const canSubmitPost = Boolean(title.trim() && body.trim() && (composeScope === 'school' || selectedComposeCourse));
  const showFeedAd = boardView === 'hot' || boardView === 'school' || boardView === 'course';

  const changeBoardView = (nextView: BoardView) => {
    setBoardView(nextView);
    setVisibleCount(pageSize);
    if (nextView !== 'hot') {
      if (nextView === 'mine' || nextView === 'myComments' || nextView === 'bookmarks') {
        return;
      }
      setSelectedPostScope(nextView);
    }
  };

  const openComposer = () => {
    if (boardView !== 'hot' && boardView !== 'mine' && boardView !== 'myComments' && boardView !== 'bookmarks') {
      setComposeScope(boardView);
      if (boardView === 'course') {
        setComposeCourseId(selectedBoardCourse?.id ?? null);
      }
    }
    setComposerOpen(true);
  };

  const submitPost = () => {
    if (!title.trim() || !body.trim()) {
      return;
    }

    if (!canSubmitPost) {
      return;
    }

    createPost(composeScope, title.trim(), body.trim(), composeScope === 'course' ? selectedComposeCourse?.id : undefined);
    setTitle('');
    setBody('');
    setComposerOpen(false);
  };

  const submitComment = () => {
    if (!selectedPost || !commentBody.trim()) {
      return;
    }

    createComment(selectedPost.id, commentBody.trim());
    setCommentBody('');
  };

  const requestReport = (target: ReportTarget) => {
    if (!verified) {
      return;
    }

    setReportTarget(target);
  };

  const submitReport = (reason: string) => {
    if (!reportTarget) {
      return;
    }

    if (reportTarget.type === 'post') {
      reportPost(reportTarget.id, reason);
    } else {
      reportComment(reportTarget.id, reason);
    }
    setReportTarget(null);
  };

  if (selectedPost) {
    return (
      <PostDetail
        commentBody={commentBody}
        communityActions={communityActions}
        comments={postComments}
        onBack={() => {
          setReportTarget(null);
          closePost();
        }}
        onCancelReport={() => setReportTarget(null)}
        onChangeComment={setCommentBody}
        onLikeComment={likeComment}
        onLike={() => likePost(selectedPost.id)}
        onBookmark={() => bookmarkPost(selectedPost.id)}
        onDeletePost={() => deletePost(selectedPost.id)}
        onDeleteComment={deleteComment}
        onReport={() => requestReport({ type: 'post', id: selectedPost.id, label: '게시글' })}
        onReportComment={(commentId) => requestReport({ type: 'comment', id: commentId, label: '댓글' })}
        onSelectReportReason={submitReport}
        onSubmitComment={submitComment}
        post={selectedPost}
        postBookmarked={communityActions.bookmarkedPostIds.includes(selectedPost.id)}
        profileId={profile.id}
        reportTarget={reportTarget}
        verified={verified}
      />
    );
  }

  return (
    <View style={styles.boardShell}>
      <Screen>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>게시판</Text>
            <Text style={styles.subtitle}>{profile.schoolName} · 학교 인증 익명</Text>
          </View>
        </View>

        <View style={styles.boardHome}>
          <Pressable onPress={() => changeBoardView('hot')} style={styles.boardTile}>
            <Flame color={colors.primary} size={22} />
            <Text style={styles.boardTileTitle}>실시간 인기</Text>
            <Text style={styles.boardTileMeta}>공감과 댓글이 많은 글</Text>
          </Pressable>
          <Pressable onPress={() => changeBoardView('course')} style={styles.boardTile}>
            <MessageCircle color={colors.primary} size={22} />
            <Text style={styles.boardTileTitle}>수업별</Text>
            <Text style={styles.boardTileMeta}>내 시간표 수업 게시판</Text>
          </Pressable>
        </View>

        <SegmentedControl onChange={changeBoardView} segments={boardSegments} value={boardView} />

        <Card>
          <SectionHeader
            action={
              <Pressable accessibilityRole="button" onPress={refreshRemoteData} style={styles.refreshButton}>
                <RefreshCcw color={colors.primary} size={18} />
              </Pressable>
            }
            title={
              boardView === 'hot'
                ? '인기글'
                : boardView === 'school'
                  ? '학교 전체 글'
                  : boardView === 'mine'
                    ? '내가 쓴 글'
                    : boardView === 'myComments'
                      ? '내가 댓글 단 글'
                      : boardView === 'bookmarks'
                        ? '저장한 글'
                        : selectedBoardCourse?.subject ?? '수강자 글'
            }
          />
          <View style={styles.searchBox}>
            <Search color={colors.muted} size={17} />
            <TextInput
              onChangeText={setSearchQuery}
              placeholder="제목 또는 본문 검색"
              placeholderTextColor={colors.disabled}
              style={styles.searchInput}
              value={searchQuery}
            />
          </View>
          {boardView === 'course' ? (
            <CourseFilter
              courseOptions={courseOptions}
              onSelectCourse={setSelectedBoardCourseId}
              selectedCourse={selectedBoardCourse}
            />
          ) : null}
          {visiblePosts.length ? (
            <>
              {pagedPosts.map((post, index) => (
                <React.Fragment key={post.id}>
                  <PostListItem onPress={() => openPost(post.id)} post={post} />
                  {showFeedAd && index === 7 ? <BoardNativeAd /> : null}
                </React.Fragment>
              ))}
              {visibleCount < visiblePosts.length ? (
                <PrimaryButton
                  label="더 보기"
                  onPress={() => setVisibleCount((current) => current + pageSize)}
                  style={styles.loadMoreButton}
                  variant="secondary"
                />
              ) : null}
            </>
          ) : (
            <Text style={styles.emptyText}>아직 올라온 글이 없습니다.</Text>
          )}
        </Card>
        <BottomBannerAd placement="board_bottom" />
      </Screen>

      {composerOpen ? (
        <View style={styles.composeOverlay}>
          <Pressable accessibilityRole="button" onPress={() => setComposerOpen(false)} style={styles.composeBackdrop} />
          <Card style={styles.composeSheet}>
            <View style={styles.composeHandle} />
            <View style={styles.sheetHeader}>
              <View style={styles.sheetTitleRow}>
                <View style={styles.sheetIcon}>
                  <MessageSquarePlus color={colors.primary} size={20} />
                </View>
                <View>
                  <Text style={styles.sheetTitle}>익명 글쓰기</Text>
                  <Text style={styles.sheetMeta}>{profile.schoolName}</Text>
                </View>
              </View>
              <Pressable accessibilityLabel="글쓰기 닫기" accessibilityRole="button" onPress={() => setComposerOpen(false)} style={styles.closeButton}>
                <X color={colors.text} size={20} />
              </Pressable>
            </View>
            <ComposeForm
              body={body}
              canSubmitPost={canSubmitPost}
              composeScope={composeScope}
              courseOptions={courseOptions}
              onChangeBody={setBody}
              onChangeScope={setComposeScope}
              onChangeTitle={setTitle}
              onSelectCourse={setComposeCourseId}
              onSubmit={submitPost}
              selectedComposeCourse={selectedComposeCourse}
              title={title}
              verified={verified}
            />
          </Card>
        </View>
      ) : null}

      {!composerOpen ? (
        <Pressable accessibilityLabel="글쓰기" accessibilityRole="button" onPress={openComposer} style={styles.fab}>
          <MessageSquarePlus color={colors.surface} size={25} />
        </Pressable>
      ) : null}
    </View>
  );
}

function CourseFilter({
  courseOptions,
  onSelectCourse,
  selectedCourse,
}: {
  courseOptions: ComposeCourse[];
  onSelectCourse: (courseId: string) => void;
  selectedCourse?: ComposeCourse;
}) {
  if (!courseOptions.length) {
    return <Text style={styles.emptyInlineText}>시간표에 등록된 수업이 없습니다.</Text>;
  }

  return (
    <View style={styles.courseFilter}>
      {courseOptions.map((course) => {
        const active = course.id === selectedCourse?.id;
        return (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            key={course.id}
            onPress={() => onSelectCourse(course.id)}
            style={[styles.courseFilterChip, active ? styles.courseFilterChipActive : null]}
          >
            <Text style={[styles.courseFilterText, active ? styles.courseFilterTextActive : null]}>{course.subject}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function ComposeForm({
  body,
  canSubmitPost,
  composeScope,
  courseOptions,
  onChangeBody,
  onChangeScope,
  onChangeTitle,
  onSelectCourse,
  onSubmit,
  selectedComposeCourse,
  title,
  verified,
}: {
  body: string;
  canSubmitPost: boolean;
  composeScope: PostScope;
  courseOptions: ComposeCourse[];
  onChangeBody: (value: string) => void;
  onChangeScope: (value: PostScope) => void;
  onChangeTitle: (value: string) => void;
  onSelectCourse: (courseId: string) => void;
  onSubmit: () => void;
  selectedComposeCourse?: ComposeCourse;
  title: string;
  verified: boolean;
}) {
  if (!verified) {
    return (
      <View style={styles.lockedBox}>
        <LockKeyhole color={colors.primary} size={24} />
        <View style={styles.lockedCopy}>
          <Text style={styles.lockedTitle}>학생증 인증 승인 후 작성할 수 있어요.</Text>
          <Text style={styles.lockedMeta}>읽기는 가능하지만 글·댓글 작성은 제한됩니다.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.compose}>
      <View style={styles.composeScopePanel}>
        <View style={styles.composePanelHeader}>
          <Text style={styles.composeLabel}>게시판</Text>
          <Text style={styles.composePanelMeta}>{composeScope === 'school' ? '학교 전체' : selectedComposeCourse?.subject ?? '수업'}</Text>
        </View>
        <SegmentedControl onChange={onChangeScope} segments={composeScopeSegments} value={composeScope} />
      </View>
      {composeScope === 'course' ? (
        <View style={styles.composeBlock}>
          <Text style={styles.composeLabel}>수업 선택</Text>
          <View style={styles.coursePicker}>
            {courseOptions.length ? (
              courseOptions.map((course) => {
                const active = course.id === selectedComposeCourse?.id;
                return (
                  <Pressable
                    accessibilityRole="button"
                    key={course.id}
                    onPress={() => onSelectCourse(course.id)}
                    style={[styles.courseChip, active ? styles.courseChipActive : null]}
                  >
                    <Text style={[styles.courseChipTitle, active ? styles.courseChipTitleActive : null]}>{course.subject}</Text>
                    {course.meta ? (
                      <Text style={[styles.courseChipMeta, active ? styles.courseChipMetaActive : null]}>{course.meta}</Text>
                    ) : null}
                  </Pressable>
                );
              })
            ) : (
              <Text style={styles.emptyInlineText}>시간표에 등록된 수업이 없습니다.</Text>
            )}
          </View>
        </View>
      ) : null}
      <View style={styles.editorPanel}>
        <TextInput
          onChangeText={onChangeTitle}
          placeholder={composeScope === 'school' ? '제목' : `${selectedComposeCourse?.subject ?? '수업'} 질문 제목`}
          placeholderTextColor={colors.disabled}
          style={styles.composeTitleInput}
          value={title}
        />
        <View style={styles.editorDivider} />
        <TextInput
          multiline
          onChangeText={onChangeBody}
          placeholder="내용을 입력하세요"
          placeholderTextColor={colors.disabled}
          style={styles.composeBodyInput}
          textAlignVertical="top"
          value={body}
        />
        <View style={styles.editorFooter}>
          <Text style={styles.editorCounter}>제목 {title.trim().length}자 · 본문 {body.trim().length}자</Text>
          <Text style={styles.editorScope}>{composeScope === 'school' ? '학교' : '수강자'}</Text>
        </View>
      </View>
      <View style={styles.publishRow}>
        <View style={styles.anonymousBadge}>
          <Text style={styles.anonymousBadgeText}>익명</Text>
        </View>
        <PrimaryButton
          disabled={!canSubmitPost}
          icon={<Send color={canSubmitPost ? colors.surface : colors.disabled} size={18} />}
          label="올리기"
          onPress={onSubmit}
          style={styles.publishButton}
        />
      </View>
    </View>
  );
}

function PostListItem({ post, onPress }: { post: Post; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.post}>
      <View style={styles.postHeader}>
        <Text style={styles.postTitle}>{post.title}</Text>
        {isHotPost(post) ? <Text style={styles.hotInline}>인기</Text> : null}
      </View>
      <Text numberOfLines={2} style={styles.postBody}>
        {post.body}
      </Text>
      <View style={styles.postFooter}>
        <Text style={styles.postMeta}>
          {post.anonymousLabel} · {formatTime(post.createdAt)}
        </Text>
        <View style={styles.postStats}>
          <ThumbsUp color={colors.primary} size={15} />
          <Text style={styles.statText}>{post.likeCount}</Text>
          <MessageCircle color={colors.muted} size={15} />
          <Text style={styles.statText}>{post.commentCount}</Text>
          <Eye color={colors.muted} size={15} />
          <Text style={styles.statText}>{post.viewCount}</Text>
          <ChevronRight color={colors.subtle} size={17} />
        </View>
      </View>
    </Pressable>
  );
}

function PostDetail({
  commentBody,
  communityActions,
  comments,
  onBack,
  onCancelReport,
  onChangeComment,
  onLikeComment,
  onLike,
  onBookmark,
  onDeletePost,
  onDeleteComment,
  onReport,
  onReportComment,
  onSelectReportReason,
  onSubmitComment,
  post,
  postBookmarked,
  profileId,
  reportTarget,
  verified,
}: {
  commentBody: string;
  communityActions: ReturnType<typeof useAppState>['communityActions'];
  comments: ReturnType<typeof useAppState>['comments'];
  onBack: () => void;
  onCancelReport: () => void;
  onChangeComment: (value: string) => void;
  onLikeComment: (commentId: string) => void;
  onLike: () => void;
  onBookmark: () => void;
  onDeletePost: () => void;
  onDeleteComment: (commentId: string) => void;
  onReport: () => void;
  onReportComment: (commentId: string) => void;
  onSelectReportReason: (reason: string) => void;
  onSubmitComment: () => void;
  post: Post;
  postBookmarked: boolean;
  profileId: string;
  reportTarget: ReportTarget | null;
  verified: boolean;
}) {
  const postLiked = communityActions.likedPostIds.includes(post.id);
  const postReported = communityActions.reportedPostIds.includes(post.id);
  const ownPost = post.authorId === profileId;

  return (
    <Screen>
      <View style={styles.detailHeader}>
        <Pressable onPress={onBack} style={styles.backButton}>
          <ArrowLeft color={colors.text} size={22} />
        </Pressable>
        <View style={styles.detailHeaderCopy}>
          <Text style={styles.detailHeaderTitle}>{post.scope === 'school' ? '학교 전체 게시판' : '같은 수강자 게시판'}</Text>
          <Text style={styles.detailHeaderMeta}>학교 인증 익명</Text>
        </View>
      </View>

      <Card>
        <View style={styles.detailMetaRow}>
          <Text style={styles.detailMetaText}>{post.scope === 'school' ? '학교 전체' : '수강자'}</Text>
          {isHotPost(post) ? <Text style={styles.detailMetaText}>인기</Text> : null}
        </View>
        <Text style={styles.detailTitle}>{post.title}</Text>
        <Text style={styles.detailBody}>{post.body}</Text>
        <View style={styles.detailInfoRow}>
          <Text style={styles.postMeta}>
            {post.anonymousLabel} · {formatTime(post.createdAt)}
          </Text>
          <View style={styles.postStats}>
            <Eye color={colors.muted} size={15} />
            <Text style={styles.statText}>{post.viewCount}</Text>
          </View>
        </View>
        <View style={styles.detailActions}>
          <Pressable
            accessibilityLabel={postLiked ? `공감 취소 ${post.likeCount}` : `공감 ${post.likeCount}`}
            accessibilityRole="button"
            disabled={!verified}
            onPress={onLike}
            style={[styles.actionButton, !verified ? styles.actionButtonDisabled : null]}
          >
            <ThumbsUp color={postLiked ? colors.primary : colors.muted} fill={postLiked ? colors.primarySoft : 'none'} size={20} />
            <Text style={[styles.actionText, postLiked ? styles.actionTextActive : null]}>{post.likeCount}</Text>
          </Pressable>
          <Pressable
            accessibilityLabel={postBookmarked ? '북마크 해제' : '북마크'}
            accessibilityRole="button"
            disabled={!verified}
            onPress={onBookmark}
            style={[styles.actionButton, !verified ? styles.actionButtonDisabled : null]}
          >
            <Bookmark color={postBookmarked ? colors.primary : colors.muted} fill={postBookmarked ? colors.primarySoft : 'none'} size={19} />
            <Text style={[styles.actionText, postBookmarked ? styles.actionTextActive : null]}>
              {postBookmarked ? '저장됨' : '저장'}
            </Text>
          </Pressable>
          {ownPost ? (
            <Pressable
              accessibilityLabel="게시글 삭제"
              accessibilityRole="button"
              onPress={onDeletePost}
              style={styles.actionButton}
            >
              <Trash2 color={colors.danger} size={18} />
              <Text style={[styles.actionText, styles.deleteText]}>삭제</Text>
            </Pressable>
          ) : null}
          <Pressable
            accessibilityLabel={postReported ? '신고 완료' : '신고'}
            accessibilityRole="button"
            disabled={!verified || postReported}
            onPress={onReport}
            style={[styles.actionButton, postReported || !verified ? styles.actionButtonDisabled : null]}
          >
            <Flag color={postReported ? colors.danger : colors.muted} size={18} />
            {postReported ? <Text style={[styles.actionText, styles.actionTextDisabled]}>완료</Text> : null}
          </Pressable>
        </View>
      </Card>

      {reportTarget ? (
        <ReportReasonPanel
          onCancel={onCancelReport}
          onSelectReason={onSelectReportReason}
          targetLabel={reportTarget.label}
        />
      ) : null}

      <Card>
        <SectionHeader title={`댓글 ${comments.length}개`} />
        {comments.length ? (
          comments.map((comment) => {
            const commentLiked = communityActions.likedCommentIds.includes(comment.id);
            const commentReported = communityActions.reportedCommentIds.includes(comment.id);
            const ownComment = comment.authorId === profileId;

            return (
              <View key={comment.id} style={styles.commentRow}>
                <View style={styles.commentAvatar}>
                  <Text style={styles.commentAvatarText}>{comment.anonymousLabel.replace('익명', '') || '익'}</Text>
                </View>
                <View style={styles.commentCopy}>
                  <Text style={styles.commentAuthor}>
                    {comment.anonymousLabel} · {formatTime(comment.createdAt)}
                  </Text>
                  <Text style={styles.commentBody}>{comment.body}</Text>
                  <View style={styles.commentActions}>
                    <Pressable
                      accessibilityLabel={commentLiked ? `댓글 공감 취소 ${comment.likeCount}` : `댓글 공감 ${comment.likeCount}`}
                      accessibilityRole="button"
                      disabled={!verified}
                      onPress={() => onLikeComment(comment.id)}
                      style={[
                        styles.commentActionButton,
                        commentLiked ? styles.commentActionButtonActive : null,
                        !verified ? styles.actionButtonDisabled : null,
                      ]}
                    >
                      <ThumbsUp color={commentLiked ? colors.primary : colors.muted} fill={commentLiked ? colors.primarySoft : 'none'} size={15} />
                      <Text style={[styles.commentActionText, commentLiked ? styles.actionTextActive : null]}>
                        {comment.likeCount}
                      </Text>
                    </Pressable>
                    <Pressable
                      accessibilityLabel={commentReported ? '댓글 신고 완료' : '댓글 신고'}
                      accessibilityRole="button"
                      disabled={!verified || commentReported}
                      onPress={() => onReportComment(comment.id)}
                      style={[styles.commentActionButton, commentReported || !verified ? styles.actionButtonDisabled : null]}
                    >
                      <Flag color={commentReported ? colors.danger : colors.muted} size={14} />
                      {commentReported ? <Text style={[styles.commentActionText, styles.actionTextDisabled]}>완료</Text> : null}
                    </Pressable>
                    {ownComment ? (
                      <Pressable
                        accessibilityLabel="댓글 삭제"
                        accessibilityRole="button"
                        onPress={() => onDeleteComment(comment.id)}
                        style={styles.commentActionButton}
                      >
                        <Trash2 color={colors.danger} size={14} />
                        <Text style={[styles.commentActionText, styles.deleteText]}>삭제</Text>
                      </Pressable>
                    ) : null}
                  </View>
                </View>
              </View>
            );
          })
        ) : (
          <Text style={styles.emptyText}>아직 댓글이 없습니다.</Text>
        )}
      </Card>

      <Card>
        <SectionHeader action={<Send color={colors.primary} size={21} />} title="익명 댓글 쓰기" />
        {!verified ? (
          <View style={styles.lockedBox}>
            <LockKeyhole color={colors.primary} size={24} />
            <View style={styles.lockedCopy}>
              <Text style={styles.lockedTitle}>댓글 작성은 인증 후 가능해요.</Text>
              <Text style={styles.lockedMeta}>학생증 승인 전에는 읽기만 할 수 있습니다.</Text>
            </View>
          </View>
        ) : (
          <View style={styles.commentComposer}>
            <TextInput
              multiline
              onChangeText={onChangeComment}
              placeholder="익명으로 댓글 달기"
              placeholderTextColor={colors.disabled}
              style={[styles.input, styles.commentInput]}
              textAlignVertical="top"
              value={commentBody}
            />
            <PrimaryButton disabled={!commentBody.trim()} label="댓글 올리기" onPress={onSubmitComment} />
          </View>
        )}
      </Card>
    </Screen>
  );
}

function ReportReasonPanel({
  onCancel,
  onSelectReason,
  targetLabel,
}: {
  onCancel: () => void;
  onSelectReason: (reason: string) => void;
  targetLabel: string;
}) {
  return (
    <Card style={styles.reportPanel}>
      <View style={styles.reportHeader}>
        <View>
          <Text style={styles.reportTitle}>{targetLabel} 신고 사유</Text>
          <Text style={styles.reportMeta}>접수 후 신고 버튼은 다시 누를 수 없습니다.</Text>
        </View>
        <Pressable accessibilityRole="button" onPress={onCancel} style={styles.reportCancel}>
          <Text style={styles.reportCancelText}>취소</Text>
        </Pressable>
      </View>
      <View style={styles.reportReasonList}>
        {reportReasons.map((reason) => (
          <Pressable accessibilityRole="button" key={reason} onPress={() => onSelectReason(reason)} style={styles.reportReasonButton}>
            <Flag color={colors.danger} size={16} />
            <Text style={styles.reportReasonText}>{reason}</Text>
          </Pressable>
        ))}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  actionButton: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
    justifyContent: 'center',
    minHeight: 30,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs,
  },
  actionButtonDisabled: {
    opacity: 0.55,
  },
  actionText: {
    color: colors.muted,
    fontFamily: fonts.semibold,
    fontSize: typography.small,
    fontWeight: '600',
  },
  actionTextActive: {
    color: colors.primary,
  },
  actionTextDisabled: {
    color: colors.muted,
  },
  backButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.pill,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  boardHome: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  boardShell: {
    flex: 1,
  },
  boardTile: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    flex: 1,
    gap: spacing.xs,
    minHeight: 118,
    padding: spacing.lg,
  },
  boardTileMeta: {
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: typography.small,
    lineHeight: 20,
  },
  boardTileTitle: {
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: typography.h3,
    fontWeight: '600',
    marginTop: spacing.xs,
  },
  anonymousBadge: {
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderRadius: radii.pill,
    borderWidth: 1,
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  anonymousBadgeText: {
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: typography.small,
    fontWeight: '600',
  },
  bodyInput: {
    minHeight: 92,
    paddingTop: spacing.md,
  },
  commentAvatar: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: radii.pill,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  commentAvatarText: {
    color: colors.primary,
    fontFamily: fonts.semibold,
    fontSize: typography.small,
    fontWeight: '600',
  },
  commentActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  commentActionButton: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
    minHeight: 28,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs,
  },
  commentActionButtonActive: {
    opacity: 1,
  },
  commentActionText: {
    color: colors.muted,
    fontFamily: fonts.semibold,
    fontSize: typography.small,
    fontWeight: '600',
  },
  commentAuthor: {
    color: colors.muted,
    fontFamily: fonts.semibold,
    fontSize: typography.small,
    fontWeight: '600',
  },
  commentBody: {
    color: colors.text,
    fontFamily: fonts.regular,
    fontSize: typography.body,
    lineHeight: 23,
    marginTop: spacing.xs,
  },
  commentComposer: {
    gap: spacing.md,
  },
  commentCopy: {
    flex: 1,
  },
  commentInput: {
    minHeight: 86,
    paddingTop: spacing.md,
  },
  commentRow: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  compose: {
    gap: spacing.lg,
  },
  closeButton: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: radii.pill,
    borderWidth: 1,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  composeBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(29, 29, 31, 0.22)',
  },
  composeBlock: {
    gap: spacing.sm,
  },
  composeBodyInput: {
    color: colors.text,
    fontFamily: fonts.regular,
    fontSize: typography.body,
    lineHeight: 24,
    minHeight: 136,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  composeHandle: {
    alignSelf: 'center',
    backgroundColor: colors.border,
    borderRadius: radii.pill,
    height: 4,
    width: 42,
  },
  composeLabel: {
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: typography.small,
    fontWeight: '600',
  },
  composeOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  composeSheet: {
    borderRadius: radii.lg,
    gap: spacing.lg,
    maxHeight: '92%',
  },
  composePanelHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  composePanelMeta: {
    color: colors.primary,
    fontFamily: fonts.semibold,
    fontSize: typography.small,
    fontWeight: '600',
  },
  composeScopePanel: {
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.md,
  },
  composeTitleInput: {
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: typography.h2,
    fontWeight: '600',
    minHeight: 56,
    paddingHorizontal: spacing.md,
  },
  courseChip: {
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    flexBasis: '48%',
    flexGrow: 1,
    gap: spacing.xs,
    minHeight: 64,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  courseChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  courseChipMeta: {
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: typography.tiny,
    lineHeight: 17,
  },
  courseChipMetaActive: {
    color: colors.surface,
  },
  courseChipTitle: {
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: typography.small,
    fontWeight: '600',
  },
  courseChipTitleActive: {
    color: colors.surface,
  },
  courseFilter: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  courseFilterChip: {
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderRadius: radii.pill,
    borderWidth: 1,
    minHeight: 34,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  courseFilterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  courseFilterText: {
    color: colors.muted,
    fontFamily: fonts.semibold,
    fontSize: typography.small,
    fontWeight: '600',
  },
  courseFilterTextActive: {
    color: colors.surface,
  },
  coursePicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  detailActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  detailBody: {
    color: colors.slate,
    fontFamily: fonts.regular,
    fontSize: typography.body,
    lineHeight: 25,
    marginTop: spacing.lg,
  },
  detailHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  detailHeaderCopy: {
    flex: 1,
  },
  detailHeaderMeta: {
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: typography.small,
    marginTop: spacing.xs,
  },
  detailHeaderTitle: {
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: typography.h2,
    fontWeight: '600',
  },
  detailInfoRow: {
    alignItems: 'center',
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
    paddingTop: spacing.md,
  },
  detailMetaRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  detailMetaText: {
    color: colors.primary,
    fontFamily: fonts.semibold,
    fontSize: typography.small,
    fontWeight: '600',
  },
  detailTitle: {
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: typography.h1,
    fontWeight: '600',
    lineHeight: 34,
    marginTop: spacing.lg,
  },
  deleteText: {
    color: colors.danger,
  },
  emptyText: {
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: typography.body,
    lineHeight: 22,
    paddingVertical: spacing.lg,
    textAlign: 'center',
  },
  emptyInlineText: {
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: typography.small,
    lineHeight: 20,
  },
  editorCounter: {
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: typography.tiny,
  },
  editorDivider: {
    backgroundColor: colors.border,
    height: 1,
  },
  editorFooter: {
    alignItems: 'center',
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 40,
    paddingHorizontal: spacing.md,
  },
  editorPanel: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  editorScope: {
    color: colors.primary,
    fontFamily: fonts.semibold,
    fontSize: typography.tiny,
    fontWeight: '600',
  },
  loadMoreButton: {
    marginTop: spacing.md,
  },
  fab: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderColor: colors.primaryDark,
    borderWidth: 1,
    borderRadius: radii.pill,
    bottom: spacing.xl,
    elevation: 10,
    height: 58,
    justifyContent: 'center',
    position: 'absolute',
    right: spacing.xl,
    width: 58,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    color: colors.text,
    fontFamily: fonts.regular,
    fontSize: typography.body,
    minHeight: 48,
    paddingHorizontal: spacing.md,
  },
  lockedBox: {
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
  },
  lockedCopy: {
    flex: 1,
  },
  lockedMeta: {
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: typography.small,
    lineHeight: 18,
    marginTop: spacing.xs,
  },
  lockedTitle: {
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: typography.body,
    fontWeight: '600',
  },
  post: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    gap: spacing.sm,
    paddingVertical: spacing.lg,
  },
  postBody: {
    color: colors.slate,
    fontFamily: fonts.regular,
    fontSize: typography.body,
    lineHeight: 22,
  },
  postFooter: {
    gap: spacing.sm,
  },
  postHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  hotInline: {
    color: colors.primary,
    fontFamily: fonts.semibold,
    fontSize: typography.small,
    fontWeight: '600',
  },
  postMeta: {
    color: colors.muted,
    fontFamily: fonts.semibold,
    fontSize: typography.small,
    fontWeight: '600',
  },
  postStats: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  postTitle: {
    color: colors.text,
    fontFamily: fonts.semibold,
    flex: 1,
    fontSize: typography.h3,
    fontWeight: '600',
  },
  reportCancel: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: radii.pill,
    borderWidth: 1,
    minHeight: 34,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  reportCancelText: {
    color: colors.muted,
    fontFamily: fonts.semibold,
    fontSize: typography.small,
    fontWeight: '600',
  },
  reportHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  reportMeta: {
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: typography.small,
    lineHeight: 19,
    marginTop: spacing.xs,
  },
  reportPanel: {
    backgroundColor: colors.dangerSoft,
    borderColor: colors.danger,
  },
  refreshButton: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: radii.pill,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  reportReasonButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.xs,
    minHeight: 38,
    paddingHorizontal: spacing.md,
  },
  reportReasonList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  reportReasonText: {
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: typography.small,
    fontWeight: '600',
  },
  reportTitle: {
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: typography.h3,
    fontWeight: '600',
  },
  searchBox: {
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
    minHeight: 46,
    paddingHorizontal: spacing.md,
  },
  searchInput: {
    color: colors.text,
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: typography.body,
    minHeight: 44,
    padding: 0,
  },
  publishButton: {
    flex: 1,
  },
  publishRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  sheetIcon: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: radii.pill,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  sheetHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sheetMeta: {
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: typography.small,
    marginTop: spacing.xs,
  },
  sheetTitle: {
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: typography.h2,
    fontWeight: '600',
  },
  sheetTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  statText: {
    color: colors.muted,
    fontFamily: fonts.semibold,
    fontSize: typography.small,
    fontWeight: '600',
    marginRight: spacing.xs,
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
