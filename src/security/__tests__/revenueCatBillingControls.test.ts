import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migration = readFileSync(
  resolve(
    process.cwd(),
    'supabase/migrations/202607290001_revenuecat_google_play_billing.sql',
  ),
  'utf8',
);
const webhook = readFileSync(
  resolve(process.cwd(), 'supabase/functions/revenuecat-webhook/index.ts'),
  'utf8',
);
const syncFunction = readFileSync(
  resolve(
    process.cwd(),
    'supabase/functions/sync-revenuecat-subscription/index.ts',
  ),
  'utf8',
);
const sharedRevenueCat = readFileSync(
  resolve(process.cwd(), 'supabase/functions/_shared/revenuecat.ts'),
  'utf8',
);

describe('RevenueCat billing security controls', () => {
  it('keeps provider events private and idempotent', () => {
    expect(migration).toContain(
      'alter table public.billing_provider_events enable row level security',
    );
    expect(migration).toContain(
      'revoke all on table public.billing_provider_events from public, anon, authenticated',
    );
    expect(migration).toContain('on conflict (id) do nothing');
  });

  it('protects every provider-controlled profile field', () => {
    expect(migration).toContain(
      'new.subscription_provider is distinct from old.subscription_provider',
    );
    expect(migration).toContain(
      'new.subscription_expires_at is distinct from old.subscription_expires_at',
    );
    expect(migration).toContain(
      'new.subscription_event_at is distinct from old.subscription_event_at',
    );
  });

  it('preserves paid access until expiration after cancellation', () => {
    expect(migration).toContain(
      "p.subscription_status in ('active', 'cancelled', 'grace_period')",
    );
    expect(migration).toContain(
      'p.subscription_expires_at is null or p.subscription_expires_at > now()',
    );
  });

  it('authenticates webhooks independently of client JWTs', () => {
    expect(webhook).toContain("Deno.env.get('REVENUECAT_WEBHOOK_AUTH_TOKEN')");
    expect(webhook).toContain(
      "request.headers.get('Authorization') !== `Bearer ${webhookToken}`",
    );
    expect(webhook).toContain("event.store !== 'PLAY_STORE'");
  });

  it('derives access from the RevenueCat API and an explicit product allowlist', () => {
    expect(sharedRevenueCat).toContain(
      'https://api.revenuecat.com/v1/subscribers/',
    );
    expect(sharedRevenueCat).toContain('GOOGLE_PLAY_PRODUCT_TO_PLAN');
    expect(sharedRevenueCat).toContain(
      "appfinanceiro_intermediate_v1: 'intermediate'",
    );
  });

  it('requires a valid Supabase user for client-triggered synchronization', () => {
    expect(syncFunction).toContain('await userClient.auth.getUser()');
    expect(syncFunction).toContain("return jsonResponse({ error: 'Unauthorized' }, 401)");
    expect(syncFunction).toContain('serviceRoleKey');
  });
});
