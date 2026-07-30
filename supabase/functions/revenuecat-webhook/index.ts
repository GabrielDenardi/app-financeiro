import { createClient } from 'npm:@supabase/supabase-js@2';

import {
  applyRevenueCatSubscriptionState,
  fetchRevenueCatSubscriptionState,
} from '../_shared/revenuecat.ts';

type WebhookPayload = {
  api_version?: string;
  event?: {
    id?: string;
    type?: string;
    app_user_id?: string;
    original_app_user_id?: string;
    aliases?: string[];
    transferred_from?: string[];
    transferred_to?: string[];
    event_timestamp_ms?: number;
    store?: string;
  };
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function createAdminClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Supabase admin credentials are not configured.');
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function isUuid(value?: string): value is string {
  return Boolean(
    value &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        value,
      ),
  );
}

Deno.serve(async (request) => {
  try {
    if (request.method !== 'POST') {
      return jsonResponse({ error: 'Method not allowed' }, 405);
    }

    const webhookToken = Deno.env.get('REVENUECAT_WEBHOOK_AUTH_TOKEN');
    if (
      !webhookToken ||
      request.headers.get('Authorization') !== `Bearer ${webhookToken}`
    ) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    const payload = (await request.json()) as WebhookPayload;
    const event = payload.event;
    const eventId = event?.id;
    const userIdCandidates = [
      event?.app_user_id,
      event?.original_app_user_id,
      ...(event?.aliases ?? []),
    ];
    const userId = userIdCandidates.find(isUuid) ?? null;

    if (!eventId || !event?.type) {
      return jsonResponse({ error: 'Invalid RevenueCat event' }, 400);
    }

    if (event.store && event.store !== 'PLAY_STORE') {
      return jsonResponse({ ok: true, ignored: true });
    }

    const eventAt = new Date(
      typeof event.event_timestamp_ms === 'number'
        ? event.event_timestamp_ms
        : Date.now(),
    ).toISOString();
    const transferredUserIds =
      event.type === 'TRANSFER'
        ? [...(event.transferred_from ?? []), ...(event.transferred_to ?? [])].filter(
            isUuid,
          )
        : [];
    const affectedUserIds = [
      ...new Set([
        ...(userId ? [userId] : []),
        ...transferredUserIds,
      ]),
    ];

    if (affectedUserIds.length === 0) {
      return jsonResponse({ ok: true, ignored: true });
    }

    const adminClient = createAdminClient();
    const results = await Promise.all(
      affectedUserIds.map(async (affectedUserId) => {
        const { raw, state } =
          await fetchRevenueCatSubscriptionState(affectedUserId);
        return applyRevenueCatSubscriptionState(adminClient, {
          eventId:
            affectedUserIds.length === 1
              ? eventId
              : `${eventId}:${affectedUserId}`,
          eventName: event.type!,
          userId: affectedUserId,
          eventAt,
          payload: { webhook: payload, subscriber: raw },
          state,
        });
      }),
    );

    return jsonResponse({ ok: true, applied: results.some(Boolean) });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Webhook error';
    return jsonResponse({ error: message }, 500);
  }
});
