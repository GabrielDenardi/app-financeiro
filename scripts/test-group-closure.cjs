const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { PGlite } = require('@electric-sql/pglite');

async function main() {
  const db = new PGlite();
  const setup = [];
  const setupExec = async sql => { setup.push(sql); await db.exec(sql); };
  const groups = readFileSync('supabase/migrations/202603090001_groups_feature.sql', 'utf8');
  const hardening = readFileSync('supabase/migrations/20260622184602_harden_security_boundaries.sql', 'utf8');
  const section = (source, start, end) => {
    const first = source.indexOf(start);
    const last = source.indexOf(end, first + start.length);
    assert.ok(first >= 0 && last > first, `Missing SQL section: ${start}`);
    return source.slice(first, last);
  };
  const admin = '00000000-0000-0000-0000-000000000001';
  const member = '00000000-0000-0000-0000-000000000002';
  const outsider = '00000000-0000-0000-0000-000000000003';
  const group = '00000000-0000-0000-0000-000000000010';
  const otherGroup = '00000000-0000-0000-0000-000000000011';
  const split = '00000000-0000-0000-0000-000000000020';
  const settlement = '00000000-0000-0000-0000-000000000030';
  await setupExec(`create role anon; create role authenticated; create schema auth; create schema private;
    create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create function public.is_session_aal2_if_required() returns boolean language sql as $$ select coalesce(current_setting('test.mfa', true), 'true') <> 'false' $$;
    create table profiles(id uuid primary key);
    insert into profiles values('${admin}'),('${member}'),('${outsider}');
    select set_config('request.jwt.claim.sub', '${admin}', false);`);
  await setupExec(section(groups, 'create table if not exists public.groups', 'create index if not exists group_members_group_idx'));
  await setupExec(section(groups, 'create unique index if not exists personal_accounts_default_unique', 'drop trigger if exists trg_groups_updated_at'));
  await setupExec(section(groups, 'create or replace function public.ensure_default_personal_account', 'create or replace function public.handle_profile_default_personal_account'));
  await setupExec(section(hardening, 'create or replace function public.is_active_group_member(p_group_id uuid, p_user_id uuid)', '-- Rebind pre-existing policies'));
  await setupExec(section(groups, 'create or replace function public.group_outstanding_amount', 'create or replace function public.create_group('));
  await setupExec(section(groups, 'create or replace function public.confirm_group_settlement', 'create or replace function public.remove_group_member'));
  await setupExec(`create table transaction_attachments(id uuid primary key default gen_random_uuid(), group_id uuid,
    transaction_id uuid, group_split_id uuid, user_id uuid);
    alter table personal_transactions add column group_split_id uuid references group_splits(id);
    insert into groups(id,title,share_code,created_by) values('${group}','Teste','ABC123','${admin}'),('${otherGroup}','Outro','DEF456','${admin}');
    insert into group_members(group_id,user_id,role) values('${group}','${admin}','admin'),('${group}','${member}','member');`);
  await setupExec(readFileSync('supabase/migrations/202610270002_group_closure.sql', 'utf8'));
  const rows = async sql => (await db.query(sql)).rows;
  const login = id => db.query("select set_config('request.jwt.claim.sub', $1, false)", [id]);
  const close = () => db.exec(`select close_group('${group}');`);
  const reopen = () => db.exec(`select reopen_group('${group}');`);
  const snapshot = async () => (await rows(`select
    (select row_to_json(g) from groups g where id = '${group}') as group,
    (select count(*) from group_splits) as splits,
    (select count(*) from group_split_shares) as shares,
    (select count(*) from group_settlements) as settlements,
    (select count(*) from personal_transactions) as transactions,
    (select count(*) from group_status_events) as events`))[0];

  await login('');
  await assert.rejects(close(), /não autenticado/);
  for (const id of [member, outsider]) {
    await login(id);
    await assert.rejects(close(), /administradores/);
    await assert.rejects(reopen(), /administradores/);
  }
  await login(admin);
  await db.exec(`select set_config('test.mfa', 'false', false);`);
  await assert.rejects(close(), /dois fatores/);
  await assert.rejects(reopen(), /dois fatores/);
  await db.exec(`select set_config('test.mfa', 'true', false);`);

  // An expense creates debt even when its participant has been removed.
  await db.exec(`insert into group_splits(id,group_id,created_by,owner_user_id,title,kind,split_mode,total_amount)
    values('${split}','${group}','${admin}','${admin}','Despesa','expense','equal',100);
    insert into group_split_shares(split_id,user_id,share_amount) values('${split}','${admin}',50),('${split}','${member}',50);`);
  const beforeDebt = await snapshot();
  await assert.rejects(close(), /saldos em aberto/);
  assert.deepEqual(await snapshot(), beforeDebt);
  await db.exec(`delete from group_members where group_id = '${group}' and user_id = '${member}';`);
  await assert.rejects(close(), /saldos em aberto/);
  await db.exec(`insert into group_members(group_id,user_id) values('${group}','${member}');
    insert into group_settlements(id,group_id,from_user_id,to_user_id,requested_by_user_id,amount,payment_method)
    values('${settlement}','${group}','${member}','${admin}','${member}',50,'PIX');`);
  await assert.rejects(close(), /aguardando confirmação/);
  await db.exec(`select confirm_group_settlement('${settlement}');`);
  assert.equal(Number((await rows(`select group_outstanding_amount('${group}','${member}','${admin}') as amount`))[0].amount), 0);

  // A failure writing the audit must also roll back the status transition.
  await db.exec(`create function fail_event() returns trigger language plpgsql as $$ begin raise exception 'audit failure'; end; $$;
    create trigger fail_event before insert on group_status_events for each row execute function fail_event();`);
  const beforeFailure = await snapshot();
  await assert.rejects(close(), /audit failure/);
  assert.deepEqual(await snapshot(), beforeFailure);
  await db.exec('drop trigger fail_event on group_status_events;');

  await db.exec('set role authenticated;');
  await close();
  await db.exec('reset role;');
  const closed = await snapshot();
  assert.equal(closed.group.status, 'inactive');
  assert.equal(closed.group.closed_by, admin);
  assert.ok(closed.group.closed_at);
  assert.equal(closed.events, 1);
  for (const key of ['splits', 'shares', 'settlements', 'transactions']) assert.equal(closed[key], beforeFailure[key]);
  await assert.rejects(close(), /já está encerrado/);

  // Cover insert, update, delete and clearing/moving historical references.
  const blocked = [
    `insert into group_splits(group_id,created_by,owner_user_id,title,kind,split_mode,total_amount) values('${group}','${admin}','${admin}','Nova','expense','equal',1)`,
    `update group_splits set total_amount = 1 where id = '${split}'`,
    `delete from group_splits where id = '${split}'`,
    `insert into group_split_shares(split_id,user_id,share_amount) values('${split}','${outsider}',1)`,
    `update group_split_shares set share_amount = 1 where split_id = '${split}'`,
    `delete from group_split_shares where split_id = '${split}'`,
    `update group_settlements set amount = 1 where id = '${settlement}'`,
    `delete from group_settlements where id = '${settlement}'`,
    `insert into group_members(group_id,user_id) values('${group}','${outsider}')`,
    `update group_members set removed_at = now() where group_id = '${group}'`,
    `delete from group_members where group_id = '${group}'`,
    `update personal_transactions set amount = 1 where group_id = '${group}'`,
    `update personal_transactions set group_id = null where group_id = '${group}'`,
    `update personal_transactions set group_id = '${otherGroup}' where group_id = '${group}'`,
    `delete from personal_transactions where group_id = '${group}'`,
    `insert into transaction_attachments(group_id) values('${group}')`,
    `insert into transaction_attachments(group_split_id) values('${split}')`,
  ];
  for (const sql of blocked) {
    await assert.rejects(db.exec(sql), /grupo foi encerrado/);
    assert.deepEqual(await snapshot(), closed);
  }
  await login(member);
  await db.exec('set role authenticated;');
  assert.equal((await rows('select * from group_status_events')).length, 1, 'members can read closure history');
  await assert.rejects(db.exec('delete from group_status_events'), /permission denied/);
  await assert.rejects(db.exec(`insert into group_status_events(group_id,action) values('${group}','reopened')`), /permission denied/);
  await login(outsider);
  assert.equal((await rows('select * from group_status_events')).length, 0, 'outsiders cannot read closure history');
  await db.exec('reset role;');
  await login(admin);
  await db.exec('set role authenticated;');
  await reopen();
  await db.exec('reset role;');
  const reopened = await snapshot();
  assert.equal(reopened.group.status, 'active');
  assert.equal(reopened.group.closed_at, null);
  assert.equal(reopened.group.closed_by, null);
  assert.equal(reopened.events, 2);
  assert.equal(reopened.transactions, closed.transactions);
  await assert.rejects(reopen(), /já está ativo/);
  await db.exec(`update group_splits set title = 'Permitido novamente' where id = '${split}';`);
  await db.exec('set role anon;');
  await assert.rejects(close(), /permission denied/);
  await assert.rejects(reopen(), /permission denied/);
  await db.close();
  console.log('Group closure SQL checks passed: admin, MFA, outstanding and pending balances, removed participants, preservation, mutation guards, audit, RLS, reopen and rollback.');
  if (process.argv.includes('--concurrency')) {
    await require('./test-group-closure-concurrency.cjs')(setup.join('\n'), { admin, member, group });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
