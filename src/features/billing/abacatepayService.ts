import type { SubscriptionPlanId } from '../plans/types';
import { supabase } from '../../lib/supabase';

type CreateSubscriptionResponse = {
  checkoutUrl?: string;
  error?: string;
};

export async function startAbacatepaySubscription(planId: SubscriptionPlanId) {
  const { data, error } = await supabase.functions.invoke<CreateSubscriptionResponse>(
    'create-abacatepay-subscription',
    {
      body: { planId },
    },
  );

  if (error) {
    throw new Error(error.message);
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  if (!data?.checkoutUrl) {
    throw new Error('Nao foi possivel iniciar o checkout da assinatura.');
  }

  return data.checkoutUrl;
}
