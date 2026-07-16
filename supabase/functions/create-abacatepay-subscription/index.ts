/// <reference path="../deno-globals.d.ts" />

import { createClient } from 'npm:@supabase/supabase-js@2';

const ABACATEPAY_API_URL = 'https://api.abacatepay.com/v2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type PlanId = 'basic' | 'intermediate' | 'pro';

type CheckoutReservation = {
  session_id: string;
  external_id: string;
  checkout_url: string | null;
  should_create: boolean;
};

const plans: Record<PlanId, { externalId: string; name: string; price: number; description: string }> = {
  basic: {
    externalId: 'app-financeiro-basic-monthly',
    name: 'nitin - Plano Basico',
    price: 799,
    description: 'Plano Basico mensal do nitin.',
  },
  intermediate: {
    externalId: 'app-financeiro-intermediate-monthly',
    name: 'nitin - Plano Intermediario',
    price: 1299,
    description: 'Plano Intermediario mensal do nitin.',
  },
  pro: {
    externalId: 'app-financeiro-pro-monthly',
    name: 'nitin - Plano Pro',
    price: 1499,
    description: 'Plano Pro mensal do nitin.',
  },
};

function isPlanId(value: unknown): value is PlanId {
  return value === 'basic' || value === 'intermediate' || value === 'pro';
}

function createSupabaseClients(authHeader: string | null) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  return {
    userClient: createClient(supabaseUrl, anonKey, {
      global: {
        headers: authHeader ? { Authorization: authHeader } : {},
      },
    }),
    adminClient: createClient(supabaseUrl, serviceRoleKey),
  };
}

async function abacateRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const apiKey = Deno.env.get('ABACATEPAY_API_KEY');
  if (!apiKey) {
    throw new Error('ABACATEPAY_API_KEY nao configurada.');
  }

  const response = await fetch(`${ABACATEPAY_API_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.success) {
    const message = payload?.error?.message ?? payload?.error ?? 'Falha na AbacatePay.';
    throw new Error(typeof message === 'string' ? message : JSON.stringify(message));
  }

  return payload.data as T;
}

async function ensureProduct(planId: PlanId) {
  const plan = plans[planId];
  const products = await abacateRequest<Array<{ id: string; externalId: string }>>('/products/list');
  const existing = products.find((product) => product.externalId === plan.externalId);

  if (existing) {
    return existing.id;
  }

  const created = await abacateRequest<{ id: string }>('/products/create', {
    method: 'POST',
    body: JSON.stringify({
      externalId: plan.externalId,
      name: plan.name,
      description: plan.description,
      price: plan.price,
      currency: 'BRL',
      cycle: 'MONTHLY',
    }),
  });

  return created.id;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

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
    if (!isPlanId(payload.planId)) {
      return new Response(JSON.stringify({ error: 'Plano invalido.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: reservationRows, error: reservationError } = await userClient.rpc(
      'reserve_billing_checkout',
      { p_plan_id: payload.planId },
    );

    if (reservationError) {
      const reservationMessage = String(reservationError.message ?? 'Nao foi possivel reservar o checkout.');
      const status = reservationMessage.includes('Limite de checkouts')
        ? 429
        : reservationMessage.includes('assinatura ativa') ||
            reservationMessage.includes('Checkout') ||
            reservationMessage.includes('checkout')
          ? 409
          : 500;

      return new Response(JSON.stringify({ error: reservationMessage }), {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const reservation = (Array.isArray(reservationRows) ? reservationRows[0] : reservationRows) as
      | CheckoutReservation
      | null;

    if (!reservation) {
      throw new Error('Reserva de checkout nao retornada.');
    }

    if (!reservation.should_create && reservation.checkout_url) {
      return new Response(JSON.stringify({ checkoutUrl: reservation.checkout_url }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let subscriptionAttempted = false;

    try {
      const { data: profile, error: profileError } = await adminClient
        .from('profiles')
        .select('id, email, cpf, full_name, phone, cep, abacatepay_customer_id')
        .eq('id', authData.user.id)
        .single();

      if (profileError || !profile) {
        throw profileError ?? new Error('Perfil nao encontrado.');
      }

      const productId = await ensureProduct(payload.planId);
      let customerId = profile.abacatepay_customer_id as string | null;

      if (!customerId) {
        const customer = await abacateRequest<{ id: string }>('/customers/create', {
          method: 'POST',
          body: JSON.stringify({
            email: profile.email,
            taxId: profile.cpf,
            name: profile.full_name,
            cellphone: profile.phone,
            zipCode: profile.cep,
            metadata: {
              userId: profile.id,
            },
          }),
        });
        customerId = customer.id;

        const { error: customerUpdateError } = await adminClient
          .from('profiles')
          .update({ abacatepay_customer_id: customerId })
          .eq('id', profile.id)
          .is('abacatepay_customer_id', null);

        if (customerUpdateError) {
          throw customerUpdateError;
        }
      }

      subscriptionAttempted = true;
      const checkout = await abacateRequest<{ id: string; url: string; status: string; externalId: string }>(
        '/subscriptions/create',
        {
          method: 'POST',
          body: JSON.stringify({
            items: [{ id: productId, quantity: 1 }],
            customerId,
            externalId: reservation.external_id,
            methods: ['CARD'],
            returnUrl: 'appfinanceiro://billing/return',
            completionUrl: 'appfinanceiro://billing/complete',
            metadata: {
              userId: profile.id,
              planId: payload.planId,
            },
          }),
        },
      );

      const { data: finalizedSession, error: sessionError } = await adminClient
        .from('billing_checkout_sessions')
        .update({
          abacatepay_customer_id: customerId,
          abacatepay_checkout_id: checkout.id,
          checkout_url: checkout.url,
          status: 'pending',
          raw_response: checkout,
          updated_at: new Date().toISOString(),
        })
        .eq('id', reservation.session_id)
        .eq('user_id', profile.id)
        .eq('external_id', reservation.external_id)
        .eq('status', 'provisioning')
        .select('id')
        .maybeSingle();

      if (sessionError || !finalizedSession) {
        throw sessionError ?? new Error('Reserva de checkout nao pode ser finalizada.');
      }

      const { error: updateError } = await adminClient
        .from('profiles')
        .update({
          abacatepay_customer_id: customerId,
          subscription_updated_at: new Date().toISOString(),
        })
        .eq('id', profile.id)
        .eq('subscription_status', 'pending');

      if (updateError) {
        throw updateError;
      }

      return new Response(JSON.stringify({ checkoutUrl: checkout.url }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (error) {
      if (!subscriptionAttempted) {
        await adminClient
          .from('billing_checkout_sessions')
          .update({ status: 'failed', updated_at: new Date().toISOString() })
          .eq('id', reservation.session_id)
          .eq('user_id', authData.user.id)
          .eq('status', 'provisioning');

        await adminClient
          .from('profiles')
          .update({ subscription_status: 'inactive', subscription_updated_at: new Date().toISOString() })
          .eq('id', authData.user.id)
          .eq('subscription_status', 'pending');
      }

      throw error;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Nao foi possivel iniciar a assinatura.';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
