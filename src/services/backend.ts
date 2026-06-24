import {
  AccountStatus,
  AppSnapshot,
  CommunityActionState,
  CommunityReport,
  Friend,
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
  ScoreSubjectCandidateResult,
  ShareStatus,
  StudentVerificationRequest,
  Timetable,
  TimetableDay,
  TimetableImageInput,
  TimetableSlot,
  VerificationStatus,
} from '../types';
import { getCourseId, getSubjectColor, normalizePeriodTimes, sortTimetableSlots, timetableDays } from '../utils/timetable';
import { normalizeKoreanMobileNumber } from '../utils/profile';
import { providerConfig } from './env';
import { fetchMealMenu } from './neis';
import { clearSupabaseAuthStorage, supabase } from './supabase';

type DbValue = string | number | boolean | null | undefined;
type RemoteClient = NonNullable<typeof supabase>;

interface SchoolRow {
  id: string;
  name: string;
  region: string;
  office_code: string;
  school_code: string;
}

interface ProfileRow {
  id: string;
  school_id: string | null;
  display_name: string;
  grade: number;
  class_name: string;
  verification_status: 'pending' | 'approved' | 'rejected' | null;
  account_status: AccountStatus;
  is_admin: boolean;
  timetable_share_status: ShareStatus;
  friend_timetable_view_status: ShareStatus;
  created_at?: string;
  updated_at?: string;
  schools?: SchoolRow | null;
}

interface StudentVerificationRow {
  id: string;
  user_id: string;
  school_id: string;
  storage_path: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewer_id?: string | null;
  reviewed_at?: string | null;
  rejection_reason?: string | null;
  created_at: string;
}

interface TimetableRow {
  id: string;
  user_id: string;
  school_id: string;
  week_label: string;
  semester_label?: string | null;
  source: 'manual' | 'ocr';
  period_times?: PeriodTimeMap | null;
  source_storage_path?: string | null;
  updated_at?: string;
  timetable_slots?: TimetableSlotRow[];
}

interface TimetableSlotRow {
  id: string;
  course_id: string;
  day_of_week: number;
  period: number;
  start_time: string;
  end_time: string;
  subject: string;
  teacher?: string | null;
  room?: string | null;
}

interface PostRow {
  id: string;
  school_id: string;
  course_id?: string | null;
  author_id: string;
  scope: PostScope;
  title: string;
  body: string;
  image_uris?: string[] | null;
  like_count: number;
  comment_count: number;
  view_count: number;
  report_count: number;
  hidden: boolean;
  created_at: string;
}

interface CommentRow {
  id: string;
  post_id: string;
  author_id: string;
  body: string;
  like_count: number;
  report_count: number;
  hidden: boolean;
  created_at: string;
}

interface ReportRow {
  id: string;
  reporter_id: string;
  post_id?: string | null;
  comment_id?: string | null;
  reason: string;
  created_at: string;
}

interface MealRow {
  id: string;
  school_id: string;
  meal_date: string;
  meal_type: string;
  items: string[];
  calories?: string | null;
  source?: string | null;
}

interface NotificationSettingsRow {
  timetable: boolean;
  meal: boolean;
  community: boolean;
  timetable_reminder_minutes?: number | null;
  lunch_reminder_time?: string | null;
  dinner_reminder_time?: string | null;
  push_token?: string | null;
}

interface ScoreExamRow {
  id: string;
  school_id: string;
  grade: number;
  subject: string;
  exam_name: string;
  max_score: number | string;
  total_students?: number | null;
  created_at?: string;
  updated_at?: string;
}

interface ScoreSubmissionRow {
  exam_id: string;
  score: number | string;
  updated_at?: string | null;
}

interface ScoreSubjectCandidateRow {
  subject?: string | null;
  occurrence_count?: number | string | null;
}

export interface RemoteProfileInput {
  name: string;
  phoneNumber: string;
  schoolId: string;
  school?: School;
  grade: number;
  className: string;
}

export interface RemoteAppData extends AppSnapshot {
  authenticated: boolean;
  userId: string | null;
  schools: School[];
  needsProfile: boolean;
  friends: Friend[];
  meal: MealMenu;
  scoreExams: ScoreExam[];
}

const defaultNotificationSettings: NotificationSettings = {
  timetable: true,
  meal: true,
  community: true,
  timetableReminderMinutes: 10,
  lunchReminderTime: '11:20',
  dinnerReminderTime: '16:30',
};
const loginIdPattern = /^[a-z0-9](?:[a-z0-9._-]{2,18}[a-z0-9])$/;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const emptyCommunityActions: CommunityActionState = {
  likedPostIds: [],
  likedCommentIds: [],
  bookmarkedPostIds: [],
  reportedPostIds: [],
  reportedCommentIds: [],
};
let scoreAdminTestColumnAvailable: boolean | null = null;

const weekdayByNumber: TimetableDay[] = ['월', '화', '수', '목', '금'];

function assertSupabase() {
  if (!supabase) {
    throw new Error('서비스 연결을 확인하지 못했어요. 잠시 후 다시 시도해 주세요.');
  }

  return supabase;
}

function normalizeLoginId(loginId: string) {
  return loginId.trim().toLowerCase();
}

function assertLoginId(loginId: string) {
  const normalized = normalizeLoginId(loginId);
  if (!loginIdPattern.test(normalized) || normalized.includes('..')) {
    throw new Error('아이디는 영문 소문자, 숫자, 점, 밑줄, 하이픈을 조합해 4-20자로 입력해 주세요.');
  }

  return normalized;
}

function authEmailFromLoginId(loginId: string) {
  if (!providerConfig.authEmailDomain) {
    throw new Error('이메일 주소를 입력해 주세요.');
  }

  return `${assertLoginId(loginId)}@${providerConfig.authEmailDomain}`;
}

function assertEmail(email: string) {
  const normalized = email.trim().toLowerCase();
  if (!emailPattern.test(normalized)) {
    throw new Error('이메일 형식을 확인해 주세요.');
  }

  return normalized;
}

function authEmailFromIdentifier(identifier: string) {
  const normalized = normalizeLoginId(identifier);
  return normalized.includes('@') ? assertEmail(normalized) : authEmailFromLoginId(normalized);
}

function getPostgrestCode(error: unknown) {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return '';
  }

  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' ? code : '';
}

function getPostgrestMessage(error: unknown) {
  if (typeof error !== 'object' || error === null || !('message' in error)) {
    return '';
  }

  const message = (error as { message?: unknown }).message;
  return typeof message === 'string' ? message : '';
}

function toPhoneClaimError(error: unknown) {
  const message = getPostgrestMessage(error);

  if (getPostgrestCode(error) === '23505' || /duplicate key|account_phone_numbers_phone_number/i.test(message)) {
    return new Error('이미 이 휴대폰 번호로 만든 계정이 있어요. 로그인하거나 계정 찾기를 이용해 주세요.');
  }

  if (/account_phone_numbers|is_phone_number_available/i.test(message)) {
    return new Error('휴대폰 번호 확인을 완료하지 못했어요. 잠시 후 다시 시도해 주세요.');
  }

  return error;
}

function toTime(value: string) {
  return value.slice(0, 5);
}

function normalizeReminderMinutes(value: number | null | undefined) {
  if (!Number.isFinite(value)) {
    return defaultNotificationSettings.timetableReminderMinutes;
  }

  return Math.min(60, Math.max(0, Math.round(Number(value))));
}

function isMissingNotificationTimeColumn(error: unknown) {
  const message =
    error && typeof error === 'object' && 'message' in error && typeof error.message === 'string'
      ? error.message
      : String(error ?? '');

  return (
    message.includes('notification_settings') &&
    (message.includes('timetable_reminder_minutes') ||
      message.includes('lunch_reminder_time') ||
      message.includes('dinner_reminder_time')) &&
    (message.includes('does not exist') || message.includes('schema cache') || message.includes('Could not find'))
  );
}

function toDayNumber(day: TimetableDay) {
  return timetableDays.indexOf(day) + 1;
}

function toVerificationStatus(value: ProfileRow['verification_status']): VerificationStatus {
  return value ?? 'not_submitted';
}

function getLocalDateString(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function mapSchool(row: SchoolRow): School {
  return {
    id: row.id,
    name: row.name,
    region: row.region,
    officeCode: row.office_code,
    schoolCode: row.school_code,
  };
}

function mapProfile(row: ProfileRow, schoolsById: Map<string, School>): Profile {
  const school = row.schools ? mapSchool(row.schools) : row.school_id ? schoolsById.get(row.school_id) : undefined;

  return {
    id: row.id,
    name: row.display_name,
    anonymousName: '익명',
    schoolId: row.school_id ?? school?.id ?? '',
    schoolName: school?.name ?? '학교 미설정',
    grade: row.grade,
    className: row.class_name,
    verificationStatus: toVerificationStatus(row.verification_status),
    accountStatus: row.account_status,
    isAdmin: row.is_admin,
    joinedAt: row.created_at,
    lastActiveAt: row.updated_at,
    timetableShareStatus: row.timetable_share_status,
    friendTimetableViewStatus: row.friend_timetable_view_status,
  };
}

function mapTimetableSlot(row: TimetableSlotRow): TimetableSlot {
  const day = weekdayByNumber[row.day_of_week - 1] ?? '월';
  const subject = row.subject.trim() || '수업';

  return {
    id: row.id,
    day,
    period: row.period,
    startTime: toTime(row.start_time),
    endTime: toTime(row.end_time),
    subject,
    teacher: row.teacher?.trim() || '미확인',
    room: row.room?.trim() || '미확인',
    courseId: row.course_id || getCourseId(subject),
    color: getSubjectColor(subject),
  };
}

function mapTimetable(row: TimetableRow | null, ownerId: string): Timetable {
  const slots = sortTimetableSlots((row?.timetable_slots ?? []).map(mapTimetableSlot));

  return {
    id: row?.id ?? 'remote-empty-timetable',
    ownerId,
    weekLabel: row?.week_label ?? '이번 주',
    semesterLabel: row?.semester_label ?? '2026 1학기',
    source: row?.source ?? 'manual',
    lastImportedAt: row?.updated_at,
    periodTimes: normalizePeriodTimes(row?.period_times, slots),
    slots,
  };
}

function mapPost(row: PostRow): Post {
  return {
    id: row.id,
    scope: row.scope,
    schoolId: row.school_id,
    courseId: row.course_id ?? undefined,
    title: row.title,
    body: row.body,
    imageUris: row.image_uris?.filter(Boolean) ?? [],
    authorId: row.author_id,
    anonymousLabel: '익명',
    createdAt: row.created_at,
    likeCount: row.like_count,
    commentCount: row.comment_count,
    viewCount: row.view_count,
    reportCount: row.report_count,
    hidden: row.hidden,
    hot: row.like_count >= 8 || row.comment_count >= 5,
  };
}

function getAnonymousCommentLabel(post: Post | undefined, comments: PostComment[], authorId: string) {
  if (post?.authorId === authorId) {
    return '글쓴이';
  }

  const existingLabel = comments.find((comment) => comment.postId === post?.id && comment.authorId === authorId)?.anonymousLabel;
  if (existingLabel) {
    return existingLabel;
  }

  const usedNumbers = comments
    .filter((comment) => comment.postId === post?.id)
    .map((comment) => Number(comment.anonymousLabel.match(/^익명(\d+)$/)?.[1] ?? 0))
    .filter((value) => Number.isFinite(value));

  return `익명${Math.max(0, ...usedNumbers) + 1}`;
}

function mapComments(rows: CommentRow[], posts: Post[]): PostComment[] {
  const mapped: PostComment[] = [];

  rows.forEach((row) => {
    const post = posts.find((candidate) => candidate.id === row.post_id);
    mapped.push({
      id: row.id,
      postId: row.post_id,
      authorId: row.author_id,
      anonymousLabel: getAnonymousCommentLabel(post, mapped, row.author_id),
      body: row.body,
      likeCount: row.like_count,
      reportCount: row.report_count,
      hidden: row.hidden,
      createdAt: row.created_at,
    });
  });

  return mapped;
}

function mapReport(row: ReportRow): CommunityReport | null {
  const targetId = row.post_id ?? row.comment_id;
  if (!targetId) {
    return null;
  }

  return {
    id: row.id,
    reporterId: row.reporter_id,
    targetType: row.post_id ? 'post' : 'comment',
    targetId,
    reason: row.reason,
    createdAt: row.created_at,
  };
}

function mapMeal(row: MealRow): MealMenu {
  return {
    id: row.id,
    schoolId: row.school_id,
    date: row.meal_date,
    type: row.meal_type === '석식' ? '석식' : '중식',
    items: row.items,
    calories: row.calories ?? '',
    origin: row.source ?? 'NEIS',
  };
}

function mapNotificationSettings(row?: NotificationSettingsRow | null): NotificationSettings {
  if (!row) {
    return defaultNotificationSettings;
  }

  return {
    timetable: row.timetable,
    meal: row.meal,
    community: row.community,
    timetableReminderMinutes: normalizeReminderMinutes(row.timetable_reminder_minutes),
    lunchReminderTime: toTime(row.lunch_reminder_time ?? defaultNotificationSettings.lunchReminderTime),
    dinnerReminderTime: toTime(row.dinner_reminder_time ?? defaultNotificationSettings.dinnerReminderTime),
  };
}

function toOptionalNumber(value: unknown) {
  if (value === null || value === undefined || value === '') {
    return undefined;
  }

  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : undefined;
}

function mapScoreExam(row: ScoreExamRow, ownSubmission?: ScoreSubmissionRow): ScoreExam {
  return {
    id: row.id,
    schoolId: row.school_id,
    grade: row.grade,
    subject: row.subject,
    examName: row.exam_name,
    maxScore: Number(row.max_score),
    totalStudents: toOptionalNumber(row.total_students),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    myScore: ownSubmission ? Number(ownSubmission.score) : undefined,
    mySubmittedAt: ownSubmission?.updated_at ?? undefined,
  };
}

function getSharedSlotIds(ownerTimetable: Timetable, friendTimetable?: TimetableRow) {
  const friendSlots = friendTimetable?.timetable_slots ?? [];

  return ownerTimetable.slots
    .filter((slot) =>
      friendSlots.some(
        (friendSlot) =>
          friendSlot.course_id === slot.courseId ||
          (friendSlot.day_of_week === toDayNumber(slot.day) && friendSlot.period === slot.period),
      ),
    )
    .map((slot) => slot.id);
}

function mapSharedTimetablePeople(rows: TimetableRow[], users: Profile[], ownerTimetable: Timetable): Friend[] {
  const latestTimetableByUser = new Map<string, TimetableRow>();
  rows.forEach((row) => {
    if (!latestTimetableByUser.has(row.user_id)) {
      latestTimetableByUser.set(row.user_id, row);
    }
  });

  return [...latestTimetableByUser.values()]
    .map((row) => {
      const user = users.find((candidate) => candidate.id === row.user_id);
      if (
        !user ||
        user.verificationStatus !== 'approved' ||
        user.accountStatus === 'suspended' ||
        user.timetableShareStatus !== 'enabled'
      ) {
        return null;
      }

      const sharedSlotIds = getSharedSlotIds(ownerTimetable, row);
      if (!sharedSlotIds.length) {
        return null;
      }

      const sharedPerson: Friend = {
        id: `shared-${row.user_id}`,
        profileId: row.user_id,
        name: user.name,
        grade: user.grade,
        className: user.className,
        status: 'accepted',
        requestedByCurrentUser: false,
        avatarColor: '#E9F8F0',
        sharedSlotIds,
      };

      return sharedPerson;
    })
    .filter((friend): friend is Friend => friend !== null);
}

function compact<T>(items: Array<T | null | undefined>): T[] {
  return items.filter((item): item is T => Boolean(item));
}

async function createSignedVerificationUrl(storagePath: string) {
  if (!storagePath || storagePath.startsWith('mock/') || storagePath.startsWith('file:')) {
    return undefined;
  }

  const client = assertSupabase();
  const { data } = await client.storage.from('student-id-cards').createSignedUrl(storagePath, 60 * 10);
  return data?.signedUrl;
}

export async function getRemoteUserId() {
  if (!supabase) {
    return null;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

export async function loadRemoteSchools() {
  const client = assertSupabase();
  const { data, error } = await client.from('schools').select('*').order('name');
  if (error) {
    throw error;
  }

  return ((data ?? []) as SchoolRow[]).map(mapSchool);
}

export async function createRemoteProfile(input: RemoteProfileInput) {
  const client = assertSupabase();
  const {
    data: { user },
    error: userError,
  } = await client.auth.getUser();

  if (userError || !user) {
    throw new Error('로그인 세션이 필요해요.');
  }

  const schoolId = await ensureRemoteSchoolId(input);
  const phoneNumber = normalizeKoreanMobileNumber(input.phoneNumber);
  const { error: phoneError } = await client.from('account_phone_numbers').insert({
    user_id: user.id,
    phone_number: phoneNumber,
  });

  if (phoneError) {
    throw toPhoneClaimError(phoneError);
  }

  const { error } = await client.from('profiles').insert({
    id: user.id,
    school_id: schoolId,
    display_name: input.name.trim(),
    grade: input.grade,
    class_name: input.className.trim(),
    verification_status: null,
    account_status: 'active',
    is_admin: false,
    timetable_share_status: 'disabled',
    friend_timetable_view_status: 'disabled',
    terms_accepted_at: new Date().toISOString(),
    privacy_accepted_at: new Date().toISOString(),
    student_id_policy_accepted_at: new Date().toISOString(),
  });

  if (error) {
    await client.from('account_phone_numbers').delete().eq('user_id', user.id);
    throw error;
  }
}

export async function assertRemotePhoneNumberAvailable(phoneNumber: string) {
  const client = assertSupabase();
  const normalizedPhoneNumber = normalizeKoreanMobileNumber(phoneNumber);
  const { data, error } = await client.rpc('is_phone_number_available', {
    p_phone_number: normalizedPhoneNumber,
  });

  if (error) {
    throw toPhoneClaimError(error);
  }

  if (data === false) {
    throw new Error('이미 이 휴대폰 번호로 만든 계정이 있어요. 로그인하거나 계정 찾기를 이용해 주세요.');
  }
}

async function ensureRemoteSchoolId(input: RemoteProfileInput) {
  const client = assertSupabase();
  const school = input.school;
  if (!school?.schoolCode) {
    return input.schoolId;
  }

  const { data: existingSchool, error: existingError } = await client
    .from('schools')
    .select('*')
    .eq('school_code', school.schoolCode)
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  if (existingSchool) {
    return mapSchool(existingSchool as SchoolRow).id;
  }

  const { data, error } = await client.rpc('upsert_school_by_code', {
    p_name: school.name,
    p_region: school.region,
    p_office_code: school.officeCode,
    p_school_code: school.schoolCode,
  });

  if (error) {
    throw error;
  }

  return mapSchool(data as SchoolRow).id;
}

function getMetadataString(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key];
  return typeof value === 'string' ? value.trim() : '';
}

function getMetadataNumber(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key];
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : undefined;
}

function profileInputFromUserMetadata(metadata: Record<string, unknown> | undefined, schools: School[]): RemoteProfileInput | null {
  if (!metadata) {
    return null;
  }

  const name = getMetadataString(metadata, 'display_name') || getMetadataString(metadata, 'name');
  const phoneNumber = getMetadataString(metadata, 'phone_number');
  const className = getMetadataString(metadata, 'class_name');
  const grade = getMetadataNumber(metadata, 'grade');
  const schoolId = getMetadataString(metadata, 'school_id');
  const schoolCode = getMetadataString(metadata, 'school_code');
  const officeCode = getMetadataString(metadata, 'office_code');
  const schoolName = getMetadataString(metadata, 'school_name');
  const schoolRegion = getMetadataString(metadata, 'school_region');
  const storedSchool = schools.find((school) => school.id === schoolId);
  const school =
    storedSchool ??
    (schoolCode && officeCode && schoolName
      ? {
          id: schoolId || `neis-${officeCode}-${schoolCode}`,
          name: schoolName,
          region: schoolRegion || '지역 미상',
          officeCode,
          schoolCode,
        }
      : undefined);

  if (!name || !phoneNumber || !className || !grade || grade < 1 || grade > 3 || (!school && !schoolId)) {
    return null;
  }

  return {
    name,
    phoneNumber,
    schoolId: school?.id ?? schoolId,
    school,
    grade,
    className,
  };
}

async function createRemoteProfileFromMetadata(metadata: Record<string, unknown> | undefined, schools: School[]) {
  const profileInput = profileInputFromUserMetadata(metadata, schools);
  if (!profileInput) {
    return null;
  }

  try {
    await createRemoteProfile(profileInput);
    return profileInput;
  } catch {
    return null;
  }
}

export async function loadRemoteAppData(): Promise<RemoteAppData> {
  const client = assertSupabase();
  const schools = await loadRemoteSchools();
  const schoolsById = new Map(schools.map((school) => [school.id, school]));
  const {
    data: { user },
    error: userError,
  } = await client.auth.getUser();

  if (userError || !user) {
    return {
      authenticated: false,
      userId: null,
      needsProfile: false,
      schools,
      profile: {} as Profile,
      users: [],
      timetable: mapTimetable(null, ''),
      posts: [],
      comments: [],
      reports: [],
      studentVerifications: [],
      communityActions: emptyCommunityActions,
      notificationSettings: defaultNotificationSettings,
      scoreExams: [],
      friends: [],
      meal: await fetchMealMenu(schools[0]),
    };
  }

  let { data: profileRow, error: profileError } = await client
    .from('profiles')
    .select('*, schools(*)')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError) {
    throw profileError;
  }

  if (!profileRow) {
    const recoveredProfile = await createRemoteProfileFromMetadata(user.user_metadata as Record<string, unknown> | undefined, schools);
    if (recoveredProfile) {
      const profileResult = await client
        .from('profiles')
        .select('*, schools(*)')
        .eq('id', user.id)
        .maybeSingle();

      if (profileResult.error) {
        throw profileResult.error;
      }

      profileRow = profileResult.data;
    }
  }

  if (!profileRow) {
    return {
      authenticated: true,
      userId: user.id,
      needsProfile: true,
      schools,
      profile: {} as Profile,
      users: [],
      timetable: mapTimetable(null, user.id),
      posts: [],
      comments: [],
      reports: [],
      studentVerifications: [],
      communityActions: emptyCommunityActions,
      notificationSettings: defaultNotificationSettings,
      scoreExams: [],
      friends: [],
      meal: await fetchMealMenu(schools[0]),
    };
  }

  const profile = mapProfile(profileRow as ProfileRow, schoolsById);
  const today = getLocalDateString();

  const [
    usersResult,
    timetableResult,
    postsResult,
    reportsResult,
    verificationsResult,
    settingsResult,
    mealResult,
    postLikesResult,
    commentLikesResult,
    postBookmarksResult,
    sharedTimetablesResult,
    scoreExamsResult,
  ] = await Promise.all([
      client.from('profiles').select('*, schools(*)').order('display_name'),
      client.from('timetables').select('*, timetable_slots(*)').eq('user_id', user.id).order('updated_at', { ascending: false }).limit(1).maybeSingle(),
      client.from('posts').select('*').order('created_at', { ascending: false }).limit(100),
      client.from('reports').select('*').order('created_at', { ascending: false }).limit(100),
      client.from('student_verifications').select('*').order('created_at', { ascending: false }).limit(100),
      client.from('notification_settings').select('*').eq('user_id', user.id).maybeSingle(),
      client.from('meal_menus').select('*').eq('school_id', profile.schoolId).eq('meal_date', today).eq('meal_type', '중식').maybeSingle(),
      client.from('post_likes').select('post_id').eq('user_id', user.id),
      client.from('comment_likes').select('comment_id').eq('user_id', user.id),
      client.from('post_bookmarks').select('post_id').eq('user_id', user.id),
      profile.friendTimetableViewStatus === 'enabled'
        ? client
            .from('timetables')
            .select('*, timetable_slots(*)')
            .eq('school_id', profile.schoolId)
            .neq('user_id', user.id)
            .order('updated_at', { ascending: false })
            .limit(200)
        : { data: [], error: null },
      client.from('score_exams').select('*').eq('school_id', profile.schoolId).eq('grade', profile.grade).order('updated_at', { ascending: false }).limit(100),
    ]);

  const remoteQueryError = [
    usersResult.error,
    timetableResult.error,
    postsResult.error,
    reportsResult.error,
    verificationsResult.error,
    settingsResult.error,
    mealResult.error,
    postLikesResult.error,
    commentLikesResult.error,
    postBookmarksResult.error,
    sharedTimetablesResult.error,
    scoreExamsResult.error,
  ].find(Boolean);

  if (remoteQueryError) {
    throw remoteQueryError;
  }

  const users = ((usersResult.data ?? []) as ProfileRow[]).map((row) => mapProfile(row, schoolsById));
  const timetable = mapTimetable(timetableResult.data as TimetableRow | null, user.id);
  const posts = ((postsResult.data ?? []) as PostRow[]).map(mapPost);
  const postIds = posts.map((post) => post.id);
  const commentsResult = postIds.length
    ? await client.from('comments').select('*').in('post_id', postIds).order('created_at', { ascending: true }).limit(500)
    : { data: [], error: null };
  if (commentsResult.error) {
    throw commentsResult.error;
  }

  const comments = mapComments((commentsResult.data ?? []) as CommentRow[], posts);
  const reports = compact(((reportsResult.data ?? []) as ReportRow[]).map(mapReport));
  const verificationRows = (verificationsResult.data ?? []) as StudentVerificationRow[];
  const studentVerifications = await Promise.all(
    verificationRows.map(async (row): Promise<StudentVerificationRequest> => ({
      id: row.id,
      userId: row.user_id,
      schoolId: row.school_id,
      displayUri: await createSignedVerificationUrl(row.storage_path),
      storagePath: row.storage_path,
      status: row.status,
      submittedAt: row.created_at,
      reviewedAt: row.reviewed_at ?? undefined,
      reviewerId: row.reviewer_id ?? undefined,
      rejectionReason: row.rejection_reason ?? undefined,
    })),
  );
  const notificationSettings = mapNotificationSettings(settingsResult.data as NotificationSettingsRow | null);
  const meal = !mealResult.data ? await fetchMealMenu(schoolsById.get(profile.schoolId), today) : mapMeal(mealResult.data as MealRow);
  const likedPostIds = ((postLikesResult.data ?? []) as Array<{ post_id: string }>).map((row) => row.post_id);
  const likedCommentIds = ((commentLikesResult.data ?? []) as Array<{ comment_id: string }>).map((row) => row.comment_id);
  const bookmarkedPostIds = ((postBookmarksResult.data ?? []) as Array<{ post_id: string }>).map((row) => row.post_id);
  const scoreExamRows = (scoreExamsResult.data ?? []) as ScoreExamRow[];
  const scoreExamIds = scoreExamRows.map((exam) => exam.id);
  const scoreSubmissions = await loadOwnScoreSubmissions(client, scoreExamIds, user.id);
  const ownScoreSubmissions = new Map(
    scoreSubmissions.map((submission) => [submission.exam_id, submission]),
  );
  const scoreExams = scoreExamRows.map((row) => mapScoreExam(row, ownScoreSubmissions.get(row.id)));
  const friends = mapSharedTimetablePeople((sharedTimetablesResult.data ?? []) as TimetableRow[], users, timetable);

  return {
    authenticated: true,
    userId: user.id,
    needsProfile: false,
    schools,
    profile,
    users,
    timetable,
    posts,
    comments,
    reports,
    studentVerifications,
    communityActions: {
      likedPostIds,
      likedCommentIds,
      bookmarkedPostIds,
      reportedPostIds: reports.filter((report) => report.reporterId === user.id && report.targetType === 'post').map((report) => report.targetId),
      reportedCommentIds: reports.filter((report) => report.reporterId === user.id && report.targetType === 'comment').map((report) => report.targetId),
    },
    notificationSettings,
    scoreExams,
    friends,
    meal,
  };
}

export async function signInRemote(loginId: string, password: string) {
  const client = assertSupabase();
  const { error } = await client.auth.signInWithPassword({ email: authEmailFromIdentifier(loginId), password });
  if (error) {
    throw error;
  }
}

export async function signUpRemote(loginId: string, password: string, profile: RemoteProfileInput) {
  const client = assertSupabase();
  const school = profile.school;
  const authEmail = authEmailFromIdentifier(loginId);
  const normalizedLoginId = authEmail.includes('@') ? authEmail : assertLoginId(loginId);
  const phoneNumber = normalizeKoreanMobileNumber(profile.phoneNumber);
  await assertRemotePhoneNumberAvailable(phoneNumber);

  const { data, error } = await client.auth.signUp({
    email: authEmail,
    password,
    options: {
      data: {
        login_id: normalizedLoginId,
        display_name: profile.name.trim(),
        phone_number: phoneNumber,
        school_id: profile.schoolId,
        school_name: school?.name,
        school_region: school?.region,
        office_code: school?.officeCode,
        school_code: school?.schoolCode,
        grade: profile.grade,
        class_name: profile.className.trim(),
      },
    },
  });

  if (error) {
    throw error;
  }

  if (data.session) {
    await createRemoteProfile(profile);
  }

  return Boolean(data.session);
}

export async function signOutRemote() {
  const client = assertSupabase();
  const { error } = await client.auth.signOut({ scope: 'local' });
  if (error) {
    await clearSupabaseAuthStorage();
  }
}

export async function deleteRemoteAccount() {
  const client = assertSupabase();
  if (!providerConfig.accountDeleteEndpoint) {
    throw new Error('계정 삭제를 완료하지 못했어요. 고객지원에 문의해 주세요.');
  }

  const {
    data: { session },
  } = await client.auth.getSession();
  if (!session?.access_token) {
    throw new Error('로그인 세션이 필요해요.');
  }

  const response = await fetch(providerConfig.accountDeleteEndpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
  });

  const payload = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) {
    throw new Error(payload.error ?? '계정 삭제에 실패했어요.');
  }

  const { error: signOutError } = await client.auth.signOut({ scope: 'local' });
  if (signOutError) {
    await clearSupabaseAuthStorage();
  }
}

export async function setRemoteShareStatus(key: 'timetableShareStatus' | 'friendTimetableViewStatus', value: ShareStatus) {
  const client = assertSupabase();
  const userId = await getRemoteUserId();
  if (!userId) {
    throw new Error('로그인 세션이 필요해요.');
  }

  const column = key === 'timetableShareStatus' ? 'timetable_share_status' : 'friend_timetable_view_status';
  const patch: Record<string, DbValue> = {
    [column]: value,
    updated_at: new Date().toISOString(),
  };
  const { error } = await client.from('profiles').update(patch).eq('id', userId);
  if (error) {
    throw error;
  }
}

export async function upsertRemoteNotificationSettings(settings: NotificationSettings, pushToken?: string | null) {
  const client = assertSupabase();
  const userId = await getRemoteUserId();
  if (!userId) {
    throw new Error('로그인 세션이 필요해요.');
  }

  const updatedAt = new Date().toISOString();
  const { error } = await client.from('notification_settings').upsert(
    {
      user_id: userId,
      timetable: settings.timetable,
      meal: settings.meal,
      community: settings.community,
      timetable_reminder_minutes: settings.timetableReminderMinutes,
      lunch_reminder_time: settings.lunchReminderTime,
      dinner_reminder_time: settings.dinnerReminderTime,
      push_token: pushToken,
      updated_at: updatedAt,
    },
    { onConflict: 'user_id' },
  );

  if (!error) {
    return;
  }

  if (!isMissingNotificationTimeColumn(error)) {
    throw error;
  }

  const { error: legacyError } = await client.from('notification_settings').upsert(
    {
      user_id: userId,
      timetable: settings.timetable,
      meal: settings.meal,
      community: settings.community,
      push_token: pushToken,
      updated_at: updatedAt,
    },
    { onConflict: 'user_id' },
  );

  if (legacyError) {
    throw legacyError;
  }
}

export async function createRemotePost(
  profile: Profile,
  scope: PostScope,
  title: string,
  body: string,
  courseId?: string,
  imageUris: string[] = [],
) {
  const client = assertSupabase();
  const payload = {
    school_id: profile.schoolId,
    course_id: scope === 'course' ? courseId : null,
    author_id: profile.id,
    scope,
    title,
    body,
    image_uris: imageUris.filter(Boolean),
  };
  const { error } = await client.from('posts').insert(payload);

  if (error && /image_uris|schema cache|PGRST204|column/i.test(`${error.message} ${error.code ?? ''}`)) {
    const { image_uris: _imageUris, ...legacyPayload } = payload;
    const { error: legacyError } = await client.from('posts').insert(legacyPayload);
    if (legacyError) {
      throw legacyError;
    }
    return;
  }

  if (error) {
    throw error;
  }
}

export async function createRemoteComment(profile: Profile, postId: string, body: string) {
  const client = assertSupabase();
  const { error } = await client.from('comments').insert({
    post_id: postId,
    author_id: profile.id,
    body,
  });

  if (error) {
    throw error;
  }

  await sendRemoteCommunityPush(postId).catch(() => undefined);
}

async function sendRemoteCommunityPush(postId: string) {
  if (!providerConfig.communityPushEndpoint) {
    return;
  }

  const client = assertSupabase();
  const {
    data: { session },
  } = await client.auth.getSession();
  if (!session?.access_token) {
    return;
  }

  await fetch(providerConfig.communityPushEndpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
      ...(providerConfig.supabaseAnonKey ? { apikey: providerConfig.supabaseAnonKey } : {}),
    },
    body: JSON.stringify({ postId }),
  });
}

export async function deleteRemotePost(postId: string) {
  const client = assertSupabase();
  const { error } = await client.from('posts').delete().eq('id', postId);
  if (error) {
    throw error;
  }
}

export async function deleteRemoteComment(commentId: string) {
  const client = assertSupabase();
  const { error } = await client.from('comments').delete().eq('id', commentId);
  if (error) {
    throw error;
  }
}

export async function setRemotePostLike(postId: string, liked: boolean) {
  const client = assertSupabase();
  const userId = await getRemoteUserId();
  if (!userId) {
    throw new Error('로그인 세션이 필요해요.');
  }

  const result = liked
    ? await client.from('post_likes').insert({ post_id: postId, user_id: userId })
    : await client.from('post_likes').delete().eq('post_id', postId).eq('user_id', userId);

  if (result.error) {
    throw result.error;
  }
}

export async function setRemotePostBookmark(postId: string, bookmarked: boolean) {
  const client = assertSupabase();
  const userId = await getRemoteUserId();
  if (!userId) {
    throw new Error('로그인 세션이 필요해요.');
  }

  const result = bookmarked
    ? await client.from('post_bookmarks').insert({ post_id: postId, user_id: userId })
    : await client.from('post_bookmarks').delete().eq('post_id', postId).eq('user_id', userId);

  if (result.error) {
    throw result.error;
  }
}

export async function setRemoteCommentLike(commentId: string, liked: boolean) {
  const client = assertSupabase();
  const userId = await getRemoteUserId();
  if (!userId) {
    throw new Error('로그인 세션이 필요해요.');
  }

  const result = liked
    ? await client.from('comment_likes').insert({ comment_id: commentId, user_id: userId })
    : await client.from('comment_likes').delete().eq('comment_id', commentId).eq('user_id', userId);

  if (result.error) {
    throw result.error;
  }
}

export async function incrementRemotePostView(postId: string) {
  const client = assertSupabase();
  const { data, error } = await client.rpc('increment_post_view', { target_post_id: postId });
  if (error) {
    throw error;
  }

  if (typeof data === 'number') {
    return data;
  }

  const { data: post, error: postError } = await client
    .from('posts')
    .select('view_count')
    .eq('id', postId)
    .maybeSingle();

  if (postError) {
    throw postError;
  }

  return typeof post?.view_count === 'number' ? post.view_count : null;
}

export async function reportRemotePost(profile: Profile, postId: string, reason: string) {
  const client = assertSupabase();
  const { error } = await client.from('reports').insert({
    reporter_id: profile.id,
    post_id: postId,
    reason,
  });

  if (error) {
    throw error;
  }
}

export async function reportRemoteComment(profile: Profile, commentId: string, reason: string) {
  const client = assertSupabase();
  const { error } = await client.from('reports').insert({
    reporter_id: profile.id,
    comment_id: commentId,
    reason,
  });

  if (error) {
    throw error;
  }
}

export async function adminSetRemotePostHidden(postId: string, hidden: boolean) {
  const client = assertSupabase();
  const { error } = await client.from('posts').update({ hidden, updated_at: new Date().toISOString() }).eq('id', postId);
  if (error) {
    throw error;
  }
}

export async function adminSetRemoteCommentHidden(commentId: string, hidden: boolean) {
  const client = assertSupabase();
  const { error } = await client.from('comments').update({ hidden }).eq('id', commentId);
  if (error) {
    throw error;
  }
}

export async function adminDeleteRemotePost(postId: string) {
  const client = assertSupabase();
  const { error } = await client.from('posts').delete().eq('id', postId);
  if (error) {
    throw error;
  }
}

export async function adminDeleteRemoteComment(commentId: string) {
  const client = assertSupabase();
  const { error } = await client.from('comments').delete().eq('id', commentId);
  if (error) {
    throw error;
  }
}

export async function adminDismissRemoteReport(reportId: string) {
  const client = assertSupabase();
  const { error } = await client.from('reports').delete().eq('id', reportId);
  if (error) {
    throw error;
  }
}

export async function adminSetRemoteUserAccountStatus(userId: string, status: AccountStatus) {
  const client = assertSupabase();
  const { error } = await client.from('profiles').update({ account_status: status, updated_at: new Date().toISOString() }).eq('id', userId);
  if (error) {
    throw error;
  }
}

export async function adminReviewRemoteStudentVerification(
  userId: string,
  status: Extract<VerificationStatus, 'approved' | 'rejected'>,
  rejectionReason?: string,
) {
  const client = assertSupabase();
  const reviewerId = await getRemoteUserId();
  if (!reviewerId) {
    throw new Error('로그인 세션이 필요해요.');
  }

  const { error } = await client
    .from('student_verifications')
    .update({
      status,
      reviewer_id: reviewerId,
      reviewed_at: new Date().toISOString(),
      rejection_reason: status === 'rejected' ? rejectionReason ?? '학생증 정보를 확인할 수 없어요.' : null,
    })
    .eq('user_id', userId)
    .eq('status', 'pending');

  if (error) {
    throw error;
  }
}

function getTimetableImageUri(image: string | TimetableImageInput) {
  return typeof image === 'string' ? image : image.uri;
}

function getTimetableImageContentType(image: string | TimetableImageInput) {
  if (typeof image !== 'string' && image.mimeType) {
    return image.mimeType;
  }

  const uri = getTimetableImageUri(image).toLowerCase();
  if (uri.includes('.png')) {
    return 'image/png';
  }
  if (uri.includes('.webp')) {
    return 'image/webp';
  }
  return 'image/jpeg';
}

export async function uploadRemoteTimetableImage(image: string | TimetableImageInput) {
  const client = assertSupabase();
  const userId = await getRemoteUserId();
  if (!userId) {
    throw new Error('로그인 세션이 필요해요.');
  }

  const response = await fetch(getTimetableImageUri(image));
  const blob = await response.blob();
  const storagePath = `${userId}/${Date.now()}.jpg`;
  const { error } = await client.storage.from('timetable-uploads').upload(storagePath, blob, {
    contentType: getTimetableImageContentType(image),
    upsert: false,
  });

  if (error) {
    throw error;
  }

  return storagePath;
}

async function getOrCreateRemoteTimetable(profile: Profile, source: Timetable['source'] = 'manual') {
  const client = assertSupabase();
  const { data: existing, error: existingError } = await client
    .from('timetables')
    .select('id')
    .eq('user_id', profile.id)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  const existingId = (existing as { id?: string } | null)?.id;
  if (existingId) {
    return existingId;
  }

  const { data, error } = await client
    .from('timetables')
    .insert({
      user_id: profile.id,
      school_id: profile.schoolId,
      week_label: '이번 주',
      semester_label: '2026 1학기',
      source,
      period_times: normalizePeriodTimes(),
    })
    .select('id')
    .single();

  if (error) {
    throw error;
  }

  return (data as { id: string }).id;
}

export async function saveRemoteTimetable(
  profile: Profile,
  slots: TimetableSlot[],
  sourceStoragePath?: string,
  periodTimes?: PeriodTimeMap,
) {
  const client = assertSupabase();
  const { data: existing, error: existingError } = await client
    .from('timetables')
    .select('id')
    .eq('user_id', profile.id)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  const timetablePatch = {
    user_id: profile.id,
    school_id: profile.schoolId,
    week_label: '이번 주',
    semester_label: '2026 1학기',
    source: 'ocr',
    period_times: normalizePeriodTimes(periodTimes, slots),
    source_storage_path: sourceStoragePath ?? null,
    updated_at: new Date().toISOString(),
  };
  const timetableId = (existing as { id?: string } | null)?.id;
  const timetableResult = timetableId
    ? await client.from('timetables').update(timetablePatch).eq('id', timetableId).select('id').single()
    : await client.from('timetables').insert(timetablePatch).select('id').single();

  if (timetableResult.error) {
    throw timetableResult.error;
  }

  const nextTimetableId = (timetableResult.data as { id: string }).id;
  const deleteResult = await client.from('timetable_slots').delete().eq('timetable_id', nextTimetableId);
  if (deleteResult.error) {
    throw deleteResult.error;
  }

  if (!slots.length) {
    return;
  }

  const { error } = await client.from('timetable_slots').insert(
    slots.map((slot) => ({
      timetable_id: nextTimetableId,
      course_id: slot.courseId || getCourseId(slot.subject),
      day_of_week: toDayNumber(slot.day),
      period: slot.period,
      start_time: slot.startTime,
      end_time: slot.endTime,
      subject: slot.subject,
      teacher: slot.teacher,
      room: slot.room,
    })),
  );

  if (error) {
    throw error;
  }
}

export async function createRemoteTimetableSlot(profile: Profile, slot: TimetableSlot) {
  const client = assertSupabase();
  const timetableId = await getOrCreateRemoteTimetable(profile, 'manual');
  const { error } = await client.from('timetable_slots').insert({
    timetable_id: timetableId,
    course_id: slot.courseId || getCourseId(slot.subject),
    day_of_week: toDayNumber(slot.day),
    period: slot.period,
    start_time: slot.startTime,
    end_time: slot.endTime,
    subject: slot.subject,
    teacher: slot.teacher,
    room: slot.room,
  });

  if (error) {
    throw error;
  }

  const { error: updateError } = await client
    .from('timetables')
    .update({ source: 'manual', updated_at: new Date().toISOString() })
    .eq('id', timetableId);

  if (updateError) {
    throw updateError;
  }
}

export async function deleteRemoteTimetableSlot(slotId: string) {
  const client = assertSupabase();
  const { error } = await client.from('timetable_slots').delete().eq('id', slotId);
  if (error) {
    throw error;
  }
}

export async function updateRemoteTimetableSemester(profile: Profile, semesterLabel: string) {
  const client = assertSupabase();
  const timetableId = await getOrCreateRemoteTimetable(profile, 'manual');
  const { error } = await client
    .from('timetables')
    .update({ semester_label: semesterLabel.trim(), updated_at: new Date().toISOString() })
    .eq('id', timetableId);

  if (error) {
    throw error;
  }
}

export async function updateRemoteTimetablePeriodTimes(profile: Profile, periodTimes: PeriodTimeMap) {
  const client = assertSupabase();
  const timetableId = await getOrCreateRemoteTimetable(profile, 'manual');
  const nextPeriodTimes = normalizePeriodTimes(periodTimes);
  const { error } = await client
    .from('timetables')
    .update({
      period_times: nextPeriodTimes,
      source: 'manual',
      updated_at: new Date().toISOString(),
    })
    .eq('id', timetableId);

  if (error) {
    throw error;
  }

  const slotResults = await Promise.all(
    Object.entries(nextPeriodTimes).map(([periodKey, time]) =>
      client
        .from('timetable_slots')
        .update({
          start_time: time.startTime,
          end_time: time.endTime,
        })
        .eq('timetable_id', timetableId)
        .eq('period', Number(periodKey)),
    ),
  );
  const slotError = slotResults.find((result) => result.error)?.error;

  if (slotError) {
    throw slotError;
  }
}

export async function updateRemoteTimetablePeriodTime(profile: Profile, periodTimes: PeriodTimeMap, period: number, time: PeriodTime) {
  await updateRemoteTimetablePeriodTimes(profile, { ...periodTimes, [period]: time });
}

export async function updateRemoteTimetableSlot(slotId: string, patch: Partial<TimetableSlot>) {
  const client = assertSupabase();
  const dbPatch: Record<string, DbValue> = {};
  if (patch.subject !== undefined) {
    dbPatch.subject = patch.subject;
    dbPatch.course_id = getCourseId(patch.subject);
  }
  if (patch.teacher !== undefined) {
    dbPatch.teacher = patch.teacher;
  }
  if (patch.room !== undefined) {
    dbPatch.room = patch.room;
  }
  if (patch.startTime !== undefined) {
    dbPatch.start_time = patch.startTime;
  }
  if (patch.endTime !== undefined) {
    dbPatch.end_time = patch.endTime;
  }

  if (!Object.keys(dbPatch).length) {
    return;
  }

  const { error } = await client.from('timetable_slots').update(dbPatch).eq('id', slotId);
  if (error) {
    throw error;
  }
}

export async function cacheRemoteMeal(meal: MealMenu) {
  const client = assertSupabase();
  const userId = await getRemoteUserId();
  if (!userId) {
    throw new Error('로그인 세션이 필요해요.');
  }

  const { error } = await client.from('meal_menus').upsert(
    {
      school_id: meal.schoolId,
      meal_date: meal.date,
      meal_type: meal.type,
      items: meal.items,
      calories: meal.calories,
      source: meal.origin ?? 'NEIS',
    },
    { onConflict: 'school_id,meal_date,meal_type' },
  );

  if (error) {
    throw error;
  }
}

function getScorePredictionErrorMessage(payload: {
  error?: { message?: string } | string;
  message?: string;
  code?: string;
}) {
  if (typeof payload.error === 'string') {
    return payload.error;
  }

  return payload.error?.message ?? payload.message ?? payload.code ?? '분포 참고값 요청에 실패했어요.';
}

function getRemoteErrorText(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'object' && error !== null) {
    const payload = error as { code?: unknown; message?: unknown; details?: unknown };
    return [payload.code, payload.message, payload.details].filter((value) => typeof value === 'string').join(' ');
  }

  return typeof error === 'string' ? error : '';
}

function isMissingAdminTestColumnError(error: unknown) {
  const errorText = getRemoteErrorText(error).toLowerCase();
  return (
    errorText.includes('score_submissions.is_admin_test') ||
    (errorText.includes('is_admin_test') && /could not find|does not exist|not find|not found|schema cache|pgrst204|42703/i.test(errorText))
  );
}

function markScoreAdminTestColumnMissing() {
  scoreAdminTestColumnAvailable = false;
}

function isMissingRpcError(error: unknown, functionName: string) {
  const errorText = getRemoteErrorText(error);
  return errorText.includes(functionName) && /not find|not found|does not exist|PGRST202|42883/i.test(errorText);
}

async function loadOwnScoreSubmissions(client: RemoteClient, scoreExamIds: string[], userId: string) {
  if (!scoreExamIds.length) {
    return [];
  }

  if (scoreAdminTestColumnAvailable === false) {
    const fallbackResult = await client
      .from('score_submissions')
      .select('exam_id, score, updated_at')
      .in('exam_id', scoreExamIds)
      .eq('user_id', userId);

    if (fallbackResult.error) {
      throw fallbackResult.error;
    }

    return (fallbackResult.data ?? []) as ScoreSubmissionRow[];
  }

  const filteredResult = await client
    .from('score_submissions')
    .select('exam_id, score, updated_at')
    .in('exam_id', scoreExamIds)
    .eq('user_id', userId)
    .eq('is_admin_test', false);

  if (!filteredResult.error) {
    scoreAdminTestColumnAvailable = true;
    return (filteredResult.data ?? []) as ScoreSubmissionRow[];
  }

  if (!isMissingAdminTestColumnError(filteredResult.error)) {
    throw filteredResult.error;
  }

  markScoreAdminTestColumnMissing();
  const fallbackResult = await client
    .from('score_submissions')
    .select('exam_id, score, updated_at')
    .in('exam_id', scoreExamIds)
    .eq('user_id', userId);

  if (fallbackResult.error) {
    throw fallbackResult.error;
  }

  return (fallbackResult.data ?? []) as ScoreSubmissionRow[];
}

async function updateRegularScoreSubmission(client: RemoteClient, examId: string, userId: string, score: number) {
  if (scoreAdminTestColumnAvailable === false) {
    const fallbackUpdateResult = await client
      .from('score_submissions')
      .update({ score })
      .eq('exam_id', examId)
      .eq('user_id', userId)
      .select('id');

    if (fallbackUpdateResult.error) {
      throw fallbackUpdateResult.error;
    }

    return Boolean(fallbackUpdateResult.data?.length);
  }

  const filteredUpdateResult = await client
    .from('score_submissions')
    .update({ score })
    .eq('exam_id', examId)
    .eq('user_id', userId)
    .eq('is_admin_test', false)
    .select('id');

  if (!filteredUpdateResult.error) {
    scoreAdminTestColumnAvailable = true;
    return Boolean(filteredUpdateResult.data?.length);
  }

  if (!isMissingAdminTestColumnError(filteredUpdateResult.error)) {
    throw filteredUpdateResult.error;
  }

  markScoreAdminTestColumnMissing();
  const fallbackUpdateResult = await client
    .from('score_submissions')
    .update({ score })
    .eq('exam_id', examId)
    .eq('user_id', userId)
    .select('id');

  if (fallbackUpdateResult.error) {
    throw fallbackUpdateResult.error;
  }

  return Boolean(fallbackUpdateResult.data?.length);
}

async function insertRegularScoreSubmission(client: RemoteClient, examId: string, userId: string, score: number) {
  if (scoreAdminTestColumnAvailable === false) {
    const fallbackInsertResult = await client
      .from('score_submissions')
      .insert({ exam_id: examId, user_id: userId, score });

    if (fallbackInsertResult.error) {
      throw fallbackInsertResult.error;
    }
    return;
  }

  const filteredInsertResult = await client
    .from('score_submissions')
    .insert({ exam_id: examId, user_id: userId, score, is_admin_test: false });

  if (!filteredInsertResult.error) {
    scoreAdminTestColumnAvailable = true;
    return;
  }

  if (!isMissingAdminTestColumnError(filteredInsertResult.error)) {
    throw filteredInsertResult.error;
  }

  markScoreAdminTestColumnMissing();
  const fallbackInsertResult = await client
    .from('score_submissions')
    .insert({ exam_id: examId, user_id: userId, score });

  if (fallbackInsertResult.error) {
    throw fallbackInsertResult.error;
  }
}

async function upsertRegularScoreSubmission(client: RemoteClient, examId: string, userId: string, score: number) {
  const updated = await updateRegularScoreSubmission(client, examId, userId, score);
  if (!updated) {
    await insertRegularScoreSubmission(client, examId, userId, score);
  }
}

function normalizeNumberList(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map(Number).filter((score) => Number.isFinite(score));
}

function normalizeScoreStats(examId: string, payload: Record<string, unknown> | null | undefined): ScoreExamStats {
  return {
    examId: String(payload?.examId ?? payload?.exam_id ?? examId),
    ready: Boolean(payload?.ready),
    submissionCount: Number(payload?.submissionCount ?? payload?.submission_count ?? 0),
    anonymousScores: normalizeNumberList(payload?.anonymousScores ?? payload?.anonymous_scores),
    topScore: toOptionalNumber(payload?.topScore ?? payload?.top_score),
    topTenCutScore: toOptionalNumber(payload?.topTenCutScore ?? payload?.top_ten_cut_score),
    topTenCount: toOptionalNumber(payload?.topTenCount ?? payload?.top_ten_count),
    myScore: toOptionalNumber(payload?.myScore ?? payload?.my_score),
    myRank: toOptionalNumber(payload?.myRank ?? payload?.my_rank),
    myTopPercent: toOptionalNumber(payload?.myTopPercent ?? payload?.my_top_percent),
    message: typeof payload?.message === 'string' ? payload.message : undefined,
  };
}

function normalizeScorePrediction(examId: string, payload: Record<string, unknown>): ScorePrediction {
  const topLow = toOptionalNumber(payload.predictedTopScoreLow ?? payload.predicted_top_score_low);
  const topHigh = toOptionalNumber(payload.predictedTopScoreHigh ?? payload.predicted_top_score_high);
  const cutLow = toOptionalNumber(payload.predictedCutScoreLow ?? payload.predicted_cut_score_low);
  const cutHigh = toOptionalNumber(payload.predictedCutScoreHigh ?? payload.predicted_cut_score_high);

  return {
    examId: String(payload.examId ?? payload.exam_id ?? examId),
    status: payload.status === 'insufficient_sample' ? 'insufficient_sample' : 'ready',
    sampleCount: Number(payload.sampleCount ?? payload.sample_count ?? 0),
    predictedTopScoreRange: topLow !== undefined && topHigh !== undefined ? [topLow, topHigh] : undefined,
    predictedCutScoreRange: cutLow !== undefined && cutHigh !== undefined ? [cutLow, cutHigh] : undefined,
    confidence: toOptionalNumber(payload.confidence),
    rationale: typeof payload.rationale === 'string' ? payload.rationale : '현재 제출된 점수로 계산했어요.',
    biasWarning:
      typeof payload.biasWarning === 'string'
        ? payload.biasWarning
        : typeof payload.bias_warning === 'string'
          ? payload.bias_warning
          : '참고용이에요.',
  };
}

export async function createRemoteScoreExam(profile: Profile, input: ScoreExamInput) {
  const client = assertSupabase();
  const subject = input.subject.trim();
  const examName = input.examName.trim();
  const maxScore = Number(input.maxScore);
  const totalStudents = input.totalStudents ? Number(input.totalStudents) : null;

  if (!subject || !examName || !Number.isFinite(maxScore) || maxScore <= 0) {
    throw new Error('시험 정보를 확인해 주세요.');
  }

  const { data, error } = await client.rpc('create_score_exam', {
    p_subject: subject,
    p_exam_name: examName,
    p_max_score: maxScore,
    p_total_students: totalStudents,
  });

  if (error) {
    throw error;
  }

  return mapScoreExam(data as ScoreExamRow);
}

export async function deleteRemoteScoreExam(examId: string) {
  const client = assertSupabase();
  const { error: rpcError } = await client.rpc('delete_score_exam', {
    target_exam_id: examId,
  });

  if (!rpcError) {
    return;
  }

  if (!isMissingRpcError(rpcError, 'delete_score_exam')) {
    throw rpcError;
  }

  const { error } = await client.from('score_exams').delete().eq('id', examId);

  if (error) {
    throw error;
  }
}

export async function loadRemoteScoreSubjectCandidates(): Promise<Pick<ScoreSubjectCandidateResult, 'subjects' | 'timetableSubjectCount'>> {
  const client = assertSupabase();
  const { data, error } = await client.rpc('get_score_subject_candidates');

  if (error) {
    if (isMissingRpcError(error, 'get_score_subject_candidates')) {
      return { subjects: [], timetableSubjectCount: 0 };
    }
    throw error;
  }

  const subjects = ((data ?? []) as ScoreSubjectCandidateRow[])
    .map((row) => String(row.subject ?? '').trim())
    .filter(Boolean);

  return {
    subjects: [...new Set(subjects)],
    timetableSubjectCount: subjects.length,
  };
}

export async function upsertRemoteScoreSubmission(examId: string, score: number) {
  const client = assertSupabase();
  const { error } = await client.rpc('submit_score_submission', {
    target_exam_id: examId,
    p_score: score,
  });

  if (!error) {
    return;
  }

  if (isMissingRpcError(error, 'submit_score_submission') || isMissingAdminTestColumnError(error)) {
    if (isMissingAdminTestColumnError(error)) {
      markScoreAdminTestColumnMissing();
    }
    const userId = await getRemoteUserId();
    if (!userId) {
      throw new Error('로그인 세션이 필요해요.');
    }
    await upsertRegularScoreSubmission(client, examId, userId, score);
    return;
  }

  if (error) {
    throw error;
  }
}

export async function submitRemoteAdminTestScoreSubmission(examId: string, score: number) {
  const client = assertSupabase();
  const { error } = await client.rpc('submit_admin_score_test', {
    target_exam_id: examId,
    p_score: score,
  });

  if (error) {
    if (isMissingRpcError(error, 'submit_admin_score_test') || isMissingAdminTestColumnError(error)) {
      if (isMissingAdminTestColumnError(error)) {
        markScoreAdminTestColumnMissing();
      }
      const userId = await getRemoteUserId();
      if (!userId) {
        throw new Error('로그인 세션이 필요해요.');
      }
      await upsertRegularScoreSubmission(client, examId, userId, score);
      return;
    }
    throw error;
  }
}

export async function deleteRemoteScoreSubmission(examId: string) {
  const client = assertSupabase();
  const userId = await getRemoteUserId();
  if (!userId) {
    throw new Error('로그인 세션이 필요해요.');
  }

  if (scoreAdminTestColumnAvailable === false) {
    const { error: fallbackError } = await client
      .from('score_submissions')
      .delete()
      .eq('exam_id', examId)
      .eq('user_id', userId);
    if (fallbackError) {
      throw fallbackError;
    }
    return;
  }

  const { error } = await client
    .from('score_submissions')
    .delete()
    .eq('exam_id', examId)
    .eq('user_id', userId)
    .eq('is_admin_test', false);
  if (!error) {
    scoreAdminTestColumnAvailable = true;
    return;
  }

  if (!isMissingAdminTestColumnError(error)) {
    throw error;
  }

  markScoreAdminTestColumnMissing();
  const { error: fallbackError } = await client
    .from('score_submissions')
    .delete()
    .eq('exam_id', examId)
    .eq('user_id', userId);
  if (fallbackError) {
    throw fallbackError;
  }
}

export async function loadRemoteScoreExamStats(examId: string) {
  const client = assertSupabase();
  const { data, error } = await client.rpc('get_score_exam_stats', { target_exam_id: examId });
  if (error) {
    throw error;
  }

  return normalizeScoreStats(examId, data as Record<string, unknown>);
}

export async function requestRemoteScorePrediction(examId: string) {
  const client = assertSupabase();
  if (!providerConfig.scorePredictionEndpoint) {
    throw new Error('분포 참고값을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.');
  }

  const {
    data: { session },
  } = await client.auth.getSession();
  if (!session?.access_token) {
    throw new Error('로그인 세션이 필요해요.');
  }

  const response = await fetch(providerConfig.scorePredictionEndpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
      ...(providerConfig.supabaseAnonKey ? { apikey: providerConfig.supabaseAnonKey } : {}),
    },
    body: JSON.stringify({ examId }),
  });

  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown> & {
    error?: { message?: string } | string;
    message?: string;
    code?: string;
  };
  if (!response.ok) {
    throw new Error(getScorePredictionErrorMessage(payload));
  }

  return normalizeScorePrediction(examId, payload);
}

export async function recordRemoteAnalyticsEvent(eventName: string, properties: Record<string, unknown> = {}) {
  if (!supabase) {
    return;
  }

  try {
    const userId = await getRemoteUserId();
    if (!userId) {
      return;
    }

    await supabase.from('analytics_events').insert({
      user_id: userId,
      event_name: eventName,
      properties,
    });
  } catch {
    // Analytics must never interrupt app usage or surface dev redboxes.
  }
}

export type RemoteAdFeedbackAction = 'hide' | 'report';

interface RemoteAdEventInput {
  placement: string;
  provider?: string;
  campaignId?: string;
  schoolId?: string;
}

interface RemoteAdClickInput extends RemoteAdEventInput {
  destinationUrl?: string;
}

interface RemoteAdFeedbackInput extends RemoteAdEventInput {
  action: RemoteAdFeedbackAction;
  reason?: string;
}

async function insertRemoteAdRecord(table: 'ad_impressions' | 'ad_clicks' | 'ad_feedback', payload: Record<string, unknown>) {
  if (!supabase) {
    return;
  }

  const userId = await getRemoteUserId();
  if (!userId) {
    return;
  }

  const { error } = await supabase.from(table).insert({
    user_id: userId,
    ...payload,
  });

  if (error) {
    throw error;
  }
}

function getAdAnalyticsProperties(input: RemoteAdEventInput) {
  return {
    campaignId: input.campaignId,
    placement: input.placement,
    provider: input.provider ?? 'sponsor_direct',
    schoolId: input.schoolId,
  };
}

export async function recordRemoteAdImpression(input: RemoteAdEventInput) {
  await recordRemoteAnalyticsEvent('ad_impression', getAdAnalyticsProperties(input)).catch(() => undefined);
  await insertRemoteAdRecord('ad_impressions', {
    campaign_id: input.campaignId ?? null,
    placement: input.placement,
    provider: input.provider ?? 'sponsor_direct',
    school_id: input.schoolId || null,
  }).catch(() => undefined);
}

export async function recordRemoteAdClick(input: RemoteAdClickInput) {
  await recordRemoteAnalyticsEvent('ad_click', {
    ...getAdAnalyticsProperties(input),
    destinationUrl: input.destinationUrl,
  }).catch(() => undefined);
  await insertRemoteAdRecord('ad_clicks', {
    campaign_id: input.campaignId ?? null,
    destination_url: input.destinationUrl ?? null,
    placement: input.placement,
    provider: input.provider ?? 'sponsor_direct',
    school_id: input.schoolId || null,
  }).catch(() => undefined);
}

export async function recordRemoteAdFeedback(input: RemoteAdFeedbackInput) {
  await recordRemoteAnalyticsEvent('ad_feedback', {
    ...getAdAnalyticsProperties(input),
    action: input.action,
    reason: input.reason,
  }).catch(() => undefined);
  await insertRemoteAdRecord('ad_feedback', {
    action: input.action,
    campaign_id: input.campaignId ?? null,
    placement: input.placement,
    provider: input.provider ?? 'sponsor_direct',
    reason: input.reason ?? null,
    school_id: input.schoolId || null,
  }).catch(() => undefined);
}
