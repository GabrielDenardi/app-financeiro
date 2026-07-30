import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

export type SubscriptionPlanId = 'free' | 'basic' | 'intermediate' | 'pro';

const GOOGLE_PLAY_PRODUCT_TO_PLAN: Record<string, Exclude<SubscriptionPlanId, 'free'>> = {
  appfinanceiro_basic_v1: 'basic',
  appfinanceiro_intermediate_v1: 'intermediate',
  appfinanceiro_pro_v1: 'pro',
};

const PLAN_RANK: Record<SubscriptionPlanId, number> = {
  free: 0,
  basic: 1,
  intermediate: 2,
  pro: 3,
};

type RevenueCatEntitlement = {
  product_identifier?: string | null;
  expires_date?: string | null;
  purchase_date?: string | null;
};

type RevenueCatSubscription = {
  expires_date?: string | null;
  unsubscribe_detected_at?: string | null;
  billing_issues_detected_at?: string | null;
  grace_period_expires_date?: string | null;
  original_transaction_id?: string | null;
  store_transaction_id?: string | null;
  is_sandbox?: boolean;
};

type RevenueCatSubscriberResponse = {
  request_date?: string;
  subscriber?: {
    entitlements?: Record<string, RevenueCatEntitlement>;
    subscriptions?: Record<string, RevenueCatSubscription>;
  };
};

export type RevenueCatSubscriptionState = {
  planId: SubscriptionPlanId;
  status: 'inactive' | 'active' | 'cancelled' | 'expired' | 'grace_period';
  productId: string | null;
  transactionId: string | null;
  expiresAt: string | null;
  autoRenews: boolean | null;
  environment: 'SANDBOX' | 'PRODUCTION' | null;
};

function getSubscriptionId(productIdentifier: string): string {
  return productIdentifier.split(':', 1)[0];
}

function getPlanId(productIdentifier?: string | null): SubscriptionPlanId | null {
  if (!productIdentifier) {
    return null;
  }
  return GOOGLE_PLAY_PRODUCT_TO_PLAN[getSubscriptionId(productIdentifier)] ?? null;
}

function isFutureDate(value?: string | null): boolean {
  if (!value) {
    return true;
  }
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) && timestamp > Date.now();
}

export function deriveRevenueCatSubscriptionState(
  response: RevenueCatSubscriberResponse,
): RevenueCatSubscriptionState {
  const entitlements = Object.values(response.subscriber?.entitlements ?? {});
  const activeEntitlements = entitlements
    .map((entitlement) => ({
      entitlement,
      planId: getPlanId(entitlement.product_identifier),
    }))
    .filter(
      (
        item,
      ): item is {
        entitlement: RevenueCatEntitlement;
        planId: Exclude<SubscriptionPlanId, 'free'>;
      } => Boolean(item.planId) && isFutureDate(item.entitlement.expires_date),
    )
    .sort((left, right) => PLAN_RANK[right.planId] - PLAN_RANK[left.planId]);

  const selected = activeEntitlements[0];
  if (!selected?.entitlement.product_identifier) {
    return {
      planId: 'free',
      status: entitlements.some((item) => getPlanId(item.product_identifier))
        ? 'expired'
        : 'inactive',
      productId: null,
      transactionId: null,
      expiresAt: null,
      autoRenews: null,
      environment: null,
    };
  }

  const productId = selected.entitlement.product_identifier;
  const subscription =
    response.subscriber?.subscriptions?.[productId] ??
    response.subscriber?.subscriptions?.[getSubscriptionId(productId)] ??
    null;
  const inGracePeriod =
    Boolean(subscription?.billing_issues_detected_at) &&
    isFutureDate(subscription?.grace_period_expires_date);
  const cancelled = Boolean(subscription?.unsubscribe_detected_at);

  return {
    planId: selected.planId,
    status: inGracePeriod ? 'grace_period' : cancelled ? 'cancelled' : 'active',
    productId,
    transactionId:
      subscription?.store_transaction_id ??
      subscription?.original_transaction_id ??
      null,
    expiresAt:
      selected.entitlement.expires_date ??
      subscription?.expires_date ??
      null,
    autoRenews: inGracePeriod ? true : !cancelled,
    environment:
      typeof subscription?.is_sandbox === 'boolean'
        ? subscription.is_sandbox
          ? 'SANDBOX'
          : 'PRODUCTION'
        : null,
  };
}

export async function fetchRevenueCatSubscriptionState(
  appUserId: string,
): Promise<{
  raw: RevenueCatSubscriberResponse;
  state: RevenueCatSubscriptionState;
}> {
  const secretApiKey = Deno.env.get('REVENUECAT_SECRET_API_KEY');
  if (!secretApiKey) {
    throw new Error('REVENUECAT_SECRET_API_KEY nao configurada.');
  }

  const response = await fetch(
    `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(appUserId)}`,
    {
      headers: {
        Authorization: `Bearer ${secretApiKey}`,
        Accept: 'application/json',
      },
    },
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`RevenueCat respondeu ${response.status}: ${body.slice(0, 300)}`);
  }

  const raw = (await response.json()) as RevenueCatSubscriberResponse;
  return {
    raw,
    state: deriveRevenueCatSubscriptionState(raw),
  };
}

export async function applyRevenueCatSubscriptionState(
  adminClient: SupabaseClient,
  input: {
    eventId: string;
    eventName: string;
    userId: string;
    eventAt: string;
    payload: unknown;
    state: RevenueCatSubscriptionState;
  },
): Promise<boolean> {
  const { data, error } = await adminClient.rpc(
    'apply_revenuecat_subscription_event',
    {
      p_event_id: input.eventId,
      p_event_name: input.eventName,
      p_user_id: input.userId,
      p_plan_id: input.state.planId,
      p_status: input.state.status,
      p_product_id: input.state.productId,
      p_transaction_id: input.state.transactionId,
      p_expires_at: input.state.expiresAt,
      p_auto_renews: input.state.autoRenews,
      p_environment: input.state.environment,
      p_event_at: input.eventAt,
      p_payload: input.payload,
    },
  );

  if (error) {
    throw error;
  }

  return data === true;
}
