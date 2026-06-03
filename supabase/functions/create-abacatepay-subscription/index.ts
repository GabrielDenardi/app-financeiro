/// <reference path="../deno-globals.d.ts" />
/// <reference path="../deno-npm-modules.d.ts" />

import { createClient } from 'npm:@supabase/supabase-js@2';

const ABACATEPAY_API_URL = 'https://api.abacatepay.com/v2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type PlanId = 'basic' | 'intermediate' | 'pro';

const plans: Record<PlanId, { externalId: string; name: string; price: number; description: string }> = {
  basic: {
    externalId: 'app-financeiro-basic-monthly',
    name: 'App Financeiro - Plano Basico',
    price: 799,
    description: 'Plano Basico mensal do App Financeiro.',
  },
  intermediate: {
    externalId: 'app-financeiro-intermediate-monthly',
    name: 'App Financeiro - Plano Intermediario',
    price: 1299,
    description: 'Plano Intermediario mensal do App Financeiro.',
  },
  pro: {
    externalId: 'app-financeiro-pro-monthly',
    name: 'App Financeiro - Plano Pro',
    price: 1499,
    description: 'Plano Pro mensal do App Financeiro.',
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
    }

    const externalId = `sub_${profile.id}_${payload.planId}_${Date.now()}`;
    const checkout = await abacateRequest<{ id: string; url: string; status: string; externalId: string }>('/subscriptions/create', {
      method: 'POST',
      body: JSON.stringify({
        items: [{ id: productId, quantity: 1 }],
        customerId,
        externalId,
        methods: ['CARD'],
        returnUrl: 'appfinanceiro://billing/return',
        completionUrl: 'appfinanceiro://billing/complete',
        metadata: {
          userId: profile.id,
          planId: payload.planId,
        },
      }),
    });

    const { error: sessionError } = await adminClient.from('billing_checkout_sessions').insert({
      user_id: profile.id,
      plan_id: payload.planId,
      external_id: externalId,
      abacatepay_customer_id: customerId,
      abacatepay_checkout_id: checkout.id,
      checkout_url: checkout.url,
      status: 'pending',
      raw_response: checkout,
    });

    if (sessionError) {
      throw sessionError;
    }

    const { error: updateError } = await adminClient
      .from('profiles')
      .update({
        abacatepay_customer_id: customerId,
        subscription_status: 'pending',
        subscription_updated_at: new Date().toISOString(),
      })
      .eq('id', profile.id);

    if (updateError) {
      throw updateError;
    }

    return new Response(JSON.stringify({ checkoutUrl: checkout.url }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Nao foi possivel iniciar a assinatura.';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
