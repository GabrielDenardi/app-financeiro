import type { PlanEntitlements, SubscriptionPlan, SubscriptionPlanId } from './types';

export const DEFAULT_PLAN_ID: SubscriptionPlanId = 'basic';

export const SUBSCRIPTION_PLANS: Record<SubscriptionPlanId, SubscriptionPlan> = {
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

export function normalizePlanId(planId?: string | null): SubscriptionPlanId {
  return planId === 'intermediate' || planId === 'pro' ? planId : DEFAULT_PLAN_ID;
}

export function isValidPlanId(planId?: string | null): planId is SubscriptionPlanId {
  return planId === 'basic' || planId === 'intermediate' || planId === 'pro';
}

export function getPlan(planId?: string | null): SubscriptionPlan {
  return SUBSCRIPTION_PLANS[normalizePlanId(planId)];
}

export function getPlanEntitlements(planId?: string | null): PlanEntitlements {
  const plan = getPlan(planId);

  return {
    accountLimit: plan.accountLimit,
    ...plan.features,
  };
}

export function canCreateAccount(planId: string | null | undefined, activeAccountCount: number) {
  return activeAccountCount < getPlanEntitlements(planId).accountLimit;
}

export function getAccountLimitMessage(planId: string | null | undefined) {
  const plan = getPlan(planId);
  return `Seu ${plan.name} permite ate ${plan.accountLimit} conta(s) financeira(s). Veja os planos para aumentar esse limite.`;
}

export function getUpgradeMessage(featureName: string) {
  return `${featureName} nao esta disponivel no seu plano atual. Veja os planos para liberar esse recurso.`;
}
