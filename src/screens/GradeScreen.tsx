import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { BarChart3, BrainCircuit, ChevronRight, ClipboardList, LockKeyhole, Plus, RefreshCw, Trash2 } from 'lucide-react-native';

import { Card } from '../components/Card';
import { Pill } from '../components/Pill';
import { PrimaryButton } from '../components/PrimaryButton';
import { AnalysisSponsorCard, BottomBannerAd } from '../components/RevenueAds';
import { Screen } from '../components/Screen';
import { SectionHeader } from '../components/SectionHeader';
import { useAppState } from '../state/AppStateContext';
import { colors, fonts, radii, spacing, typography } from '../theme';
import { ScoreExam } from '../types';

type GradeErrorTarget = 'create' | 'score' | 'stats' | 'prediction';

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
    deleteScore,
    isAdminMode,
    refreshScoreExamStats,
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
  const [subject, setSubject] = useState('');
  const [examName, setExamName] = useState('');
  const [maxScore, setMaxScore] = useState('100');
  const [totalStudents, setTotalStudents] = useState('');
  const [scoreInput, setScoreInput] = useState('');
  const [localError, setLocalError] = useState<{ target: GradeErrorTarget; message: string } | null>(null);
  const [scoreErrorTarget, setScoreErrorTarget] = useState<GradeErrorTarget | null>(null);

  const selectedExam = scoreExams.find((exam) => exam.id === selectedScoreExamId);
  const adminScoreTesting = isAdminMode;
  const canViewScoreResults = Boolean(selectedExam && (adminScoreTesting || selectedExam.myScore !== undefined));
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
    const parsedTotalStudents = parseNumberInput(totalStudents);
    if (!subject.trim() || !examName.trim()) {
      setLocalError({ target: 'create', message: '과목명과 시험명을 입력해 주세요.' });
      return;
    }
    if (!parsedMaxScore || parsedMaxScore <= 0) {
      setLocalError({ target: 'create', message: '만점을 확인해 주세요.' });
      return;
    }
    if (parsedTotalStudents !== undefined && parsedTotalStudents < 1) {
      setLocalError({ target: 'create', message: '응시자 수를 확인해 주세요.' });
      return;
    }

    setLocalError(null);
    setScoreErrorTarget('create');
    const createdId = await createScoreExam({
      subject,
      examName,
      maxScore: parsedMaxScore,
      totalStudents: parsedTotalStudents ? Math.round(parsedTotalStudents) : undefined,
    });
    if (createdId) {
      setSubject('');
      setExamName('');
      setTotalStudents('');
      selectScoreExam(createdId);
    }
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

  const refreshStats = () => {
    if (!selectedExam || !canViewScoreResults) {
      if (selectedExam) {
        setLocalError({ target: 'stats', message: '점수를 제출해야 성적을 볼 수 있습니다.' });
      }
      return;
    }

    setScoreErrorTarget('stats');
    void refreshScoreExamStats(selectedExam.id);
  };

  const runPrediction = () => {
    if (!selectedExam || !canViewScoreResults) {
      if (selectedExam) {
        setLocalError({ target: 'prediction', message: '점수를 제출해야 성적을 볼 수 있습니다.' });
      }
      return;
    }

    setScoreErrorTarget('prediction');
    void requestScorePrediction(selectedExam.id);
  };

  return (
    <Screen>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>성적</Text>
        </View>
        <View style={styles.headerIcon}>
          <BarChart3 color={colors.primary} size={24} />
        </View>
      </View>

      <Card style={styles.cardGap}>
        <SectionHeader action={<Pill label="5등급제" tone="blue" />} title="시험 찾기" />
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
                style={[styles.examRow, exam.id === selectedExam?.id ? styles.examRowActive : null]}
              >
                <View style={styles.examCopy}>
                  <Text style={styles.examTitle}>{getExamLabel(exam)}</Text>
                  <Text style={styles.examMeta}>
                    만점 {formatScore(exam.maxScore)}
                    {exam.totalStudents ? ` · 전체 ${exam.totalStudents}명` : ''}{' '}
                    {exam.myScore !== undefined ? `· 내 점수 ${formatScore(exam.myScore)}` : ''}
                  </Text>
                </View>
                <ChevronRight color={exam.id === selectedExam?.id ? colors.primary : colors.subtle} size={18} />
              </Pressable>
            ))
          ) : (
            <Text style={styles.emptyText}>아직 등록된 시험이 없습니다.</Text>
          )}
        </View>
      </Card>

      <Card style={styles.cardGap}>
        <SectionHeader action={<Plus color={colors.primary} size={21} />} title="시험 만들기" />
        <View style={styles.fieldGrid}>
          <TextInput
            onChangeText={setSubject}
            placeholder="과목명"
            placeholderTextColor={colors.subtle}
            style={styles.input}
            value={subject}
          />
          <TextInput
            onChangeText={setExamName}
            placeholder="시험명"
            placeholderTextColor={colors.subtle}
            style={styles.input}
            value={examName}
          />
          <View style={styles.twoColumn}>
            <TextInput
              keyboardType="decimal-pad"
              onChangeText={setMaxScore}
              placeholder="만점"
              placeholderTextColor={colors.subtle}
              style={[styles.input, styles.flexInput]}
              value={maxScore}
            />
            <TextInput
              keyboardType="number-pad"
              onChangeText={setTotalStudents}
              placeholder="전체 응시자 수"
              placeholderTextColor={colors.subtle}
              style={[styles.input, styles.flexInput]}
              value={totalStudents}
            />
          </View>
        </View>
        <PrimaryButton
          disabled={scoreLoading}
          icon={<Plus color={scoreLoading ? colors.disabled : colors.surface} size={19} />}
          label="시험 등록"
          onPress={createExam}
        />
        <FieldError text={getError('create')} />
      </Card>

      <Card style={styles.cardGap}>
        <SectionHeader title="점수 제출" />
        {selectedExam ? (
          <>
            <View style={styles.selectedExamBox}>
              <Text style={styles.selectedExamTitle}>{getExamLabel(selectedExam)}</Text>
              <Text style={styles.selectedExamMeta}>
                {canViewScoreResults ? `참여 ${scoreExamStats?.submissionCount ?? 0}명 · ` : ''}만점 {formatScore(selectedExam.maxScore)}
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
              label={adminScoreTesting ? '테스트 제출' : selectedExam.myScore !== undefined ? '점수 수정' : '점수 제출'}
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
          <Text style={styles.emptyText}>시험을 선택하거나 새 시험을 만들어 주세요.</Text>
        )}
      </Card>

      <Card style={styles.cardGap}>
        <SectionHeader
          action={
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: !selectedExam || !canViewScoreResults }}
              disabled={!selectedExam || !canViewScoreResults}
              onPress={refreshStats}
              style={[styles.iconButton, (!selectedExam || !canViewScoreResults) && styles.iconButtonDisabled]}
            >
              {scoreLoading ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                <RefreshCw color={!selectedExam || !canViewScoreResults ? colors.disabled : colors.primary} size={19} />
              )}
            </Pressable>
          }
          title="점수 현황"
        />
        <StatsContent locked={Boolean(selectedExam && !canViewScoreResults)} stats={canViewScoreResults ? scoreExamStats : null} />
        <FieldError text={getError('stats')} />
      </Card>

      <Card style={styles.cardGap}>
        <SectionHeader action={<BrainCircuit color={colors.primary} size={22} />} title="석차/분포 확인" />
        <Text style={styles.warningText}>익명 제보 기반 참고용입니다.</Text>
        {scoreLoading && scoreErrorTarget === 'prediction' ? <AnalysisSponsorCard /> : null}
        <PredictionContent locked={Boolean(selectedExam && !canViewScoreResults)} prediction={canViewScoreResults ? scorePrediction : null} />
        <PrimaryButton
          disabled={!selectedExam || !canViewScoreResults || scoreLoading}
          icon={<BrainCircuit color={!selectedExam || !canViewScoreResults || scoreLoading ? colors.disabled : colors.surface} size={19} />}
          label="분포 예측 보기"
          onPress={runPrediction}
        />
        <FieldError text={getError('prediction')} />
      </Card>

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

function StatsContent({ locked, stats }: { locked: boolean; stats: ReturnType<typeof useAppState>['scoreExamStats'] }) {
  if (locked) {
    return <LockedScoreContent message="내 점수를 제출한 뒤 익명 점수 현황을 볼 수 있습니다." />;
  }

  if (!stats) {
    return <Text style={styles.emptyText}>시험을 선택해 주세요.</Text>;
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
          <View key={`${score}-${index}`} style={styles.scoreRow}>
            <Text style={styles.scoreRank}>{index + 1}등</Text>
            <Text style={styles.scoreAlias}>익명 {index + 1}</Text>
            <Text style={styles.scoreValue}>{formatScore(score)}점</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function PredictionContent({ locked, prediction }: { locked: boolean; prediction: ReturnType<typeof useAppState>['scorePrediction'] }) {
  if (locked) {
    return <LockedScoreContent message="내 점수를 제출한 뒤 AI 예측을 볼 수 있습니다." />;
  }

  if (!prediction) {
    return <Text style={styles.emptyText}>15명 이상 필요</Text>;
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
    flex: 1,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
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
    fontWeight: '800',
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
    borderRadius: radii.sm,
    flexDirection: 'row',
    minHeight: 42,
    paddingHorizontal: spacing.md,
  },
  scoreValue: {
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: typography.small,
    fontWeight: '700',
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
  subtitle: {
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: typography.small,
    lineHeight: 20,
    marginTop: spacing.xs,
  },
  title: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: typography.h1,
    fontWeight: '800',
  },
  twoColumn: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  warningText: {
    color: colors.subtle,
    fontFamily: fonts.regular,
    fontSize: typography.tiny,
    lineHeight: 17,
  },
});
