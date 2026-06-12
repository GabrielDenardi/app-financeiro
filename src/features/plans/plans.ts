import type { PlanEntitlements, SubscriptionPlan, SubscriptionPlanId } from './types';

export const DEFAULT_PLAN_ID: SubscriptionPlanId = 'free';

export const PAID_PLAN_IDS: SubscriptionPlanId[] = ['basic', 'intermediate', 'pro'];

export const SUBSCRIPTION_PLANS: Record<SubscriptionPlanId, SubscriptionPlan> = {
  free: {
    id: 'free',
    name: 'Plano Free',
    priceLabel: 'Gratis',
    accountLimit: 1,
    features: {
      fullReports: false,
      createGroups: false,
      supportChat: false,
      voiceCapture: false,
      dataImportExport: false,
    },
    benefits: [
      'Dashboard com resumo do mês',
      'Cadastro de receitas e despesas',
      'Acesso ao perfil',
    ],
  },
  basic: {
    id: 'basic',
    name: 'Plano Basico',
    priceLabel: 'R$ 7,99',
    accountLimit: 1,
    features: {
      fullReports: false,
      createGroups: false,
      supportChat: false,
      voiceCapture: false,
      dataImportExport: false,
    },
    benefits: [
      '1 conta financeira',
      'Relatorios parciais',
      'Entrar em grupos existentes',
    ],
  },
  intermediate: {
    id: 'intermediate',
    name: 'Plano Intermediario',
    priceLabel: 'R$ 12,99',
    accountLimit: 2,
    features: {
      fullReports: true,
      createGroups: true,
      supportChat: false,
      voiceCapture: true,
      dataImportExport: false,
    },
    benefits: [
      '2 contas financeiras',
      'Relatorios completos',
      'Criar e entrar em grupos',
      'Cadastro de despesas por voz',
    ],
  },
  pro: {
    id: 'pro',
    name: 'Plano Pro',
    priceLabel: 'R$ 14,99',
    accountLimit: 4,
    features: {
      fullReports: true,
      createGroups: true,
      supportChat: true,
      voiceCapture: true,
      dataImportExport: true,
    },
    benefits: [
      '4 contas financeiras',
      'Tudo dos outros planos',
      'Chat de suporte interno',
      'Importacao e exportacao de dados',
      'Exportacao para o Imposto de Renda',
    ],
  },
};

export const TRIAL_PLAN_ID: SubscriptionPlanId = 'intermediate';
// Must stay in sync with `interval '7 days'` in supabase/migrations/202606110002_intermediate_trial.sql.
export const TRIAL_DURATION_DAYS = 7;

export function normalizePlanId(planId?: string | null): SubscriptionPlanId {
  return isValidPlanId(planId) ? planId : DEFAULT_PLAN_ID;
}

export function isValidPlanId(planId?: string | null): planId is SubscriptionPlanId {
  return planId === 'free' || planId === 'basic' || planId === 'intermediate' || planId === 'pro';
}

export function isFreePlan(planId?: string | null): boolean {
  return normalizePlanId(planId) === 'free';
}

export function isTrialActive(trialEndsAt?: string | null): boolean {
  if (!trialEndsAt) {
    return false;
  }

  const endsAt = new Date(trialEndsAt).getTime();
  return Number.isFinite(endsAt) && endsAt > Date.now();
}

/**
 * Plano efetivo do usuario: durante o trial, planos abaixo do Intermediario
 * passam a valer como Intermediario; planos iguais ou superiores nao mudam.
 */
export function getEffectivePlanId(
  planId?: string | null,
  trialEndsAt?: string | null,
): SubscriptionPlanId {
  const normalized = normalizePlanId(planId);

  if (isTrialActive(trialEndsAt) && normalized !== 'intermediate' && normalized !== 'pro') {
    return TRIAL_PLAN_ID;
  }

  return normalized;
}

export function getPlan(planId?: string | null): SubscriptionPlan {
  return SUBSCRIPTION_PLANS[normalizePlanId(planId)];
}

export function getPlanEntitlements(
  planId?: string | null,
  trialEndsAt?: string | null,
): PlanEntitlements {
  const plan = SUBSCRIPTION_PLANS[getEffectivePlanId(planId, trialEndsAt)];

  return {
    accountLimit: plan.accountLimit,
    ...plan.features,
  };
}

export function canCreateAccount(
  planId: string | null | undefined,
  activeAccountCount: number,
  trialEndsAt?: string | null,
) {
  return activeAccountCount < getPlanEntitlements(planId, trialEndsAt).accountLimit;
}

export function getAccountLimitMessage(planId: string | null | undefined) {
  const plan = getPlan(planId);
  return `Seu ${plan.name} permite ate ${plan.accountLimit} conta(s) financeira(s). Veja os planos para aumentar esse limite.`;
}

export function getUpgradeMessage(featureName: string) {
  return `${featureName} nao esta disponivel no seu plano atual. Veja os planos para liberar esse recurso.`;
}
