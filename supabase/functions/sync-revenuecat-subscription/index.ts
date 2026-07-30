import { createClient } from 'npm:@supabase/supabase-js@2';

import {
  applyRevenueCatSubscriptionState,
  fetchRevenueCatSubscriptionState,
} from '../_shared/revenuecat.ts';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (request) => {
  try {
    if (request.method !== 'POST') {
      return jsonResponse({ error: 'Method not allowed' }, 405);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const authorization = request.headers.get('Authorization');
    if (!supabaseUrl || !anonKey || !serviceRoleKey || !authorization) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();

    if (userError || !user) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    const { raw, state } = await fetchRevenueCatSubscriptionState(user.id);
    const eventAt = new Date().toISOString();
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const applied = await applyRevenueCatSubscriptionState(adminClient, {
      eventId: `sync:${user.id}:${Date.now()}`,
      eventName: 'CUSTOMER_SYNC',
      userId: user.id,
      eventAt,
      payload: { subscriber: raw },
      state,
    });

    return jsonResponse({ ok: true, applied, planId: state.planId });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Subscription sync error';
    return jsonResponse({ error: message }, 500);
  }
});
