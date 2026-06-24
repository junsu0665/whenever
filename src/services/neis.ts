import { demoMeal, demoSchool } from '../data/mockData';
import { MealMenu, PeriodTimeMap, School, TimetableDay, TimetableSlot } from '../types';
import { defaultPeriodTimes, getCourseId, getSubjectColor, timetableDays } from '../utils/timetable';
import { providerConfig } from './env';

interface NeisMealRow {
  CAL_INFO?: string;
  DDISH_NM?: string;
  MMEAL_SC_NM?: string;
}

interface NeisSchoolRow {
  ATPT_OFCDC_SC_CODE?: string;
  SD_SCHUL_CODE?: string;
  SCHUL_NM?: string;
  LCTN_SC_NM?: string;
  ATPT_OFCDC_SC_NM?: string;
  SCHUL_KND_SC_NM?: string;
}

interface NeisTimetableRow {
  ALL_TI_YMD?: string;
  CLRM_NM?: string;
  ITRT_CNTNT?: string;
  PERIO?: string;
  TEACHER_NM?: string;
}

const stripAllergyNumbers = (value: string) => value.replace(/\([0-9.,]+\)/g, '').trim();

const mealCode = {
  중식: '2',
  석식: '3',
} as const;

function getLocalDateString(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function getYmd(date: Date) {
  return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
}

function getWeekdayDates(date = new Date()) {
  const monday = new Date(date);
  const day = monday.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  monday.setDate(monday.getDate() + diff);

  return timetableDays.map((_, index) => {
    const nextDate = new Date(monday);
    nextDate.setDate(monday.getDate() + index);
    return nextDate;
  });
}

function getClassNumber(className: string) {
  return className.replace(/[^0-9]/g, '').trim();
}

function cleanTimetableSubject(value: string) {
  return value
    .replace(/\s+/g, ' ')
    .replace(/\([^)]*자율\)/g, '')
    .trim();
}

function emptyMeal(school: School, date: string, type: MealMenu['type'], origin: string): MealMenu {
  return {
    id: `meal-${school.id}-${date}-${type}`,
    schoolId: school.id,
    date,
    type,
    items: [],
    calories: '',
    origin,
  };
}

export async function fetchMealMenu(
  school: School = demoSchool,
  date = getLocalDateString(),
  type: MealMenu['type'] = '중식',
): Promise<MealMenu> {
  if (!providerConfig.neisApiKey) {
    if (!providerConfig.allowMocks) {
      return emptyMeal(school, date, type, '급식 정보 없음');
    }

    await new Promise((resolve) => setTimeout(resolve, 350));
    return { ...demoMeal, schoolId: school.id, date, type, origin: '샘플 데이터' };
  }

  const params = new URLSearchParams({
    KEY: providerConfig.neisApiKey,
    Type: 'json',
    pIndex: '1',
    pSize: '20',
    ATPT_OFCDC_SC_CODE: school.officeCode,
    SD_SCHUL_CODE: school.schoolCode,
    MLSV_YMD: date.replace(/-/g, ''),
    MMEAL_SC_CODE: mealCode[type],
  });

  let payload: { mealServiceDietInfo?: Array<{ row?: NeisMealRow[] }> };
  try {
    const response = await fetch(`https://open.neis.go.kr/hub/mealServiceDietInfo?${params.toString()}`);
    if (!response.ok) {
      return emptyMeal(school, date, type, '급식 정보 없음');
    }
    payload = await response.json();
  } catch {
    return emptyMeal(school, date, type, '급식 정보 없음');
  }

  const row = payload?.mealServiceDietInfo?.[1]?.row?.[0];

  if (!row) {
    return emptyMeal(school, date, type, '급식 정보 없음');
  }

  const items = String(row.DDISH_NM ?? '')
    .split('<br/>')
    .map(stripAllergyNumbers)
    .filter(Boolean);

  return {
    id: `meal-${date}`,
    schoolId: school.id,
    date,
    type: row.MMEAL_SC_NM === '석식' ? '석식' : '중식',
    items,
    calories: row.CAL_INFO ?? '',
    origin: 'NEIS',
  };
}

export async function searchSchoolsByName(query: string): Promise<School[]> {
  const keyword = query.trim();
  if (keyword.length < 2) {
    return [];
  }

  if (!providerConfig.neisApiKey) {
    throw new Error('학교 검색을 사용할 수 없어요. 잠시 후 다시 시도해 주세요.');
  }

  const params = new URLSearchParams({
    KEY: providerConfig.neisApiKey,
    Type: 'json',
    pIndex: '1',
    pSize: '100',
    SCHUL_NM: keyword,
  });

  let payload: { schoolInfo?: Array<{ row?: NeisSchoolRow[] }> };
  try {
    const response = await fetch(`https://open.neis.go.kr/hub/schoolInfo?${params.toString()}`);
    if (!response.ok) {
      throw new Error('학교 검색에 실패했어요.');
    }
    payload = await response.json();
  } catch {
    throw new Error('학교 검색에 실패했어요.');
  }

  const rows = payload.schoolInfo?.[1]?.row ?? [];

  return rows
    .filter((row) => row.SCHUL_KND_SC_NM?.includes('고등학교'))
    .map((row) => {
      const officeCode = String(row.ATPT_OFCDC_SC_CODE ?? '').trim();
      const schoolCode = String(row.SD_SCHUL_CODE ?? '').trim();
      const name = String(row.SCHUL_NM ?? '').trim();
      const region = String(row.LCTN_SC_NM ?? row.ATPT_OFCDC_SC_NM ?? '').trim();

      if (!officeCode || !schoolCode || !name) {
        return null;
      }

      return {
        id: `neis-${officeCode}-${schoolCode}`,
        name,
        region,
        officeCode,
        schoolCode,
      };
    })
    .filter((school): school is School => Boolean(school));
}

export async function fetchNeisTimetableSlots({
  className,
  date = new Date(),
  grade,
  periodTimes = defaultPeriodTimes,
  school = demoSchool,
}: {
  className: string;
  date?: Date;
  grade: number;
  periodTimes?: PeriodTimeMap;
  school?: School;
}): Promise<TimetableSlot[]> {
  if (!providerConfig.neisApiKey) {
    throw new Error('NEIS API 키가 필요해요.');
  }

  const classNumber = getClassNumber(className);
  if (!classNumber) {
    throw new Error('반 정보를 확인해 주세요.');
  }

  const slotsByKey = new Map<string, TimetableSlot>();
  const weekdayDates = getWeekdayDates(date);

  await Promise.all(
    weekdayDates.map(async (weekdayDate, dayIndex) => {
      const day = timetableDays[dayIndex] as TimetableDay;
      const ymd = getYmd(weekdayDate);
      const params = new URLSearchParams({
        KEY: providerConfig.neisApiKey,
        Type: 'json',
        pIndex: '1',
        pSize: '100',
        ATPT_OFCDC_SC_CODE: school.officeCode,
        SD_SCHUL_CODE: school.schoolCode,
        AY: String(weekdayDate.getFullYear()),
        GRADE: String(grade),
        CLASS_NM: classNumber,
        ALL_TI_YMD: ymd,
      });

      let payload: { hisTimetable?: Array<{ row?: NeisTimetableRow[] }> };
      try {
        const response = await fetch(`https://open.neis.go.kr/hub/hisTimetable?${params.toString()}`);
        if (!response.ok) {
          return;
        }
        payload = await response.json();
      } catch {
        return;
      }

      const rows = payload?.hisTimetable?.[1]?.row ?? [];
      rows.forEach((row) => {
        const subject = cleanTimetableSubject(String(row.ITRT_CNTNT ?? ''));
        const period = Math.round(Number(row.PERIO));
        if (!subject || !Number.isInteger(period) || period < 1 || period > 12) {
          return;
        }

        const periodTime = periodTimes[period] ?? defaultPeriodTimes[period] ?? { startTime: '', endTime: '' };
        const courseId = getCourseId(subject);
        const key = `${day}-${period}-${courseId}`;
        slotsByKey.set(key, {
          id: `slot-neis-${ymd}-${period}-${courseId}`,
          day,
          period,
          startTime: periodTime.startTime,
          endTime: periodTime.endTime,
          subject,
          teacher: String(row.TEACHER_NM ?? '').trim() || 'NEIS',
          room: String(row.CLRM_NM ?? '').trim() || '교실 미정',
          courseId,
          color: getSubjectColor(subject),
        });
      });
    }),
  );

  return [...slotsByKey.values()].sort((left, right) => {
    const dayDiff = timetableDays.indexOf(left.day) - timetableDays.indexOf(right.day);
    return dayDiff || left.period - right.period;
  });
}
