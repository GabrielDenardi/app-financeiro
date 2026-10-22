const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { PGlite } = require('@electric-sql/pglite');

async function main() {
  const db = new PGlite();
  const groups = readFileSync('supabase/migrations/202603090001_groups_feature.sql', 'utf8');
  const core = readFileSync('supabase/migrations/202603110001_finance_core.sql', 'utf8');
  const capture = readFileSync('supabase/migrations/202605160001_transaction_capture.sql', 'utf8');
  const section = (source, start, end) => {
    const first = source.indexOf(start);
    const last = source.indexOf(end, first + start.length);
    assert.ok(first >= 0 && last > first, `Missing SQL section: ${start}`);
    return source.slice(first, last);
  };
  const user = '00000000-0000-0000-0000-000000000001';
  const member = '00000000-0000-0000-0000-000000000002';
  const outsider = '00000000-0000-0000-0000-000000000003';
  const group = '00000000-0000-0000-0000-000000000010';
  await db.exec(`create schema auth;
    create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create table profiles(id uuid primary key);
    insert into profiles values('${user}'),('${member}'),('${outsider}');
    select set_config('request.jwt.claim.sub', '${user}', false);`);
  // Load the real tables, membership checks, RPC, trigger and partial unique index.
  await db.exec(section(groups, 'create table if not exists public.groups', 'create index if not exists group_members_group_idx'));
  await db.exec(section(groups, 'create or replace function public.ensure_default_personal_account', 'create or replace function public.handle_profile_default_personal_account'));
  await db.exec(section(groups, 'create or replace function public.is_active_group_member', 'create or replace function public.is_group_admin'));
  await db.exec(`alter table personal_transactions
      add column group_split_id uuid references group_splits(id) on delete cascade,
      add column occurred_on date, add column source_type text default 'manual',
      add column include_in_reports boolean default true;
    create table user_preferences(user_id uuid, require_group_expense_receipt boolean default false);
    create table transaction_attachments(id uuid primary key, user_id uuid, group_id uuid, transaction_id uuid, group_split_id uuid);
    insert into groups(id,title,share_code,created_by) values('${group}','Teste','ABC123','${user}');
    insert into group_members(group_id,user_id) values('${group}','${user}'),('${group}','${member}');`);
  await db.exec(section(core, 'create unique index if not exists personal_transactions_group_split_user_unique', 'create or replace function public.make_month_date'));
  await db.exec(section(core, 'create or replace function public.create_group_split_personal_transaction', 'create or replace function public.create_account_transfer'));
  await db.exec(section(capture, 'create or replace function public.create_group_split(', 'alter table public.transaction_attachments enable row level security'));
  const rows = async sql => (await db.query(sql)).rows;
  const counts = async () => (await rows(`select
    (select count(*) from group_splits) splits,
    (select count(*) from group_split_shares) shares,
    (select count(*) from personal_transactions) transactions`))[0];
  const createSplit = async (kind = 'expense', mode = 'equal', owner = user) => {
    const shares = mode === 'equal' ? [50, 50] : [30, 70];
    const payload = { title: 'Divisão teste', description: 'Teste de regressão', kind, split_mode: mode,
      total_amount: 100, owner_user_id: owner, occurred_at: '2026-10-22T12:00:00Z',
      shares: [user, member].map((id, index) => ({ user_id: id, amount: shares[index],
        ...(mode === 'percentage' ? { percentage: shares[index] } : {}) })) };
    return (await db.query('select create_group_split($1::uuid, $2::jsonb) id', [group, JSON.stringify(payload)])).rows[0].id;
  };
  await assert.rejects(createSplit(), error => {
    assert.equal(error.code, '42P10');
    assert.match(error.message, /no unique or exclusion constraint matching the ON CONFLICT specification/);
    return true;
  });
  assert.deepEqual(await counts(), { splits: 0, shares: 0, transactions: 0 }, 'failed creation leaves no partial records');
  console.log('Reproduced original group-split failure (42P10).');

  await db.exec(readFileSync('supabase/migrations/202610220001_fix_group_split_transaction_conflict.sql', 'utf8'));
  for (const kind of ['expense', 'income']) {
    for (const mode of ['equal', 'percentage', 'custom']) {
      const owner = kind === 'income' ? member : user;
      const id = await createSplit(kind, mode, owner);
      const tx = (await db.query('select * from personal_transactions where group_split_id = $1', [id])).rows;
      assert.equal(tx.length, 1, 'exactly one linked transaction');
      assert.equal(tx[0].user_id, owner, 'transaction belongs to payer or receiver');
      assert.equal(tx[0].type, kind);
      assert.equal(Number(tx[0].amount), 100);
      assert.equal(tx[0].source_type, 'group_split');
      assert.equal(tx[0].include_in_reports, true);
      assert.equal((await db.query('select * from group_split_shares where split_id = $1', [id])).rows.length, 2);
    }
  }
  assert.deepEqual(await counts(), { splits: 6, shares: 12, transactions: 6 });
  // Re-running the trigger for the same split must preserve the original transaction.
  await db.exec(`create trigger test_repeat after update on group_splits
    for each row execute function create_group_split_personal_transaction();
    update group_splits set title = title;
    drop trigger test_repeat on group_splits;`);
  assert.equal((await counts()).transactions, 6);
  await db.exec(`select set_config('request.jwt.claim.sub', '${outsider}', false);`);
  await assert.rejects(createSplit(), /nao participa deste grupo/);
  await db.exec(`select set_config('request.jwt.claim.sub', '${user}', false);`);
  await assert.rejects(createSplit('expense', 'equal', outsider), /precisa participar do grupo/);
  assert.deepEqual(await counts(), { splits: 6, shares: 12, transactions: 6 });
  // A later share failure must roll back both the split and its automatic transaction.
  await db.exec(`create function fail_share() returns trigger language plpgsql as $$ begin raise exception 'share failure'; end; $$;
    create trigger test_share_failure before insert on group_split_shares for each row execute function fail_share();`);
  await assert.rejects(createSplit(), /share failure/);
  assert.deepEqual(await counts(), { splits: 6, shares: 12, transactions: 6 });
  await db.close();
  console.log('Group split SQL checks passed: income/expense, equal/percentage/custom, ownership, idempotency and rollback.');
}
main().catch(error => { console.error(error.message); process.exit(1); });
