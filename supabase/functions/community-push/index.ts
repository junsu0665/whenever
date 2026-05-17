import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function sendExpoPushMessage(pushToken: string, title: string, body: string, postId: string) {
  const response = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      to: pushToken,
      title,
      body,
      data: { postId, type: 'comment' },
      sound: 'default',
    }),
  });

  return response.ok;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 405,
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const authorization = request.headers.get('Authorization') ?? '';
  const token = authorization.replace(/^Bearer\s+/i, '');

  if (!supabaseUrl || !anonKey || !serviceRoleKey || !token) {
    return new Response(JSON.stringify({ error: 'Community push is not configured' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }

  const body = await request.json().catch(() => ({}));
  const postId = typeof body?.postId === 'string' ? body.postId : '';
  if (!postId) {
    return new Response(JSON.stringify({ error: 'postId is required' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const serviceClient = createClient(supabaseUrl, serviceRoleKey);
  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser();

  if (userError || !user) {
    return new Response(JSON.stringify({ error: 'Invalid session' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 401,
    });
  }

  const { data: actor } = await serviceClient
    .from('profiles')
    .select('school_id, verification_status, account_status')
    .eq('id', user.id)
    .maybeSingle();

  if (actor?.verification_status !== 'approved' || actor.account_status !== 'active') {
    return new Response(JSON.stringify({ error: 'Student verification is required' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 403,
    });
  }

  const { data: post } = await serviceClient
    .from('posts')
    .select('id, author_id, school_id, title, hidden')
    .eq('id', postId)
    .maybeSingle();

  if (!post || post.hidden || post.school_id !== actor.school_id || post.author_id === user.id) {
    return new Response(JSON.stringify({ ok: true, sent: false }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { data: settings } = await serviceClient
    .from('notification_settings')
    .select('community, push_token')
    .eq('user_id', post.author_id)
    .maybeSingle();

  if (!settings?.community || !settings.push_token) {
    return new Response(JSON.stringify({ ok: true, sent: false }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const sent = await sendExpoPushMessage(settings.push_token, '새 댓글이 달렸어요', post.title, post.id);
  return new Response(JSON.stringify({ ok: true, sent }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
