import { File } from 'expo-file-system';

import { demoTimetable } from '../data/mockData';
import { TimetableDay, TimetableImageInput, TimetableSlot } from '../types';
import { getCourseId, getDefaultPeriodTime, getSubjectColor, sortTimetableSlots, timetableDays } from '../utils/timetable';
import { providerConfig } from './env';
import { supabase } from './supabase';

export interface OcrTimetableResult {
  provider: string;
  confidence: number;
  slots: TimetableSlot[];
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

function normalizeRecognizedSlots(payload: RecognizedTimetablePayload, importedAt: number): TimetableSlot[] {
  const slots = payload.slots ?? [];
  const normalized = slots
    .map((slot, index): TimetableSlot | null => {
      const subject = (slot.subject ?? '').trim();
      const period = Math.round(Number(slot.period));
      if (!isTimetableDay(slot.day) || !subject || !Number.isFinite(period) || period < 1 || period > 12) {
        return null;
      }

      const defaults = getDefaultPeriodTime(period);
      const teacher = (slot.teacher ?? '').trim();
      const room = (slot.room ?? '').trim();

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
    throw new Error('시간표 칸을 찾지 못했습니다. 더 선명한 사진으로 다시 시도해 주세요.');
  }

  return sortTimetableSlots(normalized);
}

async function blobUriToDataUrl(uri: string, mimeType: string) {
  const response = await fetch(uri);
  if (!response.ok) {
    throw new Error('선택한 이미지 파일을 읽지 못했습니다.');
  }

  const blob = await response.blob();

  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('선택한 이미지 파일을 변환하지 못했습니다.'));
    reader.onload = () => {
      if (typeof reader.result === 'string' && reader.result) {
        resolve(reader.result);
        return;
      }
      reject(new Error('선택한 이미지 파일을 변환하지 못했습니다.'));
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
  if (typeof payload.error === 'string') {
    return payload.error;
  }

  return payload.error?.message ?? payload.message ?? payload.code ?? 'OCR endpoint 요청에 실패했습니다.';
}

async function parseWithEndpoint(imageSource: TimetableImageSource): Promise<OcrTimetableResult> {
  if (!providerConfig.ocrEndpoint) {
    throw new Error('OCR endpoint가 없습니다. EXPO_PUBLIC_OCR_ENDPOINT를 설정해 주세요.');
  }

  const image = await imageSourceToOpenAiImageUrl(imageSource);
  const {
    data: { session },
  } = supabase ? await supabase.auth.getSession() : { data: { session: null } };
  const authorizationToken = session?.access_token ?? providerConfig.supabaseAnonKey;
  const response = await fetch(providerConfig.ocrEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(providerConfig.supabaseAnonKey ? { apikey: providerConfig.supabaseAnonKey } : {}),
      ...(authorizationToken ? { Authorization: `Bearer ${authorizationToken}` } : {}),
      ...(providerConfig.ocrApiKey ? { 'x-ocr-api-key': providerConfig.ocrApiKey } : {}),
    },
    body: JSON.stringify({
      image,
      schemaVersion: 1,
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
    slots: normalizeRecognizedSlots(payload, importedAt),
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

export async function parseTimetableImage(imageSource: TimetableImageSource): Promise<OcrTimetableResult> {
  if (providerConfig.ocrProvider === 'endpoint') {
    return parseWithEndpoint(imageSource);
  }

  if (providerConfig.ocrProvider === 'mock' && providerConfig.allowMocks) {
    return parseWithMock(imageSource);
  }

  if (providerConfig.ocrProvider === 'openai') {
    throw new Error('앱 직접 OpenAI OCR은 지원하지 않습니다. Supabase Edge Function OCR endpoint를 설정해 주세요.');
  }

  throw new Error(`지원하지 않는 OCR provider입니다: ${providerConfig.ocrProvider}`);
}
