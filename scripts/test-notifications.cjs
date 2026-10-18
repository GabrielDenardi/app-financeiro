// Runs the real feature migrations in PostgreSQL WASM without Docker or remote credentials.
const { PGlite } = require('@electric-sql/pglite');
const { readFileSync } = require('node:fs');
const assert = require('node:assert/strict');

async function main() {
  const db = new PGlite();
  const uid = '00000000-0000-0000-0000-000000000001';
  const other = '00000000-0000-0000-0000-000000000002';
  // Minimal existing-domain fixture. Feature SQL is loaded verbatim below.
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
    grant usage on schema auth to authenticated, anon, service_role;
    create table auth.sessions(id uuid primary key);
    create table auth.users(id uuid primary key, encrypted_password text);
    create table public.profiles(id uuid primary key);
    create table public.user_preferences(user_id uuid, login_alerts_enabled boolean, biometric_enabled boolean);
    create table public.user_notifications(id uuid primary key default gen_random_uuid(), user_id uuid references profiles(id),
      title text, description text, icon text, source_type text, read_at timestamptz, created_at timestamptz default now(), metadata jsonb);
    alter table public.user_notifications enable row level security;
    grant all on public.user_notifications to authenticated, service_role;
    create table public.financial_categories(id uuid primary key, label text);
    create table public.personal_transactions(user_id uuid, category_id uuid, occurred_on date, amount numeric, type text, include_in_reports boolean);
    create table public.budget_fixture(budget_id uuid, user_id uuid, category_id uuid, category_label text, month_date date, limit_amount numeric, spent_amount numeric);
    create view public.v_budget_progress as select * from public.budget_fixture;
    create table public.card_fixture(user_id uuid, card_id uuid, name text, open_amount numeric, due_date date, invoice_month date);
    create view public.v_card_invoice_summary as select * from public.card_fixture;
    create table public.installment_fixture(user_id uuid, category_id uuid, invoice_month date, amount numeric);
    create view public.v_card_installment_feed as select * from public.installment_fixture;
    create table public.recurring_transaction_rules(id uuid, user_id uuid, title text, day_of_month integer, is_active boolean, type text);
    create table public.recurring_transaction_executions(rule_id uuid, execution_month date);
    create table public.group_splits(id uuid primary key, group_id uuid, created_by uuid, title text);
    create table public.group_members(group_id uuid, user_id uuid, removed_at timestamptz);
    create table public.group_split_shares(id uuid primary key default gen_random_uuid(), split_id uuid, user_id uuid, share_amount numeric);
    create table public.auth_login_events(id uuid default gen_random_uuid(), user_id uuid, event_type text);
    insert into profiles values ('${uid}'), ('${other}');
    select set_config('request.jwt.claim.sub', '${uid}', false);
  `);
  for (const file of ['202610180001_notification_feature.sql', '202610180002_notification_delivery.sql', '202610180003_notification_recommendations.sql', '202610180004_notification_events.sql']) {
    await db.exec(readFileSync(`supabase/migrations/${file}`, 'utf8'));
  }
  const rows = async sql => (await db.query(sql)).rows;
  const count = async (table = 'user_notifications', where = 'true') => Number((await rows(`select count(*) n from ${table} where ${where}`))[0].n);
  const budget = '00000000-0000-0000-0000-000000000010';
  const category = '00000000-0000-0000-0000-000000000011';
  await db.exec(`insert into financial_categories values('${category}', 'Alimentação');
    insert into budget_fixture values('${budget}', '${uid}', '${category}', 'Alimentação', date_trunc('month', now() at time zone 'America/Sao_Paulo')::date, 100, 85);
    select refresh_user_notifications(); select refresh_user_notifications();`);
  assert.equal(await count(), 1, 'repeated refresh must not duplicate');
  assert.match((await rows('select description from user_notifications'))[0].description, /85%/);
  await db.exec('delete from user_notifications; select refresh_user_notifications();');
  assert.equal(await count(), 0, 'cleared notifications must not reappear');
  await db.exec('update budget_fixture set spent_amount = 110; select refresh_user_notifications();');
  assert.equal(await count(), 1, 'new threshold emits a new alert');
  await db.exec('update budget_fixture set spent_amount = 60; select refresh_user_notifications();');
  assert.equal(await count(), 1, 'lower threshold must not emit after a higher threshold');
  await db.exec(`update notification_preferences set budgets = false where user_id = '${uid}';
    update budget_fixture set budget_id = gen_random_uuid(); select refresh_user_notifications();`);
  assert.equal(await count(), 1, 'disabled category must not generate');
  await assert.rejects(db.exec(`update notification_preferences set timezone = 'invalid/timezone'`), /Fuso/);
  await assert.rejects(db.exec(`update notification_preferences set budget_thresholds = '{0,80}'`), /notification_thresholds_valid/);
  await db.exec(`insert into auth_login_events(user_id,event_type) values('${uid}', 'sign_in');`);
  assert.equal(await count('user_notifications', "source_type = 'security'"), 1, 'security trigger');
  await db.exec(`insert into auth.users values('${uid}', 'old-test-hash');
    update auth.users set encrypted_password = 'new-test-hash' where id = '${uid}';
    insert into user_preferences values('${uid}', true, false);
    update user_preferences set biometric_enabled = true where user_id = '${uid}';`);
  assert.equal(await count('user_notifications', "source_type = 'security'"), 3, 'password and biometric changes notify');
  const group = '00000000-0000-0000-0000-000000000030';
  const split = '00000000-0000-0000-0000-000000000031';
  await db.exec(`insert into group_splits values('${split}', '${group}', '${uid}', 'Almoço');
    insert into group_members values('${group}', '${other}', null);
    insert into group_split_shares(split_id,user_id,share_amount) values('${split}', '${other}', 40);`);
  assert.equal(await count('user_notifications', `user_id = '${other}'`), 1, 'group recipient notified');
  await db.exec(`update group_split_shares set share_amount = 45;`);
  assert.equal(await count('user_notifications', `user_id = '${other}'`), 2, 'changed share notified');
  await db.exec(`update group_split_shares set share_amount = 45;`);
  assert.equal(await count('user_notifications', `user_id = '${other}'`), 2, 'unchanged share ignored');
  // RLS + column grants: an app cannot forge a notification or edit its body.
  await db.exec('set role authenticated;');
  assert.equal(await count('user_notifications', `user_id = '${other}'`), 0, 'recipient isolation');
  await assert.rejects(db.exec(`insert into user_notifications(user_id,title) values('${uid}', 'forged')`), /permission denied/);
  await assert.rejects(db.exec(`update user_notifications set title = 'forged'`), /permission denied/);
  await db.exec(`update user_notifications set read_at = now(); reset role;`);
  // Device tokens are bound to auth sessions and disappear when the session ends.
  const session = '00000000-0000-0000-0000-000000000040';
  await db.exec(`insert into auth.sessions values('${session}');
    select set_config('request.jwt.claims', '{"session_id":"${session}"}', false);
    select register_notification_device('ExpoPushToken[testToken]', 'android');
    update notification_preferences set push_enabled = true, quiet_start = 0, quiet_end = 0 where user_id = '${uid}';
    select emit_notification('${uid}', 'push:test', 'security', 'Test', 'Body', 'security');`);
  assert.equal(await count('notification_deliveries'), 1, 'push queued');
  assert.equal((await rows('select * from claim_notification_deliveries()')).length, 1, 'delivery claimed');
  assert.equal((await rows('select * from claim_notification_deliveries()')).length, 0, 'claim is exclusive');
  await db.exec(`delete from auth.sessions where id = '${session}';`);
  assert.equal(await count('notification_devices'), 0, 'session end removes device');
  // AI requires consent, limits daily calls, and cannot choose another user's budget.
  await assert.rejects(db.exec('select claim_notification_recommendation()'), /Autorize/);
  await db.exec(`update notification_preferences set ai_enabled = true, recommendations = true where user_id = '${uid}';`);
  const snapshot = (await rows('select claim_notification_recommendation() snapshot'))[0].snapshot;
  assert.equal(snapshot.length, 1);
  assert.ok(!JSON.stringify(snapshot).includes('Alimentação'), 'snapshot contains no category names');
  await assert.rejects(db.exec('select claim_notification_recommendation()'), /hoje/);
  await db.exec(`select complete_notification_recommendation('${uid}', '${budget}', 'reduce_spending');`);
  assert.equal(await count('user_notifications', "metadata->>'method' = 'ai'"), 0, 'missing budget ignored');
  const actualBudget = (await rows('select budget_id from budget_fixture'))[0].budget_id;
  await db.exec(`select complete_notification_recommendation('${uid}', '${actualBudget}', 'reduce_spending');
    select complete_notification_recommendation('${uid}', '${actualBudget}', 'review_budget');`);
  assert.equal(await count('user_notifications', "metadata->>'method' = 'ai'"), 1, 'AI emits once per day');
  const rule = '00000000-0000-0000-0000-000000000050';
  await db.exec(`insert into recurring_transaction_rules values('${rule}', '${uid}', 'Conta mensal',
    extract(day from (now() at time zone 'America/Sao_Paulo')::date + 1), true, 'expense');
    insert into recurring_transaction_executions values('${rule}', date_trunc('month', (now() at time zone 'America/Sao_Paulo')::date + 1)::date);
    insert into card_fixture values('${uid}', gen_random_uuid(), 'Cartão de teste', 0, (now() at time zone 'America/Sao_Paulo')::date + 1,
      date_trunc('month', now() at time zone 'America/Sao_Paulo')::date);
    select refresh_user_notifications();`);
  assert.equal(await count('user_notifications', "source_type = 'reminders'"), 0, 'paid invoices and confirmed recurring rules ignored');
  await db.exec(`delete from recurring_transaction_executions; update card_fixture set open_amount = 450;
    select refresh_user_notifications(); select refresh_user_notifications();`);
  assert.equal(await count('user_notifications', "source_type = 'reminders'"), 2, 'unpaid invoice and upcoming recurring due once');
  await db.exec(`insert into auth.sessions values('${session}');
    select register_notification_device('ExpoPushToken[testToken]', 'android');
    update notification_preferences set timezone = 'UTC', quiet_start = extract(hour from now() at time zone 'UTC')::integer,
      quiet_end = (extract(hour from now() at time zone 'UTC')::integer + 1) % 24 where user_id = '${uid}';
    select emit_notification('${uid}', 'quiet:test', 'reminders', 'Quiet', 'Body', 'warning');`);
  assert.equal((await rows('select * from claim_notification_deliveries()')).length, 0, 'quiet hours defer nonurgent push');
  await db.exec(`select emit_notification('${uid}', 'quiet:security', 'security', 'Security', 'Body', 'security');`);
  assert.equal((await rows('select * from claim_notification_deliveries()')).length, 1, 'security bypasses quiet hours');
  await db.exec(`update notification_preferences set quiet_start = 0, quiet_end = 0 where user_id = '${uid}';`);
  assert.equal((await rows('select * from claim_notification_deliveries()')).length, 1, 'deferred push becomes eligible');
  await db.exec('select refresh_all_user_notifications();');
  assert.equal((await rows('select auth.uid() uid'))[0].uid, uid, 'worker restores caller claims');
  await db.exec('set role authenticated;');
  await assert.rejects(db.exec('select claim_notification_deliveries()'), /permission denied/);
  await db.exec('reset role;');
  await db.close();
  console.log('Notification SQL integration checks passed: generation, deduplication, preferences, triggers, RLS, delivery, session cleanup, AI consent/quota, due dates, quiet hours, worker claims.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
