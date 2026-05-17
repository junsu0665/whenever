import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const predictionResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'predictedTopScoreLow',
    'predictedTopScoreHigh',
    'predictedCutScoreLow',
    'predictedCutScoreHigh',
    'confidence',
    'rationale',
    'biasWarning',
  ],
  properties: {
    predictedTopScoreLow: { type: 'number' },
    predictedTopScoreHigh: { type: 'number' },
    predictedCutScoreLow: { type: 'number' },
    predictedCutScoreHigh: { type: 'number' },
    confidence: { type: 'number' },
    rationale: { type: 'string' },
    biasWarning: { type: 'string' },
  },
};

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

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
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

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  const authorization = request.headers.get('Authorization') ?? '';
  const token = authorization.replace(/^Bearer\s+/i, '');

  if (!supabaseUrl || !anonKey || !token) {
    return new Response(JSON.stringify({ error: { message: 'Login session is required' } }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 401,
    });
  }

  const body = await request.json().catch(() => ({}));
  const examId = typeof body?.examId === 'string' ? body.examId : '';
  if (!examId) {
    return new Response(JSON.stringify({ error: { message: 'examId is required' } }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }

  const client = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const {
    data: { user },
    error: userError,
  } = await client.auth.getUser();

  if (userError || !user) {
    return new Response(JSON.stringify({ error: { message: 'Invalid session' } }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 401,
    });
  }

  const { data: exam, error: examError } = await client
    .from('score_exams')
    .select('id, subject, exam_name, max_score, total_students')
    .eq('id', examId)
    .maybeSingle();

  if (examError || !exam) {
    return new Response(JSON.stringify({ error: { message: 'Score exam not found' } }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 404,
    });
  }

  const { data: stats, error: statsError } = await client.rpc('get_score_exam_stats', { target_exam_id: examId });
  if (statsError || !stats) {
    return new Response(JSON.stringify({ error: { message: statsError?.message ?? 'Score stats unavailable' } }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 403,
    });
  }

  const sampleCount = Number(stats.submissionCount ?? 0);
  if (!stats.ready || sampleCount < 15) {
    return new Response(
      JSON.stringify({
        examId,
        status: 'insufficient_sample',
        sampleCount,
        rationale: '제보가 15명 이상 모이면 AI 참고 예측을 보여줍니다.',
        biasWarning: '성적을 잘 본 학생이 더 많이 입력했을 수 있어 지금은 컷을 예측하지 않습니다.',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  if (!apiKey) {
    return new Response(JSON.stringify({ error: { message: 'OPENAI_API_KEY is not configured' } }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }

  const maxScore = Number(exam.max_score);
  const anonymousScores = (Array.isArray(stats.anonymousScores) ? stats.anonymousScores : [])
    .map(Number)
    .filter((score) => Number.isFinite(score));
  const prompt = [
    'You estimate a Korean high-school 5-level grading reference range from anonymous self-reported scores.',
    'The first grade is top 10%. The app already shows observed top score and observed top 10% score.',
    'Self-reported data is biased because high scorers may be more likely to report. Never present the result as exact.',
    'Return a conservative range, bounded by 0 and maxScore. Keep Korean rationale concise.',
    JSON.stringify({
      subject: exam.subject,
      examName: exam.exam_name,
      maxScore,
      totalStudents: exam.total_students,
      sampleCount,
      observedTopScore: stats.topScore,
      observedTopTenCutScore: stats.topTenCutScore,
      anonymousScores,
    }),
  ].join('\n');

  const model = Deno.env.get('OPENAI_SCORE_MODEL') ?? Deno.env.get('OPENAI_MODEL') ?? 'gpt-4o-mini';
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      input: [{ role: 'user', content: [{ type: 'input_text', text: prompt }] }],
      text: {
        format: {
          type: 'json_schema',
          name: 'score_prediction',
          strict: true,
          schema: predictionResponseSchema,
        },
      },
      max_output_tokens: 900,
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    return new Response(JSON.stringify({ error: { message: payload?.error?.message ?? 'Score prediction failed' } }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: response.status,
    });
  }

  const outputText = getOutputText(payload);
  if (!outputText) {
    return new Response(JSON.stringify({ error: { message: 'Score prediction output is empty' } }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 502,
    });
  }

  let result;
  try {
    result = JSON.parse(outputText);
  } catch {
    return new Response(JSON.stringify({ error: { message: 'Score prediction output is not valid JSON' } }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 502,
    });
  }

  const normalized = {
    examId,
    status: 'ready',
    sampleCount,
    predictedTopScoreLow: clamp(Number(result.predictedTopScoreLow), 0, maxScore),
    predictedTopScoreHigh: clamp(Number(result.predictedTopScoreHigh), 0, maxScore),
    predictedCutScoreLow: clamp(Number(result.predictedCutScoreLow), 0, maxScore),
    predictedCutScoreHigh: clamp(Number(result.predictedCutScoreHigh), 0, maxScore),
    confidence: clamp(Number(result.confidence), 0, 1),
    rationale: String(result.rationale ?? ''),
    biasWarning: String(result.biasWarning ?? '자발 입력 표본이라 실제 컷과 차이가 날 수 있습니다.'),
  };

  return new Response(JSON.stringify(normalized), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
