import {
  canCreateAccount,
  getEffectivePlanId,
  getPlan,
  getPlanEntitlements,
  isTrialActive,
  normalizePlanId,
  SUBSCRIPTION_PLANS,
} from '../plans';

const FUTURE_DATE = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
const PAST_DATE = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

describe('subscription plans', () => {
  it('defaults unknown or missing plan ids to free', () => {
    expect(normalizePlanId(null)).toBe('free');
    expect(normalizePlanId('unknown')).toBe('free');
    expect(normalizePlanId('basic')).toBe('basic');
    expect(getPlan(undefined)).toEqual(SUBSCRIPTION_PLANS.free);
  });

  it('exposes the expected entitlement matrix', () => {
    expect(getPlanEntitlements('free')).toMatchObject({
      accountLimit: 1,
      fullReports: false,
      createGroups: false,
      supportChat: false,
      voiceCapture: false,
      dataImportExport: false,
    });

    expect(getPlanEntitlements('basic')).toMatchObject({
      accountLimit: 1,
      fullReports: false,
      createGroups: false,
      supportChat: false,
      voiceCapture: false,
      dataImportExport: false,
    });

    expect(getPlanEntitlements('intermediate')).toMatchObject({
      accountLimit: 2,
      fullReports: true,
      createGroups: true,
      supportChat: false,
      voiceCapture: true,
      dataImportExport: false,
    });

    expect(getPlanEntitlements('pro')).toMatchObject({
      accountLimit: 4,
      fullReports: true,
      createGroups: true,
      supportChat: true,
      voiceCapture: true,
      dataImportExport: true,
    });
  });

  it('detects active and expired trials', () => {
    expect(isTrialActive(null)).toBe(false);
    expect(isTrialActive(undefined)).toBe(false);
    expect(isTrialActive(PAST_DATE)).toBe(false);
    expect(isTrialActive(FUTURE_DATE)).toBe(true);
  });

  it('upgrades the effective plan to intermediate during an active trial', () => {
    expect(getEffectivePlanId('basic', FUTURE_DATE)).toBe('intermediate');
    expect(getEffectivePlanId('basic', PAST_DATE)).toBe('basic');
    expect(getEffectivePlanId('basic', null)).toBe('basic');
    // Planos iguais ou superiores nao mudam durante o trial.
    expect(getEffectivePlanId('intermediate', FUTURE_DATE)).toBe('intermediate');
    expect(getEffectivePlanId('pro', FUTURE_DATE)).toBe('pro');
  });

  it('grants intermediate entitlements while the trial is active', () => {
    expect(getPlanEntitlements('basic', FUTURE_DATE)).toMatchObject({
      accountLimit: 2,
      fullReports: true,
      createGroups: true,
      voiceCapture: true,
      supportChat: false,
      dataImportExport: false,
    });

    expect(getPlanEntitlements('basic', PAST_DATE)).toMatchObject({
      accountLimit: 1,
      fullReports: false,
    });
  });

  it('checks account creation limits by active account count', () => {
    expect(canCreateAccount('free', 0)).toBe(true);
    expect(canCreateAccount('free', 1)).toBe(false);
    expect(canCreateAccount('basic', 0)).toBe(true);
    expect(canCreateAccount('basic', 1)).toBe(false);
    expect(canCreateAccount('intermediate', 1)).toBe(true);
    expect(canCreateAccount('intermediate', 2)).toBe(false);
    expect(canCreateAccount('pro', 3)).toBe(true);
    expect(canCreateAccount('pro', 4)).toBe(false);
  });

  it('applies trial-upgraded account limits when trial is active', () => {
    // Basic user with active trial gets intermediate limits (2 accounts).
    expect(canCreateAccount('basic', 1, FUTURE_DATE)).toBe(true);
    expect(canCreateAccount('basic', 2, FUTURE_DATE)).toBe(false);
    // After trial expires, reverts to basic limits (1 account).
    expect(canCreateAccount('basic', 1, PAST_DATE)).toBe(false);
  });
});
