const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { PGlite } = require('@electric-sql/pglite');
const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, 'supabase/migrations', name), 'utf8');

async function main() {
  const db = new PGlite();
  const owner = randomUUID(), other = randomUUID(), agent = randomUUID(), free = randomUUID();
  try {
    // Auth/plan helpers are fixtures; support RLS and RPCs are the actual migration.
    await db.exec(`
      create role anon; create role authenticated; create role service_role;
      create schema auth; create schema private;
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid',true),'')::uuid $$;
      create function public.is_session_aal2_if_required() returns boolean language sql stable as $$ select coalesce(current_setting('test.aal',true),'aal2') = 'aal2' $$;
      create table public.profiles(id uuid primary key, full_name text, email text, subscription_plan text);
      create table auth.sessions(id uuid primary key);
      create function public.user_has_entitlement(text) returns boolean language sql stable security definer as $$
        select exists(select 1 from public.profiles where id = auth.uid() and subscription_plan = 'pro')
      $$;
      insert into profiles values
        ('${owner}','Cliente','cliente@example.test','pro'), ('${other}','Outra conta','outra@example.test','pro'),
        ('${agent}','Atendente','equipe@example.test','free'), ('${free}','Free','free@example.test','free');
    `);
    const base = read('202605120001_backend_pending_screens.sql');
    await db.exec(base.slice(base.indexOf('create table if not exists public.support_conversations'), base.indexOf('alter table public.recurring_transaction_rules')));
    const notifications = read('202610180001_notification_feature.sql');
    await db.exec(notifications.slice(0, notifications.indexOf('create function public.refresh_user_notifications')));
    const delivery = read('202610180002_notification_delivery.sql');
    await db.exec(delivery.slice(0, delivery.indexOf('-- Atomic claims')));
    await db.exec(read('202610280002_human_support.sql'));
    await db.exec(`insert into support_agents values ('${agent}', 'Ana · nitin', true);
      grant usage on schema public, auth to authenticated;
      insert into notification_preferences(user_id,push_enabled) values ('${owner}',true);
      insert into auth.sessions values ('${randomUUID()}');
      insert into notification_devices(token,user_id,session_id,platform)
        select 'ExpoPushToken[test-device]', '${owner}',id,'android' from auth.sessions;
    `);
    async function asUser(uid, sql, params = []) {
      await db.exec(`reset role; select set_config('test.uid','${uid}',false); select set_config('test.aal','aal2',false); set role authenticated;`);
      return db.query(sql, params);
    }
    async function rejected(uid, sql, params = []) { await assert.rejects(() => asUser(uid, sql, params)); }
    const request = randomUUID();
    const create = 'select create_support_conversation($1,$2,$3) id';
    const cid = (await asUser(owner, create, ['Dúvida sobre o app', 'Preciso de ajuda', request])).rows[0].id;
    assert.equal((await asUser(owner, create, ['Dúvida sobre o app','Preciso de ajuda',request])).rows[0].id, cid);
    await rejected(owner, create, ['Outro assunto','Outro conteúdo',request]);
    await rejected(owner, create, ['Vazio','',randomUUID()]);
    assert.equal((await asUser(owner,'select count(*)::int n from support_conversations')).rows[0].n,1);
    await rejected(free, create, ['Teste','Mensagem',randomUUID()]);
    await rejected(other, 'select list_support_inbox()');
    await rejected(owner, 'insert into support_agents values ($1,$2,true)', [owner,'Impostor']);
    await rejected(owner, "insert into support_messages(conversation_id, sender_user_id,sender_role,body) values ($1,$2,'support','Falsa resposta')", [cid,owner]);
    assert.equal((await asUser(other,'select * from support_messages where conversation_id=$1',[cid])).rows.length, 0);
    assert.equal((await asUser(other,'select * from support_conversations where id=$1',[cid])).rows.length, 0);
    const send = 'select send_support_message($1,$2,$3) id';
    await rejected(other,send,[cid,'Intrusão',randomUUID()]);
    await rejected(other,'select mark_support_read($1)',[cid]);
    await rejected(owner,'select set_support_status($1,$2)',[cid,'done']);
    const inbox = (await asUser(agent,'select list_support_inbox() data')).rows[0].data;
    assert.equal(inbox[0].user_email,'cliente@example.test'); assert.equal(inbox[0].needs_reply,true);
    await asUser(agent,'select mark_support_read($1)',[cid]);
    const replyId = randomUUID();
    const mid = (await asUser(agent,send,[cid,'Olá! Como podemos ajudar?',replyId])).rows[0].id;
    assert.equal((await asUser(agent,send,[cid,'Olá! Como podemos ajudar?',replyId])).rows[0].id,mid);
    await rejected(agent,send,[cid,'Texto diferente',replyId]);
    const message = (await asUser(owner,'select * from support_messages where id=$1',[mid])).rows[0];
    assert.equal(message.sender_role,'support'); assert.equal(message.sender_name,'Ana · nitin'); assert.equal(message.sender_user_id,agent);
    assert.equal((await asUser(owner,'select status from support_conversations where id=$1',[cid])).rows[0].status,'working');
    await asUser(owner,'select mark_support_read($1)',[cid]);
    assert.ok((await asUser(owner,'select read_at from support_messages where id=$1',[mid])).rows[0].read_at);
    await asUser(agent,'select set_support_status($1,$2)',[cid,'done']);
    await asUser(owner,send,[cid,'Ainda tenho dúvida',randomUUID()]);
    const reopened = (await asUser(owner,'select status,closed_at from support_conversations where id=$1',[cid])).rows[0];
    assert.equal(reopened.status,'active'); assert.equal(reopened.closed_at,null);
    await db.exec(`reset role;`);
    assert.equal((await db.query('select count(*)::int n from user_notifications')).rows[0].n,1);
    assert.equal((await db.query('select count(*)::int n from notification_deliveries')).rows[0].n,1);
    await db.exec(`update support_agents set is_active=false where user_id='${agent}';`);
    await rejected(agent,'select list_support_inbox()');
    await rejected(agent,send,[cid,'Revogado',randomUUID()]);
    await db.exec(`reset role; select set_config('test.uid','${owner}',false); select set_config('test.aal','aal1',false); set role authenticated;`);
    await assert.rejects(() => db.query(send,[cid,'Sem MFA',randomUUID()]));
    console.log('Suporte humano SQL: criação atômica, idempotência, RLS, falsificação, permissões, identificação, status, reabertura, leitura, fila de push e revogação OK.');
  } finally { await db.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
