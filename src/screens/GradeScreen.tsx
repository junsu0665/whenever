import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { BarChart3, ChevronRight, ClipboardList, Flag, LockKeyhole, Plus, Trash2 } from 'lucide-react-native';

import { Card } from '../components/Card';
import { EmptyState } from '../components/EmptyState';
import { Pill } from '../components/Pill';
import { PrimaryButton } from '../components/PrimaryButton';
import { RefreshGlyph } from '../components/RefreshGlyph';
import { AnalysisSponsorCard, BottomBannerAd } from '../components/RevenueAds';
import { Screen } from '../components/Screen';
import { ScreenHeader } from '../components/ScreenHeader';
import { SectionHeader } from '../components/SectionHeader';
import { useAppState } from '../state/AppStateContext';
import { colors, fonts, radii, spacing, typography } from '../theme';
import { ScoreExam } from '../types';
import { getScoreReportKey } from '../utils/scoreReports';

type GradeErrorTarget = 'create' | 'score' | 'stats' | 'prediction' | 'sync';

function parseNumberInput(value: string) {
  const normalized = value.trim().replace(',', '.');
  if (!normalized) {
    return undefined;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function formatScore(value: number | undefined) {
  if (value === undefined) {
    return '-';
  }

  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function getExamLabel(exam: ScoreExam) {
  return `${exam.subject} · ${exam.examName}`;
}

export function GradeScreen() {
  const {
    createScoreExam,
    deleteScoreExam,
    deleteScore,
    isAdminMode,
    loadScoreSubjectCandidates,
    refreshScoreExamStats,
    reportedScoreKeys,
    reportScoreAnomaly,
    requestScorePrediction,
    scoreError,
    scoreExamStats,
    scoreExams,
    scoreLoading,
    scorePrediction,
    selectScoreExam,
    selectedScoreExamId,
    submitScore,
  } = useAppState();
  const [query, setQuery] = useState('');
  const [examName, setExamName] = useState('');
  const [maxScore, setMaxScore] = useState('100');
  const [scoreInput, setScoreInput] = useState('');
  const [subjectCandidates, setSubjectCandidates] = useState<string[]>([]);
  const [selectedSubjectCandidates, setSelectedSubjectCandidates] = useState<string[]>([]);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [localError, setLocalError] = useState<{ target: GradeErrorTarget; message: string } | null>(null);
  const [scoreErrorTarget, setScoreErrorTarget] = useState<GradeErrorTarget | null>(null);

  const selectedExam = scoreExams.find((exam) => exam.id === selectedScoreExamId);
  const adminScoreTesting = isAdminMode;
  const canViewScoreResults = Boolean(selectedExam && (adminScoreTesting || selectedExam.myScore !== undefined));
  const statsRefreshing = scoreLoading && scoreErrorTarget === 'stats';
  const filteredExams = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) {
      return scoreExams;
    }

    return scoreExams.filter((exam) => getExamLabel(exam).toLowerCase().includes(keyword));
  }, [query, scoreExams]);

  useEffect(() => {
    if (!selectedScoreExamId || !canViewScoreResults) {
      return;
    }

    setScoreErrorTarget('stats');
    void refreshScoreExamStats(selectedScoreExamId);
  }, [canViewScoreResults, selectedScoreExamId]);

  useEffect(() => {
    setScoreInput(selectedExam?.myScore !== undefined ? String(selectedExam.myScore) : '');
    setLocalError(null);
    setScoreErrorTarget(null);
  }, [selectedExam?.id, selectedExam?.myScore]);

  const getError = (target: GradeErrorTarget) => {
    if (localError?.target === target) {
      return localError.message;
    }

    return scoreError && scoreErrorTarget === target ? scoreError : null;
  };

  const createExam = async () => {
    const parsedMaxScore = parseNumberInput(maxScore);
    if (!examName.trim()) {
      setLocalError({ target: 'create', message: '시험명을 입력해 주세요.' });
      return;
    }
    if (!selectedSubjectCandidates.length) {
      setLocalError({ target: 'create', message: '학생 시간표나 NEIS에서 과목을 선택해 주세요.' });
      return;
    }
    if (!parsedMaxScore || parsedMaxScore <= 0) {
      setLocalError({ target: 'create', message: '만점을 확인해 주세요.' });
      return;
    }

    setSyncMessage(null);
    setLocalError(null);
    setScoreErrorTarget('create');
    let firstCreatedId: string | undefined;
    let createdCount = 0;
    for (const selectedSubject of selectedSubjectCandidates) {
      const createdId = await createScoreExam({
        subject: selectedSubject,
        examName,
        maxScore: parsedMaxScore,
      });
      if (createdId) {
        firstCreatedId = firstCreatedId ?? createdId;
        createdCount += 1;
      }
    }

    if (firstCreatedId) {
      setExamName('');
      setSelectedSubjectCandidates([]);
      selectScoreExam(firstCreatedId);
      setSyncMessage(`${createdCount}개 과목 시험을 만들었어요.`);
    }
  };

  const loadSubjectCandidates = async () => {
    setSyncMessage(null);
    setLocalError(null);
    setScoreErrorTarget('sync');
    const result = await loadScoreSubjectCandidates();
    setSubjectCandidates(result.subjects);
    setSelectedSubjectCandidates((current) => current.filter((subject) => result.subjects.includes(subject)));
    setSyncMessage(
      result.subjects.length
        ? `${result.subjects.length}개 과목을 불러왔어요. 시간표 ${result.timetableSubjectCount}개 · NEIS ${result.neisSubjectCount}개`
        : '불러온 과목이 없어요.',
    );
  };

  const toggleSubjectCandidate = (targetSubject: string) => {
    setLocalError(null);
    setSelectedSubjectCandidates((current) =>
      current.includes(targetSubject)
        ? current.filter((subject) => subject !== targetSubject)
        : [...current, targetSubject],
    );
  };

  const saveScore = async () => {
    if (!selectedExam) {
      setLocalError({ target: 'score', message: '시험을 선택해 주세요.' });
      return;
    }

    const score = parseNumberInput(scoreInput);
    if (score === undefined || score < 0 || score > selectedExam.maxScore) {
      setLocalError({ target: 'score', message: `0-${formatScore(selectedExam.maxScore)}점 사이로 입력해 주세요.` });
      return;
    }

    setLocalError(null);
    setScoreErrorTarget('score');
    await submitScore(selectedExam.id, score);
    if (adminScoreTesting) {
      setScoreInput('');
    }
  };

  const removeScore = async () => {
    if (!selectedExam) {
      return;
    }

    setLocalError(null);
    setScoreErrorTarget('score');
    await deleteScore(selectedExam.id);
  };

  const removeSelectedExam = async () => {
    if (!selectedExam || !adminScoreTesting) {
      return;
    }

    setLocalError(null);
    setScoreErrorTarget('sync');
    await deleteScoreExam(selectedExam.id);
  };

  const refreshStats = () => {
    if (!selectedExam || !canViewScoreResults) {
      if (selectedExam) {
        setLocalError({ target: 'stats', message: '점수를 제출하면 성적을 볼 수 있어요.' });
      }
      return;
    }

    setScoreErrorTarget('stats');
    void refreshScoreExamStats(selectedExam.id);
  };

  const runPrediction = () => {
    if (!selectedExam || !canViewScoreResults) {
      if (selectedExam) {
        setLocalError({ target: 'prediction', message: '점수를 제출하면 분포를 볼 수 있어요.' });
      }
      return;
    }

    setScoreErrorTarget('prediction');
    void requestScorePrediction(selectedExam.id);
  };

  return (
    <Screen>
      <ScreenHeader
        action={
          <View style={styles.headerIcon}>
            <BarChart3 color={colors.primary} size={24} />
          </View>
        }
        subtitle={`${scoreExams.length}개 시험`}
        title="성적"
      />

      <Card style={styles.cardGap}>
        <SectionHeader action={<Pill label={adminScoreTesting ? '관리자' : '학생'} tone="primary" />} title="시험 찾기" />
        <TextInput
          autoCapitalize="none"
          onChangeText={setQuery}
          placeholder="과목명 또는 시험명 검색"
          placeholderTextColor={colors.subtle}
          style={styles.input}
          value={query}
        />
        <View style={styles.examList}>
          {filteredExams.length ? (
            filteredExams.map((exam) => (
              <Pressable
                accessibilityRole="button"
                key={exam.id}
                onPress={() => selectScoreExam(exam.id)}
                style={({ pressed }) => [
                  styles.examRow,
                  exam.id === selectedExam?.id ? styles.examRowActive : null,
                  pressed && exam.id !== selectedExam?.id ? styles.examRowPressed : null,
                ]}
              >
                <View style={styles.examCopy}>
                  <Text numberOfLines={1} style={styles.examTitle}>{getExamLabel(exam)}</Text>
                  <Text style={styles.examMeta}>
                    만점 {formatScore(exam.maxScore)}
                    {exam.myScore !== undefined ? `· 내 점수 ${formatScore(exam.myScore)}` : ''}
                  </Text>
                </View>
                <ChevronRight color={exam.id === selectedExam?.id ? colors.primary : colors.subtle} size={18} />
              </Pressable>
            ))
          ) : (
            <EmptyState
              compact
              icon={<ClipboardList color={colors.subtle} size={22} />}
              title="아직 등록된 시험이 없어요."
            />
          )}
        </View>
      </Card>

      {adminScoreTesting ? (
        <Card style={styles.cardGap}>
          <SectionHeader action={<Plus color={colors.primary} size={21} />} title="시험 만들기" />
          <View style={styles.fieldGrid}>
            <TextInput
              onChangeText={setExamName}
              placeholder="시험명"
              placeholderTextColor={colors.subtle}
              style={styles.input}
              value={examName}
            />
            <TextInput
              keyboardType="decimal-pad"
              onChangeText={setMaxScore}
              placeholder="만점"
              placeholderTextColor={colors.subtle}
              style={styles.input}
              value={maxScore}
            />
          </View>
          <PrimaryButton
            disabled={scoreLoading}
            icon={<ClipboardList color={scoreLoading ? colors.disabled : colors.text} size={19} />}
            label="학생 시간표 + NEIS 과목 불러오기"
            onPress={loadSubjectCandidates}
            variant="secondary"
          />
          <View style={styles.neisSubjectPanel}>
            <View style={styles.neisSubjectHeader}>
              <Text style={styles.neisSubjectTitle}>시험 과목 선택</Text>
              <Text style={styles.neisSubjectMeta}>{selectedSubjectCandidates.length}개 선택</Text>
            </View>
            {subjectCandidates.length ? (
              <View style={styles.neisSubjectGrid}>
                {subjectCandidates.map((subjectCandidate) => {
                  const active = selectedSubjectCandidates.includes(subjectCandidate);
                  return (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      key={subjectCandidate}
                      onPress={() => toggleSubjectCandidate(subjectCandidate)}
                      style={({ pressed }) => [
                        styles.neisSubjectChip,
                        active && styles.neisSubjectChipActive,
                        pressed && !active ? styles.neisSubjectChipPressed : null,
                      ]}
                    >
                      <Text style={[styles.neisSubjectChipText, active && styles.neisSubjectChipTextActive]}>{subjectCandidate}</Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : (
              <Text style={styles.emptyText}>학생 시간표와 NEIS를 불러오면 과목을 선택할 수 있어요.</Text>
            )}
          </View>
          {syncMessage ? <Text style={styles.syncMessage}>{syncMessage}</Text> : null}
          <PrimaryButton
            disabled={scoreLoading || !selectedSubjectCandidates.length}
            icon={<Plus color={scoreLoading || !selectedSubjectCandidates.length ? colors.disabled : colors.surface} size={19} />}
            label={`${selectedSubjectCandidates.length || 0}개 과목 시험 만들기`}
            onPress={createExam}
          />
          <FieldError text={getError('create')} />
          <FieldError text={getError('sync')} />
        </Card>
      ) : null}

      {adminScoreTesting && selectedExam ? (
        <Card style={styles.cardGap}>
          <SectionHeader action={<Trash2 color={colors.danger} size={20} />} title="시험 삭제" />
          <View style={styles.selectedExamBox}>
            <Text style={styles.selectedExamTitle}>{getExamLabel(selectedExam)}</Text>
            <Text style={styles.selectedExamMeta}>삭제하면 제출된 익명 점수도 함께 삭제돼요.</Text>
          </View>
          <PrimaryButton
            disabled={scoreLoading}
            icon={<Trash2 color={colors.danger} size={19} />}
            label="선택 시험 삭제"
            onPress={removeSelectedExam}
            variant="danger"
          />
        </Card>
      ) : null}

      {!adminScoreTesting ? (
        <Card style={styles.cardGap}>
          <SectionHeader title="점수 제출" />
          {selectedExam ? (
            <>
              <View style={styles.selectedExamBox}>
                <Text style={styles.selectedExamTitle}>{getExamLabel(selectedExam)}</Text>
                <Text style={styles.selectedExamMeta}>
                  {canViewScoreResults ? `제출 ${scoreExamStats?.submissionCount ?? 0}명 · ` : ''}만점 {formatScore(selectedExam.maxScore)}
                </Text>
              </View>
              <TextInput
                keyboardType="decimal-pad"
                onChangeText={setScoreInput}
                placeholder="내 점수"
                placeholderTextColor={colors.subtle}
                style={styles.input}
                value={scoreInput}
              />
              <PrimaryButton
                disabled={scoreLoading}
                icon={<ClipboardList color={scoreLoading ? colors.disabled : colors.surface} size={19} />}
                label={selectedExam.myScore !== undefined ? '점수 수정' : '점수 제출'}
                onPress={saveScore}
              />
              {selectedExam.myScore !== undefined ? (
                <PrimaryButton
                  disabled={scoreLoading}
                  icon={<Trash2 color={colors.danger} size={19} />}
                  label="내 점수 삭제"
                  onPress={removeScore}
                  variant="danger"
                />
              ) : null}
              <FieldError text={getError('score')} />
            </>
          ) : (
            <EmptyState compact title="시험을 선택해 주세요." />
          )}
        </Card>
      ) : null}

      <Card style={styles.cardGap}>
        <SectionHeader
          action={
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: !selectedExam || !canViewScoreResults }}
              disabled={!selectedExam || !canViewScoreResults}
              onPress={refreshStats}
              style={({ pressed }) => [
                styles.iconButton,
                (!selectedExam || !canViewScoreResults) && styles.iconButtonDisabled,
                pressed && selectedExam && canViewScoreResults ? styles.iconButtonPressed : null,
              ]}
            >
              <RefreshGlyph
                active={statsRefreshing}
                color={!selectedExam || !canViewScoreResults ? colors.disabled : colors.primary}
                size={19}
              />
            </Pressable>
          }
          title={adminScoreTesting ? '점수 관리 / 통계' : '점수 현황'}
        />
        <StatsContent
          locked={Boolean(selectedExam && !canViewScoreResults)}
          onReportScore={reportScoreAnomaly}
          reportedScoreKeys={reportedScoreKeys}
          stats={canViewScoreResults ? scoreExamStats : null}
        />
        <FieldError text={getError('stats')} />
      </Card>

      {!adminScoreTesting ? (
        <Card style={styles.cardGap}>
          <SectionHeader action={<BarChart3 color={colors.primary} size={22} />} title="분포 참고값" />
          <Text style={styles.warningText}>익명 제보 기반 참고용이에요.</Text>
          {scoreLoading && scoreErrorTarget === 'prediction' ? <AnalysisSponsorCard /> : null}
          <PredictionContent locked={Boolean(selectedExam && !canViewScoreResults)} prediction={canViewScoreResults ? scorePrediction : null} />
          <PrimaryButton
            disabled={!selectedExam || !canViewScoreResults || scoreLoading}
            icon={<BarChart3 color={!selectedExam || !canViewScoreResults || scoreLoading ? colors.disabled : colors.surface} size={19} />}
            label="분포 보기"
            onPress={runPrediction}
          />
          <FieldError text={getError('prediction')} />
        </Card>
      ) : null}

      {canViewScoreResults ? <BottomBannerAd placement="score_result_banner" /> : null}
    </Screen>
  );
}

function LockedScoreContent({ message }: { message: string }) {
  return (
    <View style={styles.lockedBox}>
      <LockKeyhole color={colors.warning} size={22} />
      <View style={styles.lockedCopy}>
        <Text style={styles.lockedTitle}>점수 제출 필요</Text>
        <Text style={styles.lockedText}>{message}</Text>
      </View>
    </View>
  );
}

function StatsContent({
  locked,
  onReportScore,
  reportedScoreKeys,
  stats,
}: {
  locked: boolean;
  onReportScore: (examId: string, score: number, rank: number) => void;
  reportedScoreKeys: string[];
  stats: ReturnType<typeof useAppState>['scoreExamStats'];
}) {
  if (locked) {
    return <LockedScoreContent message="내 점수를 제출한 뒤 익명 점수 현황을 볼 수 있어요." />;
  }

  if (!stats) {
    return <EmptyState compact title="시험을 선택해 주세요." />;
  }

  if (!stats.ready) {
    return (
      <View style={styles.insufficientBox}>
        <Text style={styles.insufficientTitle}>자료 부족</Text>
        <Text style={styles.insufficientText}>{stats.submissionCount}/5명</Text>
      </View>
    );
  }

  return (
    <View style={styles.statsWrap}>
      <View style={styles.metricGrid}>
        <Metric label="최고점" value={`${formatScore(stats.topScore)}점`} />
        <Metric label="현재 상위 10%" value={`${formatScore(stats.topTenCutScore)}점`} />
        <Metric label="컷 이상" value={`${stats.topTenCount ?? 0}명`} />
        <Metric
          label="내 위치"
          value={stats.myRank ? `${stats.myRank}등 · 상위 ${formatScore(stats.myTopPercent)}%` : '미제출'}
        />
      </View>
      <View style={styles.scoreList}>
        <Text style={styles.scoreListTitle}>점수 목록</Text>
        {stats.anonymousScores.map((score, index) => (
          <View
            key={`${score}-${index}`}
            style={[
              styles.scoreRow,
              reportedScoreKeys.includes(getScoreReportKey(stats.examId, score, index + 1)) ? styles.scoreRowReported : null,
            ]}
          >
            <Text style={styles.scoreRank}>{index + 1}등</Text>
            <Text style={styles.scoreAlias}>익명 {index + 1}</Text>
            <Text style={styles.scoreValue}>{formatScore(score)}점</Text>
            <ScoreReportButton
              examId={stats.examId}
              onReportScore={onReportScore}
              rank={index + 1}
              reported={reportedScoreKeys.includes(getScoreReportKey(stats.examId, score, index + 1))}
              score={score}
            />
          </View>
        ))}
      </View>
    </View>
  );
}

function ScoreReportButton({
  examId,
  onReportScore,
  rank,
  reported,
  score,
}: {
  examId: string;
  onReportScore: (examId: string, score: number, rank: number) => void;
  rank: number;
  reported: boolean;
  score: number;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: reported }}
      disabled={reported}
      onPress={() => onReportScore(examId, score, rank)}
      style={({ pressed }) => [styles.scoreReportButton, reported && styles.scoreReportButtonDone, pressed && !reported ? styles.scoreReportButtonPressed : null]}
    >
      <Flag color={reported ? colors.subtle : colors.danger} size={14} />
      <Text style={[styles.scoreReportText, reported && styles.scoreReportTextDone]}>{reported ? '신고됨' : '신고'}</Text>
    </Pressable>
  );
}

function PredictionContent({ locked, prediction }: { locked: boolean; prediction: ReturnType<typeof useAppState>['scorePrediction'] }) {
  if (locked) {
    return <LockedScoreContent message="내 점수를 제출한 뒤 분포 참고값을 볼 수 있어요." />;
  }

  if (!prediction) {
    return <EmptyState compact title="15명 이상 모이면 보여요." />;
  }

  if (prediction.status === 'insufficient_sample') {
    return (
      <View style={styles.insufficientBox}>
        <Text style={styles.insufficientTitle}>표본 부족</Text>
        <Text style={styles.insufficientText}>{prediction.rationale}</Text>
        <Text style={styles.biasText}>{prediction.biasWarning}</Text>
      </View>
    );
  }

  return (
    <View style={styles.predictionBox}>
      <View style={styles.metricGrid}>
        <Metric label="예상 1등" value={formatRange(prediction.predictedTopScoreRange)} />
        <Metric label="예상 1등급 컷" value={formatRange(prediction.predictedCutScoreRange)} />
      </View>
      <Text style={styles.predictionText}>{prediction.rationale}</Text>
      <Text style={styles.biasText}>{prediction.biasWarning}</Text>
      {prediction.confidence !== undefined ? (
        <Text style={styles.confidenceText}>신뢰도 {Math.round(prediction.confidence * 100)}%</Text>
      ) : null}
    </View>
  );
}

function FieldError({ text }: { text: string | null }) {
  if (!text) {
    return null;
  }

  return <Text selectable style={styles.fieldError}>{text}</Text>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text adjustsFontSizeToFit minimumFontScale={0.78} numberOfLines={1} style={styles.metricValue}>
        {value}
      </Text>
    </View>
  );
}

function formatRange(range: [number, number] | undefined) {
  if (!range) {
    return '-';
  }

  return `${formatScore(range[0])}-${formatScore(range[1])}점`;
}

const styles = StyleSheet.create({
  biasText: {
    color: colors.warning,
    fontFamily: fonts.medium,
    fontSize: typography.tiny,
    lineHeight: 17,
  },
  cardGap: {
    gap: spacing.md,
  },
  confidenceText: {
    color: colors.muted,
    fontFamily: fonts.semibold,
    fontSize: typography.small,
    fontWeight: '600',
  },
  emptyText: {
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: typography.small,
    lineHeight: 20,
  },
  fieldError: {
    color: colors.danger,
    fontFamily: fonts.semibold,
    fontSize: typography.tiny,
    fontWeight: '600',
    lineHeight: 17,
  },
  examCopy: {
    flex: 1,
    minWidth: 0,
  },
  examList: {
    gap: spacing.sm,
  },
  examMeta: {
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: typography.tiny,
    lineHeight: 18,
    marginTop: spacing.xs,
  },
  examRow: {
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 68,
    padding: spacing.md,
  },
  examRowActive: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  examRowPressed: {
    backgroundColor: colors.surfacePressed,
  },
  examTitle: {
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: typography.body,
    fontWeight: '600',
  },
  fieldGrid: {
    gap: spacing.sm,
  },
  flexInput: {
    flexBasis: 0,
    flex: 1,
    minWidth: 0,
  },
  headerIcon: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: radii.pill,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  iconButton: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: radii.pill,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  iconButtonDisabled: {
    backgroundColor: colors.surfaceAlt,
  },
  iconButtonPressed: {
    opacity: 0.76,
    transform: [{ scale: 0.96 }],
  },
  input: {
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    color: colors.text,
    fontFamily: fonts.regular,
    fontSize: typography.body,
    minHeight: 48,
    paddingHorizontal: spacing.md,
  },
  insufficientBox: {
    backgroundColor: colors.warningSoft,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.md,
    gap: spacing.xs,
    padding: spacing.md,
  },
  insufficientText: {
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: typography.small,
    lineHeight: 20,
  },
  insufficientTitle: {
    color: colors.warning,
    fontFamily: fonts.semibold,
    fontSize: typography.h3,
    fontWeight: '700',
  },
  lockedBox: {
    alignItems: 'center',
    backgroundColor: colors.warningSoft,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.md,
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
  },
  lockedCopy: {
    flex: 1,
    gap: 2,
  },
  lockedText: {
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: typography.small,
    lineHeight: 20,
  },
  lockedTitle: {
    color: colors.warning,
    fontFamily: fonts.semibold,
    fontSize: typography.body,
    fontWeight: '700',
  },
  metricCard: {
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    flexBasis: '48%',
    flexGrow: 1,
    gap: spacing.xs,
    minHeight: 76,
    padding: spacing.md,
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  metricLabel: {
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: typography.tiny,
  },
  metricValue: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: typography.h3,
    fontVariant: ['tabular-nums'],
    fontWeight: '800',
  },
  neisSubjectChip: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.pill,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 36,
    paddingHorizontal: spacing.md,
  },
  neisSubjectChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  neisSubjectChipPressed: {
    backgroundColor: colors.surfacePressed,
  },
  neisSubjectChipText: {
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: typography.small,
    fontWeight: '600',
  },
  neisSubjectChipTextActive: {
    color: colors.surface,
  },
  neisSubjectGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  neisSubjectHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  neisSubjectMeta: {
    color: colors.primary,
    fontFamily: fonts.semibold,
    fontSize: typography.small,
    fontWeight: '700',
  },
  neisSubjectPanel: {
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  neisSubjectTitle: {
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: typography.body,
    fontWeight: '700',
  },
  predictionBox: {
    gap: spacing.md,
  },
  predictionText: {
    color: colors.text,
    fontFamily: fonts.regular,
    fontSize: typography.small,
    lineHeight: 20,
  },
  scoreAlias: {
    color: colors.muted,
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: typography.small,
  },
  scoreList: {
    gap: spacing.xs,
  },
  scoreListTitle: {
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: typography.h3,
    fontWeight: '700',
    marginTop: spacing.sm,
  },
  scoreRank: {
    color: colors.primary,
    fontFamily: fonts.semibold,
    fontSize: typography.small,
    fontWeight: '700',
    width: 42,
  },
  scoreRow: {
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderRadius: radii.sm,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 42,
    paddingHorizontal: spacing.md,
  },
  scoreRowReported: {
    opacity: 0.62,
  },
  scoreReportButton: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: radii.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 3,
    minHeight: 28,
    paddingHorizontal: spacing.sm,
  },
  scoreReportButtonDone: {
    backgroundColor: colors.surface,
  },
  scoreReportButtonPressed: {
    backgroundColor: colors.surfacePressed,
  },
  scoreReportText: {
    color: colors.danger,
    fontFamily: fonts.semibold,
    fontSize: typography.tiny,
    fontWeight: '700',
  },
  scoreReportTextDone: {
    color: colors.subtle,
  },
  scoreValue: {
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: typography.small,
    fontVariant: ['tabular-nums'],
    fontWeight: '700',
    minWidth: 44,
    textAlign: 'right',
  },
  selectedExamBox: {
    backgroundColor: colors.primarySoft,
    borderRadius: radii.md,
    gap: spacing.xs,
    padding: spacing.md,
  },
  selectedExamMeta: {
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: typography.small,
  },
  selectedExamTitle: {
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: typography.h3,
    fontWeight: '700',
  },
  statsWrap: {
    gap: spacing.md,
  },
  syncMessage: {
    color: colors.primary,
    fontFamily: fonts.semibold,
    fontSize: typography.small,
    fontWeight: '700',
    lineHeight: 20,
  },
  twoColumn: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  warningText: {
    color: colors.subtle,
    fontFamily: fonts.regular,
    fontSize: typography.tiny,
    lineHeight: 17,
  },
});
