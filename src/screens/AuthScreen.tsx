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
  KeyRound,
  LockKeyhole,
  Search,
  Smartphone,
  UserRound,
} from 'lucide-react-native';

import { BrandLogo } from '../components/BrandLogo';
import { Card } from '../components/Card';
import { LegalPolicyModal } from '../components/LegalPolicyModal';
import { PrimaryButton } from '../components/PrimaryButton';
import { Screen } from '../components/Screen';
import { searchSchoolsByName } from '../services/neis';
import { colors, fonts, radii, spacing, typography } from '../theme';
import { useAppState } from '../state/AppStateContext';
import { School } from '../types';
import { getFriendlyErrorMessage } from '../utils/errorMessages';
import { formatClassName, formatPhoneNumberInput, isValidKoreanMobileNumber, normalizeKoreanMobileNumber } from '../utils/profile';

type AuthMode = 'signin' | 'signup';
type SignupStep = 'account' | 'profile';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const minimumPasswordLength = 8;
const normalizeSchoolKeyword = (value: string) => value.replace(/\s/g, '').toLowerCase();
const signupSteps: { key: SignupStep; title: string }[] = [
  { key: 'account', title: '이메일' },
  { key: 'profile', title: '본인 확인' },
];

function mergeSchools(schoolLists: School[][]) {
  const seen = new Set<string>();
  const merged: School[] = [];

  schoolLists.flat().forEach((school) => {
    const name = getSchoolDisplayName(school);
    if (!name) {
      return;
    }

    const key = school.schoolCode || school.id || name;
    if (!key || seen.has(key)) {
      return;
    }

    seen.add(key);
    merged.push({ ...school, name });
  });

  return merged;
}

function getSchoolDisplayName(school: School | null | undefined) {
  return school?.name?.trim() ?? '';
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
  const [mode, setMode] = useState<AuthMode>('signup');
  const [signupStep, setSignupStep] = useState<SignupStep>('account');
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [name, setName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [grade, setGrade] = useState(1);
  const [className, setClassName] = useState('');
  const [schoolId, setSchoolId] = useState(schools[0]?.id ?? '');
  const [schoolQuery, setSchoolQuery] = useState('');
  const [selectedSchoolDraft, setSelectedSchoolDraft] = useState<School | null>(schools[0] ?? null);
  const [remoteSchools, setRemoteSchools] = useState<School[]>([]);
  const [schoolSearchLoading, setSchoolSearchLoading] = useState(false);
  const [schoolSearchError, setSchoolSearchError] = useState<string | null>(null);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [loginIdTouched, setLoginIdTouched] = useState(false);
  const [legalVisible, setLegalVisible] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [passwordConfirmTouched, setPasswordConfirmTouched] = useState(false);
  const [phoneTouched, setPhoneTouched] = useState(false);

  const showSignupWizard = mode === 'signup' && !needsProfile;
  const signupStepIndex = signupSteps.findIndex((step) => step.key === signupStep);
  const collectingProfile = needsProfile || (showSignupWizard && signupStep === 'profile');
  const normalizedLoginId = loginId.trim().toLowerCase();
  const emailReady = emailPattern.test(normalizedLoginId);
  const signInPasswordReady = password.length > 0;
  const passwordCriteria = useMemo(
    () => [
      { key: 'length', label: `${minimumPasswordLength}자 이상`, met: password.length >= minimumPasswordLength },
      { key: 'letter', label: '영문 포함', met: /[A-Za-z]/.test(password) },
      { key: 'number', label: '숫자 포함', met: /\d/.test(password) },
    ],
    [password],
  );
  const signupPasswordReady = passwordCriteria.every((criterion) => criterion.met);
  const passwordConfirmReady = Boolean(passwordConfirm) && passwordConfirm === password;
  const phoneReady = isValidKoreanMobileNumber(phoneNumber);
  const accountStepReady = emailReady && signupPasswordReady && passwordConfirmReady;
  const displayAuthError = formatAuthMessage(authError);
  const pageTitle = needsProfile
    ? '프로필 입력'
    : mode === 'signin'
      ? '로그인'
      : '회원가입';
  const pageSubtitle = needsProfile
    ? '프로필 정보를 입력하세요.'
    : mode === 'signin'
      ? '이메일과 비밀번호를 입력하세요.'
      : signupStep === 'account'
        ? '이메일과 비밀번호를 입력하세요.'
        : '프로필 정보를 입력하세요.';
  const submitLabel = needsProfile ? '저장' : mode === 'signin' ? '로그인' : signupStep === 'profile' ? '가입 완료' : '다음';
  const showLoginIdError = mode === 'signup' && loginIdTouched && Boolean(loginId.trim()) && !emailReady;
  const showPasswordError = mode === 'signup' && passwordTouched && Boolean(password) && !signupPasswordReady;
  const showPasswordConfirmError = mode === 'signup' && passwordConfirmTouched && Boolean(passwordConfirm) && !passwordConfirmReady;
  const showPhoneError = collectingProfile && phoneTouched && Boolean(phoneNumber.trim()) && !phoneReady;
  const localSchoolMatches = useMemo(() => {
    const query = normalizeSchoolKeyword(schoolQuery);
    if (!query) {
      return schools.filter((school) => getSchoolDisplayName(school)).slice(0, 12);
    }

    return schools
      .filter((school) => {
        const schoolName = getSchoolDisplayName(school);
        return Boolean(schoolName) && normalizeSchoolKeyword(`${schoolName}${school.region}${school.officeCode}${school.schoolCode}`).includes(query);
      })
      .slice(0, 20);
  }, [schoolQuery, schools]);
  const schoolOptions = useMemo(() => {
    if (!schoolQuery.trim()) {
      const selected = [selectedSchoolDraft].filter((school): school is School => Boolean(school && getSchoolDisplayName(school)));
      return selected.length ? selected : localSchoolMatches.slice(0, 3);
    }

    return mergeSchools([localSchoolMatches, remoteSchools]).slice(0, 6);
  }, [localSchoolMatches, remoteSchools, schoolQuery, selectedSchoolDraft]);
  const selectedSchool =
    selectedSchoolDraft?.id === schoolId
      ? selectedSchoolDraft
      : schoolOptions.find((school) => school.id === schoolId) ?? schools.find((school) => school.id === schoolId);
  const selectedSchoolName = getSchoolDisplayName(selectedSchool);
  const selectedSchoolId = selectedSchoolName ? selectedSchool?.id ?? '' : '';
  const showSchoolSearchHint = collectingProfile && schoolQuery.trim().length === 1;
  const showNoSchoolResults =
    collectingProfile && schoolQuery.trim().length >= 2 && !schoolSearchLoading && !schoolSearchError && schoolOptions.length === 0;
  const showSchoolOptions = collectingProfile && schoolQuery.trim().length >= 2 && schoolOptions.length > 0;
  const profileStepReady = Boolean(name.trim() && phoneReady && className.trim() && selectedSchool && selectedSchoolName && acceptedTerms);
  const signupReady = accountStepReady && profileStepReady;
  const canSubmit = useMemo(() => {
    if (authLoading) {
      return false;
    }

    if (needsProfile) {
      return profileStepReady;
    }

    if (mode === 'signin') {
      return Boolean(normalizedLoginId && signInPasswordReady);
    }

    if (signupStep === 'account') {
      return accountStepReady;
    }

    return signupReady;
  }, [
    accountStepReady,
    authLoading,
    mode,
    needsProfile,
    normalizedLoginId,
    profileStepReady,
    signInPasswordReady,
    signupReady,
    signupStep,
  ]);

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
            setSchoolSearchError('학교 검색에 실패했어요. 학교명을 다시 입력해 주세요.');
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
    const buildProfileInput = () => ({
      name: name.trim(),
      phoneNumber: normalizeKoreanMobileNumber(phoneNumber),
      schoolId: selectedSchool?.id ?? selectedSchoolId,
      school: selectedSchool,
      grade,
      className: formatClassName(className),
    });

    if (needsProfile) {
      await completeProfile(buildProfileInput());
      return;
    }

    if (mode === 'signin') {
      await signIn(normalizedLoginId, password);
      return;
    }

    await signUp(normalizedLoginId, password, buildProfileInput());
  };

  const goToNextSignupStep = () => {
    const nextStep = signupSteps[signupStepIndex + 1];
    if (nextStep) {
      setSignupStep(nextStep.key);
    }
  };

  const goToPreviousSignupStep = () => {
    const previousStep = signupSteps[signupStepIndex - 1];
    if (previousStep) {
      setSignupStep(previousStep.key);
    }
  };

  const handlePrimaryAction = async () => {
    if (showSignupWizard && signupStep !== 'profile') {
      goToNextSignupStep();
      return;
    }

    await submit();
  };

  const switchMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setSignupStep('account');
    setLoginIdTouched(false);
    setPasswordTouched(false);
    setPasswordConfirmTouched(false);
    setPhoneTouched(false);
    setPasswordConfirm('');
  };

  const selectSchool = (school: School) => {
    setSchoolId(school.id);
    setSelectedSchoolDraft(school);
    setSchoolQuery(getSchoolDisplayName(school));
  };

  const updateLoginId = (value: string) => {
    setLoginId(value.replace(/\s/g, '').toLowerCase());
  };

  const authFormKey = needsProfile ? 'needs-profile' : mode === 'signin' ? 'signin' : signupStep;

  return (
    <Screen backgroundColor={colors.background} contentStyle={styles.screenContent}>
      <View style={[styles.shell, isWide ? styles.shellWide : null]}>
        <View style={[styles.hero, isWide ? styles.heroWide : null]}>
          <View style={styles.logo}>
            <BrandLogo width={126} />
          </View>
          <View style={styles.heroCopy}>
            <Text style={styles.heroTitle}>{pageTitle}</Text>
            <Text style={styles.heroSubtitle}>{pageSubtitle}</Text>
          </View>
        </View>

        <Card style={[styles.authCard, isWide ? styles.authCardWide : null]}>
          {showSignupWizard ? (
            <SignupStepStrip currentStep={signupStep} />
          ) : null}

          <View key={authFormKey} style={styles.animatedForm}>
            {!needsProfile && (mode === 'signin' || signupStep === 'account') ? (
              <View style={styles.formSection}>
                <LabeledInput
                  autoCapitalize="none"
                  autoComplete="email"
                  icon={<UserRound color={colors.muted} size={18} />}
                  keyboardType="email-address"
                  label="이메일"
                  onBlur={() => setLoginIdTouched(true)}
                  onChangeText={updateLoginId}
                  placeholder="예: name@example.com"
                  returnKeyType="next"
                  textContentType="emailAddress"
                  value={loginId}
                />
                {showLoginIdError ? <FieldMessage text="이메일 형식을 확인해 주세요." tone="danger" /> : null}

                <LabeledInput
                  autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                  icon={<LockKeyhole color={colors.muted} size={18} />}
                  label="비밀번호"
                  onBlur={() => setPasswordTouched(true)}
                  onChangeText={setPassword}
                  placeholder={mode === 'signin' ? '비밀번호' : '영문+숫자 8자 이상'}
                  returnKeyType={mode === 'signin' ? 'done' : 'next'}
                  secureTextEntry
                  textContentType={mode === 'signin' ? 'password' : 'newPassword'}
                  value={password}
                />
                {mode === 'signup' ? (
                  <View style={styles.criteriaList}>
                    {passwordCriteria.map((criterion) => (
                      <View key={criterion.key} style={styles.criteriaItem}>
                        <CheckCircle2 color={criterion.met ? colors.success : colors.disabled} size={14} />
                        <Text style={[styles.criteriaText, criterion.met ? styles.criteriaTextActive : null]}>{criterion.label}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}
                {showPasswordError ? <FieldMessage text="비밀번호 기준을 모두 충족해 주세요." tone="danger" /> : null}

                {mode === 'signup' ? (
                  <>
                    <LabeledInput
                      autoComplete="new-password"
                      icon={<KeyRound color={colors.muted} size={18} />}
                      label="비밀번호 확인"
                      onBlur={() => setPasswordConfirmTouched(true)}
                      onChangeText={setPasswordConfirm}
                      placeholder="비밀번호를 다시 입력"
                      returnKeyType="next"
                      secureTextEntry
                      textContentType="newPassword"
                      value={passwordConfirm}
                    />
                    {showPasswordConfirmError ? <FieldMessage text="비밀번호가 일치하지 않아요." tone="danger" /> : null}
                    {passwordConfirmReady ? <FieldMessage text="비밀번호가 일치해요." tone="success" /> : null}
                  </>
                ) : null}
              </View>
            ) : null}

            {collectingProfile ? (
              <View style={styles.formSection}>
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

                <LabeledInput
                  autoComplete="tel"
                  icon={<Smartphone color={colors.muted} size={18} />}
                  keyboardType="phone-pad"
                  label="휴대폰 번호"
                  maxLength={13}
                  onBlur={() => setPhoneTouched(true)}
                  onChangeText={(value) => setPhoneNumber(formatPhoneNumberInput(value))}
                  placeholder="010-1234-5678"
                  returnKeyType="next"
                  textContentType="telephoneNumber"
                  value={phoneNumber}
                />
                {showPhoneError ? <FieldMessage text="010으로 시작하는 11자리 번호를 입력해 주세요." tone="danger" /> : null}
                {phoneReady ? <FieldMessage text="휴대폰 번호는 중복 가입 방지에만 사용해요." tone="success" /> : null}

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

              {selectedSchool && selectedSchoolName ? (
                <View style={styles.selectedSchool}>
                  <CheckCircle2 color={colors.primary} size={17} />
                  <Text style={styles.selectedSchoolText}>{selectedSchoolName}</Text>
                  <Text style={styles.selectedSchoolRegion}>{selectedSchool.region}</Text>
                </View>
              ) : null}

              {showSchoolSearchHint ? <Text style={styles.schoolSearchMeta}>학교명을 2글자 이상 입력해 주세요.</Text> : null}
              {schoolSearchError ? <FieldMessage text={schoolSearchError} tone="danger" /> : null}
              {showNoSchoolResults ? <FieldMessage text="검색 결과가 없어요." tone="danger" /> : null}

              {showSchoolOptions ? (
                <View style={styles.schoolList}>
                  {schoolOptions.map((school) => {
                    const active = selectedSchoolId === school.id;
                    const schoolName = getSchoolDisplayName(school);
                    return (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                        key={school.id}
                        onPress={() => selectSchool(school)}
                        style={({ pressed }) => [styles.schoolChip, active ? styles.schoolChipActive : null, pressed && !active ? styles.schoolChipPressed : null]}
                      >
                        <View style={styles.schoolChipCopy}>
                          <Text numberOfLines={1} style={[styles.schoolChipText, active ? styles.schoolChipTextActive : null]}>
                            {schoolName}
                          </Text>
                          <Text style={[styles.schoolChipRegion, active ? styles.schoolChipRegionActive : null]}>{school.region}</Text>
                        </View>
                        {active ? <Check color={colors.primary} size={14} /> : null}
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}
              {!schools.length ? <FieldMessage text="학교 목록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요." tone="danger" /> : null}

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
                        style={({ pressed }) => [styles.gradeChip, grade === value ? styles.gradeChipActive : null, pressed && grade !== value ? styles.gradeChipPressed : null]}
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
                  style={({ pressed }) => [styles.termsRow, pressed ? styles.termsRowPressed : null]}
                >
                  <View style={[styles.checkbox, acceptedTerms ? styles.checkboxActive : null]}>
                    {acceptedTerms ? <Check color={colors.surface} size={15} /> : null}
                  </View>
                  <Text style={styles.termsText}>약관 및 개인정보 처리방침에 동의해요.</Text>
                </Pressable>
                <Pressable accessibilityRole="button" onPress={() => setLegalVisible(true)} style={styles.legalLink}>
                  <Text style={styles.legalLinkText}>자세히 보기</Text>
                </Pressable>
              </View>
              </View>
            ) : null}
          </View>

          {displayAuthError ? <FeedbackBox text={displayAuthError} tone="danger" /> : null}
          {authNotice ? <FeedbackBox text={authNotice} tone="notice" /> : null}

          <View style={showSignupWizard && signupStepIndex > 0 ? styles.actionRow : null}>
            {showSignupWizard && signupStepIndex > 0 ? (
              <PrimaryButton
                disabled={authLoading}
                label="이전"
                onPress={goToPreviousSignupStep}
                style={styles.actionButton}
                variant="secondary"
              />
            ) : null}
            <PrimaryButton
              disabled={!canSubmit}
              icon={authLoading ? <ActivityIndicator color={colors.surface} /> : undefined}
              label={submitLabel}
              onPress={handlePrimaryAction}
              style={showSignupWizard && signupStepIndex > 0 ? styles.actionButton : styles.submit}
            />
          </View>
          {!needsProfile ? (
            <View style={styles.authSwitch}>
              <Text style={styles.authSwitchText}>{mode === 'signup' ? '이미 가입했어요' : '처음이에요'}</Text>
              <Pressable accessibilityRole="button" hitSlop={8} onPress={() => switchMode(mode === 'signup' ? 'signin' : 'signup')}>
                <Text style={styles.authSwitchLink}>{mode === 'signup' ? '로그인' : '회원가입'}</Text>
              </Pressable>
            </View>
          ) : null}
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

  return getFriendlyErrorMessage(message, message);
}

function SignupStepStrip({ currentStep }: { currentStep: SignupStep }) {
  const currentIndex = signupSteps.findIndex((step) => step.key === currentStep);
  const currentTitle = signupSteps[currentIndex]?.title ?? '';

  return (
    <View style={styles.progressBlock}>
      <View style={styles.progressMeta}>
        <Text style={styles.progressStep}>{currentIndex + 1}/{signupSteps.length}</Text>
        <Text style={styles.progressTitle}>{currentTitle}</Text>
      </View>
      <View style={styles.progressTrack}>
        {signupSteps.map((step, index) => (
          <View
            key={step.key}
            style={[styles.progressSegment, index <= currentIndex ? styles.progressSegmentActive : null]}
          />
        ))}
      </View>
    </View>
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
  return <Text selectable style={[styles.fieldMessage, tone === 'danger' ? styles.fieldMessageDanger : styles.fieldMessageSuccess]}>{text}</Text>;
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
  actionButton: {
    flex: 1,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  animatedForm: {
    gap: spacing.sm,
  },
  authCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    boxShadow: '0 1px 0 rgba(14, 21, 17, 0.02)',
    gap: spacing.md,
    padding: spacing.lg,
  },
  authCardWide: {
    flexGrow: 0,
    flexShrink: 0,
    maxWidth: 420,
    width: 420,
  },
  authSwitch: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
    justifyContent: 'center',
    paddingTop: spacing.xs,
  },
  authSwitchLink: {
    color: colors.primary,
    fontFamily: fonts.semibold,
    fontSize: typography.small,
    fontWeight: '600',
    lineHeight: 19,
  },
  authSwitchText: {
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: typography.small,
    lineHeight: 19,
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
  criteriaItem: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  criteriaList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  criteriaText: {
    color: colors.subtle,
    fontFamily: fonts.semibold,
    fontSize: typography.tiny,
    fontWeight: '600',
    lineHeight: 17,
  },
  criteriaTextActive: {
    color: colors.success,
  },
  feedbackBox: {
    borderRadius: radii.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  feedbackDanger: {
    backgroundColor: colors.dangerSoft,
    borderColor: colors.border,
  },
  feedbackNotice: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.border,
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
  gradeChipPressed: {
    backgroundColor: colors.surfacePressed,
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
  hero: {
    gap: spacing.md,
    paddingTop: spacing.lg,
  },
  heroCopy: {
    gap: spacing.xs,
  },
  heroTitle: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: 27,
    fontWeight: '700',
    lineHeight: 36,
  },
  heroSubtitle: {
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: typography.body,
    lineHeight: 23,
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
    backgroundColor: colors.surface,
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
    alignItems: 'flex-start',
    height: 64,
    justifyContent: 'center',
    width: 132,
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
    alignSelf: 'stretch',
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 50,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    width: '100%',
  },
  schoolChipActive: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  schoolChipCopy: {
    flex: 1,
    minWidth: 0,
  },
  schoolChipPressed: {
    backgroundColor: colors.surfacePressed,
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
    gap: spacing.sm,
  },
  schoolSearchMeta: {
    color: colors.subtle,
    fontFamily: fonts.regular,
    fontSize: typography.tiny,
    lineHeight: 17,
  },
  screenContent: {
    flexGrow: 1,
    maxWidth: 1040,
    paddingBottom: 42,
    paddingHorizontal: 28,
    paddingTop: 34,
  },
  selectedSchool: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
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
  progressBlock: {
    gap: spacing.sm,
  },
  progressMeta: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  progressSegment: {
    backgroundColor: colors.dividerSoft,
    borderRadius: radii.pill,
    flex: 1,
    height: 6,
  },
  progressSegmentActive: {
    backgroundColor: colors.primary,
  },
  progressStep: {
    color: colors.subtle,
    fontFamily: fonts.semibold,
    fontSize: typography.small,
    fontWeight: '600',
    lineHeight: 19,
  },
  progressTitle: {
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: typography.small,
    fontWeight: '600',
    lineHeight: 19,
    textAlign: 'right',
  },
  progressTrack: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  submit: {
    marginTop: spacing.xs,
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
  termsRowPressed: {
    backgroundColor: colors.surfacePressed,
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
});
