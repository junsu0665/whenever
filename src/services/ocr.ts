import { File } from 'expo-file-system';

import { demoTimetable } from '../data/mockData';
import { Timetable, TimetableDay, TimetableImageInput, TimetableSlot } from '../types';
import { getCourseId, getDefaultPeriodTime, getSubjectColor, sortTimetableSlots, timetableDays } from '../utils/timetable';
import { providerConfig } from './env';
import { supabase } from './supabase';

export interface OcrTimetableResult {
  provider: string;
  confidence: number;
  slots: TimetableSlot[];
}

export interface TimetableOcrContext {
  subjectCandidates: string[];
  teacherCandidates: string[];
  roomCandidates: string[];
  knownSlots: Array<Pick<TimetableSlot, 'day' | 'period' | 'subject' | 'teacher' | 'room'>>;
  expectedPeriodCount?: number;
  periodsByDay: Partial<Record<TimetableDay, number[]>>;
}

interface RecognizedSlot {
  day: string;
  period: number;
  startTime: string;
  endTime: string;
  subject: string;
  teacher: string;
  room: string;
}

interface RecognizedTimetablePayload {
  provider?: string;
  confidence?: number;
  slots?: RecognizedSlot[];
}

type TimetableImageSource = string | TimetableImageInput;

const ignoredHintValues = new Set(['미확인', 'NEIS', '교실 미정']);

function isTimetableDay(value: string): value is TimetableDay {
  return timetableDays.includes(value as TimetableDay);
}

function clampConfidence(value: unknown) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return 0.72;
  }
  return Math.min(1, Math.max(0, value));
}

function inferMimeType(uri: string, fileType?: string) {
  if (fileType) {
    return fileType;
  }

  const lowerUri = uri.toLowerCase();
  if (lowerUri.includes('.png')) {
    return 'image/png';
  }
  if (lowerUri.includes('.webp')) {
    return 'image/webp';
  }
  return 'image/jpeg';
}

function getImageUri(image: TimetableImageSource) {
  return typeof image === 'string' ? image : image.uri;
}

function getImageMimeType(image: TimetableImageSource) {
  if (typeof image !== 'string' && image.mimeType) {
    return image.mimeType;
  }

  return inferMimeType(getImageUri(image));
}

function normalizeClock(value: string | undefined, fallback: string) {
  const raw = (value ?? '').trim();
  if (!raw) {
    return fallback;
  }

  const match = raw.match(/(\d{1,2})\D?(\d{2})/);
  if (!match) {
    return fallback;
  }

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return fallback;
  }

  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function uniqueCompact(values: string[]) {
  const seen = new Set<string>();
  return values
    .map((value) => value.trim().replace(/\s+/g, ' '))
    .filter((value) => {
      if (!value || ignoredHintValues.has(value) || seen.has(value.toLowerCase())) {
        return false;
      }
      seen.add(value.toLowerCase());
      return true;
    });
}

function normalizeForMatch(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s·ㆍ.,()[\]{}<>ⅠⅡⅢⅣⅤ]/g, (token) => {
      const romanMap: Record<string, string> = { 'Ⅰ': '1', 'Ⅱ': '2', 'Ⅲ': '3', 'Ⅳ': '4', 'Ⅴ': '5' };
      return romanMap[token] ?? '';
    });
}

function editDistance(left: string, right: string) {
  if (left === right) {
    return 0;
  }

  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  const current = Array.from({ length: right.length + 1 }, () => 0);

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    current[0] = leftIndex;
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const cost = left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1;
      current[rightIndex] = Math.min(
        previous[rightIndex] + 1,
        current[rightIndex - 1] + 1,
        previous[rightIndex - 1] + cost,
      );
    }
    previous.splice(0, previous.length, ...current);
  }

  return previous[right.length];
}

function resolveHintCandidate(value: string, candidates: string[], minimumScore: number) {
  const compactValue = value.trim().replace(/\s+/g, ' ');
  if (!compactValue || candidates.length === 0) {
    return compactValue;
  }

  const normalizedValue = normalizeForMatch(compactValue);
  if (!normalizedValue) {
    return compactValue;
  }

  let bestCandidate = compactValue;
  let bestScore = 0;
  candidates.forEach((candidate) => {
    const normalizedCandidate = normalizeForMatch(candidate);
    if (!normalizedCandidate) {
      return;
    }

    if (normalizedCandidate === normalizedValue) {
      bestCandidate = candidate;
      bestScore = 1;
      return;
    }

    const length = Math.max(normalizedValue.length, normalizedCandidate.length);
    const score = 1 - editDistance(normalizedValue, normalizedCandidate) / Math.max(1, length);
    if (score > bestScore) {
      bestCandidate = candidate;
      bestScore = score;
    }
  });

  return bestScore >= minimumScore ? bestCandidate : compactValue;
}

export function buildTimetableOcrContext(timetable: Timetable): TimetableOcrContext | undefined {
  const knownSlots = sortTimetableSlots(timetable.slots).map((slot) => ({
    day: slot.day,
    period: slot.period,
    subject: slot.subject,
    teacher: slot.teacher,
    room: slot.room,
  }));

  if (!knownSlots.length) {
    return undefined;
  }

  const periodsByDay: Partial<Record<TimetableDay, number[]>> = {};
  timetableDays.forEach((day) => {
    const periods = [...new Set(knownSlots.filter((slot) => slot.day === day).map((slot) => slot.period))].sort((left, right) => left - right);
    if (periods.length) {
      periodsByDay[day] = periods;
    }
  });

  return {
    subjectCandidates: uniqueCompact(knownSlots.map((slot) => slot.subject)),
    teacherCandidates: uniqueCompact(knownSlots.map((slot) => slot.teacher)),
    roomCandidates: uniqueCompact(knownSlots.map((slot) => slot.room)),
    knownSlots: knownSlots.slice(0, 80),
    expectedPeriodCount: Math.max(...knownSlots.map((slot) => slot.period)),
    periodsByDay,
  };
}

function normalizeRecognizedSlots(payload: RecognizedTimetablePayload, importedAt: number, context?: TimetableOcrContext): TimetableSlot[] {
  const slots = payload.slots ?? [];
  const normalized = slots
    .map((slot, index): TimetableSlot | null => {
      const subject = resolveHintCandidate(slot.subject ?? '', context?.subjectCandidates ?? [], 0.72);
      const period = Math.round(Number(slot.period));
      if (!isTimetableDay(slot.day) || !subject || !Number.isFinite(period) || period < 1 || period > 12) {
        return null;
      }

      const defaults = getDefaultPeriodTime(period);
      const teacher = resolveHintCandidate(slot.teacher ?? '', context?.teacherCandidates ?? [], 0.78);
      const room = resolveHintCandidate(slot.room ?? '', context?.roomCandidates ?? [], 0.72);

      return {
        id: `slot-${slot.day}-${period}-${index}-${importedAt}`,
        day: slot.day,
        period,
        startTime: normalizeClock(slot.startTime, defaults.startTime),
        endTime: normalizeClock(slot.endTime, defaults.endTime),
        subject,
        teacher: teacher || '미확인',
        room: room || '미확인',
        courseId: getCourseId(subject),
        color: getSubjectColor(subject),
      };
    })
    .filter((slot): slot is TimetableSlot => Boolean(slot));

  if (normalized.length === 0) {
    throw new Error('시간표 칸을 찾지 못했어요. 더 선명한 사진으로 다시 시도해 주세요.');
  }

  return sortTimetableSlots(normalized);
}

async function blobUriToDataUrl(uri: string, mimeType: string) {
  const response = await fetch(uri);
  if (!response.ok) {
    throw new Error('선택한 이미지 파일을 읽지 못했어요.');
  }

  const blob = await response.blob();

  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('선택한 이미지 파일을 변환하지 못했어요.'));
    reader.onload = () => {
      if (typeof reader.result === 'string' && reader.result) {
        resolve(reader.result);
        return;
      }
      reject(new Error('선택한 이미지 파일을 변환하지 못했어요.'));
    };
    reader.readAsDataURL(blob.type ? blob : blob.slice(0, blob.size, mimeType));
  });
}

async function imageSourceToOpenAiImageUrl(image: TimetableImageSource) {
  if (typeof image !== 'string' && image.base64) {
    return `data:${getImageMimeType(image)};base64,${image.base64}`;
  }

  const uri = getImageUri(image);
  if (uri.startsWith('data:') || /^https?:\/\//.test(uri)) {
    return uri;
  }

  if (uri.startsWith('blob:')) {
    return blobUriToDataUrl(uri, getImageMimeType(image));
  }

  const file = new File(uri);
  const base64 = await file.base64();
  return `data:${inferMimeType(uri, file.type || getImageMimeType(image))};base64,${base64}`;
}

function getEndpointErrorMessage(
  payload: Partial<RecognizedTimetablePayload> & {
    error?: { message?: string } | string;
    message?: string;
    code?: string;
  },
) {
  const message = typeof payload.error === 'string'
    ? payload.error
    : payload.error?.message ?? payload.message ?? payload.code ?? '';

  if (!message || /api|key|token|endpoint|provider|supabase|openai|env|function/i.test(message)) {
    return '시간표 자동 등록을 사용할 수 없어요. 잠시 후 다시 시도해 주세요.';
  }

  return message;
}

function serializeOcrContext(context?: TimetableOcrContext) {
  if (!context) {
    return undefined;
  }

  return {
    subjectCandidates: context.subjectCandidates.slice(0, 60),
    teacherCandidates: context.teacherCandidates.slice(0, 60),
    roomCandidates: context.roomCandidates.slice(0, 60),
    knownSlots: context.knownSlots.slice(0, 80),
    expectedPeriodCount: context.expectedPeriodCount,
    periodsByDay: context.periodsByDay,
  };
}

async function parseWithEndpoint(imageSource: TimetableImageSource, context?: TimetableOcrContext): Promise<OcrTimetableResult> {
  if (!providerConfig.ocrEndpoint) {
    throw new Error('시간표 자동 등록을 사용할 수 없어요. 잠시 후 다시 시도해 주세요.');
  }

  const image = await imageSourceToOpenAiImageUrl(imageSource);
  const {
    data: { session },
  } = supabase ? await supabase.auth.getSession() : { data: { session: null } };
  if (!session?.access_token) {
    throw new Error('로그인 세션이 필요해요.');
  }

  const response = await fetch(providerConfig.ocrEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(providerConfig.supabaseAnonKey ? { apikey: providerConfig.supabaseAnonKey } : {}),
      Authorization: `Bearer ${session.access_token}`,
      ...(providerConfig.ocrApiKey ? { 'x-ocr-api-key': providerConfig.ocrApiKey } : {}),
    },
    body: JSON.stringify({
      context: serializeOcrContext(context),
      image,
      schemaVersion: 2,
    }),
  });

  const payload = (await response.json().catch(() => ({}))) as RecognizedTimetablePayload & {
    error?: { message?: string } | string;
    message?: string;
    code?: string;
  };
  if (!response.ok) {
    throw new Error(getEndpointErrorMessage(payload));
  }

  const importedAt = Date.now();
  return {
    provider: payload.provider ?? 'endpoint',
    confidence: clampConfidence(payload.confidence),
    slots: normalizeRecognizedSlots(payload, importedAt, context),
  };
}

async function parseWithMock(imageSource: TimetableImageSource): Promise<OcrTimetableResult> {
  await new Promise((resolve) => setTimeout(resolve, 650));
  const importedAt = Date.now();
  const uri = getImageUri(imageSource);

  return {
    provider: `mock:${uri.slice(0, 24)}`,
    confidence: 0.91,
    slots: demoTimetable.slots.map((slot, index) => ({
      ...slot,
      id: `${slot.id}-ocr-${index}-${importedAt}`,
    })),
  };
}

export async function parseTimetableImage(imageSource: TimetableImageSource, context?: TimetableOcrContext): Promise<OcrTimetableResult> {
  if (providerConfig.ocrProvider === 'endpoint') {
    return parseWithEndpoint(imageSource, context);
  }

  if (providerConfig.ocrProvider === 'mock' && providerConfig.allowMocks) {
    return parseWithMock(imageSource);
  }

  if (providerConfig.ocrProvider === 'openai') {
    throw new Error('시간표 자동 등록을 사용할 수 없어요. 잠시 후 다시 시도해 주세요.');
  }

  throw new Error('시간표 자동 등록을 사용할 수 없어요. 잠시 후 다시 시도해 주세요.');
}
