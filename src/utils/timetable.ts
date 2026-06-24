import { PeriodTime, PeriodTimeMap, Timetable, TimetableDay, TimetableSlot } from '../types';
import { clockTimeToMinutes, isClockTime, minutesToClockTime, normalizeClockTime } from './time';

export const timetableDays: TimetableDay[] = ['월', '화', '수', '목', '금'];

export const defaultPeriodTimes: PeriodTimeMap = {
  1: { startTime: '08:40', endTime: '09:30' },
  2: { startTime: '09:40', endTime: '10:30' },
  3: { startTime: '10:40', endTime: '11:30' },
  4: { startTime: '11:40', endTime: '12:30' },
  5: { startTime: '13:20', endTime: '14:10' },
  6: { startTime: '14:20', endTime: '15:10' },
  7: { startTime: '15:20', endTime: '16:10' },
  8: { startTime: '16:20', endTime: '17:10' },
};

export const defaultPeriodTimeTemplate = {
  classMinutes: 50,
  breakMinutes: 10,
  lunchAfterPeriod: 4,
  lunchMinutes: 50,
};

const subjectColors = ['#00845E', '#7ED8A4', '#2FA66B'];

export function getDefaultPeriodTime(period: number) {
  return defaultPeriodTimes[period] ?? { startTime: '', endTime: '' };
}

function isPeriodTime(value: unknown): value is PeriodTime {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<PeriodTime>;
  return typeof candidate.startTime === 'string' && typeof candidate.endTime === 'string';
}

export function normalizePeriodTimes(value?: unknown, slots: TimetableSlot[] = []): PeriodTimeMap {
  const normalized: PeriodTimeMap = { ...defaultPeriodTimes };
  const periodsFromValue = new Set<number>();

  if (value && typeof value === 'object') {
    Object.entries(value as Record<string, unknown>).forEach(([periodKey, candidate]) => {
      const period = Number(periodKey);
      if (!Number.isInteger(period) || period < 1 || !isPeriodTime(candidate)) {
        return;
      }

      const fallback = getDefaultPeriodTime(period);
      normalized[period] = {
        startTime: isClockTime(candidate.startTime) ? candidate.startTime : fallback.startTime,
        endTime: isClockTime(candidate.endTime) ? candidate.endTime : fallback.endTime,
      };
      periodsFromValue.add(period);
    });
  }

  const periodsFromSlots = new Set<number>();
  slots.forEach((slot) => {
    if (
      slot.period >= 1 &&
      isClockTime(slot.startTime) &&
      isClockTime(slot.endTime) &&
      !periodsFromValue.has(slot.period) &&
      !periodsFromSlots.has(slot.period)
    ) {
      normalized[slot.period] = {
        startTime: slot.startTime,
        endTime: slot.endTime,
      };
      periodsFromSlots.add(slot.period);
    }
  });

  return normalized;
}

export function getTimetablePeriodTime(timetable: Pick<Timetable, 'periodTimes'>, period: number) {
  return timetable.periodTimes[period] ?? getDefaultPeriodTime(period);
}

function normalizeDurationMinutes(value: number, fallback: number, min = 0) {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(240, Math.max(min, Math.round(value)));
}

export function buildPeriodTimesFromTemplate({
  breakMinutes,
  classMinutes,
  firstStartTime,
  lunchAfterPeriod = defaultPeriodTimeTemplate.lunchAfterPeriod,
  lunchMinutes,
  periodCount,
}: {
  breakMinutes: number;
  classMinutes: number;
  firstStartTime: string;
  lunchAfterPeriod?: number;
  lunchMinutes: number;
  periodCount: number;
}) {
  const normalizedPeriodCount = Math.min(12, Math.max(1, Math.round(periodCount)));
  const normalizedClassMinutes = normalizeDurationMinutes(
    classMinutes,
    defaultPeriodTimeTemplate.classMinutes,
    1,
  );
  const normalizedBreakMinutes = normalizeDurationMinutes(breakMinutes, defaultPeriodTimeTemplate.breakMinutes);
  const normalizedLunchMinutes = normalizeDurationMinutes(lunchMinutes, defaultPeriodTimeTemplate.lunchMinutes);
  const normalizedFirstStartTime = normalizeClockTime(firstStartTime, defaultPeriodTimes[1].startTime);
  const periodTimes: PeriodTimeMap = {};
  let cursor = clockTimeToMinutes(normalizedFirstStartTime, defaultPeriodTimes[1].startTime);

  for (let period = 1; period <= normalizedPeriodCount; period += 1) {
    const end = cursor + normalizedClassMinutes;
    periodTimes[period] = {
      startTime: minutesToClockTime(cursor),
      endTime: minutesToClockTime(end),
    };
    cursor = end + (period === lunchAfterPeriod ? normalizedLunchMinutes : normalizedBreakMinutes);
  }

  return periodTimes;
}

export function applyPeriodTimesToSlots(slots: TimetableSlot[], periodTimes: PeriodTimeMap) {
  return slots.map((slot) => {
    const periodTime = periodTimes[slot.period];
    if (!periodTime) {
      return slot;
    }

    return {
      ...slot,
      startTime: periodTime.startTime,
      endTime: periodTime.endTime,
    };
  });
}

export function getSubjectColor(subject: string) {
  const seed = Array.from(subject || '수업').reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return subjectColors[seed % subjectColors.length];
}

export function getCourseId(subject: string) {
  const slug = (subject || 'class')
    .trim()
    .toLowerCase()
    .replace(/[^0-9a-z가-힣]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `course-${slug || 'class'}`;
}

export function sortTimetableSlots(slots: TimetableSlot[]) {
  return [...slots].sort((left, right) => {
    const dayDiff = timetableDays.indexOf(left.day) - timetableDays.indexOf(right.day);
    if (dayDiff !== 0) {
      return dayDiff;
    }
    return left.period - right.period;
  });
}

export function getTodayTimetableDayOrNull(): TimetableDay | null {
  const day = new Date().getDay();
  return timetableDays[day - 1] ?? null;
}

export function getTomorrowTimetableDayOrNull(date = new Date()): TimetableDay | null {
  const tomorrow = new Date(date);
  tomorrow.setDate(date.getDate() + 1);
  const day = tomorrow.getDay();
  return timetableDays[day - 1] ?? null;
}

export function getTodayTimetableDay(): TimetableDay {
  return getTodayTimetableDayOrNull() ?? '월';
}
