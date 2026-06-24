import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { colors, fonts, radii, spacing, typography } from '../theme';
import { PeriodTime, PeriodTimeMap, Timetable } from '../types';
import { clockTimeToMinutes, isClockTime } from '../utils/time';
import {
  buildPeriodTimesFromTemplate,
  defaultPeriodTimeTemplate,
  getTimetablePeriodTime,
} from '../utils/timetable';
import { TimeField } from './TimeField';

interface TimetablePeriodSettingsProps {
  onChange: (periodTimes: PeriodTimeMap) => void;
  timetable: Timetable;
}

interface PeriodTimeTemplateDraft {
  firstStartTime: string;
  classMinutes: number;
  breakMinutes: number;
  lunchMinutes: number;
}

export function TimetablePeriodSettings({ onChange, timetable }: TimetablePeriodSettingsProps) {
  const maxPeriod = Math.max(8, ...timetable.slots.map((slot) => slot.period));
  const periodSettings = Array.from({ length: maxPeriod }, (_, index) => index + 1);

  return (
    <View style={styles.wrap}>
      <AutoPeriodTimeSettings onChange={onChange} periodCount={maxPeriod} timetable={timetable} />
      <View style={styles.previewBlock}>
        <View style={styles.previewHeader}>
          <Text style={styles.settingTitle}>결과 미리보기</Text>
          <Text style={styles.previewMeta}>{periodSettings.length}교시</Text>
        </View>
        <View style={styles.periodTimeList}>
          {periodSettings.map((period) => (
            <PeriodTimeRow
              key={period}
              period={period}
              time={getTimetablePeriodTime(timetable, period)}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

function getDurationMinutes(time: PeriodTime, fallback: number) {
  if (!isClockTime(time.startTime) || !isClockTime(time.endTime)) {
    return fallback;
  }

  const duration = clockTimeToMinutes(time.endTime) - clockTimeToMinutes(time.startTime);
  return duration > 0 ? duration : fallback;
}

function getGapMinutes(previous: PeriodTime, next: PeriodTime, fallback: number) {
  if (!isClockTime(previous.endTime) || !isClockTime(next.startTime)) {
    return fallback;
  }

  const duration = clockTimeToMinutes(next.startTime) - clockTimeToMinutes(previous.endTime);
  return duration >= 0 ? duration : fallback;
}

function getPeriodTimeTemplateDraft(timetable: Timetable): PeriodTimeTemplateDraft {
  const first = getTimetablePeriodTime(timetable, 1);
  const second = getTimetablePeriodTime(timetable, 2);
  const fourth = getTimetablePeriodTime(timetable, 4);
  const fifth = getTimetablePeriodTime(timetable, 5);

  return {
    firstStartTime: isClockTime(first.startTime) ? first.startTime : '08:40',
    classMinutes: getDurationMinutes(first, defaultPeriodTimeTemplate.classMinutes),
    breakMinutes: getGapMinutes(first, second, defaultPeriodTimeTemplate.breakMinutes),
    lunchMinutes: getGapMinutes(fourth, fifth, defaultPeriodTimeTemplate.lunchMinutes),
  };
}

function AutoPeriodTimeSettings({
  onChange,
  periodCount,
  timetable,
}: {
  onChange: (periodTimes: PeriodTimeMap) => void;
  periodCount: number;
  timetable: Timetable;
}) {
  const [draft, setDraft] = useState(() => getPeriodTimeTemplateDraft(timetable));

  useEffect(() => {
    setDraft(getPeriodTimeTemplateDraft(timetable));
  }, [timetable]);

  const commitDraft = (patch: Partial<PeriodTimeTemplateDraft>) => {
    const nextDraft = { ...draft, ...patch };
    setDraft(nextDraft);
    onChange(
      buildPeriodTimesFromTemplate({
        ...nextDraft,
        periodCount,
      }),
    );
  };

  return (
    <View style={styles.autoSchedule}>
      <Text style={styles.settingTitle}>교시 자동 계산</Text>
      <View style={styles.autoScheduleGrid}>
        <View style={styles.autoScheduleField}>
          <Text style={styles.autoScheduleLabel}>1교시 시작</Text>
          <TimeField
            accessibilityLabel="1교시 시작 시간"
            onCommit={(firstStartTime) => commitDraft({ firstStartTime })}
            style={styles.autoTimeInput}
            value={draft.firstStartTime}
          />
        </View>
        <DurationField
          accessibilityLabel="수업 시간 길이"
          label="수업 길이"
          min={1}
          onCommit={(classMinutes) => commitDraft({ classMinutes })}
          value={draft.classMinutes}
        />
        <DurationField
          accessibilityLabel="쉬는시간 길이"
          label="쉬는시간"
          onCommit={(breakMinutes) => commitDraft({ breakMinutes })}
          value={draft.breakMinutes}
        />
        <DurationField
          accessibilityLabel="점심시간 길이"
          label="점심시간(4교시 후)"
          onCommit={(lunchMinutes) => commitDraft({ lunchMinutes })}
          value={draft.lunchMinutes}
        />
      </View>
    </View>
  );
}

function DurationField({
  accessibilityLabel,
  label,
  min = 0,
  onCommit,
  value,
}: {
  accessibilityLabel: string;
  label: string;
  min?: number;
  onCommit: (value: number) => void;
  value: number;
}) {
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  const commit = () => {
    const compact = draft.replace(/[^0-9]/g, '');
    const parsed = compact ? Number(compact) : value;
    const nextValue = Math.min(240, Math.max(min, Math.round(parsed)));
    setDraft(String(nextValue));
    if (nextValue !== value) {
      onCommit(nextValue);
    }
  };

  return (
    <View style={styles.autoScheduleField}>
      <Text style={styles.autoScheduleLabel}>{label}</Text>
      <View style={styles.durationInputWrap}>
        <TextInput
          accessibilityLabel={accessibilityLabel}
          keyboardType="number-pad"
          maxLength={3}
          onBlur={commit}
          onChangeText={setDraft}
          onSubmitEditing={commit}
          returnKeyType="done"
          selectTextOnFocus
          style={styles.durationInput}
          value={draft}
        />
        <Text style={styles.durationUnit}>분</Text>
      </View>
    </View>
  );
}

function PeriodTimeRow({
  period,
  time,
}: {
  period: number;
  time: PeriodTime;
}) {
  return (
    <View style={styles.periodTimeRow}>
      <Text style={styles.periodTimeLabel}>{period}교시</Text>
      <View style={styles.periodTimeInputs}>
        <Text style={styles.periodTimeValue}>{time.startTime}</Text>
        <Text style={styles.periodTimeSeparator}>~</Text>
        <Text style={styles.periodTimeValue}>{time.endTime}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  autoSchedule: {
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  autoScheduleField: {
    flexBasis: '47%',
    flexGrow: 1,
    gap: spacing.xs,
    minWidth: 120,
  },
  autoScheduleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  autoScheduleLabel: {
    color: colors.muted,
    fontFamily: fonts.semibold,
    fontSize: typography.tiny,
    fontWeight: '600',
  },
  autoTimeInput: {
    width: '100%',
  },
  durationInput: {
    color: colors.text,
    flex: 1,
    fontFamily: fonts.semibold,
    fontSize: typography.body,
    fontWeight: '600',
    minWidth: 0,
    padding: 0,
  },
  durationInputWrap: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderCurve: 'continuous',
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 42,
    paddingHorizontal: spacing.md,
  },
  durationUnit: {
    color: colors.muted,
    fontFamily: fonts.semibold,
    fontSize: typography.small,
    fontWeight: '600',
  },
  periodTimeInputs: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  periodTimeLabel: {
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: typography.body,
    fontWeight: '700',
  },
  periodTimeList: {
    gap: spacing.sm,
  },
  periodTimeRow: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderCurve: 'continuous',
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
    minHeight: 42,
    paddingHorizontal: spacing.md,
  },
  periodTimeSeparator: {
    color: colors.muted,
    fontFamily: fonts.semibold,
    fontSize: typography.body,
    fontWeight: '600',
  },
  periodTimeValue: {
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: typography.body,
    fontWeight: '700',
  },
  previewBlock: {
    gap: spacing.sm,
  },
  previewHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  previewMeta: {
    color: colors.muted,
    fontFamily: fonts.semibold,
    fontSize: typography.small,
    fontWeight: '600',
  },
  settingTitle: {
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: typography.body,
    fontWeight: '700',
  },
  wrap: {
    gap: spacing.lg,
  },
});
