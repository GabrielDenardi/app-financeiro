import { readFileSync } from 'fs';
import { resolve } from 'path';

const checkoutFunction = readFileSync(
  resolve(process.cwd(), 'supabase/functions/create-abacatepay-subscription/index.ts'),
  'utf8',
);
const checkoutMigration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/202606230001_harden_billing_checkout_creation.sql'),
  'utf8',
);

describe('billing checkout creation controls', () => {
  it('reserves a checkout before making any provider call', () => {
    const reservationCall = checkoutFunction.indexOf("'reserve_billing_checkout'");
    const firstProviderCall = checkoutFunction.indexOf('const productId = await ensureProduct');

    expect(reservationCall).toBeGreaterThan(-1);
    expect(firstProviderCall).toBeGreaterThan(reservationCall);
    expect(checkoutFunction).not.toContain('Date.now()');
    expect(checkoutFunction).toContain('externalId: reservation.external_id');
  });

  it('atomically limits, serializes, and reuses checkout reservations', () => {
    expect(checkoutMigration).toContain('pg_catalog.pg_advisory_xact_lock');
    expect(checkoutMigration).toContain("'billing_checkout', current_window, 1, 1");
    expect(checkoutMigration).toContain('request_count < 5');
    expect(checkoutMigration).toContain('billing_checkout_sessions_one_inflight_per_user_idx');
    expect(checkoutMigration).toContain('should_create := false');
    expect(checkoutMigration).toContain("v_profile_status = 'active'");
  });

  it('allows only explicit checkout state transitions', () => {
    expect(checkoutMigration).toContain("old.status = 'provisioning'");
    expect(checkoutMigration).toContain("new.status in ('pending', 'failed')");
    expect(checkoutMigration).toContain('Transicao de checkout invalida');
  });
});
