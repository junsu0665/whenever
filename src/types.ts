export type TabKey = 'home' | 'timetable' | 'board' | 'meal' | 'grades' | 'settings' | 'admin';
export type VerificationStatus = 'not_submitted' | 'pending' | 'approved' | 'rejected';
export type ShareStatus = 'enabled' | 'disabled';
export type PostScope = 'school' | 'course';
export type FriendStatus = 'requested' | 'accepted' | 'blocked';
export type TimetableDay = '월' | '화' | '수' | '목' | '금';
export type CommunityReportTarget = 'post' | 'comment';
export type AccountStatus = 'active' | 'suspended';
export type AccountMode = 'user' | 'admin';

export interface School {
  id: string;
  name: string;
  region: string;
  officeCode: string;
  schoolCode: string;
}

export interface Profile {
  id: string;
  name: string;
  anonymousName: string;
  schoolId: string;
  schoolName: string;
  grade: number;
  className: string;
  verificationStatus: VerificationStatus;
  accountStatus?: AccountStatus;
  isAdmin?: boolean;
  joinedAt?: string;
  lastActiveAt?: string;
  studentCardUri?: string;
  studentVerificationRejectionReason?: string;
  timetableShareStatus: ShareStatus;
  friendTimetableViewStatus: ShareStatus;
}

export interface TimetableSlot {
  id: string;
  day: TimetableDay;
  period: number;
  startTime: string;
  endTime: string;
  subject: string;
  teacher: string;
  room: string;
  courseId: string;
  color: string;
}

export interface PeriodTime {
  startTime: string;
  endTime: string;
}

export type PeriodTimeMap = Record<number, PeriodTime>;

export interface Timetable {
  id: string;
  ownerId: string;
  weekLabel: string;
  semesterLabel?: string;
  source: 'manual' | 'ocr';
  periodTimes: PeriodTimeMap;
  slots: TimetableSlot[];
  lastImportedAt?: string;
}

export interface TimetableImageInput {
  uri: string;
  base64?: string | null;
  mimeType?: string;
  fileName?: string | null;
}

export interface Friend {
  id: string;
  profileId?: string;
  requesterId?: string;
  addresseeId?: string;
  name: string;
  grade: number;
  className: string;
  status: FriendStatus;
  requestedByCurrentUser?: boolean;
  avatarColor: string;
  sharedSlotIds: string[];
}

export interface FriendOverlap {
  sharedPeriods: number[];
  sharedSubjects: string[];
  friendCount: number;
  friendNames: string[];
}

export interface MealMenu {
  id: string;
  schoolId: string;
  date: string;
  type: '중식' | '석식';
  items: string[];
  calories: string;
  origin?: string;
}

export interface Post {
  id: string;
  scope: PostScope;
  schoolId: string;
  courseId?: string;
  title: string;
  body: string;
  imageUris?: string[];
  authorId: string;
  anonymousLabel: string;
  createdAt: string;
  likeCount: number;
  commentCount: number;
  viewCount: number;
  reportCount: number;
  hidden: boolean;
  hot: boolean;
}

export interface PostComment {
  id: string;
  postId: string;
  authorId: string;
  anonymousLabel: string;
  body: string;
  likeCount: number;
  reportCount: number;
  hidden: boolean;
  createdAt: string;
}

export interface CommunityReport {
  id: string;
  reporterId: string;
  targetType: CommunityReportTarget;
  targetId: string;
  reason: string;
  createdAt: string;
}

export interface StudentVerificationRequest {
  id: string;
  userId: string;
  schoolId: string;
  displayUri?: string;
  storagePath: string;
  status: VerificationStatus;
  submittedAt: string;
  reviewedAt?: string;
  reviewerId?: string;
  rejectionReason?: string;
}

export interface CommunityActionState {
  likedPostIds: string[];
  likedCommentIds: string[];
  bookmarkedPostIds: string[];
  reportedPostIds: string[];
  reportedCommentIds: string[];
}

export interface NotificationSettings {
  timetable: boolean;
  meal: boolean;
  community: boolean;
  timetableReminderMinutes: number;
  lunchReminderTime: string;
  dinnerReminderTime: string;
}

export interface ScoreExam {
  id: string;
  schoolId: string;
  grade: number;
  subject: string;
  examName: string;
  maxScore: number;
  totalStudents?: number;
  createdAt?: string;
  updatedAt?: string;
  myScore?: number;
  mySubmittedAt?: string;
}

export interface ScoreExamInput {
  subject: string;
  examName: string;
  maxScore: number;
  totalStudents?: number;
}

export interface ScoreSubjectCandidateResult {
  subjects: string[];
  timetableSubjectCount: number;
  neisSubjectCount: number;
}

export interface ScoreSubmission {
  id: string;
  examId: string;
  userId: string;
  score: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface ScoreExamStats {
  examId: string;
  ready: boolean;
  submissionCount: number;
  anonymousScores: number[];
  topScore?: number;
  topTenCutScore?: number;
  topTenCount?: number;
  myScore?: number;
  myRank?: number;
  myTopPercent?: number;
  message?: string;
}

export interface ScorePrediction {
  examId: string;
  status: 'ready' | 'insufficient_sample';
  sampleCount: number;
  predictedTopScoreRange?: [number, number];
  predictedCutScoreRange?: [number, number];
  confidence?: number;
  rationale: string;
  biasWarning: string;
}

export interface AppSnapshot {
  profile: Profile;
  users?: Profile[];
  timetable: Timetable;
  posts: Post[];
  comments: PostComment[];
  reports?: CommunityReport[];
  studentVerifications?: StudentVerificationRequest[];
  communityActions?: CommunityActionState;
  notificationSettings: NotificationSettings;
  scoreExams?: ScoreExam[];
}
