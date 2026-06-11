import {
  canCreateAccount,
  getPlan,
  getPlanEntitlements,
  normalizePlanId,
  SUBSCRIPTION_PLANS,
} from '../plans';

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
});
