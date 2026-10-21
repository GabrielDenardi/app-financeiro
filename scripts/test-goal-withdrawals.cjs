const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { PGlite } = require('@electric-sql/pglite');

async function main() {
  const db = new PGlite();
  const uid = '00000000-0000-0000-0000-000000000001';
  const other = '00000000-0000-0000-0000-000000000002';
  const account = '00000000-0000-0000-0000-000000000010';
  const goal = '00000000-0000-0000-0000-000000000020';
  await db.exec(`
    create role anon; create role authenticated; create schema auth;
    create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create function public.is_session_aal2_if_required() returns boolean language sql as $$ select coalesce(current_setting('test.mfa', true), 'true') <> 'false' $$;
    create table profiles(id uuid primary key);
    create table personal_accounts(id uuid primary key, user_id uuid, name text, type text, institution text,
      color text, is_active boolean default true, display_order integer default 0, opening_balance numeric default 100);
    create table financial_goals(id uuid primary key, user_id uuid, title text, current_amount numeric(14,2) check(current_amount >= 0),
      target_amount numeric(14,2), status text, updated_at timestamptz default now());
    create table personal_transactions(id uuid primary key default gen_random_uuid(), user_id uuid, account_id uuid,
      type text, title text, description text, notes text, payment_method text, amount numeric(14,2) check(amount > 0),
      occurred_at timestamptz, occurred_on date, source_type text, include_in_reports boolean default true,
      settlement_id uuid, transfer_id uuid, constraint personal_transactions_source_type_check check(source_type in ('manual','goal_contribution')));
    insert into profiles values ('${uid}'), ('${other}');
    insert into personal_accounts(id,user_id,name) values('${account}', '${uid}', 'Conta teste');
    insert into financial_goals(id,user_id,title,current_amount,target_amount,status) values('${goal}', '${uid}', 'Reserva', 500, 500, 'completed');
    select set_config('request.jwt.claim.sub', '${uid}', false);
    grant usage on schema public, auth to authenticated, anon;
  `);
  const core = readFileSync('supabase/migrations/202603110001_finance_core.sql', 'utf8');
  // Exercise the production account-balance view, not an imitation of its calculation.
  await db.exec(core.slice(core.indexOf('create or replace view public.v_account_current_balance'), core.indexOf('create or replace view public.v_goal_progress')));
  await db.exec(readFileSync('supabase/migrations/202610210001_goal_withdrawals.sql', 'utf8'));
  await db.exec(`create trigger normalize before insert or update on personal_transactions for each row execute function normalize_personal_transaction();`);
  const rows = async sql => (await db.query(sql)).rows;
  const snapshot = async () => ({
    goal: (await rows('select current_amount, status from financial_goals'))[0],
    balance: (await rows('select current_balance from v_account_current_balance'))[0].current_balance,
    withdrawals: (await rows('select count(*) n from goal_withdrawals'))[0].n,
    transactions: (await rows('select count(*) n from personal_transactions'))[0].n,
  });
  const withdraw = (amount, destination = account, target = goal) => db.exec(`select withdraw_from_goal('${target}', '${destination}', ${amount}, '  emergência  ', '2026-10-21T12:00:00Z');`);
  await db.exec('set role authenticated;');
  await withdraw(125.55);
  await db.exec('reset role;');
  let state = await snapshot();
  assert.equal(Number(state.goal.current_amount), 374.45);
  assert.equal(state.goal.status, 'active', 'completed goal reopens after withdrawing below target');
  assert.equal(Number(state.balance), 225.55, 'destination account receives exactly the withdrawal');
  assert.equal(Number(state.withdrawals), 1);
  const tx = (await rows('select * from personal_transactions'))[0];
  assert.equal(tx.type, 'income');
  assert.equal(tx.source_type, 'goal_withdrawal');
  assert.equal(tx.include_in_reports, false, 'moving savings is not income for reporting');
  assert.equal(tx.notes, 'emergência');

  for (const amount of [400, 0, -1, 'null', "'NaN'::numeric", "'Infinity'::numeric", 0.001]) {
    const before = await snapshot();
    await assert.rejects(withdraw(amount), /saldo da meta|valor válido/);
    assert.deepEqual(await snapshot(), before, 'invalid withdrawal must have no side effects');
  }
  await db.exec(`update personal_accounts set user_id = '${other}';`);
  await assert.rejects(withdraw(1), /conta ativa/);
  await db.exec(`update personal_accounts set user_id = '${uid}', is_active = false;`);
  await assert.rejects(withdraw(1), /conta ativa/);
  await db.exec(`update personal_accounts set is_active = true; select set_config('request.jwt.claim.sub', '${other}', false);`);
  await assert.rejects(withdraw(1), /Meta não encontrada/);
  await db.exec(`set role authenticated;`);
  assert.equal((await rows('select * from goal_withdrawals')).length, 0, 'ledger is isolated by user');
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`);
  await assert.rejects(withdraw(1), /não autenticado/);
  await db.exec(`select set_config('request.jwt.claim.sub', '${uid}', false); select set_config('test.mfa', 'false', false);`);
  await assert.rejects(withdraw(1), /dois fatores/);
  await db.exec(`select set_config('test.mfa', 'true', false);`);

  // Force a failure after the income and audit inserts; both must roll back.
  await db.exec(`create function fail_goal_update() returns trigger language plpgsql as $$ begin raise exception 'forced failure'; end; $$;
    create trigger fail_goal_update before update on financial_goals for each row execute function fail_goal_update();`);
  const beforeFailure = await snapshot();
  await assert.rejects(withdraw(1), /forced failure/);
  assert.deepEqual(await snapshot(), beforeFailure, 'the entire operation is atomic');
  await db.exec('drop trigger fail_goal_update on financial_goals;');

  // PGlite queues these requests on one connection; verify the second sees the new balance.
  // Cross-connection serialization is provided by SELECT ... FOR UPDATE in the RPC.
  const competing = await Promise.allSettled([withdraw(300), withdraw(300)]);
  assert.equal(competing.filter(result => result.status === 'fulfilled').length, 1);
  state = await snapshot();
  assert.equal(Number(state.goal.current_amount), 74.45);
  await withdraw(74.45);
  state = await snapshot();
  assert.equal(Number(state.goal.current_amount), 0, 'the entire remaining balance can be withdrawn');
  assert.equal(Number(state.balance), 600);
  await assert.rejects(withdraw(0.01), /saldo da meta/);

  await db.exec(`set role authenticated;`);
  assert.equal((await rows('select * from goal_withdrawals')).length, 3);
  await assert.rejects(db.exec('delete from goal_withdrawals'), /permission denied/);
  await assert.rejects(db.exec('update goal_withdrawals set amount = 1'), /permission denied/);
  await db.exec('reset role; set role anon;');
  await assert.rejects(withdraw(1), /permission denied/);
  await db.exec('reset role;');
  // Verify the new operation composes with the existing production contribution RPC.
  await db.exec(core.slice(core.indexOf('create table if not exists public.goal_contributions'), core.indexOf('create table if not exists public.budget_plans')));
  await db.exec(core.slice(core.indexOf('create or replace function public.assert_owned_personal_account'), core.indexOf('create or replace function public.normalize_personal_transaction')));
  await db.exec(core.slice(core.indexOf('create or replace function public.add_goal_contribution'), core.indexOf('create or replace function public.finalize_import_batch')));
  await db.exec(`select add_goal_contribution('${goal}', '${account}', 50);`);
  state = await snapshot();
  assert.equal(Number(state.goal.current_amount), 50);
  assert.equal(Number(state.balance), 550);
  await withdraw(50);
  state = await snapshot();
  assert.equal(Number(state.goal.current_amount), 0);
  assert.equal(Number(state.balance), 600, 'contribution followed by withdrawal restores account balance');
  await db.exec(`update financial_goals set current_amount = 10, status = 'archived';`);
  await withdraw(1);
  assert.equal((await snapshot()).goal.status, 'archived', 'withdrawal preserves archived status');
  await db.close();
  console.log('Goal withdrawal SQL checks passed: balance, limits, ownership, MFA, RLS and rollback.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
