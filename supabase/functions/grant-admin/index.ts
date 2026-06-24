import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(payload), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status,
  });
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const bootstrapToken = Deno.env.get('ADMIN_BOOTSTRAP_TOKEN');
  const authorization = request.headers.get('Authorization') ?? '';
  const token = authorization.replace(/^Bearer\s+/i, '');
  const body = await request.json().catch(() => ({}));

  if (!supabaseUrl || !anonKey || !serviceRoleKey || !bootstrapToken) {
    return jsonResponse({ error: 'Admin bootstrap is not configured' }, 500);
  }

  if (!token) {
    return jsonResponse({ error: 'Invalid session' }, 401);
  }

  if (body?.bootstrapToken !== bootstrapToken) {
    return jsonResponse({ error: 'Invalid bootstrap token' }, 403);
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
    return jsonResponse({ error: 'Invalid session' }, 401);
  }

  const { count: activeAdminCount, error: adminCountError } = await serviceClient
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('is_admin', true)
    .eq('account_status', 'active');

  if (adminCountError) {
    return jsonResponse({ error: 'Could not verify admin bootstrap state' }, 500);
  }

  if ((activeAdminCount ?? 0) > 0) {
    const { data: callerProfile, error: callerProfileError } = await serviceClient
      .from('profiles')
      .select('account_status, is_admin')
      .eq('id', user.id)
      .maybeSingle();

    if (callerProfileError) {
      return jsonResponse({ error: 'Could not verify caller permissions' }, 500);
    }

    if (callerProfile?.account_status !== 'active' || callerProfile.is_admin !== true) {
      return jsonResponse({ error: 'Admin bootstrap is closed' }, 403);
    }
  }

  const { error } = await serviceClient
    .from('profiles')
    .update({
      account_status: 'active',
      is_admin: true,
      updated_at: new Date().toISOString(),
      verification_status: 'approved',
    })
    .eq('id', user.id);

  if (error) {
    return jsonResponse({ error: error.message }, 500);
  }

  return jsonResponse({ ok: true, userId: user.id });
});
