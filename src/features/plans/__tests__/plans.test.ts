import {
  canCreateAccount,
  getPlan,
  getPlanEntitlements,
  normalizePlanId,
  SUBSCRIPTION_PLANS,
} from '../plans';

describe('subscription plans', () => {
  it('defaults unknown or missing plan ids to basic', () => {
    expect(normalizePlanId(null)).toBe('basic');
    expect(normalizePlanId('unknown')).toBe('basic');
    expect(getPlan(undefined)).toEqual(SUBSCRIPTION_PLANS.basic);
  });

  it('exposes the expected entitlement matrix', () => {
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
    expect(canCreateAccount('basic', 0)).toBe(true);
    expect(canCreateAccount('basic', 1)).toBe(false);
    expect(canCreateAccount('intermediate', 1)).toBe(true);
    expect(canCreateAccount('intermediate', 2)).toBe(false);
    expect(canCreateAccount('pro', 3)).toBe(true);
    expect(canCreateAccount('pro', 4)).toBe(false);
  });
});
