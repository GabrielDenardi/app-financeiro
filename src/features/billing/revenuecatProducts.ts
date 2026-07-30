import type { SubscriptionPlanId } from '../plans/types';

export const REVENUECAT_ENTITLEMENT_ID = 'paid_access';

export const GOOGLE_PLAY_PRODUCT_IDS = {
  basic: 'appfinanceiro_basic_v1',
  intermediate: 'appfinanceiro_intermediate_v1',
  pro: 'appfinanceiro_pro_v1',
} as const satisfies Record<Exclude<SubscriptionPlanId, 'free'>, string>;

export type PaidSubscriptionPlanId = keyof typeof GOOGLE_PLAY_PRODUCT_IDS;

export const PAID_PLAN_RANK: Record<PaidSubscriptionPlanId, number> = {
  basic: 1,
  intermediate: 2,
  pro: 3,
};

export function getGooglePlaySubscriptionId(productIdentifier: string): string {
  return productIdentifier.split(':', 1)[0];
}

export function getPlanIdFromProduct(
  productIdentifier?: string | null,
): PaidSubscriptionPlanId | null {
  if (!productIdentifier) {
    return null;
  }

  const subscriptionId = getGooglePlaySubscriptionId(productIdentifier);
  const entry = Object.entries(GOOGLE_PLAY_PRODUCT_IDS).find(
    ([, configuredId]) => configuredId === subscriptionId,
  );

  return (entry?.[0] as PaidSubscriptionPlanId | undefined) ?? null;
}
