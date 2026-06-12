export type SubscriptionPlanId = 'free' | 'basic' | 'intermediate' | 'pro';

export type PlanFeatureKey =
  | 'fullReports'
  | 'createGroups'
  | 'supportChat'
  | 'voiceCapture'
  | 'dataImportExport';

export type SubscriptionPlan = {
  id: SubscriptionPlanId;
  name: string;
  priceLabel: string;
  accountLimit: number;
  features: Record<PlanFeatureKey, boolean>;
  benefits: string[];
};

export type PlanEntitlements = SubscriptionPlan['features'] & {
  accountLimit: number;
};
