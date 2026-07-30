import {
  getGooglePlaySubscriptionId,
  getPlanIdFromProduct,
  GOOGLE_PLAY_PRODUCT_IDS,
} from '../revenuecatProducts';

describe('RevenueCat Google Play products', () => {
  it('maps every configured subscription to its plan', () => {
    expect(getPlanIdFromProduct(GOOGLE_PLAY_PRODUCT_IDS.basic)).toBe('basic');
    expect(getPlanIdFromProduct(GOOGLE_PLAY_PRODUCT_IDS.intermediate)).toBe(
      'intermediate',
    );
    expect(getPlanIdFromProduct(GOOGLE_PLAY_PRODUCT_IDS.pro)).toBe('pro');
  });

  it('supports the RevenueCat subscription:base-plan identifier', () => {
    expect(
      getPlanIdFromProduct(
        `${GOOGLE_PLAY_PRODUCT_IDS.intermediate}:monthly-autorenewing`,
      ),
    ).toBe('intermediate');
    expect(
      getGooglePlaySubscriptionId(
        `${GOOGLE_PLAY_PRODUCT_IDS.pro}:monthly-autorenewing`,
      ),
    ).toBe(GOOGLE_PLAY_PRODUCT_IDS.pro);
  });

  it('rejects products outside the allowlist', () => {
    expect(getPlanIdFromProduct('unknown_product:monthly')).toBeNull();
    expect(getPlanIdFromProduct(null)).toBeNull();
  });
});
