import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function createSupabaseClients(authHeader: string | null) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  const userClient = createClient(supabaseUrl, anonKey, {
    global: {
      headers: authHeader ? { Authorization: authHeader } : {},
    },
  });
  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  const passwordClient = createClient(supabaseUrl, anonKey);

  return { userClient, adminClient, passwordClient };
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  let requestId: string | null = null;
  let userId: string | null = null;

  try {
    const authHeader = request.headers.get('Authorization');
    const { userClient, adminClient, passwordClient } = createSupabaseClients(authHeader);
    const { data: authData, error: authError } = await userClient.auth.getUser();

    if (authError || !authData.user || !authData.user.email) {
      return new Response(JSON.stringify({ error: 'Nao autenticado.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const payload = await request.json();
    requestId = payload.requestId;
    const password = payload.password;
    userId = authData.user.id;

    const { error: signInError } = await passwordClient.auth.signInWithPassword({
      email: authData.user.email,
      password,
    });

    if (signInError) {
      return new Response(JSON.stringify({ error: 'Senha invalida.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    await adminClient
      .from('account_deletion_requests')
      .update({
        status: 'processing',
      })
      .eq('id', requestId)
      .eq('user_id', userId);

    const { data: objectList } = await adminClient.storage
      .from('user-data-exports')
      .list(userId, {
        limit: 100,
      });

    if (objectList?.length) {
      await adminClient.storage
        .from('user-data-exports')
        .remove(objectList.map((item) => `${userId}/${item.name}`));
    }

    const { error: completeError } = await adminClient
      .from('account_deletion_requests')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        error_message: '',
      })
      .eq('id', requestId)
      .eq('user_id', userId);

    if (completeError) {
      throw completeError;
    }

    const deleteResponse = await adminClient.auth.admin.deleteUser(userId);

    if (deleteResponse.error) {
      throw deleteResponse.error;
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao excluir a conta.';

    if (requestId && userId) {
      const { adminClient } = createSupabaseClients(null);
      await adminClient
        .from('account_deletion_requests')
        .update({
          status: 'failed',
          error_message: message,
        })
        .eq('id', requestId)
        .eq('user_id', userId);
    }

    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
