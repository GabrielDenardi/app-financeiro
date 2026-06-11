import type { SubscriptionPlanId } from '../features/plans/types';

export type UserProfile = {
  id: string;
  email: string;
  subscriptionPlan: SubscriptionPlanId;
  trialStartedAt: string | null;
  trialEndsAt: string | null;
  fullName: string;
  phone: string;
  birthDate: string | null;
  cep: string;
  street: string;
  addressNumber: string;
  complement: string;
  city: string;
  state: string;
  bio: string;
};

export type UpdateUserProfileInput = {
  id: string;
  email: string;
  subscriptionPlan?: SubscriptionPlanId;
  fullName: string;
  phone: string;
  birthDate: string | null;
  cep: string;
  street: string;
  addressNumber: string;
  complement: string;
  city: string;
  state: string;
  bio: string;
};
