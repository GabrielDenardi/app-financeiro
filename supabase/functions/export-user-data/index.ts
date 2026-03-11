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

  return { userClient, adminClient };
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  let requestId: string | null = null;
  let userId: string | null = null;

  try {
    const authHeader = request.headers.get('Authorization');
    const { userClient, adminClient } = createSupabaseClients(authHeader);
    const { data: authData, error: authError } = await userClient.auth.getUser();

    if (authError || !authData.user) {
      return new Response(JSON.stringify({ error: 'Nao autenticado.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const payload = await request.json();
    requestId = payload.requestId;
    userId = authData.user.id;

    const { error: requestError } = await adminClient
      .from('data_export_requests')
      .update({ status: 'processing' })
      .eq('id', requestId)
      .eq('user_id', userId);

    if (requestError) {
      throw requestError;
    }

    const tableNames = [
      'profiles',
      'user_preferences',
      'auth_login_events',
      'personal_accounts',
      'personal_transactions',
      'financial_goals',
      'goal_contributions',
      'budget_plans',
      'credit_cards',
      'credit_card_charges',
      'credit_card_installments',
      'import_batches',
      'import_batch_rows',
      'groups',
      'group_members',
      'group_splits',
      'group_split_shares',
      'group_settlements',
    ];

    const exportPayload: Record<string, unknown> = {
      exported_at: new Date().toISOString(),
      user_id: userId,
    };

    for (const tableName of tableNames) {
      if (tableName === 'profiles') {
        const { data, error } = await adminClient.from(tableName).select('*').eq('id', userId);
        if (error) {
          throw error;
        }
        exportPayload[tableName] = data ?? [];
        continue;
      }

      if (tableName === 'groups') {
        const { data, error } = await adminClient.from(tableName).select('*').eq('created_by', userId);
        if (error) {
          throw error;
        }
        exportPayload[tableName] = data ?? [];
        continue;
      }

      if (tableName === 'group_split_shares') {
        const { data: splitIds, error: splitError } = await adminClient
          .from('group_splits')
          .select('id')
          .or(`created_by.eq.${userId},owner_user_id.eq.${userId}`);

        if (splitError) {
          throw splitError;
        }

        const ids = (splitIds ?? []).map((row: { id: string }) => row.id);
        if (!ids.length) {
          exportPayload[tableName] = [];
          continue;
        }

        const { data, error } = await adminClient.from(tableName).select('*').in('split_id', ids);
        if (error) {
          throw error;
        }
        exportPayload[tableName] = data ?? [];
        continue;
      }

      if (tableName === 'group_members') {
        const { data, error } = await adminClient.from(tableName).select('*').eq('user_id', userId);
        if (error) {
          throw error;
        }
        exportPayload[tableName] = data ?? [];
        continue;
      }

      if (tableName === 'group_splits') {
        const { data, error } = await adminClient
          .from(tableName)
          .select('*')
          .or(`created_by.eq.${userId},owner_user_id.eq.${userId}`);
        if (error) {
          throw error;
        }
        exportPayload[tableName] = data ?? [];
        continue;
      }

      if (tableName === 'group_settlements') {
        const { data, error } = await adminClient
          .from(tableName)
          .select('*')
          .or(`from_user_id.eq.${userId},to_user_id.eq.${userId}`);
        if (error) {
          throw error;
        }
        exportPayload[tableName] = data ?? [];
        continue;
      }

      const { data, error } = await adminClient.from(tableName).select('*').eq('user_id', userId);
      if (error) {
        throw error;
      }

      exportPayload[tableName] = data ?? [];
    }

    const storagePath = `${userId}/${requestId}.json`;
    const uploadContent = new TextEncoder().encode(JSON.stringify(exportPayload, null, 2));

    const { error: uploadError } = await adminClient.storage
      .from('user-data-exports')
      .upload(storagePath, uploadContent, {
        contentType: 'application/json',
        upsert: true,
      });

    if (uploadError) {
      throw uploadError;
    }

    const { data: signedUrlData, error: signedUrlError } = await adminClient.storage
      .from('user-data-exports')
      .createSignedUrl(storagePath, 60 * 60);

    if (signedUrlError) {
      throw signedUrlError;
    }

    const { error: finishError } = await adminClient
      .from('data_export_requests')
      .update({
        status: 'completed',
        storage_path: storagePath,
        completed_at: new Date().toISOString(),
      })
      .eq('id', requestId)
      .eq('user_id', userId);

    if (finishError) {
      throw finishError;
    }

    return new Response(
      JSON.stringify({
        storagePath,
        signedUrl: signedUrlData.signedUrl,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao exportar os dados.';

    if (requestId && userId) {
      const { adminClient } = createSupabaseClients(null);
      await adminClient
        .from('data_export_requests')
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
