import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-ocr-api-key',
};

const timetableDays = ['월', '화', '수', '목', '금'];

const timetableResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['confidence', 'rows'],
  properties: {
    confidence: { type: 'number' },
    rows: {
      type: 'array',
      minItems: 1,
      maxItems: 12,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['period', 'mon', 'tue', 'wed', 'thu', 'fri'],
        properties: {
          period: { type: 'integer' },
          mon: {
            type: 'object',
            additionalProperties: false,
            required: ['subject', 'teacher', 'room'],
            properties: {
              subject: { type: 'string' },
              teacher: { type: 'string' },
              room: { type: 'string' },
            },
          },
          tue: {
            type: 'object',
            additionalProperties: false,
            required: ['subject', 'teacher', 'room'],
            properties: {
              subject: { type: 'string' },
              teacher: { type: 'string' },
              room: { type: 'string' },
            },
          },
          wed: {
            type: 'object',
            additionalProperties: false,
            required: ['subject', 'teacher', 'room'],
            properties: {
              subject: { type: 'string' },
              teacher: { type: 'string' },
              room: { type: 'string' },
            },
          },
          thu: {
            type: 'object',
            additionalProperties: false,
            required: ['subject', 'teacher', 'room'],
            properties: {
              subject: { type: 'string' },
              teacher: { type: 'string' },
              room: { type: 'string' },
            },
          },
          fri: {
            type: 'object',
            additionalProperties: false,
            required: ['subject', 'teacher', 'room'],
            properties: {
              subject: { type: 'string' },
              teacher: { type: 'string' },
              room: { type: 'string' },
            },
          },
        },
      },
    },
  },
};

const prompt = [
  'You are extracting ONLY the timetable grid from a Korean high-school timetable image.',
  'The image may include phone lock-screen text, stickers, captions, handwriting, upload UI, or decorative text outside the timetable. Ignore all text outside the rectangular timetable grid.',
  'Use the visible weekday header row 월 화 수 목 금 as the five columns, left to right.',
  'Use the visible period labels 1, 2, 3, ... in the far-left column as row numbers, top to bottom.',
  'For every grid intersection, read only the text inside that exact cell. Do not use reading order to guess positions.',
  'Never shift a subject to a neighboring day or period. If a cell is ambiguous, keep that exact cell empty rather than moving text from another cell.',
  'Each non-empty class cell usually has 1st line subject, 2nd line teacher, 3rd line room. Put those into subject, teacher, room.',
  'For empty cells, return subject="", teacher="", room="".',
  'For 창체 or other one-line cells, put it in subject and leave teacher and room empty.',
  'Return rows ordered by period. Return all visible period rows, including empty rows.',
].join('\n');

type OcrContext = {
  subjectCandidates?: string[];
  teacherCandidates?: string[];
  roomCandidates?: string[];
  knownSlots?: Array<{ day?: string; period?: number; subject?: string; teacher?: string; room?: string }>;
  expectedPeriodCount?: number;
  periodsByDay?: Record<string, number[]>;
};

const dayColumns = [
  { key: 'mon', day: '월' },
  { key: 'tue', day: '화' },
  { key: 'wed', day: '수' },
  { key: 'thu', day: '목' },
  { key: 'fri', day: '금' },
] as const;

const defaultPeriodTimes: Record<number, { startTime: string; endTime: string }> = {
  1: { startTime: '08:40', endTime: '09:30' },
  2: { startTime: '09:40', endTime: '10:30' },
  3: { startTime: '10:40', endTime: '11:30' },
  4: { startTime: '11:40', endTime: '12:30' },
  5: { startTime: '13:20', endTime: '14:10' },
  6: { startTime: '14:20', endTime: '15:10' },
  7: { startTime: '15:20', endTime: '16:10' },
  8: { startTime: '16:20', endTime: '17:10' },
};

type TimetableCell = {
  subject?: string;
  teacher?: string;
  room?: string;
};

type TimetableRow = {
  period?: number;
  mon?: TimetableCell;
  tue?: TimetableCell;
  wed?: TimetableCell;
  thu?: TimetableCell;
  fri?: TimetableCell;
};

function compact(value: unknown) {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
}

function rowsToSlots(rows: TimetableRow[] | undefined) {
  const slots = [];

  for (const row of rows ?? []) {
    const period = Math.round(Number(row.period));
    if (!Number.isFinite(period) || period < 1 || period > 12) {
      continue;
    }

    const periodTime = defaultPeriodTimes[period] ?? { startTime: '', endTime: '' };

    for (const { key, day } of dayColumns) {
      const cell = row[key];
      const subject = compact(cell?.subject);
      if (!subject) {
        continue;
      }

      slots.push({
        day,
        period,
        startTime: periodTime.startTime,
        endTime: periodTime.endTime,
        subject,
        teacher: compact(cell?.teacher),
        room: compact(cell?.room),
      });
    }
  }

  return slots;
}

function getOutputText(payload: { output_text?: string; output?: Array<{ content?: Array<{ type?: string; text?: string }> }> }) {
  if (payload.output_text) {
    return payload.output_text;
  }

  for (const item of payload.output ?? []) {
    for (const content of item.content ?? []) {
      if (content.type === 'output_text' && content.text) {
        return content.text;
      }
    }
  }

  return '';
}

function normalizeContextList(values: unknown, limit: number) {
  if (!Array.isArray(values)) {
    return [];
  }

  return [...new Set(values.map((value) => compact(value)).filter(Boolean))].slice(0, limit);
}

function normalizeOcrContext(value: unknown): OcrContext | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as OcrContext;
  const knownSlots = Array.isArray(candidate.knownSlots)
    ? candidate.knownSlots
        .map((slot) => ({
          day: compact(slot.day),
          period: Math.round(Number(slot.period)),
          subject: compact(slot.subject),
          teacher: compact(slot.teacher),
          room: compact(slot.room),
        }))
        .filter((slot) => timetableDays.includes(slot.day) && Number.isInteger(slot.period) && slot.period >= 1 && slot.period <= 12)
        .slice(0, 80)
    : [];
  const expectedPeriodCount = Math.round(Number(candidate.expectedPeriodCount));

  return {
    subjectCandidates: normalizeContextList(candidate.subjectCandidates, 60),
    teacherCandidates: normalizeContextList(candidate.teacherCandidates, 60),
    roomCandidates: normalizeContextList(candidate.roomCandidates, 60),
    knownSlots,
    expectedPeriodCount: Number.isInteger(expectedPeriodCount) && expectedPeriodCount >= 1 && expectedPeriodCount <= 12
      ? expectedPeriodCount
      : undefined,
    periodsByDay: candidate.periodsByDay && typeof candidate.periodsByDay === 'object' ? candidate.periodsByDay : undefined,
  };
}

function buildPrompt(context: OcrContext | null) {
  if (!context) {
    return prompt;
  }

  const hints = {
    expectedPeriodCount: context.expectedPeriodCount,
    subjectCandidates: context.subjectCandidates,
    teacherCandidates: context.teacherCandidates,
    roomCandidates: context.roomCandidates,
    knownSlots: context.knownSlots,
    periodsByDay: context.periodsByDay,
  };

  return [
    prompt,
    '',
    'Context hints from the already registered student timetable are below.',
    'Use these hints ONLY to resolve ambiguous OCR text, similar-looking subject names, teacher names, room names, and expected row count.',
    'Do not invent a class that is not visible in the image. If a cell is blank in the image, return it blank even if a known slot exists.',
    'If the image row count is ambiguous, weekdays should have the same number of period rows. Prefer expectedPeriodCount when provided.',
    'If visible text in a cell is ambiguous and a known slot with the same day/period exists, prefer that known subject/teacher/room.',
    JSON.stringify(hints),
  ].join('\n');
}

async function requireApprovedUser(request: Request) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const authorization = request.headers.get('Authorization') ?? '';
  const token = authorization.replace(/^Bearer\s+/i, '');

  if (!supabaseUrl || !anonKey || !token) {
    return { ok: false, status: 401, message: 'Login session is required' };
  }

  const client = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const {
    data: { user },
    error: userError,
  } = await client.auth.getUser();

  if (userError || !user) {
    return { ok: false, status: 401, message: 'Invalid session' };
  }

  const { data: profile, error: profileError } = await client
    .from('profiles')
    .select('verification_status, account_status')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError || profile?.verification_status !== 'approved' || (profile.account_status ?? 'active') !== 'active') {
    return { ok: false, status: 403, message: 'Student verification is required' };
  }

  return { ok: true, status: 200, message: 'ok' };
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: { message: 'Method not allowed' } }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 405,
    });
  }

  const authResult = await requireApprovedUser(request);
  if (!authResult.ok) {
    return new Response(JSON.stringify({ error: { message: authResult.message } }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: authResult.status,
    });
  }

  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) {
    return new Response(JSON.stringify({ error: { message: 'OPENAI_API_KEY is not configured' } }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }

  const { context, image } = await request.json().catch(() => ({ image: '', context: null }));
  if (!image || typeof image !== 'string') {
    return new Response(JSON.stringify({ error: { message: 'image is required' } }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
  const ocrContext = normalizeOcrContext(context);

  const model = Deno.env.get('OPENAI_MODEL') ?? 'gpt-4o-mini';
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: 'user',
          content: [
            { type: 'input_text', text: buildPrompt(ocrContext) },
            { type: 'input_image', image_url: image, detail: 'high' },
          ],
        },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'korean_school_timetable',
          strict: true,
          schema: timetableResponseSchema,
        },
      },
      max_output_tokens: 3000,
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    return new Response(JSON.stringify({ error: { message: payload?.error?.message ?? 'OCR failed' } }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: response.status,
    });
  }

  const outputText = getOutputText(payload);
  if (!outputText) {
    return new Response(JSON.stringify({ error: { message: 'OCR output is empty' } }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 502,
    });
  }

  let result;
  try {
    result = JSON.parse(outputText);
  } catch {
    return new Response(JSON.stringify({ error: { message: 'OCR output is not valid JSON' } }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 502,
    });
  }

  return new Response(JSON.stringify({ provider: `openai:${model}`, confidence: result.confidence, slots: rowsToSlots(result.rows) }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
