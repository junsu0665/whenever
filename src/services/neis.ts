import { demoMeal, demoSchool } from '../data/mockData';
import { MealMenu, School } from '../types';
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

const stripAllergyNumbers = (value: string) => value.replace(/\([0-9.,]+\)/g, '').trim();

const mealCode = {
  중식: '2',
  석식: '3',
} as const;

function getLocalDateString(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
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
      return emptyMeal(school, date, type, 'NEIS API key 없음');
    }

    await new Promise((resolve) => setTimeout(resolve, 350));
    return { ...demoMeal, schoolId: school.id, date, type, origin: 'NEIS mock' };
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
      return emptyMeal(school, date, type, `NEIS 요청 실패 ${response.status}`);
    }
    payload = await response.json();
  } catch {
    return emptyMeal(school, date, type, 'NEIS 네트워크 실패');
  }

  const row = payload?.mealServiceDietInfo?.[1]?.row?.[0];

  if (!row) {
    return emptyMeal(school, date, type, 'NEIS 결과 없음');
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
    throw new Error('NEIS API 키가 필요합니다.');
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
      throw new Error(`NEIS 학교 검색 실패 ${response.status}`);
    }
    payload = await response.json();
  } catch {
    throw new Error('NEIS 학교 검색에 실패했습니다.');
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
