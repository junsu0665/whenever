import React, { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  type TextInputProps,
} from 'react-native';
import {
  Check,
  CheckCircle2,
  GraduationCap,
  LockKeyhole,
  Mail,
  Search,
  UserRound,
} from 'lucide-react-native';

import { Card } from '../components/Card';
import { LegalPolicyModal } from '../components/LegalPolicyModal';
import { PrimaryButton } from '../components/PrimaryButton';
import { Screen } from '../components/Screen';
import { searchSchoolsByName } from '../services/neis';
import { colors, fonts, radii, spacing, typography } from '../theme';
import { useAppState } from '../state/AppStateContext';
import { School } from '../types';
import { formatClassName } from '../utils/profile';

type AuthMode = 'signin' | 'signup';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const normalizeSchoolKeyword = (value: string) => value.replace(/\s/g, '').toLowerCase();

function mergeSchools(schoolLists: School[][]) {
  const seen = new Set<string>();
  const merged: School[] = [];

  schoolLists.flat().forEach((school) => {
    const key = school.schoolCode || school.id;
    if (!key || seen.has(key)) {
      return;
    }

    seen.add(key);
    merged.push(school);
  });

  return merged;
}

export function AuthScreen() {
  const {
    authError,
    authLoading,
    authNotice,
    completeProfile,
    needsProfile,
    schools,
    signIn,
    signUp,
  } = useAppState();
  const { width } = useWindowDimensions();
  const isWide = width >= 760;
  const [mode, setMode] = useState<AuthMode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [grade, setGrade] = useState(1);
  const [className, setClassName] = useState('');
  const [schoolId, setSchoolId] = useState(schools[0]?.id ?? '');
  const [schoolQuery, setSchoolQuery] = useState('');
  const [selectedSchoolDraft, setSelectedSchoolDraft] = useState<School | null>(schools[0] ?? null);
  const [remoteSchools, setRemoteSchools] = useState<School[]>([]);
  const [schoolSearchLoading, setSchoolSearchLoading] = useState(false);
  const [schoolSearchError, setSchoolSearchError] = useState<string | null>(null);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);
  const [legalVisible, setLegalVisible] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);

  const collectingProfile = mode === 'signup' || needsProfile;
  const normalizedEmail = email.trim().toLowerCase();
  const emailReady = emailPattern.test(normalizedEmail);
  const passwordReady = password.length >= 6;
  const displayAuthError = formatAuthMessage(authError);
  const pageTitle = needsProfile ? '프로필 입력' : mode === 'signin' ? '로그인' : '회원가입';
  const pageDescription = needsProfile
    ? '이름, 학교, 학년, 반을 입력해 주세요.'
    : mode === 'signin'
      ? '이메일과 비밀번호를 입력해 주세요.'
      : '이메일과 비밀번호를 입력해 주세요.';
  const submitLabel = needsProfile ? '프로필 저장' : mode === 'signin' ? '로그인' : '회원가입';
  const showEmailError = emailTouched && Boolean(email.trim()) && !emailReady;
  const showPasswordError = passwordTouched && Boolean(password) && !passwordReady;
  const localSchoolMatches = useMemo(() => {
    const query = normalizeSchoolKeyword(schoolQuery);
    if (!query) {
      return schools.slice(0, 12);
    }

    return schools
      .filter((school) => normalizeSchoolKeyword(`${school.name}${school.region}${school.officeCode}${school.schoolCode}`).includes(query))
      .slice(0, 20);
  }, [schoolQuery, schools]);
  const schoolOptions = useMemo(() => {
    if (!schoolQuery.trim()) {
      return mergeSchools([[selectedSchoolDraft].filter((school): school is School => Boolean(school)), localSchoolMatches]).slice(0, 12);
    }

    return mergeSchools([localSchoolMatches, remoteSchools]).slice(0, 24);
  }, [localSchoolMatches, remoteSchools, schoolQuery, selectedSchoolDraft]);
  const selectedSchool =
    selectedSchoolDraft?.id === schoolId
      ? selectedSchoolDraft
      : schoolOptions.find((school) => school.id === schoolId) ?? schools.find((school) => school.id === schoolId);
  const selectedSchoolId = selectedSchool?.id ?? '';
  const showSchoolSearchHint = collectingProfile && schoolQuery.trim().length === 1;
  const showNoSchoolResults =
    collectingProfile && schoolQuery.trim().length >= 2 && !schoolSearchLoading && !schoolSearchError && schoolOptions.length === 0;
  const canSubmit = useMemo(() => {
    if (authLoading) {
      return false;
    }

    if (needsProfile) {
      return Boolean(name.trim() && className.trim() && selectedSchool && acceptedTerms);
    }

    if (mode === 'signin') {
      return Boolean(emailReady && passwordReady);
    }

    return Boolean(emailReady && passwordReady && name.trim() && className.trim() && selectedSchool && acceptedTerms);
  }, [acceptedTerms, authLoading, className, emailReady, mode, name, needsProfile, passwordReady, selectedSchool]);

  useEffect(() => {
    if (!schools.length || schools.some((school) => school.id === schoolId) || selectedSchoolDraft?.id === schoolId) {
      return;
    }

    setSchoolId(schools[0].id);
    setSelectedSchoolDraft(schools[0]);
  }, [schoolId, schools, selectedSchoolDraft]);

  useEffect(() => {
    if (!collectingProfile) {
      return;
    }

    const query = schoolQuery.trim();
    setSchoolSearchError(null);

    if (query.length < 2) {
      setRemoteSchools([]);
      setSchoolSearchLoading(false);
      return;
    }

    let canceled = false;
    const timer = setTimeout(() => {
      setSchoolSearchLoading(true);
      searchSchoolsByName(query)
        .then((results) => {
          if (!canceled) {
            setRemoteSchools(results);
          }
        })
        .catch(() => {
          if (!canceled) {
            setRemoteSchools([]);
            setSchoolSearchError('학교 검색에 실패했습니다. 학교명을 다시 입력해 주세요.');
          }
        })
        .finally(() => {
          if (!canceled) {
            setSchoolSearchLoading(false);
          }
        });
    }, 280);

    return () => {
      canceled = true;
      clearTimeout(timer);
    };
  }, [collectingProfile, schoolQuery]);

  const submit = async () => {
    const profileInput = {
      name: name.trim(),
      schoolId: selectedSchool?.id ?? selectedSchoolId,
      school: selectedSchool,
      grade,
      className: formatClassName(className),
    };

    if (needsProfile) {
      await completeProfile(profileInput);
      return;
    }

    if (mode === 'signin') {
      await signIn(normalizedEmail, password);
      return;
    }

    await signUp(normalizedEmail, password, profileInput);
  };

  const switchMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setPasswordTouched(false);
  };

  const selectSchool = (school: School) => {
    setSchoolId(school.id);
    setSelectedSchoolDraft(school);
    setSchoolQuery(school.name);
  };

  return (
    <Screen>
      <View style={[styles.shell, isWide ? styles.shellWide : null]}>
        <View style={[styles.hero, isWide ? styles.heroWide : null]}>
          <View style={styles.brandLockup}>
            <View style={styles.logo}>
              <GraduationCap color={colors.primary} size={30} strokeWidth={2.15} />
            </View>
            <View>
              <Text style={styles.brand}>웨네버</Text>
              <Text style={styles.brandMeta}>학교 인증 기반 커뮤니티</Text>
            </View>
          </View>

          <View style={styles.heroCopy}>
            <Text style={styles.heroTitle}>학교 생활을 한 곳에서.</Text>
            <Text style={styles.subtitle}>시간표, 급식, 게시판을 빠르게 확인하세요.</Text>
          </View>
        </View>

        <Card style={[styles.authCard, isWide ? styles.authCardWide : null]}>
          <View style={styles.cardHeader}>
            <View style={styles.headerIcon}>
              {authLoading ? <ActivityIndicator color={colors.primary} /> : <LockKeyhole color={colors.primary} size={22} />}
            </View>
            <View style={styles.headerCopy}>
              <Text style={styles.cardTitle}>{pageTitle}</Text>
              <Text style={styles.cardDescription}>{pageDescription}</Text>
            </View>
          </View>

          {!needsProfile ? (
            <View style={styles.modeTabs}>
              <ModeTab active={mode === 'signin'} label="로그인" onPress={() => switchMode('signin')} />
              <ModeTab active={mode === 'signup'} label="회원가입" onPress={() => switchMode('signup')} />
            </View>
          ) : null}

          {!needsProfile ? (
            <View style={styles.formSection}>
              <LabeledInput
                autoCapitalize="none"
                autoComplete="email"
                icon={<Mail color={colors.muted} size={18} />}
                keyboardType="email-address"
                label="이메일"
                onBlur={() => setEmailTouched(true)}
                onChangeText={setEmail}
                placeholder="student@example.com"
                returnKeyType="next"
                textContentType="emailAddress"
                value={email}
              />
              {showEmailError ? <FieldMessage text="이메일 형식을 확인해 주세요." tone="danger" /> : null}

              <LabeledInput
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                icon={<LockKeyhole color={colors.muted} size={18} />}
                label="비밀번호"
                onBlur={() => setPasswordTouched(true)}
                onChangeText={setPassword}
                placeholder="6자 이상"
                returnKeyType={mode === 'signin' ? 'done' : 'next'}
                secureTextEntry
                textContentType={mode === 'signin' ? 'password' : 'newPassword'}
                value={password}
              />
              {showPasswordError ? <FieldMessage text="비밀번호는 6자 이상이어야 합니다." tone="danger" /> : null}
              {mode === 'signup' && passwordReady ? <FieldMessage text="사용 가능한 비밀번호입니다." tone="success" /> : null}
            </View>
          ) : null}

          {collectingProfile ? (
            <View style={styles.formSection}>
              <View style={styles.sectionTitleRow}>
                <Text style={styles.sectionTitle}>학교 프로필</Text>
              </View>

              <LabeledInput
                autoComplete="name"
                icon={<UserRound color={colors.muted} size={18} />}
                label="이름"
                onChangeText={setName}
                placeholder="실명"
                returnKeyType="next"
                textContentType="name"
                value={name}
              />

              <View style={styles.inputBlock}>
                <Text style={styles.label}>학교</Text>
                <View style={styles.inputWrap}>
                  <Search color={colors.muted} size={18} />
                  <TextInput
                    onChangeText={setSchoolQuery}
                    placeholder="학교명 검색"
                    placeholderTextColor={colors.disabled}
                    style={styles.input}
                    value={schoolQuery}
                  />
                  {schoolSearchLoading ? <ActivityIndicator color={colors.primary} /> : null}
                </View>
              </View>

              {selectedSchool ? (
                <View style={styles.selectedSchool}>
                  <CheckCircle2 color={colors.primary} size={17} />
                  <Text style={styles.selectedSchoolText}>{selectedSchool.name}</Text>
                  <Text style={styles.selectedSchoolRegion}>{selectedSchool.region}</Text>
                </View>
              ) : null}

              {showSchoolSearchHint ? <Text style={styles.schoolSearchMeta}>학교명을 2글자 이상 입력해 주세요.</Text> : null}
              {schoolSearchError ? <FieldMessage text={schoolSearchError} tone="danger" /> : null}
              {showNoSchoolResults ? <FieldMessage text="검색 결과가 없습니다." tone="danger" /> : null}

              <View style={styles.schoolList}>
                {schoolOptions.map((school) => {
                  const active = selectedSchoolId === school.id;
                  return (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      key={school.id}
                      onPress={() => selectSchool(school)}
                      style={[styles.schoolChip, active ? styles.schoolChipActive : null]}
                    >
                      <View style={styles.schoolChipCopy}>
                        <Text numberOfLines={1} style={[styles.schoolChipText, active ? styles.schoolChipTextActive : null]}>
                          {school.name}
                        </Text>
                        <Text style={[styles.schoolChipRegion, active ? styles.schoolChipRegionActive : null]}>{school.region}</Text>
                      </View>
                      {active ? <Check color={colors.primary} size={14} /> : null}
                    </Pressable>
                  );
                })}
              </View>
              {!schools.length ? <FieldMessage text="운영 DB에 schools 데이터가 필요합니다." tone="danger" /> : null}

              <View style={styles.profileRow}>
                <View style={styles.gradeBlock}>
                  <Text style={styles.label}>학년</Text>
                  <View style={styles.profileGrid}>
                    {[1, 2, 3].map((value) => (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityState={{ selected: grade === value }}
                        key={value}
                        onPress={() => setGrade(value)}
                        style={[styles.gradeChip, grade === value ? styles.gradeChipActive : null]}
                      >
                        <Text style={[styles.gradeChipText, grade === value ? styles.gradeChipTextActive : null]}>{value}학년</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              </View>

              <LabeledInput label="반" onChangeText={setClassName} placeholder="예: 11 또는 11반" returnKeyType="done" value={className} />

              <View style={styles.termsBlock}>
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: acceptedTerms }}
                  hitSlop={8}
                  onPress={() => setAcceptedTerms(!acceptedTerms)}
                  style={styles.termsRow}
                >
                  <View style={[styles.checkbox, acceptedTerms ? styles.checkboxActive : null]}>
                    {acceptedTerms ? <Check color={colors.surface} size={15} /> : null}
                  </View>
                  <Text style={styles.termsText}>서비스 약관, 개인정보 처리방침, 학생증 이미지 보관 정책에 동의합니다.</Text>
                </Pressable>
                <Pressable accessibilityRole="button" onPress={() => setLegalVisible(true)} style={styles.legalLink}>
                  <Text style={styles.legalLinkText}>약관과 개인정보 처리방침 보기</Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          {displayAuthError ? <FeedbackBox text={displayAuthError} tone="danger" /> : null}
          {authNotice ? <FeedbackBox text={authNotice} tone="notice" /> : null}

          <PrimaryButton
            disabled={!canSubmit}
            icon={authLoading ? <ActivityIndicator color={colors.surface} /> : undefined}
            label={submitLabel}
            onPress={submit}
            style={styles.submit}
          />
        </Card>
      </View>
      <LegalPolicyModal onClose={() => setLegalVisible(false)} visible={legalVisible} />
    </Screen>
  );
}

function formatAuthMessage(message: string | null) {
  if (!message) {
    return null;
  }

  if (/failed to fetch|fetch failed|network request failed/i.test(message)) {
    return '서버에 연결하지 못했습니다. 네트워크 상태를 확인한 뒤 다시 시도해 주세요.';
  }

  return message;
}

function ModeTab({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: active }} onPress={onPress} style={[styles.modeTab, active ? styles.modeTabActive : null]}>
      <Text style={[styles.modeTabText, active ? styles.modeTabTextActive : null]}>{label}</Text>
    </Pressable>
  );
}

function LabeledInput({
  icon,
  label,
  onBlur,
  onFocus,
  style,
  ...props
}: TextInputProps & {
  icon?: ReactNode;
  label: string;
}) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.inputBlock}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.inputWrap, focused ? styles.inputWrapFocused : null]}>
        {icon}
        <TextInput
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          placeholderTextColor={colors.disabled}
          style={[styles.input, style]}
          {...props}
        />
      </View>
    </View>
  );
}

function FieldMessage({ text, tone }: { text: string; tone: 'danger' | 'success' }) {
  return <Text style={[styles.fieldMessage, tone === 'danger' ? styles.fieldMessageDanger : styles.fieldMessageSuccess]}>{text}</Text>;
}

function FeedbackBox({ text, tone }: { text: string; tone: 'danger' | 'notice' }) {
  return (
    <View style={[styles.feedbackBox, tone === 'danger' ? styles.feedbackDanger : styles.feedbackNotice]}>
      <Text selectable style={[styles.feedbackText, tone === 'danger' ? styles.feedbackTextDanger : styles.feedbackTextNotice]}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  authCard: {
    borderColor: '#D8E8FF',
    gap: spacing.md,
  },
  authCardWide: {
    flex: 1,
    maxWidth: 500,
  },
  brand: {
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: typography.h2,
    fontWeight: '600',
    lineHeight: 27,
  },
  brandLockup: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  brandMeta: {
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: typography.small,
    lineHeight: 20,
    marginTop: 1,
  },
  cardDescription: {
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: typography.small,
    lineHeight: 20,
    marginTop: 3,
  },
  cardHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.md,
  },
  cardTitle: {
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: typography.h2,
    fontWeight: '600',
    lineHeight: 27,
  },
  checkbox: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: 7,
    borderWidth: 1,
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
  checkboxActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  feedbackBox: {
    borderRadius: radii.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  feedbackDanger: {
    backgroundColor: colors.dangerSoft,
    borderColor: '#FFD2D9',
  },
  feedbackNotice: {
    backgroundColor: colors.primarySoft,
    borderColor: '#C9E0FF',
  },
  feedbackText: {
    fontFamily: fonts.semibold,
    fontSize: typography.small,
    fontWeight: '600',
    lineHeight: 20,
  },
  feedbackTextDanger: {
    color: colors.danger,
  },
  feedbackTextNotice: {
    color: colors.primary,
  },
  fieldMessage: {
    fontFamily: fonts.semibold,
    fontSize: typography.tiny,
    fontWeight: '600',
    lineHeight: 17,
    marginTop: -spacing.xs,
  },
  fieldMessageDanger: {
    color: colors.danger,
  },
  fieldMessageSuccess: {
    color: colors.success,
  },
  formSection: {
    gap: spacing.sm,
  },
  gradeBlock: {
    flex: 1,
  },
  gradeChip: {
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderRadius: radii.pill,
    borderWidth: 1,
    flex: 1,
    height: 40,
    justifyContent: 'center',
  },
  gradeChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  gradeChipText: {
    color: colors.muted,
    fontFamily: fonts.semibold,
    fontSize: typography.small,
    fontWeight: '600',
  },
  gradeChipTextActive: {
    color: colors.surface,
  },
  headerCopy: {
    flex: 1,
  },
  headerIcon: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderColor: '#C9E0FF',
    borderRadius: radii.md,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  hero: {
    gap: spacing.lg,
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.md,
  },
  heroCopy: {
    gap: spacing.sm,
  },
  heroTitle: {
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: 32,
    fontWeight: '600',
    lineHeight: 39,
  },
  heroWide: {
    flex: 1,
    maxWidth: 460,
    paddingTop: 0,
  },
  input: {
    color: colors.text,
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: typography.body,
    minHeight: 48,
    padding: 0,
  },
  inputBlock: {
    gap: spacing.xs,
  },
  inputWrap: {
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 52,
    paddingHorizontal: spacing.md,
  },
  inputWrapFocused: {
    backgroundColor: colors.surface,
    borderColor: colors.primary,
  },
  label: {
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: typography.small,
    fontWeight: '600',
    lineHeight: 19,
  },
  legalLink: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs,
  },
  legalLinkText: {
    color: colors.primary,
    fontFamily: fonts.semibold,
    fontSize: typography.small,
    fontWeight: '600',
    lineHeight: 19,
  },
  logo: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderColor: '#C9E0FF',
    borderRadius: radii.lg,
    borderWidth: 1,
    height: 58,
    justifyContent: 'center',
    width: 58,
  },
  modeTab: {
    alignItems: 'center',
    borderRadius: radii.pill,
    flex: 1,
    minHeight: 40,
    justifyContent: 'center',
  },
  modeTabActive: {
    backgroundColor: colors.surface,
    borderColor: '#D8E8FF',
    borderWidth: 1,
  },
  modeTabText: {
    color: colors.muted,
    fontFamily: fonts.semibold,
    fontSize: typography.small,
    fontWeight: '600',
  },
  modeTabTextActive: {
    color: colors.primary,
  },
  modeTabs: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.pill,
    flexDirection: 'row',
    gap: spacing.xs,
    padding: spacing.xs,
  },
  privacyNote: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderColor: '#C9E0FF',
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  privacyText: {
    color: colors.primaryDark,
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: typography.tiny,
    lineHeight: 17,
  },
  profileGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  profileRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  schoolChip: {
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 50,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  schoolChipActive: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  schoolChipCopy: {
    maxWidth: 190,
  },
  schoolChipRegion: {
    color: colors.subtle,
    fontFamily: fonts.regular,
    fontSize: typography.tiny,
    lineHeight: 16,
    marginTop: 1,
  },
  schoolChipRegionActive: {
    color: colors.primaryDark,
  },
  schoolChipText: {
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: typography.small,
    fontWeight: '600',
    lineHeight: 18,
  },
  schoolChipTextActive: {
    color: colors.primary,
  },
  schoolList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  schoolSearchMeta: {
    color: colors.subtle,
    fontFamily: fonts.regular,
    fontSize: typography.tiny,
    lineHeight: 17,
  },
  secureFooter: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
    justifyContent: 'center',
  },
  secureFooterText: {
    color: colors.subtle,
    flexShrink: 1,
    fontFamily: fonts.regular,
    fontSize: typography.tiny,
    lineHeight: 17,
    textAlign: 'center',
  },
  sectionCaption: {
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: typography.tiny,
    lineHeight: 17,
  },
  sectionTitle: {
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: typography.h3,
    fontWeight: '600',
    lineHeight: 22,
  },
  sectionTitleRow: {
    gap: 2,
    paddingTop: spacing.xs,
  },
  selectedSchool: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: '#D8E8FF',
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  selectedSchoolRegion: {
    color: colors.subtle,
    fontFamily: fonts.regular,
    fontSize: typography.tiny,
    marginLeft: 'auto',
  },
  selectedSchoolText: {
    color: colors.text,
    flex: 1,
    fontFamily: fonts.semibold,
    fontSize: typography.small,
    fontWeight: '600',
    lineHeight: 19,
  },
  shell: {
    alignSelf: 'center',
    gap: spacing.lg,
    maxWidth: 1040,
    width: '100%',
  },
  shellWide: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xxxl,
    justifyContent: 'center',
    minHeight: 680,
  },
  stepCaption: {
    color: colors.subtle,
    fontFamily: fonts.regular,
    fontSize: 11,
    lineHeight: 14,
  },
  stepCopy: {
    gap: 1,
  },
  stepIcon: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.pill,
    borderWidth: 1,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  stepIconActive: {
    backgroundColor: colors.primarySoft,
    borderColor: '#C9E0FF',
  },
  stepItem: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: spacing.xs,
    minHeight: 58,
    paddingHorizontal: spacing.sm,
  },
  stepItemActive: {
    borderColor: '#C9E0FF',
  },
  stepStrip: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  stepTitle: {
    color: colors.muted,
    fontFamily: fonts.semibold,
    fontSize: typography.tiny,
    fontWeight: '600',
    lineHeight: 16,
  },
  stepTitleActive: {
    color: colors.primary,
  },
  submit: {
    marginTop: spacing.xs,
  },
  subtitle: {
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: typography.body,
    lineHeight: 25,
  },
  termsRow: {
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
  },
  termsBlock: {
    gap: spacing.xs,
  },
  termsText: {
    color: colors.muted,
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: typography.small,
    lineHeight: 20,
  },
  trustCaption: {
    color: colors.subtle,
    fontFamily: fonts.regular,
    fontSize: typography.tiny,
    lineHeight: 17,
    marginTop: 2,
  },
  trustGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  trustIcon: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: radii.pill,
    height: 30,
    justifyContent: 'center',
    marginBottom: spacing.sm,
    width: 30,
  },
  trustItem: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    flex: 1,
    minWidth: 132,
    padding: spacing.md,
  },
  trustTitle: {
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: typography.small,
    fontWeight: '600',
    lineHeight: 19,
  },
});
