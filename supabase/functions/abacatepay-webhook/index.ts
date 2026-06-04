/// <reference path="../deno-globals.d.ts" />
/// <reference path="../deno-npm-modules.d.ts" />

import { createClient } from 'npm:@supabase/supabase-js@2';

const ABACATEPAY_PUBLIC_KEY = Deno.env.get('ABACATEPAY_PUBLIC_KEY') ?? '';

function createAdminClient() {
  return createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
}

function base64FromBytes(bytes: ArrayBuffer) {
  const values = new Uint8Array(bytes);
  let binary = '';
  for (const value of values) {
    binary += String.fromCharCode(value);
  }
  return btoa(binary);
}

function constantTimeEqual(left: string, right: string) {
  const leftBytes = new TextEncoder().encode(left);
  const rightBytes = new TextEncoder().encode(right);

  if (leftBytes.length !== rightBytes.length) {
    return false;
  }

  let result = 0;
  for (let index = 0; index < leftBytes.length; index += 1) {
    result |= leftBytes[index] ^ rightBytes[index];
  }

  return result === 0;
}

async function verifySignature(rawBody: string, signature: string | null) {
  if (!signature || !ABACATEPAY_PUBLIC_KEY) {
    return false;
  }

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(ABACATEPAY_PUBLIC_KEY),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const expected = base64FromBytes(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody)));
  return constantTimeEqual(expected, signature);
}

function getNestedString(value: unknown, path: string[]) {
  let current = value;
  for (const key of path) {
    if (!current || typeof current !== 'object' || !(key in current)) {
      return null;
    }
    current = (current as Record<string, unknown>)[key];
  }
  return typeof current === 'string' ? current : null;
}

Deno.serve(async (request) => {
  try {
    const url = new URL(request.url);
    if (url.searchParams.get('webhookSecret') !== Deno.env.get('ABACATEPAY_WEBHOOK_SECRET')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
    }

    const rawBody = await request.text();
    const signature =
      request.headers.get('X-Webhook-Signature') ?? request.headers.get('X-Abacate-Signature');
    const isValid = await verifySignature(rawBody, signature);
    if (!isValid) {
      return new Response(JSON.stringify({ error: 'Invalid signature' }), { status: 401 });
    }

    const payload = JSON.parse(rawBody);
    const eventId = typeof payload.id === 'string' ? payload.id : crypto.randomUUID();
    const eventName = typeof payload.event === 'string' ? payload.event : '';
    const adminClient = createAdminClient();

    const { error: eventError } = await adminClient.from('billing_webhook_events').insert({
      id: eventId,
      event_name: eventName,
      payload,
    });

    if (eventError) {
      if (String(eventError.message).toLowerCase().includes('duplicate')) {
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }
      throw eventError;
    }

    const externalId =
      getNestedString(payload, ['data', 'checkout', 'externalId']) ??
      getNestedString(payload, ['data', 'payment', 'externalId']) ??
      getNestedString(payload, ['data', 'subscription', 'externalId']);

    const subscriptionId = getNestedString(payload, ['data', 'subscription', 'id']);
    const checkoutStatus = getNestedString(payload, ['data', 'checkout', 'status']);
    const normalizedStatus =
      eventName === 'subscription.completed' || eventName === 'subscription.renewed' || eventName === 'subscription.trial_started'
        ? 'active'
        : eventName === 'subscription.cancelled'
          ? 'cancelled'
          : checkoutStatus === 'EXPIRED'
            ? 'expired'
            : checkoutStatus === 'REFUNDED'
              ? 'refunded'
              : null;

    if (externalId && normalizedStatus) {
      const { data: checkoutSession, error: checkoutError } = await adminClient
        .from('billing_checkout_sessions')
        .select('user_id, plan_id')
        .eq('external_id', externalId)
        .maybeSingle();

      if (checkoutError) {
        throw checkoutError;
      }

      if (checkoutSession) {
        await adminClient
          .from('billing_checkout_sessions')
          .update({
            status: normalizedStatus,
            abacatepay_subscription_id: subscriptionId,
            updated_at: new Date().toISOString(),
          })
          .eq('external_id', externalId);

        await adminClient
          .from('profiles')
          .update({
            subscription_plan: normalizedStatus === 'active' ? checkoutSession.plan_id : null,
            subscription_status: normalizedStatus,
            abacatepay_subscription_id: subscriptionId,
            subscription_activated_at: normalizedStatus === 'active' ? new Date().toISOString() : null,
            subscription_updated_at: new Date().toISOString(),
          })
          .eq('id', checkoutSession.user_id);
      }
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Webhook error';
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
});
