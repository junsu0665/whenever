import React, { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import {
  demoComments,
  demoFriends,
  demoMeal,
  demoNotificationSettings,
  demoPosts,
  demoProfile,
  demoReports,
  demoScoreExams,
  demoScoreSubmissions,
  demoSchool,
  demoStudentVerifications,
  demoTimetable,
  demoUsers,
} from '../data/mockData';
import {
  adminDeleteRemoteComment,
  adminDeleteRemotePost,
  adminDismissRemoteReport,
  adminReviewRemoteStudentVerification,
  adminSetRemoteCommentHidden,
  adminSetRemotePostHidden,
  adminSetRemoteUserAccountStatus,
  cacheRemoteMeal,
  createRemoteComment,
  createRemotePost,
  createRemoteScoreExam,
  createRemoteTimetableSlot,
  deleteRemoteComment,
  createRemoteProfile,
  deleteRemotePost,
  deleteRemoteAccount,
  deleteRemoteScoreExam,
  deleteRemoteScoreSubmission,
  deleteRemoteTimetableSlot,
  incrementRemotePostView,
  loadRemoteScoreExamStats,
  loadRemoteAppData,
  loadRemoteScoreSubjectCandidates,
  RemoteProfileInput,
  recordRemoteAnalyticsEvent,
  requestRemoteScorePrediction,
  reportRemoteComment,
  reportRemotePost,
  saveRemoteTimetable,
  setRemoteCommentLike,
  setRemotePostBookmark,
  setRemotePostLike,
  setRemoteShareStatus,
  signInRemote,
  signOutRemote,
  signUpRemote,
  submitRemoteAdminTestScoreSubmission,
  upsertRemoteScoreSubmission,
  updateRemoteTimetableSlot,
  updateRemoteTimetablePeriodTime,
  updateRemoteTimetablePeriodTimes,
  updateRemoteTimetableSemester,
  uploadRemoteTimetableImage,
  upsertRemoteNotificationSettings,
} from '../services/backend';
import { providerConfig } from '../services/env';
import { fetchMealMenu, fetchNeisTimetableSlots } from '../services/neis';
import { getPushToken, syncLocalNotificationSchedule } from '../services/notifications';
import { buildTimetableOcrContext, parseTimetableImage } from '../services/ocr';
import { getBackendMode, supabase } from '../services/supabase';
import { clearTimetableWidgetData, syncTimetableWidgetData } from '../services/timetableWidget';
import { submitStudentVerification } from '../services/verification';
import {
  AccountMode,
  AccountStatus,
  CommunityActionState,
  CommunityReport,
  Friend,
  FriendOverlap,
  MealMenu,
  NotificationSettings,
  PeriodTime,
  PeriodTimeMap,
  Post,
  PostComment,
  PostScope,
  Profile,
  School,
  ScoreExam,
  ScoreExamInput,
  ScoreExamStats,
  ScorePrediction,
  ScoreSubmission,
  ScoreSubjectCandidateResult,
  ShareStatus,
  StudentVerificationRequest,
  TabKey,
  Timetable,
  TimetableImageInput,
  TimetableSlot,
  VerificationStatus,
} from '../types';
import { hapticImpact, hapticNotification, hapticSelection, hapticSuccess, hapticWarning } from '../utils/haptics';
import { getFriendlyErrorMessage } from '../utils/errorMessages';
import { applyPeriodTimesToSlots, getSubjectColor, normalizePeriodTimes, sortTimetableSlots } from '../utils/timetable';
import { getScoreReportKey } from '../utils/scoreReports';

type NotificationToggleKey = 'timetable' | 'meal' | 'community';

interface AppStateValue {
  authError: string | null;
  authLoading: boolean;
  authNotice: string | null;
  isAuthenticated: boolean;
  launchBlocked: boolean;
  needsProfile: boolean;
  remoteEnabled: boolean;
  activeTab: TabKey;
  setActiveTab: (tab: TabKey) => void;
  accountMode: AccountMode;
  isAdminMode: boolean;
  setAccountMode: (mode: AccountMode) => void;
  schools: School[];
  profile: Profile;
  users: Profile[];
  timetable: Timetable;
  friends: Friend[];
  posts: Post[];
  comments: PostComment[];
  reports: CommunityReport[];
  studentVerifications: StudentVerificationRequest[];
  communityActions: CommunityActionState;
  scoreExams: ScoreExam[];
  selectedScoreExamId: string | null;
  scoreExamStats: ScoreExamStats | null;
  scorePrediction: ScorePrediction | null;
  scoreLoading: boolean;
  scoreError: string | null;
  reportedScoreKeys: string[];
  meal: MealMenu;
  notificationSettings: NotificationSettings;
  backendMode: string;
  overlap: FriendOverlap;
  selectedPostScope: PostScope;
  setSelectedPostScope: (scope: PostScope) => void;
  selectedPostId: string | null;
  openPost: (postId: string) => void;
  closePost: () => void;
  setNotificationSetting: (key: NotificationToggleKey, value: boolean) => void;
  setNotificationPreferences: (patch: Partial<NotificationSettings>) => void;
  setShareStatus: (key: 'timetableShareStatus' | 'friendTimetableViewStatus', value: ShareStatus) => void;
  submitStudentCard: (uri: string) => Promise<void>;
  importTimetableFromImage: (image: TimetableImageInput) => Promise<void>;
  addTimetableSlot: (slot: TimetableSlot) => void;
  deleteTimetableSlot: (slotId: string) => void;
  setTimetableSemester: (semesterLabel: string) => void;
  setTimetablePeriodTime: (period: number, time: PeriodTime) => void;
  setTimetablePeriodTimes: (periodTimes: PeriodTimeMap) => void;
  updateTimetableSlot: (slotId: string, patch: Partial<TimetableSlot>) => void;
  refreshMeal: (date?: string, mealType?: MealMenu['type']) => Promise<void>;
  selectScoreExam: (examId: string | null) => void;
  createScoreExam: (input: ScoreExamInput) => Promise<string | undefined>;
  loadScoreSubjectCandidates: () => Promise<ScoreSubjectCandidateResult>;
  deleteScoreExam: (examId: string) => Promise<void>;
  submitScore: (examId: string, score: number) => Promise<void>;
  deleteScore: (examId: string) => Promise<void>;
  refreshScoreExamStats: (examId: string) => Promise<void>;
  requestScorePrediction: (examId: string) => Promise<void>;
  reportScoreAnomaly: (examId: string, score: number, rank: number, reason?: string) => void;
  createPost: (scope: PostScope, title: string, body: string, courseId?: string, imageUris?: string[]) => void;
  createComment: (postId: string, body: string) => void;
  deletePost: (postId: string) => void;
  deleteComment: (commentId: string) => void;
  likePost: (postId: string) => void;
  likeComment: (commentId: string) => void;
  bookmarkPost: (postId: string) => void;
  reportPost: (postId: string, reason?: string) => void;
  reportComment: (commentId: string, reason?: string) => void;
  adminSetPostHidden: (postId: string, hidden: boolean) => void;
  adminSetCommentHidden: (commentId: string, hidden: boolean) => void;
  adminDeletePost: (postId: string) => void;
  adminDeleteComment: (commentId: string) => void;
  adminDismissReport: (reportId: string) => void;
  adminSetUserAccountStatus: (userId: string, status: AccountStatus) => void;
  adminReviewStudentVerification: (userId: string, status: Extract<VerificationStatus, 'approved' | 'rejected'>, rejectionReason?: string) => void;
  signIn: (loginId: string, password: string) => Promise<void>;
  signUp: (loginId: string, password: string, profileInput: RemoteProfileInput) => Promise<void>;
  completeProfile: (profileInput: RemoteProfileInput) => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  refreshRemoteData: (showBlockingLoader?: boolean, silentOnFailure?: boolean) => Promise<void>;
}

const AppStateContext = createContext<AppStateValue | null>(null);
const primarySlotColor = '#00845E';
const reportHideThreshold = 3;
const remoteLoadTimeoutMs = 6500;

const emptyCommunityActions: CommunityActionState = {
  likedPostIds: [],
  likedCommentIds: [],
  bookmarkedPostIds: [],
  reportedPostIds: [],
  reportedCommentIds: [],
};

function normalizeTimetable(timetable: Timetable): Timetable {
  const slots = sortTimetableSlots(
    timetable.slots.map((slot) => ({
      ...slot,
      color: slot.color || getSubjectColor(slot.subject) || primarySlotColor,
    })),
  );
  const periodTimes = normalizePeriodTimes(timetable.periodTimes, slots);

  return {
    ...timetable,
    periodTimes,
    slots: applyPeriodTimesToSlots(slots, periodTimes),
  };
}

function hasEnabledNotification(settings: NotificationSettings) {
  return settings.timetable || settings.meal || settings.community;
}

function mergeNotificationSettings(current: NotificationSettings, patch: Partial<NotificationSettings>): NotificationSettings {
  return {
    ...current,
    ...patch,
    timetableReminderMinutes:
      patch.timetableReminderMinutes === undefined
        ? current.timetableReminderMinutes
        : Math.min(60, Math.max(0, Math.round(patch.timetableReminderMinutes))),
  };
}

function uniqueIds(ids: string[]) {
  return [...new Set(ids.filter(Boolean))];
}

function normalizeSubjectName(subject: string) {
  return subject.trim().replace(/\s+/g, ' ');
}

function getSubjectMergeKey(subject: string) {
  return normalizeSubjectName(subject)
    .replace(/[ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩ]/g, (match) => {
      const romanNumbers: Record<string, string> = {
        Ⅰ: '1',
        Ⅱ: '2',
        Ⅲ: '3',
        Ⅳ: '4',
        Ⅴ: '5',
        Ⅵ: '6',
        Ⅶ: '7',
        Ⅷ: '8',
        Ⅸ: '9',
        Ⅹ: '10',
      };
      return romanNumbers[match] ?? match;
    })
    .replace(/\s+/g, '')
    .toLowerCase();
}

function mergeSubjects(...groups: string[][]) {
  const subjectsByKey = new Map<string, string>();
  groups.flat().forEach((subject) => {
    const normalized = normalizeSubjectName(subject);
    if (!normalized) {
      return;
    }

    const key = getSubjectMergeKey(normalized);
    if (!subjectsByKey.has(key)) {
      subjectsByKey.set(key, normalized);
    }
  });

  return [...subjectsByKey.values()];
}

function roundScore(value: number) {
  return Math.round(value * 10) / 10;
}

function computeScoreExamStats(examId: string, submissions: ScoreSubmission[], currentUserId: string): ScoreExamStats {
  const examSubmissions = submissions.filter((submission) => submission.examId === examId);
  const anonymousScores = examSubmissions.map((submission) => submission.score).sort((first, second) => second - first);
  const submissionCount = anonymousScores.length;
  const ownSubmission = examSubmissions.find((submission) => submission.userId === currentUserId);

  if (submissionCount < 5) {
    return {
      examId,
      ready: false,
      submissionCount,
      anonymousScores: [],
      myScore: ownSubmission?.score,
      message: '5명 이상 모이면 보여요',
    };
  }

  const cutoffIndex = Math.max(0, Math.ceil(submissionCount * 0.1) - 1);
  const topTenCutScore = anonymousScores[cutoffIndex];
  const topTenCount = anonymousScores.filter((score) => score >= topTenCutScore).length;
  const myRank = ownSubmission ? anonymousScores.filter((score) => score > ownSubmission.score).length + 1 : undefined;

  return {
    examId,
    ready: true,
    submissionCount,
    anonymousScores,
    topScore: anonymousScores[0],
    topTenCutScore,
    topTenCount,
    myScore: ownSubmission?.score,
    myRank,
    myTopPercent: myRank ? roundScore((myRank / submissionCount) * 100) : undefined,
  };
}

const scoreSubmissionRequiredMessage = '점수를 제출하면 성적을 볼 수 있어요.';

function canViewScoreResults(exam: ScoreExam | undefined, isAdminMode: boolean) {
  return Boolean(exam && (isAdminMode || exam.myScore !== undefined));
}

function estimateLocalScorePrediction(exam: ScoreExam | undefined, stats: ScoreExamStats | null): ScorePrediction {
  const sampleCount = stats?.submissionCount ?? 0;
  if (!exam || !stats?.ready || sampleCount < 15 || stats.topScore === undefined || stats.topTenCutScore === undefined) {
    return {
      examId: exam?.id ?? stats?.examId ?? 'unknown',
      status: 'insufficient_sample',
      sampleCount,
      rationale: '15명 이상 모이면 보여요.',
      biasWarning: '참고용이에요.',
    };
  }

  const spread = Math.max(1, Math.round(exam.maxScore * 0.025));
  return {
    examId: exam.id,
    status: 'ready',
    sampleCount,
    predictedTopScoreRange: [Math.max(0, stats.topScore - spread), Math.min(exam.maxScore, stats.topScore + spread)],
    predictedCutScoreRange: [
      Math.max(0, stats.topTenCutScore - spread),
      Math.min(exam.maxScore, stats.topTenCutScore + spread),
    ],
    confidence: Math.min(0.72, 0.4 + sampleCount / 100),
    rationale: '현재 제출된 점수로 계산했어요.',
    biasWarning: '참고용이에요.',
  };
}

function normalizeCommunityActions(
  actions: Partial<CommunityActionState> | undefined,
  reports: CommunityReport[],
  reporterId: string,
): CommunityActionState {
  const ownReports = reports.filter((report) => report.reporterId === reporterId);

  return {
    likedPostIds: uniqueIds(actions?.likedPostIds ?? []),
    likedCommentIds: uniqueIds(actions?.likedCommentIds ?? []),
    bookmarkedPostIds: uniqueIds(actions?.bookmarkedPostIds ?? []),
    reportedPostIds: uniqueIds([
      ...(actions?.reportedPostIds ?? []),
      ...ownReports.filter((report) => report.targetType === 'post').map((report) => report.targetId),
    ]),
    reportedCommentIds: uniqueIds([
      ...(actions?.reportedCommentIds ?? []),
      ...ownReports.filter((report) => report.targetType === 'comment').map((report) => report.targetId),
    ]),
  };
}

function toggleId(ids: string[], id: string) {
  return ids.includes(id) ? ids.filter((currentId) => currentId !== id) : [...ids, id];
}

function addId(ids: string[], id: string) {
  return ids.includes(id) ? ids : [...ids, id];
}

function getErrorMessage(error: unknown, fallback: string) {
  return getFriendlyErrorMessage(error, fallback);
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(message));
    }, timeoutMs);
  });

  return Promise.race([promise, timeout]).finally(() => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  });
}

const demoUserDefaults = new Map(demoUsers.map((user) => [user.id, user]));

function normalizeProfile(profile: Profile): Profile {
  const defaults = demoUserDefaults.get(profile.id);

  return {
    ...profile,
    accountStatus: profile.accountStatus ?? defaults?.accountStatus ?? 'active',
    isAdmin: profile.isAdmin ?? defaults?.isAdmin ?? false,
    joinedAt: profile.joinedAt ?? defaults?.joinedAt,
    lastActiveAt: profile.lastActiveAt ?? defaults?.lastActiveAt,
  };
}

function upsertUser(users: Profile[], profile: Profile): Profile[] {
  const nextProfile = normalizeProfile(profile);
  const existingIndex = users.findIndex((user) => user.id === nextProfile.id);

  if (existingIndex === -1) {
    return [nextProfile, ...users];
  }

  return users.map((user, index) => (index === existingIndex ? { ...user, ...nextProfile } : user));
}

function getAnonymousCommentLabel(post: Post, currentComments: PostComment[], authorId: string) {
  if (post.authorId === authorId) {
    return '글쓴이';
  }

  const existingLabel = currentComments.find((comment) => comment.postId === post.id && comment.authorId === authorId)?.anonymousLabel;
  if (existingLabel) {
    return existingLabel;
  }

  const usedNumbers = currentComments
    .filter((comment) => comment.postId === post.id)
    .map((comment) => Number(comment.anonymousLabel.match(/^익명(\d+)$/)?.[1] ?? 0))
    .filter((value) => Number.isFinite(value));

  return `익명${Math.max(0, ...usedNumbers) + 1}`;
}

function computeOverlap(profile: Profile, timetable: Timetable, friends: Friend[]): FriendOverlap {
  if (profile.timetableShareStatus !== 'enabled' || profile.friendTimetableViewStatus !== 'enabled') {
    return {
      sharedPeriods: [],
      sharedSubjects: [],
      friendCount: 0,
      friendNames: [],
    };
  }

  const acceptedFriends = friends.filter((friend) => friend.status === 'accepted');
  const sharedSlots = timetable.slots.filter((slot) =>
    acceptedFriends.some((friend) => friend.sharedSlotIds.includes(slot.id.replace(/-ocr-.+$/, '')) || friend.sharedSlotIds.includes(slot.id)),
  );
  const friendNames = acceptedFriends
    .filter((friend) => sharedSlots.some((slot) => friend.sharedSlotIds.includes(slot.id.replace(/-ocr-.+$/, '')) || friend.sharedSlotIds.includes(slot.id)))
    .map((friend) => friend.name);

  return {
    sharedPeriods: [...new Set(sharedSlots.map((slot) => slot.period))],
    sharedSubjects: [...new Set(sharedSlots.map((slot) => slot.subject))],
    friendCount: friendNames.length,
    friendNames,
  };
}

export function AppStateProvider({ children }: { children: ReactNode }) {
  const remoteEnabled = Boolean(supabase);
  const mockEnabled = !remoteEnabled && providerConfig.allowMocks;
  const launchBlocked = !remoteEnabled && !providerConfig.allowMocks;
  const [activeTab, setActiveTab] = useState<TabKey>('home');
  const [accountMode, setAccountModeState] = useState<AccountMode>(demoProfile.isAdmin ? 'admin' : 'user');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(remoteEnabled);
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(mockEnabled);
  const [needsProfile, setNeedsProfile] = useState(false);
  const [schools, setSchools] = useState<School[]>([demoSchool]);
  const [profile, setProfile] = useState<Profile>(normalizeProfile(demoProfile));
  const [users, setUsers] = useState<Profile[]>(demoUsers.map(normalizeProfile));
  const [timetable, setTimetable] = useState<Timetable>(demoTimetable);
  const [friends, setFriends] = useState<Friend[]>(demoFriends);
  const [posts, setPosts] = useState<Post[]>(demoPosts);
  const [viewedPostIds, setViewedPostIds] = useState<string[]>([]);
  const [comments, setComments] = useState<PostComment[]>(demoComments);
  const [reports, setReports] = useState<CommunityReport[]>(demoReports);
  const [studentVerifications, setStudentVerifications] = useState<StudentVerificationRequest[]>(demoStudentVerifications);
  const [communityActions, setCommunityActions] = useState<CommunityActionState>(emptyCommunityActions);
  const [scoreExams, setScoreExams] = useState<ScoreExam[]>(demoScoreExams);
  const [scoreSubmissions, setScoreSubmissions] = useState<ScoreSubmission[]>(demoScoreSubmissions);
  const [selectedScoreExamId, setSelectedScoreExamId] = useState<string | null>(demoScoreExams[0]?.id ?? null);
  const [scoreExamStats, setScoreExamStats] = useState<ScoreExamStats | null>(
    demoScoreExams[0] ? computeScoreExamStats(demoScoreExams[0].id, demoScoreSubmissions, demoProfile.id) : null,
  );
  const [scorePrediction, setScorePrediction] = useState<ScorePrediction | null>(null);
  const [scoreLoading, setScoreLoading] = useState(false);
  const [scoreError, setScoreError] = useState<string | null>(null);
  const [reportedScoreKeys, setReportedScoreKeys] = useState<string[]>([]);
  const [meal, setMeal] = useState<MealMenu>(demoMeal);
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>(demoNotificationSettings);
  const [selectedPostScope, setSelectedPostScope] = useState<PostScope>('school');
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const isAdminMode = Boolean(profile.isAdmin && accountMode === 'admin');

  const applyRemoteData = useCallback((data: Awaited<ReturnType<typeof loadRemoteAppData>>) => {
    setSchools(data.schools.length ? data.schools : [demoSchool]);
    setIsAuthenticated(data.authenticated);
    setNeedsProfile(data.needsProfile);

    if (!data.needsProfile && data.profile.id) {
      const remoteVerifications = data.studentVerifications ?? [];
      const latestVerification = remoteVerifications.find((verification) => verification.userId === data.profile.id);
      setProfile(
        normalizeProfile({
          ...data.profile,
          studentCardUri: latestVerification?.displayUri ?? data.profile.studentCardUri,
          studentVerificationRejectionReason:
            latestVerification?.status === 'rejected' ? latestVerification.rejectionReason : undefined,
        }),
      );
      const remoteUsers = data.users ?? [];
      setUsers(remoteUsers.length ? remoteUsers.map(normalizeProfile) : [normalizeProfile(data.profile)]);
      setTimetable(normalizeTimetable(data.timetable));
      setFriends(data.friends);
      setPosts(data.posts);
      setComments(data.comments);
      setReports(data.reports ?? []);
      setStudentVerifications(data.studentVerifications ?? []);
      setCommunityActions(normalizeCommunityActions(data.communityActions, data.reports ?? [], data.profile.id));
      setScoreExams(data.scoreExams ?? []);
      setSelectedScoreExamId((current) => {
        if (current && data.scoreExams?.some((exam) => exam.id === current)) {
          return current;
        }

        return data.scoreExams?.[0]?.id ?? null;
      });
      setNotificationSettings(data.notificationSettings);
      setMeal(data.meal);
    }
  }, []);

  const refreshRemoteData = useCallback(async (showBlockingLoader = true, silentOnFailure = false) => {
    if (!remoteEnabled) {
      return;
    }

    if (showBlockingLoader) {
      setAuthLoading(true);
    }
    try {
      const data = await withTimeout(
        loadRemoteAppData(),
        remoteLoadTimeoutMs,
        '서버 연결이 지연되고 있어요. 네트워크를 확인한 뒤 다시 시도해 주세요.',
      );
      applyRemoteData(data);
      setAuthError(null);
    } catch (error) {
      if (silentOnFailure) {
        setAuthError(null);
        setAuthNotice(null);
        setIsAuthenticated(false);
        setNeedsProfile(false);
      } else {
        setAuthError(getErrorMessage(error, '데이터를 불러오지 못했어요.'));
      }
    } finally {
      if (showBlockingLoader) {
        setAuthLoading(false);
      }
    }
  }, [applyRemoteData, remoteEnabled]);

  const runRemoteMutation = useCallback(
    async (mutation: () => Promise<void>, refresh = true) => {
      if (!remoteEnabled) {
        return;
      }

      try {
        await mutation();
        setAuthError(null);
        if (refresh) {
          await refreshRemoteData(false);
        }
      } catch (error) {
        setAuthError(getErrorMessage(error, '요청을 처리하지 못했어요.'));
        if (refresh) {
          await refreshRemoteData(false);
        }
      }
    },
    [refreshRemoteData, remoteEnabled],
  );

  useEffect(() => {
    if (launchBlocked) {
      setAuthLoading(false);
      return;
    }

    if (remoteEnabled) {
      void refreshRemoteData(true, true);
      return;
    }
  }, [launchBlocked, refreshRemoteData, remoteEnabled]);

  useEffect(() => {
    setUsers((current) => upsertUser(current, profile));
  }, [profile]);

  useEffect(() => {
    if (!profile.isAdmin && accountMode !== 'user') {
      setAccountModeState('user');
    }
  }, [accountMode, profile.isAdmin]);

  useEffect(() => {
    if (launchBlocked || !isAuthenticated || profile.verificationStatus !== 'approved') {
      return;
    }

    void syncLocalNotificationSchedule(notificationSettings, timetable, meal, false).catch(() => undefined);
  }, [isAuthenticated, launchBlocked, meal, notificationSettings, profile.verificationStatus, timetable]);

  useEffect(() => {
    if (launchBlocked) {
      return;
    }

    if (!isAuthenticated || needsProfile) {
      void clearTimetableWidgetData().catch(() => undefined);
      return;
    }

    void syncTimetableWidgetData(profile, timetable).catch(() => undefined);
  }, [isAuthenticated, launchBlocked, needsProfile, profile, timetable]);

  useEffect(() => {
    if (selectedScoreExamId && scoreExams.some((exam) => exam.id === selectedScoreExamId)) {
      return;
    }

    setSelectedScoreExamId(scoreExams[0]?.id ?? null);
    setScoreExamStats(null);
    setScorePrediction(null);
  }, [scoreExams, selectedScoreExamId]);

  useEffect(() => {
    if (remoteEnabled || !selectedScoreExamId) {
      return;
    }

    const selectedExam = scoreExams.find((exam) => exam.id === selectedScoreExamId);
    if (!canViewScoreResults(selectedExam, isAdminMode)) {
      setScoreExamStats(null);
      setScorePrediction(null);
      return;
    }

    setScoreExamStats(computeScoreExamStats(selectedScoreExamId, scoreSubmissions, profile.id));
  }, [isAdminMode, profile.id, remoteEnabled, scoreExams, scoreSubmissions, selectedScoreExamId]);

  const overlap = useMemo(() => computeOverlap(profile, timetable, friends), [friends, profile, timetable]);
  const clearSignedOutState = useCallback(() => {
    setIsAuthenticated(false);
    setNeedsProfile(false);
    setSelectedPostId(null);
    setViewedPostIds([]);
    setActiveTab('home');
  }, []);
  const changeAccountMode = useCallback(
    (mode: AccountMode) => {
      setAccountModeState(profile.isAdmin && mode === 'admin' ? 'admin' : 'user');
      setScorePrediction(null);
      setScoreError(null);
    },
    [profile.isAdmin],
  );
  const changeActiveTab = useCallback(
    (tab: TabKey) => {
      if (tab === activeTab) {
        return;
      }

      hapticSelection();
      setActiveTab(tab);
      void runRemoteMutation(() => recordRemoteAnalyticsEvent('tab_open', { tab }), false);
    },
    [activeTab, runRemoteMutation],
  );

  const value = useMemo<AppStateValue>(
    () => ({
      authError,
      authLoading,
      authNotice,
      isAuthenticated,
      launchBlocked,
      needsProfile,
      remoteEnabled,
      activeTab,
      setActiveTab: changeActiveTab,
      accountMode,
      isAdminMode,
      setAccountMode: changeAccountMode,
      schools,
      profile,
      users,
      timetable,
      friends,
      posts,
      comments,
      reports,
      studentVerifications,
      communityActions,
      scoreExams,
      selectedScoreExamId,
      scoreExamStats,
      scorePrediction,
      scoreLoading,
      scoreError,
      reportedScoreKeys,
      meal,
      notificationSettings,
      backendMode: getBackendMode(),
      overlap,
      selectedPostScope,
      setSelectedPostScope,
      selectedPostId,
      openPost: (postId) => {
        setSelectedPostId(postId);
        if (viewedPostIds.includes(postId)) {
          return;
        }

        setViewedPostIds((current) => (current.includes(postId) ? current : [...current, postId]));
        if (!remoteEnabled) {
          setPosts((current) =>
            current.map((post) => (post.id === postId ? { ...post, viewCount: post.viewCount + 1 } : post)),
          );
          return;
        }

        void (async () => {
          try {
            const viewCount = await incrementRemotePostView(postId);
            if (typeof viewCount === 'number') {
              setPosts((current) =>
                current.map((post) => (post.id === postId ? { ...post, viewCount: Math.max(post.viewCount, viewCount) } : post)),
              );
            }
            setAuthError(null);
          } catch (error) {
            setViewedPostIds((current) => current.filter((id) => id !== postId));
            setAuthError(getErrorMessage(error, '조회수를 저장하지 못했어요.'));
          }
        })();
      },
      closePost: () => {
        setSelectedPostId(null);
      },
      setNotificationSetting: (key, settingValue) => {
        const nextSettings = mergeNotificationSettings(notificationSettings, { [key]: settingValue });
        setNotificationSettings(nextSettings);
        void runRemoteMutation(async () => {
          const pushToken = hasEnabledNotification(nextSettings) ? await getPushToken(settingValue) : null;
          await upsertRemoteNotificationSettings(nextSettings, pushToken);
          await syncLocalNotificationSchedule(nextSettings, timetable, meal, settingValue);
        }, false);
      },
      setNotificationPreferences: (patch) => {
        const nextSettings = mergeNotificationSettings(notificationSettings, patch);
        setNotificationSettings(nextSettings);
        void runRemoteMutation(async () => {
          const shouldRequestPermission = Boolean(
            (patch.timetable && nextSettings.timetable) || (patch.meal && nextSettings.meal) || (patch.community && nextSettings.community),
          );
          const pushToken = hasEnabledNotification(nextSettings) ? await getPushToken(shouldRequestPermission) : null;
          await upsertRemoteNotificationSettings(nextSettings, pushToken);
          await syncLocalNotificationSchedule(nextSettings, timetable, meal, shouldRequestPermission);
        }, false);
      },
      setShareStatus: (key, status) => {
        setProfile((current) => ({ ...current, [key]: status }));
        void runRemoteMutation(() => setRemoteShareStatus(key, status), false);
      },
      submitStudentCard: async (uri) => {
        const submission = await submitStudentVerification(profile, uri);
        const submittedAt = new Date().toISOString();
        setProfile((current) => ({
          ...current,
          studentCardUri: submission.displayUri,
          studentVerificationRejectionReason: undefined,
          verificationStatus: 'pending',
        }));
        setStudentVerifications((current) => [
          {
            id: `verification-${Date.now()}`,
            userId: profile.id,
            schoolId: profile.schoolId,
            displayUri: submission.displayUri,
            storagePath: submission.storagePath,
            status: 'pending',
            submittedAt,
          },
          ...current.filter((verification) => verification.userId !== profile.id || verification.status !== 'pending'),
        ]);
        if (remoteEnabled) {
          await refreshRemoteData(false);
        }
      },
      importTimetableFromImage: async (image) => {
        const result = await parseTimetableImage(image, buildTimetableOcrContext(timetable));
        let sourceStoragePath: string | undefined;

        if (remoteEnabled) {
          try {
            sourceStoragePath = await uploadRemoteTimetableImage(image);
          } catch (error) {
            void recordRemoteAnalyticsEvent('timetable_image_upload_failed', {
              message: getErrorMessage(error, '시간표 원본 이미지 업로드에 실패했어요.'),
            }).catch(() => undefined);
          }
        }

        const nextSlots = applyPeriodTimesToSlots(result.slots, timetable.periodTimes);
        setTimetable((current) => ({
          ...current,
          source: 'ocr',
          slots: sortTimetableSlots(nextSlots),
          lastImportedAt: new Date().toISOString(),
        }));
        hapticSuccess();
        if (remoteEnabled) {
          await saveRemoteTimetable(profile, nextSlots, sourceStoragePath, timetable.periodTimes);
          await refreshRemoteData();
        }
      },
      updateTimetableSlot: (slotId, patch) => {
        setTimetable((current) => ({
          ...current,
          slots: current.slots.map((slot) => (slot.id === slotId ? { ...slot, ...patch } : slot)),
        }));
        void runRemoteMutation(() => updateRemoteTimetableSlot(slotId, patch), false);
      },
      addTimetableSlot: (slot) => {
        setTimetable((current) => ({
          ...current,
          source: 'manual',
          slots: sortTimetableSlots([...current.slots.filter((currentSlot) => currentSlot.id !== slot.id), slot]),
          lastImportedAt: new Date().toISOString(),
        }));
        hapticSuccess();
        void runRemoteMutation(() => createRemoteTimetableSlot(profile, slot));
      },
      deleteTimetableSlot: (slotId) => {
        setTimetable((current) => ({
          ...current,
          source: 'manual',
          slots: current.slots.filter((slot) => slot.id !== slotId),
          lastImportedAt: new Date().toISOString(),
        }));
        hapticWarning();
        void runRemoteMutation(() => deleteRemoteTimetableSlot(slotId));
      },
      setTimetableSemester: (semesterLabel) => {
        const nextLabel = semesterLabel.trim() || '이번 학기';
        setTimetable((current) => ({ ...current, semesterLabel: nextLabel, source: 'manual' }));
        hapticSelection();
        void runRemoteMutation(() => updateRemoteTimetableSemester(profile, nextLabel), false);
      },
      setTimetablePeriodTime: (period, time) => {
        setTimetable((current) => {
          const nextPeriodTimes = normalizePeriodTimes({ ...current.periodTimes, [period]: time });
          return {
            ...current,
            source: 'manual',
            periodTimes: nextPeriodTimes,
            slots: current.slots.map((slot) =>
              slot.period === period ? { ...slot, startTime: time.startTime, endTime: time.endTime } : slot,
            ),
            lastImportedAt: new Date().toISOString(),
          };
        });
        const nextPeriodTimes = normalizePeriodTimes({ ...timetable.periodTimes, [period]: time });
        hapticSelection();
        void runRemoteMutation(() => updateRemoteTimetablePeriodTime(profile, nextPeriodTimes, period, time), false);
      },
      setTimetablePeriodTimes: (periodTimes) => {
        const nextPeriodTimes = normalizePeriodTimes(periodTimes, timetable.slots);
        setTimetable((current) => {
          const normalizedPeriodTimes = normalizePeriodTimes(periodTimes, current.slots);
          return {
            ...current,
            source: 'manual',
            periodTimes: normalizedPeriodTimes,
            slots: applyPeriodTimesToSlots(current.slots, normalizedPeriodTimes),
            lastImportedAt: new Date().toISOString(),
          };
        });
        hapticSelection();
        void runRemoteMutation(() => updateRemoteTimetablePeriodTimes(profile, nextPeriodTimes), false);
      },
      refreshMeal: async (date, mealType = meal.type) => {
        const school = schools.find((candidate) => candidate.id === profile.schoolId) ?? demoSchool;
        const nextMeal = await fetchMealMenu(school, date, mealType);
        setMeal(nextMeal);
        if (remoteEnabled) {
          await cacheRemoteMeal(nextMeal).catch(() => undefined);
        }
      },
      selectScoreExam: (examId) => {
        setSelectedScoreExamId(examId);
        setScorePrediction(null);
        setScoreError(null);
        const selectedExam = scoreExams.find((exam) => exam.id === examId);
        if (!remoteEnabled && examId && canViewScoreResults(selectedExam, isAdminMode)) {
          setScoreExamStats(computeScoreExamStats(examId, scoreSubmissions, profile.id));
        } else {
          setScoreExamStats(null);
        }
      },
      createScoreExam: async (input) => {
        setScoreLoading(true);
        setScoreError(null);
        try {
          if (remoteEnabled) {
            const created = await createRemoteScoreExam(profile, input);
            await refreshRemoteData(false);
            setSelectedScoreExamId(created.id);
            setScoreExamStats(null);
            setScorePrediction(null);
            return created.id;
          }

          const now = new Date().toISOString();
          const existing = scoreExams.find(
            (exam) =>
              exam.schoolId === profile.schoolId &&
              exam.grade === profile.grade &&
              exam.subject.trim() === input.subject.trim() &&
              exam.examName.trim() === input.examName.trim(),
          );
          if (existing) {
            setSelectedScoreExamId(existing.id);
            return existing.id;
          }

          const created: ScoreExam = {
            id: `score-exam-${Date.now()}`,
            schoolId: profile.schoolId,
            grade: profile.grade,
            subject: input.subject.trim(),
            examName: input.examName.trim(),
            maxScore: input.maxScore,
            totalStudents: input.totalStudents,
            createdAt: now,
            updatedAt: now,
          };
          setScoreExams((current) => [created, ...current]);
          setSelectedScoreExamId(created.id);
          setScoreExamStats(isAdminMode ? computeScoreExamStats(created.id, scoreSubmissions, profile.id) : null);
          setScorePrediction(null);
          return created.id;
        } catch (error) {
          setScoreError(getErrorMessage(error, '시험을 만들지 못했어요.'));
          return undefined;
        } finally {
          setScoreLoading(false);
        }
      },
      loadScoreSubjectCandidates: async () => {
        setScoreLoading(true);
        setScoreError(null);
        try {
          const localTimetableSubjects = mergeSubjects(
            timetable.slots.map((slot) => slot.subject),
            overlap.sharedSubjects,
          );
          let remoteTimetableSubjects: string[] = [];
          if (remoteEnabled) {
            try {
              const remoteCandidates = await loadRemoteScoreSubjectCandidates();
              remoteTimetableSubjects = remoteCandidates.subjects;
            } catch (error) {
              void recordRemoteAnalyticsEvent('score_subject_candidates_failed', {
                message: getErrorMessage(error, '학생 시간표 과목을 불러오지 못했어요.'),
              }).catch(() => undefined);
            }
          }

          const school = schools.find((candidate) => candidate.id === profile.schoolId) ?? demoSchool;
          let neisSubjects: string[] = [];
          try {
            const neisSlots = await fetchNeisTimetableSlots({
              className: profile.className,
              grade: profile.grade,
              periodTimes: timetable.periodTimes,
              school,
            });
            neisSubjects = mergeSubjects(neisSlots.map((slot) => slot.subject));
          } catch (error) {
            void recordRemoteAnalyticsEvent('score_neis_subjects_failed', {
              message: getErrorMessage(error, 'NEIS 시간표 과목을 불러오지 못했어요.'),
            }).catch(() => undefined);
          }

          const timetableSubjects = mergeSubjects(localTimetableSubjects, remoteTimetableSubjects);
          const subjects = mergeSubjects(timetableSubjects, neisSubjects);
          if (!subjects.length) {
            setScoreError('학생 시간표나 NEIS에서 과목을 찾지 못했어요.');
          }

          return {
            subjects,
            timetableSubjectCount: timetableSubjects.length,
            neisSubjectCount: neisSubjects.length,
          };
        } catch (error) {
          setScoreError(getErrorMessage(error, '시험 과목 후보를 불러오지 못했어요.'));
          return { subjects: [], timetableSubjectCount: 0, neisSubjectCount: 0 };
        } finally {
          setScoreLoading(false);
        }
      },
      deleteScoreExam: async (examId) => {
        if (!isAdminMode) {
          return;
        }

        setScoreLoading(true);
        setScoreError(null);
        try {
          const nextSelectedId = scoreExams.find((exam) => exam.id !== examId)?.id ?? null;

          if (remoteEnabled) {
            await deleteRemoteScoreExam(examId);
            await refreshRemoteData(false);
          } else {
            setScoreExams((current) => current.filter((exam) => exam.id !== examId));
            setScoreSubmissions((current) => current.filter((submission) => submission.examId !== examId));
          }

          setSelectedScoreExamId((current) => (current === examId ? nextSelectedId : current));
          setScoreExamStats(null);
          setScorePrediction(null);
          hapticWarning();
        } catch (error) {
          setScoreError(getErrorMessage(error, '시험을 삭제하지 못했어요.'));
        } finally {
          setScoreLoading(false);
        }
      },
      submitScore: async (examId, score) => {
        setScoreLoading(true);
        setScoreError(null);
        try {
          if (remoteEnabled) {
            if (isAdminMode) {
              await submitRemoteAdminTestScoreSubmission(examId, score);
            } else {
              await upsertRemoteScoreSubmission(examId, score);
            }
            await refreshRemoteData(false);
            try {
              const stats = await loadRemoteScoreExamStats(examId);
              setScoreExamStats(stats);
            } catch {
              setScoreExamStats(null);
            }
            setScorePrediction(null);
            return;
          }

          const now = new Date().toISOString();
          setScoreSubmissions((current) => {
            if (isAdminMode) {
              return [
                ...current,
                {
                  id: `score-submission-admin-test-${Date.now()}`,
                  examId,
                  userId: `admin-test-${profile.id}-${Date.now()}`,
                  score,
                  createdAt: now,
                  updatedAt: now,
                },
              ];
            }

            const existing = current.find((submission) => submission.examId === examId && submission.userId === profile.id);
            if (existing) {
              return current.map((submission) =>
                submission.id === existing.id ? { ...submission, score, updatedAt: now } : submission,
              );
            }

            return [
              ...current,
              {
                id: `score-submission-${Date.now()}`,
                examId,
                userId: profile.id,
                score,
                createdAt: now,
                updatedAt: now,
              },
            ];
          });
          if (!isAdminMode) {
            setScoreExams((current) =>
              current.map((exam) => (exam.id === examId ? { ...exam, myScore: score, mySubmittedAt: now, updatedAt: now } : exam)),
            );
          } else {
            setScoreExams((current) =>
              current.map((exam) => (exam.id === examId ? { ...exam, updatedAt: now } : exam)),
            );
          }
          setScorePrediction(null);
        } catch (error) {
          setScoreError(getErrorMessage(error, '점수를 저장하지 못했어요.'));
        } finally {
          setScoreLoading(false);
        }
      },
      deleteScore: async (examId) => {
        setScoreLoading(true);
        setScoreError(null);
        try {
          if (remoteEnabled) {
            await deleteRemoteScoreSubmission(examId);
            await refreshRemoteData(false);
            if (isAdminMode) {
              const stats = await loadRemoteScoreExamStats(examId);
              setScoreExamStats(stats);
            } else {
              setScoreExamStats(null);
            }
            setScorePrediction(null);
            return;
          }

          setScoreSubmissions((current) => current.filter((submission) => submission.examId !== examId || submission.userId !== profile.id));
          setScoreExams((current) =>
            current.map((exam) => (exam.id === examId ? { ...exam, myScore: undefined, mySubmittedAt: undefined } : exam)),
          );
          setScorePrediction(null);
        } catch (error) {
          setScoreError(getErrorMessage(error, '점수를 삭제하지 못했어요.'));
        } finally {
          setScoreLoading(false);
        }
      },
      refreshScoreExamStats: async (examId) => {
        const selectedExam = scoreExams.find((exam) => exam.id === examId);
        if (!canViewScoreResults(selectedExam, isAdminMode)) {
          setScoreExamStats(null);
          setScorePrediction(null);
          setScoreError(scoreSubmissionRequiredMessage);
          return;
        }

        setScoreLoading(true);
        setScoreError(null);
        try {
          const stats = remoteEnabled
            ? await loadRemoteScoreExamStats(examId)
            : computeScoreExamStats(examId, scoreSubmissions, profile.id);
          setScoreExamStats(stats);
        } catch (error) {
          setScoreError(getErrorMessage(error, '성적 현황을 불러오지 못했어요.'));
        } finally {
          setScoreLoading(false);
        }
      },
      requestScorePrediction: async (examId) => {
        const selectedExam = scoreExams.find((exam) => exam.id === examId);
        if (!canViewScoreResults(selectedExam, isAdminMode)) {
          setScoreExamStats(null);
          setScorePrediction(null);
          setScoreError(scoreSubmissionRequiredMessage);
          return;
        }

        setScoreLoading(true);
        setScoreError(null);
        try {
          const exam = scoreExams.find((candidate) => candidate.id === examId);
          const stats = scoreExamStats?.examId === examId ? scoreExamStats : remoteEnabled
            ? await loadRemoteScoreExamStats(examId)
            : computeScoreExamStats(examId, scoreSubmissions, profile.id);
          setScoreExamStats(stats);

          if (!stats.ready || stats.submissionCount < 15) {
            setScorePrediction(estimateLocalScorePrediction(exam, stats));
            return;
          }

          if (remoteEnabled && providerConfig.scorePredictionEndpoint) {
            setScorePrediction(await requestRemoteScorePrediction(examId));
            return;
          }

          setScorePrediction(estimateLocalScorePrediction(exam, stats));
        } catch (error) {
          setScoreError(getErrorMessage(error, '분포 참고값을 불러오지 못했어요.'));
          const exam = scoreExams.find((candidate) => candidate.id === examId);
          setScorePrediction(estimateLocalScorePrediction(exam, scoreExamStats));
        } finally {
          setScoreLoading(false);
        }
      },
      reportScoreAnomaly: (examId, score, rank, reason = '이상 점수 신고') => {
        if (profile.verificationStatus !== 'approved') {
          return;
        }

        const reportKey = getScoreReportKey(examId, score, rank);
        setReportedScoreKeys((current) => (current.includes(reportKey) ? current : [...current, reportKey]));
        void runRemoteMutation(
          () =>
            recordRemoteAnalyticsEvent('score_anomaly_report', {
              examId,
              rank,
              reason,
              score,
            }),
          false,
        );
      },
      createPost: (scope, title, body, courseId, imageUris = []) => {
        if (profile.verificationStatus !== 'approved' || (scope === 'course' && !courseId)) {
          return;
        }

        const post: Post = {
          id: `post-${Date.now()}`,
          scope,
          schoolId: profile.schoolId,
          courseId: scope === 'course' ? courseId : undefined,
          title,
          body,
          imageUris: imageUris.filter(Boolean),
          authorId: profile.id,
          anonymousLabel: '익명',
          createdAt: new Date().toISOString(),
          likeCount: 0,
          commentCount: 0,
          viewCount: 0,
          reportCount: 0,
          hidden: false,
          hot: false,
        };
        setPosts((current) => [post, ...current]);
        setSelectedPostId(post.id);
        hapticNotification('success');
        void runRemoteMutation(() => createRemotePost(profile, scope, title, body, scope === 'course' ? courseId : undefined, imageUris));
      },
      createComment: (postId, body) => {
        if (profile.verificationStatus !== 'approved') {
          return;
        }

        const targetPost = posts.find((post) => post.id === postId && !post.hidden);
        if (!targetPost) {
          return;
        }

        setComments((current) => [
          ...current,
          {
            id: `comment-${Date.now()}`,
            postId,
            authorId: profile.id,
            anonymousLabel: getAnonymousCommentLabel(targetPost, current, profile.id),
            body,
            likeCount: 0,
            reportCount: 0,
            hidden: false,
            createdAt: new Date().toISOString(),
          },
        ]);
        setPosts((current) =>
          current.map((post) => (post.id === postId ? { ...post, commentCount: post.commentCount + 1 } : post)),
        );
        hapticImpact('light');
        void runRemoteMutation(() => createRemoteComment(profile, postId, body));
      },
      deletePost: (postId) => {
        const targetPost = posts.find((post) => post.id === postId);
        if (!targetPost || targetPost.authorId !== profile.id) {
          return;
        }

        const commentIds = comments.filter((comment) => comment.postId === postId).map((comment) => comment.id);
        setPosts((current) => current.filter((post) => post.id !== postId));
        setComments((current) => current.filter((comment) => comment.postId !== postId));
        setReports((current) =>
          current.filter((report) => report.targetId !== postId && !commentIds.includes(report.targetId)),
        );
        setCommunityActions((current) => ({
          likedPostIds: current.likedPostIds.filter((id) => id !== postId),
          likedCommentIds: current.likedCommentIds.filter((id) => !commentIds.includes(id)),
          bookmarkedPostIds: current.bookmarkedPostIds.filter((id) => id !== postId),
          reportedPostIds: current.reportedPostIds.filter((id) => id !== postId),
          reportedCommentIds: current.reportedCommentIds.filter((id) => !commentIds.includes(id)),
        }));
        if (selectedPostId === postId) {
          setSelectedPostId(null);
        }
        hapticWarning();
        void runRemoteMutation(() => deleteRemotePost(postId));
      },
      deleteComment: (commentId) => {
        const targetComment = comments.find((comment) => comment.id === commentId);
        if (!targetComment || targetComment.authorId !== profile.id) {
          return;
        }

        setComments((current) => current.filter((comment) => comment.id !== commentId));
        if (!targetComment.hidden) {
          setPosts((current) =>
            current.map((post) =>
              post.id === targetComment.postId ? { ...post, commentCount: Math.max(0, post.commentCount - 1) } : post,
            ),
          );
        }
        setReports((current) => current.filter((report) => report.targetId !== commentId));
        setCommunityActions((current) => ({
          ...current,
          likedCommentIds: current.likedCommentIds.filter((id) => id !== commentId),
          reportedCommentIds: current.reportedCommentIds.filter((id) => id !== commentId),
        }));
        hapticWarning();
        void runRemoteMutation(() => deleteRemoteComment(commentId));
      },
      likePost: (postId) => {
        if (profile.verificationStatus !== 'approved') {
          return;
        }

        const liked = communityActions.likedPostIds.includes(postId);
        setPosts((current) =>
          current.map((post) =>
            post.id === postId && !post.hidden ? { ...post, likeCount: Math.max(0, post.likeCount + (liked ? -1 : 1)) } : post,
          ),
        );
        setCommunityActions((current) => ({ ...current, likedPostIds: toggleId(current.likedPostIds, postId) }));
        hapticImpact(liked ? 'light' : 'medium');
        void runRemoteMutation(() => setRemotePostLike(postId, !liked), false);
      },
      likeComment: (commentId) => {
        if (profile.verificationStatus !== 'approved') {
          return;
        }

        const liked = communityActions.likedCommentIds.includes(commentId);
        setComments((current) =>
          current.map((comment) =>
            comment.id === commentId && !comment.hidden
              ? { ...comment, likeCount: Math.max(0, comment.likeCount + (liked ? -1 : 1)) }
              : comment,
          ),
        );
        setCommunityActions((current) => ({ ...current, likedCommentIds: toggleId(current.likedCommentIds, commentId) }));
        hapticImpact(liked ? 'light' : 'medium');
        void runRemoteMutation(() => setRemoteCommentLike(commentId, !liked), false);
      },
      bookmarkPost: (postId) => {
        if (profile.verificationStatus !== 'approved') {
          return;
        }

        const bookmarked = communityActions.bookmarkedPostIds.includes(postId);
        setCommunityActions((current) => ({ ...current, bookmarkedPostIds: toggleId(current.bookmarkedPostIds, postId) }));
        hapticSelection();
        void runRemoteMutation(() => setRemotePostBookmark(postId, !bookmarked), false);
      },
      reportPost: (postId, reason = '부적절한 내용') => {
        if (profile.verificationStatus !== 'approved' || communityActions.reportedPostIds.includes(postId)) {
          return;
        }

        const targetPost = posts.find((post) => post.id === postId && !post.hidden);
        if (!targetPost) {
          return;
        }

        setReports((current) => [
          ...current,
          {
            id: `report-${Date.now()}`,
            reporterId: profile.id,
            targetType: 'post',
            targetId: postId,
            reason,
            createdAt: new Date().toISOString(),
          },
        ]);
        setCommunityActions((current) => ({ ...current, reportedPostIds: addId(current.reportedPostIds, postId) }));
        setPosts((current) =>
          current.map((post) => {
            if (post.id !== postId) {
              return post;
            }

            const reportCount = post.reportCount + 1;
            return { ...post, reportCount, hidden: reportCount >= reportHideThreshold };
          }),
        );
        hapticWarning();
        void runRemoteMutation(() => reportRemotePost(profile, postId, reason), false);
      },
      reportComment: (commentId, reason = '부적절한 내용') => {
        if (profile.verificationStatus !== 'approved' || communityActions.reportedCommentIds.includes(commentId)) {
          return;
        }

        const targetComment = comments.find((comment) => comment.id === commentId && !comment.hidden);
        if (!targetComment) {
          return;
        }

        const hiddenAfterReport = targetComment.reportCount + 1 >= reportHideThreshold;
        setReports((current) => [
          ...current,
          {
            id: `report-${Date.now()}`,
            reporterId: profile.id,
            targetType: 'comment',
            targetId: commentId,
            reason,
            createdAt: new Date().toISOString(),
          },
        ]);
        setCommunityActions((current) => ({ ...current, reportedCommentIds: addId(current.reportedCommentIds, commentId) }));
        setComments((current) =>
          current.map((comment) => {
            if (comment.id !== commentId) {
              return comment;
            }

            const reportCount = comment.reportCount + 1;
            return { ...comment, reportCount, hidden: reportCount >= reportHideThreshold };
          }),
        );

        if (hiddenAfterReport) {
          setPosts((current) =>
            current.map((post) =>
              post.id === targetComment.postId ? { ...post, commentCount: Math.max(0, post.commentCount - 1) } : post,
            ),
          );
        }
        hapticWarning();
        void runRemoteMutation(() => reportRemoteComment(profile, commentId, reason), false);
      },
      adminSetPostHidden: (postId, hidden) => {
        if (!isAdminMode) {
          return;
        }

        setPosts((current) => current.map((post) => (post.id === postId ? { ...post, hidden } : post)));
        void runRemoteMutation(() => adminSetRemotePostHidden(postId, hidden));
      },
      adminSetCommentHidden: (commentId, hidden) => {
        if (!isAdminMode) {
          return;
        }

        const targetComment = comments.find((comment) => comment.id === commentId);
        if (!targetComment) {
          return;
        }

        if (targetComment.hidden !== hidden) {
          setPosts((current) =>
            current.map((post) =>
              post.id === targetComment.postId
                ? { ...post, commentCount: Math.max(0, post.commentCount + (hidden ? -1 : 1)) }
                : post,
            ),
          );
        }

        setComments((current) => current.map((comment) => (comment.id === commentId ? { ...comment, hidden } : comment)));
        void runRemoteMutation(() => adminSetRemoteCommentHidden(commentId, hidden));
      },
      adminDeletePost: (postId) => {
        if (!isAdminMode) {
          return;
        }

        const commentIds = comments.filter((comment) => comment.postId === postId).map((comment) => comment.id);
        setPosts((current) => current.filter((post) => post.id !== postId));
        setComments((current) => current.filter((comment) => comment.postId !== postId));
        setReports((current) =>
          current.filter((report) => report.targetId !== postId && !commentIds.includes(report.targetId)),
        );
        setCommunityActions((current) => ({
          likedPostIds: current.likedPostIds.filter((id) => id !== postId),
          likedCommentIds: current.likedCommentIds.filter((id) => !commentIds.includes(id)),
          bookmarkedPostIds: current.bookmarkedPostIds.filter((id) => id !== postId),
          reportedPostIds: current.reportedPostIds.filter((id) => id !== postId),
          reportedCommentIds: current.reportedCommentIds.filter((id) => !commentIds.includes(id)),
        }));
        if (selectedPostId === postId) {
          setSelectedPostId(null);
        }
        void runRemoteMutation(() => adminDeleteRemotePost(postId));
      },
      adminDeleteComment: (commentId) => {
        if (!isAdminMode) {
          return;
        }

        const targetComment = comments.find((comment) => comment.id === commentId);
        if (!targetComment) {
          return;
        }

        if (!targetComment.hidden) {
          setPosts((current) =>
            current.map((post) =>
              post.id === targetComment.postId ? { ...post, commentCount: Math.max(0, post.commentCount - 1) } : post,
            ),
          );
        }

        setComments((current) => current.filter((comment) => comment.id !== commentId));
        setReports((current) => current.filter((report) => report.targetId !== commentId));
        setCommunityActions((current) => ({
          ...current,
          likedCommentIds: current.likedCommentIds.filter((id) => id !== commentId),
          reportedCommentIds: current.reportedCommentIds.filter((id) => id !== commentId),
        }));
        void runRemoteMutation(() => adminDeleteRemoteComment(commentId));
      },
      adminDismissReport: (reportId) => {
        if (!isAdminMode) {
          return;
        }

        setReports((current) => current.filter((report) => report.id !== reportId));
        void runRemoteMutation(() => adminDismissRemoteReport(reportId));
      },
      adminSetUserAccountStatus: (userId, status) => {
        if (!isAdminMode || userId === profile.id) {
          return;
        }

        setUsers((current) => current.map((user) => (user.id === userId ? { ...user, accountStatus: status } : user)));
        void runRemoteMutation(() => adminSetRemoteUserAccountStatus(userId, status));
      },
      adminReviewStudentVerification: (userId, status, rejectionReason) => {
        if (!isAdminMode) {
          return;
        }

        const reviewedAt = new Date().toISOString();
        setStudentVerifications((current) =>
          current.map((verification) =>
            verification.userId === userId && verification.status === 'pending'
              ? {
                  ...verification,
                  status,
                  reviewedAt,
                  reviewerId: profile.id,
                  rejectionReason: status === 'rejected' ? rejectionReason ?? '학생증 정보를 확인할 수 없어요.' : undefined,
                }
              : verification,
          ),
        );
        setUsers((current) =>
          current.map((user) => (user.id === userId ? { ...user, verificationStatus: status } : user)),
        );
        if (userId === profile.id) {
          setProfile((current) => ({
            ...current,
            studentVerificationRejectionReason: status === 'rejected' ? rejectionReason ?? '학생증 정보를 확인할 수 없어요.' : undefined,
            verificationStatus: status,
          }));
        }
        void runRemoteMutation(() => adminReviewRemoteStudentVerification(userId, status, rejectionReason));
      },
      signIn: async (loginId, password) => {
        setAuthLoading(true);
        setAuthError(null);
        setAuthNotice(null);
        try {
          if (!remoteEnabled) {
            setIsAuthenticated(true);
            setNeedsProfile(false);
            setActiveTab('home');
            return;
          }

          await signInRemote(loginId, password);
          await refreshRemoteData();
        } catch (error) {
          setAuthError(getErrorMessage(error, '로그인에 실패했어요.'));
        } finally {
          setAuthLoading(false);
        }
      },
      signUp: async (loginId, password, profileInput) => {
        setAuthLoading(true);
        setAuthError(null);
        setAuthNotice(null);
        try {
          if (!remoteEnabled) {
            const selectedSchool = profileInput.school ?? schools.find((school) => school.id === profileInput.schoolId) ?? demoSchool;
            const now = new Date().toISOString();
            setProfile(
              normalizeProfile({
                ...demoProfile,
                id: `mock-user-${Date.now()}`,
                name: profileInput.name,
                anonymousName: '익명',
                schoolId: selectedSchool.id,
                schoolName: selectedSchool.name,
                grade: profileInput.grade,
                className: profileInput.className,
                verificationStatus: 'approved',
                accountStatus: 'active',
                isAdmin: false,
                joinedAt: now,
                lastActiveAt: now,
              }),
            );
            setIsAuthenticated(true);
            setNeedsProfile(false);
            setActiveTab('home');
            return;
          }

          const hasSession = await signUpRemote(loginId, password, profileInput);
          if (hasSession) {
            await refreshRemoteData();
          } else {
            setAuthNotice('가입 요청이 접수됐어요. 잠시 후 만든 아이디로 로그인해 주세요.');
          }
        } catch (error) {
          setAuthError(getErrorMessage(error, '회원가입에 실패했어요.'));
        } finally {
          setAuthLoading(false);
        }
      },
      completeProfile: async (profileInput) => {
        setAuthLoading(true);
        setAuthError(null);
        setAuthNotice(null);
        try {
          if (!remoteEnabled) {
            const selectedSchool = profileInput.school ?? schools.find((school) => school.id === profileInput.schoolId) ?? demoSchool;
            setProfile((current) =>
              normalizeProfile({
                ...current,
                name: profileInput.name,
                schoolId: selectedSchool.id,
                schoolName: selectedSchool.name,
                grade: profileInput.grade,
                className: profileInput.className,
              }),
            );
            setIsAuthenticated(true);
            setNeedsProfile(false);
            return;
          }

          await createRemoteProfile(profileInput);
          await refreshRemoteData();
        } catch (error) {
          setAuthError(getErrorMessage(error, '프로필 생성에 실패했어요.'));
        } finally {
          setAuthLoading(false);
        }
      },
      signOut: async () => {
        setAuthLoading(true);
        setAuthError(null);
        setAuthNotice(null);
        try {
          if (remoteEnabled) {
            await signOutRemote();
          }
          clearSignedOutState();
        } catch (error) {
          setAuthError(getErrorMessage(error, '로그아웃에 실패했어요.'));
        } finally {
          setAuthLoading(false);
        }
      },
      deleteAccount: async () => {
        setAuthLoading(true);
        setAuthError(null);
        setAuthNotice(null);
        try {
          if (remoteEnabled) {
            await deleteRemoteAccount();
          }
          clearSignedOutState();
        } catch (error) {
          setAuthError(getErrorMessage(error, '계정 삭제에 실패했어요.'));
        } finally {
          setAuthLoading(false);
        }
      },
      refreshRemoteData,
    }),
    [
      activeTab,
      accountMode,
      authError,
      authLoading,
      authNotice,
      changeActiveTab,
      changeAccountMode,
      clearSignedOutState,
      comments,
      communityActions,
      friends,
      isAuthenticated,
      isAdminMode,
      launchBlocked,
      meal,
      needsProfile,
      notificationSettings,
      overlap,
      posts,
      profile,
      refreshRemoteData,
      remoteEnabled,
      reports,
      reportedScoreKeys,
      runRemoteMutation,
      schools,
      scoreError,
      scoreExamStats,
      scoreExams,
      scoreLoading,
      scorePrediction,
      scoreSubmissions,
      selectedScoreExamId,
      selectedPostId,
      selectedPostScope,
      studentVerifications,
      timetable,
      users,
      viewedPostIds,
    ],
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState() {
  const context = useContext(AppStateContext);
  if (!context) {
    throw new Error('useAppState must be used inside AppStateProvider');
  }
  return context;
}
