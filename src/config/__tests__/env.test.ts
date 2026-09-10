import { getRevenueCatKeyStatus } from '../env';

describe('getRevenueCatKeyStatus', () => {
  it('accepts a Google Play key in any build', () => {
    expect(getRevenueCatKeyStatus('goog_abc123', false)).toEqual({
      isConfigured: true,
      isTestStore: false,
    });
    expect(getRevenueCatKeyStatus('goog_abc123', true)).toEqual({
      isConfigured: true,
      isTestStore: false,
    });
  });

  it('accepts a Test Store key in development builds', () => {
    expect(getRevenueCatKeyStatus('test_abc123', true)).toEqual({
      isConfigured: true,
      isTestStore: true,
    });
  });

  it('disables billing when a release build carries a Test Store key', () => {
    expect(getRevenueCatKeyStatus('test_abc123', false)).toEqual({
      isConfigured: false,
      isTestStore: false,
    });
  });

  it('rejects empty, prefix-only and unknown keys', () => {
    for (const key of ['', 'goog_', 'test_', 'sk_abc123']) {
      expect(getRevenueCatKeyStatus(key, true).isConfigured).toBe(false);
    }
  });
});
