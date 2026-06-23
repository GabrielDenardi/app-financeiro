/// <reference path="../deno-globals.d.ts" />

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Metodo nao permitido.' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const authClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'Requisicao invalida.' }, 400);
  }

  const action = String(payload.action ?? '');
  const cpf = String(payload.cpf ?? '').replace(/\D/g, '');
  if (!['sign_in', 'recover'].includes(action) || !/^\d{11}$/.test(cpf)) {
    return json({ error: 'Requisicao invalida.' }, 400);
  }

  const clientAddress = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const rateKey = await sha256(`${cpf}:${clientAddress}`);
  const { data: allowed, error: limitError } = await adminClient.rpc('consume_auth_rate_limit', {
    p_key: rateKey,
  });
  if (limitError || !allowed) {
    return json({ error: 'Muitas tentativas. Tente novamente mais tarde.' }, 429);
  }

  const { data: profile } = await adminClient
    .from('profiles')
    .select('id')
    .eq('cpf', cpf)
    .maybeSingle();
  const { data: authUser } = profile?.id
    ? await adminClient.auth.admin.getUserById(profile.id)
    : { data: { user: null } };
  const email = authUser.user?.email ?? null;

  if (action === 'recover') {
    if (email) {
      const redirectTo = Deno.env.get('AUTH_REDIRECT_URL') ?? 'appfinanceiro://auth/callback';
      await authClient.auth.resetPasswordForEmail(email, { redirectTo });
    }
    return json({ accepted: true });
  }

  const password = String(payload.password ?? '');
  if (!email || password.length < 1) {
    return json({ error: 'CPF ou senha invalidos.' }, 401);
  }

  const { data, error } = await authClient.auth.signInWithPassword({ email, password });
  if (error || !data.session) {
    return json({ error: 'CPF ou senha invalidos.' }, 401);
  }

  return json({
    session: {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_at: data.session.expires_at,
    },
  });
});
