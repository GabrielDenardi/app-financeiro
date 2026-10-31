const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash, randomUUID } = require('node:crypto');
const ts = require('typescript');
const { PGlite } = require('@electric-sql/pglite');

const migrationPath = (name) => path.resolve(__dirname, '../supabase/migrations', name);
const readMigration = (name) => fs.readFileSync(migrationPath(name), 'utf8');

const productUpdatesMigration = readMigration('202610310001_product_updates.sql');
const rateLimitMigration = readMigration('202608020001_rate_limit_maintenance.sql');
const subscribersMigration = readMigration('202610310002_product_update_subscribers.sql');

function loadEdgeModule(file) {
  const { outputText } = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const edgeModule = { exports: {} };
  const load = (id) => (id.endsWith('.ts') ? loadEdgeModule(path.resolve(path.dirname(file), id)) : require(id));
  new Function('module', 'exports', 'require', outputText)(edgeModule, edgeModule.exports, load);
  return edgeModule.exports;
}

const edge = loadEdgeModule(path.resolve(__dirname, '../supabase/functions/_shared/productUpdateSubscriptions.ts'));

const config = edge.readProductUpdateConfig((key) =>
  ({ SUPABASE_URL: 'https://projeto.supabase.test', RESEND_FROM_EMAIL: 'nitin <novidades@nitin.com.br>' })[key],
);

const SERVICE_FUNCTIONS = [
  "consume_product_update_limit('news_confirm', 'chave-de-teste-longa')",
  "subscribe_to_product_updates('ataque@example.test', 'novidades', '2026-10-31')",
  "confirm_product_update_subscription('x')",
  "unsubscribe_from_product_updates('x')",
  "start_product_update_send(gen_random_uuid(), gen_random_uuid())",
  "claim_product_update_deliveries(gen_random_uuid(), 1)",
  "finish_product_update_deliveries(gen_random_uuid(), '[]'::jsonb)",
];

async function runSuite(migration) {
  const db = new PGlite();
  const editor = randomUUID();
  const member = randomUUID();
  try {
    await db.exec(`
      create role anon; create role authenticated; create role service_role;
      create schema auth; create schema private; create schema storage;
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid',true),'')::uuid $$;
      create function public.is_session_aal2_if_required() returns boolean language sql stable as $$ select coalesce(current_setting('test.aal',true),'aal2') = 'aal2' $$;
      create table public.profiles(id uuid primary key);
      create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
      create table storage.objects(id uuid primary key default gen_random_uuid(), bucket_id text, name text);
      alter table storage.objects enable row level security;
      create table private.security_rate_limits (
        subject_key text not null,
        feature text not null,
        window_started_at timestamptz not null,
        request_count integer not null default 0,
        unit_count bigint not null default 0,
        primary key (subject_key, feature, window_started_at)
      );
      revoke all on table private.security_rate_limits from public, anon, authenticated;
      revoke all on schema private from public, anon, authenticated;
      grant usage on schema public, auth, storage to anon, authenticated, service_role;
      insert into profiles values ('${editor}'), ('${member}');
    `);
    await db.exec(rateLimitMigration);
    await db.exec(productUpdatesMigration);
    await db.exec(migration);
    await db.exec(`insert into site_editors values ('${editor}', 'Equipe nitin', true);`);

    async function asUser(uid, sql, params = [], aal = 'aal2') {
      await db.exec(`reset role; select set_config('test.uid','${uid}',false); select set_config('test.aal','${aal}',false); set role authenticated;`);
      return db.query(sql, params);
    }
    async function asAnon(sql, params = []) {
      await db.exec(`reset role; select set_config('test.uid','',false); set role anon;`);
      return db.query(sql, params);
    }
    async function asOwner(sql, params = []) {
      await db.exec('reset role;');
      return db.query(sql, params);
    }
    const asEditor = (sql, params = []) => asUser(editor, sql, params);
    const denied = (attempt) => assert.rejects(attempt, { code: '42501' });

    const rowFor = async (email) =>
      (await asOwner('select * from product_update_subscribers where email = $1', [email])).rows[0];
    const hashOf = (token) => createHash('sha256').update(token, 'utf8').digest('hex');

    async function rpc(name, args = {}) {
      await db.exec('reset role; set role service_role;');
      const names = Object.keys(args);
      const call = names.map((key, index) => `${key} => $${index + 1}`).join(', ');
      const values = Object.values(args).map((value) => (typeof value === 'object' && value !== null ? JSON.stringify(value) : value));
      try {
        const { rows } = await db.query(`select * from public.${name}(${call})`, values);
        const scalar = rows.length === 1 && Object.keys(rows[0]).length === 1 && name in rows[0];
        return { data: scalar ? rows[0][name] : rows, error: null };
      } catch (error) {
        return { data: null, error: { message: error.message, code: error.code } };
      }
    }
    const serviceDb = { rpc };

    const outbox = [];
    const sendEmail = async (message, idempotencyKey) => {
      outbox.push({ message, idempotencyKey });
      return { kind: 'sent', id: `resend-${outbox.length}` };
    };
    const jsonRequest = (body, extra = {}) =>
      new Request('https://projeto.supabase.test/functions/v1/x', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: 'https://nitin.com.br', ...extra },
        body: JSON.stringify(body),
      });
    const consent = { consent: true, consentVersion: '2026-10-31', source: 'novidades' };
    const subscribe = (email, extra = {}) =>
      edge.handleSubscribe(jsonRequest({ email, ...consent, ...extra }), { db: serviceDb, config, sendEmail });
    const lastToken = (kind) => {
      const match = outbox.at(-1).message.text.match(new RegExp(`/inscricao/${kind}#token=([0-9a-f]{64})`));
      return match?.[1];
    };

    const accepted = await subscribe('  Pessoa@Example.TEST ');
    assert.equal(accepted.status, 200);
    assert.deepEqual(await accepted.json(), { accepted: true });
    const pending = await rowFor('pessoa@example.test');
    assert.equal(pending.status, 'pending');
    assert.equal(pending.consent_source, 'novidades');
    assert.equal(pending.consent_version, '2026-10-31');
    assert.ok(pending.consent_at);
    assert.equal(outbox.length, 1);
    assert.equal(outbox[0].message.to, 'pessoa@example.test');

    const firstConfirmToken = lastToken('confirmar');
    assert.ok(firstConfirmToken);
    assert.notEqual(pending.confirm_token_hash, firstConfirmToken);
    assert.equal(pending.confirm_token_hash, hashOf(firstConfirmToken));
    assert.ok(lastToken('cancelar'));
    assert.equal(lastToken('cancelar'), pending.unsubscribe_token);
    assert.match(outbox[0].message.headers['List-Unsubscribe'], new RegExp(pending.unsubscribe_token));

    for (const attempt of [
      subscribe('sem-consentimento@example.test', { consent: false }),
      subscribe('sem-versao@example.test', { consentVersion: '2020-01-01' }),
      subscribe('sem-origem@example.test', { source: 'outro-site' }),
      subscribe('endereco-invalido'),
    ]) {
      assert.equal((await attempt).status, 400);
    }
    assert.equal((await asOwner('select count(*)::int n from product_update_subscribers')).rows[0].n, 1);

    const direct = await rpc('subscribe_to_product_updates', {
      p_email: '  Direto@Example.TEST ',
      p_source: 'novidades',
      p_consent_version: '2026-10-31',
    });
    assert.equal(direct.error, null);
    assert.equal((await rowFor('direto@example.test')).status, 'pending');
    await asOwner("delete from product_update_subscribers where email = 'direto@example.test'");

    const trap = await subscribe('robo@example.test', { website: 'https://spam.test' });
    assert.equal(trap.status, 200);
    assert.equal(await rowFor('robo@example.test'), undefined);

    await denied(() => asAnon('select * from product_update_subscribers'));
    await denied(() => asAnon('select unsubscribe_token from product_update_subscribers'));
    await denied(() => asAnon('select * from product_update_email_send_summaries'));
    assert.equal((await asUser(member, 'select id from product_update_subscribers')).rows.length, 0);
    assert.equal((await asUser(editor, 'select id from product_update_subscribers', [], 'aal1')).rows.length, 0);
    assert.equal((await asEditor('select email, status, consent_version from product_update_subscribers')).rows.length, 1);
    await denied(() => asEditor('select * from product_update_subscribers'));
    await denied(() => asEditor('select unsubscribe_token from product_update_subscribers'));
    await denied(() => asEditor('select confirm_token_hash from product_update_subscribers'));

    for (const write of [
      "insert into product_update_subscribers(email, consent_source, consent_version, unsubscribe_token) values ('novo@example.test','novidades','2026-10-31', repeat('a',64))",
      "update product_update_subscribers set status = 'confirmed', confirmed_at = now()",
      'delete from product_update_subscribers',
    ]) {
      await denied(() => asEditor(write));
      await denied(() => asUser(member, write));
    }
    await denied(() => asEditor('insert into product_update_email_sends(update_id) select id from product_updates limit 1'));
    await denied(() => asEditor('delete from product_update_email_deliveries'));

    for (const fn of SERVICE_FUNCTIONS) {
      await denied(() => asAnon(`select * from public.${fn}`));
      await denied(() => asUser(member, `select * from public.${fn}`));
      await denied(() => asEditor(`select * from public.${fn}`));
    }

    const insertDirect = (email, version = '2026-10-31', source = 'novidades', token = 'b'.repeat(64)) =>
      asOwner(
        `insert into product_update_subscribers(email, consent_source, consent_version, confirm_token_hash, confirm_expires_at, unsubscribe_token)
         values ($1, $2, $3, $4, now() + interval '1 hour', $5)`,
        [email, source, version, 'c'.repeat(64), token],
      );
    await assert.rejects(() => insertDirect('MAIUSCULA@example.test'));
    await assert.rejects(() => insertDirect('sem-arroba.example.test'));
    await assert.rejects(() => insertDirect(`${'a'.repeat(250)}@example.test`));
    await assert.rejects(() => insertDirect('versao@example.test', 'qualquer'));
    await assert.rejects(() => insertDirect('origem@example.test', '2026-10-31', 'Origem Inválida'));
    await assert.rejects(() => insertDirect('token@example.test', '2026-10-31', 'novidades', 'curto'));
    await assert.rejects(() =>
      asOwner(
        `insert into product_update_subscribers(email, consent_source, consent_version, unsubscribe_token)
         values ('pendente-sem-token@example.test','novidades','2026-10-31', repeat('d',64))`,
      ),
    );
    await assert.rejects(() =>
      asOwner(
        `insert into product_update_subscribers(email, status, consent_source, consent_version, unsubscribe_token)
         values ('confirmado-sem-data@example.test','confirmed','novidades','2026-10-31', repeat('e',64))`,
      ),
    );

    assert.equal((await rpc('confirm_product_update_subscription', { p_token: 'f'.repeat(64) })).data, false);
    assert.equal((await rowFor('pessoa@example.test')).status, 'pending');

    await subscribe('pessoa@example.test');
    const secondConfirmToken = lastToken('confirmar');
    assert.notEqual(secondConfirmToken, firstConfirmToken);
    assert.equal((await rpc('confirm_product_update_subscription', { p_token: firstConfirmToken })).data, false);
    assert.equal((await rowFor('pessoa@example.test')).status, 'pending');

    const confirmResponse = await edge.handleConfirm(jsonRequest({ token: secondConfirmToken }), { db: serviceDb, config });
    assert.equal(confirmResponse.status, 200);
    const confirmed = await rowFor('pessoa@example.test');
    assert.equal(confirmed.status, 'confirmed');
    assert.ok(confirmed.confirmed_at);
    assert.equal(confirmed.confirm_token_hash, null);
    assert.equal(confirmed.confirm_expires_at, null);
    assert.equal(confirmed.unsubscribe_token, pending.unsubscribe_token);
    assert.equal((await edge.handleConfirm(jsonRequest({ token: secondConfirmToken }), { db: serviceDb, config })).status, 404);

    const beforeRepeat = await rowFor('pessoa@example.test');
    const repeated = await subscribe('pessoa@example.test', { source: 'publicacao' });
    assert.deepEqual(await repeated.json(), { accepted: true });
    const afterRepeat = await rowFor('pessoa@example.test');
    assert.equal(afterRepeat.status, 'confirmed');
    assert.equal(afterRepeat.consent_source, beforeRepeat.consent_source);
    assert.equal(afterRepeat.consent_at.getTime(), beforeRepeat.consent_at.getTime());
    assert.equal(lastToken('confirmar'), undefined);
    assert.equal(lastToken('cancelar'), confirmed.unsubscribe_token);

    const newcomer = await subscribe('novata@example.test');
    assert.equal(repeated.status, newcomer.status);
    assert.equal(outbox.at(-1).message.to, 'novata@example.test');
    const newcomerToken = lastToken('confirmar');
    assert.ok(newcomerToken);

    await asOwner("update product_update_subscribers set confirm_expires_at = now() - interval '1 minute' where email = 'novata@example.test'");
    assert.equal((await edge.handleConfirm(jsonRequest({ token: newcomerToken }), { db: serviceDb, config })).status, 404);
    assert.equal((await rowFor('novata@example.test')).status, 'pending');

    await subscribe('gatilho-limpeza@example.test');
    assert.equal(await rowFor('novata@example.test'), undefined);

    const cancelPendingToken = lastToken('cancelar');
    const cancelPending = await edge.handleUnsubscribe(jsonRequest({ token: cancelPendingToken }), { db: serviceDb, config });
    assert.equal(cancelPending.status, 200);
    assert.equal(await rowFor('gatilho-limpeza@example.test'), undefined);

    const categoryId = (await asAnon("select id from product_update_categories where slug = 'melhorias'")).rows[0].id;
    const draftId = (await asEditor("insert into product_updates(slug,title,summary,category_id) values ('rascunho-envio','Rascunho','Resumo',$1) returning id", [categoryId])).rows[0].id;
    const postId = (await asEditor("insert into product_updates(slug,title,summary,category_id,published_at) values ('novidade-envio','Título <b>da</b> novidade','Resumo da novidade',$1,now()) returning id", [categoryId])).rows[0].id;

    const userClient = (uid, aal = 'aal2') => ({
      auth: { getUser: async () => ({ data: { user: uid ? { id: uid } : null }, error: uid ? null : new Error('sem sessão') }) },
      rpc: async () => {
        const { rows } = await asUser(uid, 'select public.is_site_editor() ok', [], aal);
        return { data: rows[0].ok, error: null };
      },
    });
    const sendAs = (uid, updateId, aal, send = sendEmail) =>
      edge.handleSend(jsonRequest({ updateId }, { Authorization: 'Bearer sessao' }), {
        db: serviceDb,
        config,
        sendEmail: send,
        createUserClient: () => userClient(uid, aal),
      });

    assert.equal((await sendAs(null, postId)).status, 401);
    assert.equal((await sendAs(member, postId)).status, 403);
    assert.equal((await sendAs(editor, postId, 'aal1')).status, 403);
    assert.equal((await sendAs(editor, draftId)).status, 409);
    assert.equal((await asOwner('select count(*)::int n from product_update_email_sends')).rows[0].n, 0);

    const extraEmails = ['segunda@example.test', 'terceira@example.test', 'pendente@example.test', 'saiu@example.test'];
    for (const email of extraEmails) {
      await subscribe(email);
      if (email === 'pendente@example.test') continue;
      await edge.handleConfirm(jsonRequest({ token: lastToken('confirmar') }), { db: serviceDb, config });
    }
    const leaverToken = (await rowFor('saiu@example.test')).unsubscribe_token;
    assert.equal((await edge.handleUnsubscribe(jsonRequest({ token: leaverToken }), { db: serviceDb, config })).status, 200);
    assert.equal((await rowFor('saiu@example.test')).status, 'unsubscribed');
    assert.ok((await rowFor('saiu@example.test')).unsubscribed_at);
    assert.equal((await edge.handleUnsubscribe(jsonRequest({ token: leaverToken }), { db: serviceDb, config })).status, 200);
    assert.equal((await edge.handleUnsubscribe(jsonRequest({ token: 'f'.repeat(64) }), { db: serviceDb, config })).status, 404);

    const oneClickToken = (await rowFor('terceira@example.test')).unsubscribe_token;
    const scanner = await edge.handleUnsubscribe(
      new Request(`https://projeto.supabase.test/functions/v1/x?token=${oneClickToken}`),
      { db: serviceDb, config },
    );
    assert.equal(scanner.status, 303);
    assert.equal((await rowFor('terceira@example.test')).status, 'confirmed');

    const sentBefore = outbox.length;
    let attempts = 0;
    const flaky = async (message, key) => {
      attempts += 1;
      if (attempts === 1) return { kind: 'retry', retryAfterSeconds: 5 };
      return sendEmail(message, key);
    };
    const retried = await sendAs(editor, postId, 'aal2', flaky);
    assert.equal(retried.status, 200);
    const retriedBody = await retried.json();
    assert.equal(retriedBody.retryAfterSeconds, 5);
    assert.equal(retriedBody.sent, 0);
    assert.equal(retriedBody.remaining, 3);
    assert.equal(retriedBody.completedAt, null);

    const blocked = await (await sendAs(editor, postId, 'aal2', async () => ({ kind: 'blocked', code: 'domain' }))).json();
    assert.equal(blocked.blocked, true);
    assert.equal(blocked.remaining, 3);

    await asOwner("update product_update_email_deliveries set status = 'sending', attempted_at = now() - interval '1 hour' where subscriber_id = (select id from product_update_subscribers where email = 'segunda@example.test')");
    const oneClickLeave = await edge.handleUnsubscribe(
      new Request(`https://projeto.supabase.test/functions/v1/x?token=${oneClickToken}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'List-Unsubscribe=One-Click',
      }),
      { db: serviceDb, config },
    );
    assert.equal(oneClickLeave.status, 200);
    assert.equal((await rowFor('terceira@example.test')).status, 'unsubscribed');

    const completed = await (await sendAs(editor, postId)).json();
    assert.equal(completed.total, 3);
    assert.equal(completed.sent, 2);
    assert.equal(completed.skipped, 1);
    assert.equal(completed.remaining, 0);
    assert.ok(completed.completedAt);

    const delivered = outbox.slice(sentBefore);
    assert.deepEqual(
      delivered.map((item) => item.message.to).sort(),
      ['pessoa@example.test', 'segunda@example.test'],
    );
    for (const { message, idempotencyKey } of delivered) {
      assert.match(message.html, /Cancelar inscrição/);
      assert.match(message.text, /\/novidades\/inscricao\/cancelar#token=[0-9a-f]{64}/);
      assert.match(message.headers['List-Unsubscribe'], /product-update-unsubscribe\?token=[0-9a-f]{64}/);
      assert.equal(message.headers['List-Unsubscribe-Post'], 'List-Unsubscribe=One-Click');
      assert.match(message.text, /\/novidades\/novidade-envio/);
      assert.equal(message.html.includes('<b>da</b>'), false);
      assert.match(idempotencyKey, /^[0-9a-f-]{36}:[0-9a-f-]{36}$/);
    }

    const sentProvider = (await asEditor("select provider_id from product_update_email_deliveries where status = 'sent'")).rows;
    assert.equal(sentProvider.length, 2);
    assert.ok(sentProvider.every((row) => row.provider_id));

    const again = await (await sendAs(editor, postId)).json();
    assert.equal(again.sent, 2);
    assert.equal(again.total, 3);
    assert.equal(outbox.length, sentBefore + 2);

    const summary = (await asEditor('select * from product_update_email_send_summaries where update_id = $1', [postId])).rows[0];
    assert.equal(summary.sent, 2);
    assert.equal((await asUser(member, 'select * from product_update_email_send_summaries')).rows.length, 0);
    assert.equal((await asUser(member, 'select * from product_update_email_sends')).rows.length, 0);
    assert.equal((await asUser(member, 'select * from product_update_email_deliveries')).rows.length, 0);

    const lateSend = await rpc('start_product_update_send', { p_update_id: postId, p_editor: editor });
    await subscribe('tardia@example.test');
    await edge.handleConfirm(jsonRequest({ token: lastToken('confirmar') }), { db: serviceDb, config });
    const claimAfterFinish = await rpc('claim_product_update_deliveries', { p_send_id: lateSend.data[0].send_id, p_limit: 25 });
    assert.equal(claimAfterFinish.data.length, 0);

    const secondPostId = (await asEditor("insert into product_updates(slug,title,summary,category_id,published_at) values ('outra-novidade','Outra','Resumo',$1,now()) returning id", [categoryId])).rows[0].id;
    const secondSend = await rpc('start_product_update_send', { p_update_id: secondPostId, p_editor: editor });
    const claimedOne = await rpc('claim_product_update_deliveries', { p_send_id: secondSend.data[0].send_id, p_limit: 1 });
    assert.equal(claimedOne.data.length, 1);
    await asOwner(`
      insert into product_update_subscribers(email, status, consent_source, consent_version, confirmed_at, unsubscribe_token)
      select 'lote' || n || '@example.test', 'confirmed', 'novidades', '2026-10-31', now(), lpad(n::text, 64, '0')
      from generate_series(1, 120) n
    `);
    const bulkPostId = (await asEditor("insert into product_updates(slug,title,summary,category_id,published_at) values ('novidade-em-lote','Lote','Resumo',$1,now()) returning id", [categoryId])).rows[0].id;
    const bulkSend = await rpc('start_product_update_send', { p_update_id: bulkPostId, p_editor: editor });
    const bounded = await rpc('claim_product_update_deliveries', { p_send_id: bulkSend.data[0].send_id, p_limit: 1000 });
    assert.equal(bounded.data.length, 100);
    await asOwner("delete from product_update_subscribers where email like 'lote%'");
    const tampered = await rpc('finish_product_update_deliveries', {
      p_send_id: secondSend.data[0].send_id,
      p_results: [{ subscriber_id: claimedOne.data[0].subscriber_id, status: 'skipped' }],
    });
    assert.equal(tampered.data[0].skipped, 0);

    const beforeResubscribe = await rowFor('saiu@example.test');
    await asOwner("update product_update_subscribers set consent_at = now() - interval '1 day' where email = 'saiu@example.test'");
    await subscribe('saiu@example.test', { source: 'publicacao' });
    const resubscribed = await rowFor('saiu@example.test');
    assert.equal(resubscribed.status, 'pending');
    assert.equal(resubscribed.consent_source, 'publicacao');
    assert.notEqual(resubscribed.consent_source, beforeResubscribe.consent_source);
    assert.ok(resubscribed.consent_at.getTime() > Date.now() - 3600000);
    assert.equal(resubscribed.unsubscribed_at, null);
    assert.equal(resubscribed.confirmed_at, null);
    assert.equal(resubscribed.unsubscribe_token, leaverToken);

    await asOwner("update product_update_subscribers set unsubscribed_at = now() - interval '181 days' where email = 'terceira@example.test'");
    await subscribe('antes-da-limpeza@example.test');
    assert.equal(await rowFor('terceira@example.test'), undefined);
    await subscribe('recente@example.test');
    await edge.handleConfirm(jsonRequest({ token: lastToken('confirmar') }), { db: serviceDb, config });
    const recentToken = (await rowFor('recente@example.test')).unsubscribe_token;
    await rpc('unsubscribe_from_product_updates', { p_token: recentToken });
    await asOwner("update product_update_subscribers set unsubscribed_at = now() - interval '179 days' where email = 'recente@example.test'");
    await subscribe('depois-da-limpeza@example.test');
    assert.equal((await rowFor('recente@example.test')).status, 'unsubscribed');

    await asOwner('delete from private.security_rate_limits');
    const limitCases = [
      ['news_subscribe_email', 3],
      ['news_subscribe', 100],
      ['news_confirm', 300],
      ['news_unsubscribe', 600],
    ];
    for (const [feature, limit] of limitCases) {
      const subject = `limite-de-${feature}`;
      for (let attempt = 0; attempt < limit; attempt += 1) {
        assert.equal((await rpc('consume_product_update_limit', { p_feature: feature, p_subject: subject })).data, true);
      }
      assert.equal((await rpc('consume_product_update_limit', { p_feature: feature, p_subject: subject })).data, false);
      assert.equal((await rpc('consume_product_update_limit', { p_feature: feature, p_subject: `${subject}-outro` })).data, true);
    }
    assert.ok((await rpc('consume_product_update_limit', { p_feature: 'news_outro', p_subject: 'chave-de-teste-longa' })).error);
    assert.ok((await rpc('consume_product_update_limit', { p_feature: 'news_confirm', p_subject: 'curta' })).error);

    await asOwner('delete from private.security_rate_limits');
    await asOwner("delete from product_update_subscribers where email = 'limitada@example.test'");
    const outboxBeforeLimit = outbox.length;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      assert.equal((await subscribe('limitada@example.test')).status, 200);
    }
    assert.equal((await subscribe('LIMITADA@example.test')).status, 429);
    assert.equal(outbox.length, outboxBeforeLimit + 3);

    const windowRow = (await asOwner("select window_started_at from private.security_rate_limits where feature = 'news_subscribe_email' limit 1")).rows[0];
    assert.equal(windowRow.window_started_at.getTime() % 86400000, 0);

    await asOwner('delete from private.security_rate_limits');
    for (let attempt = 0; attempt < 100; attempt += 1) {
      assert.equal((await rpc('consume_product_update_limit', { p_feature: 'news_subscribe', p_subject: 'product-updates-global' })).data, true);
    }
    assert.equal((await subscribe('global@example.test')).status, 429);
    assert.equal(await rowFor('global@example.test'), undefined);

    const confirmedCount = (await asOwner("select count(*)::int n from product_update_subscribers where status = 'confirmed'")).rows[0].n;
    assert.ok(confirmedCount > 0);
    const secondDeliveries = 'select count(*)::int n from product_update_email_deliveries where send_id = $1';
    const secondSendId = secondSend.data[0].send_id;
    const secondCount = (await asOwner(secondDeliveries, [secondSendId])).rows[0].n;
    assert.ok(secondCount > 0);
    await asOwner("delete from product_update_subscribers where email = 'pessoa@example.test'");
    assert.equal((await asOwner(secondDeliveries, [secondSendId])).rows[0].n, secondCount - 1);

    await asEditor('delete from product_updates where id = $1', [postId]);
    assert.equal((await asOwner('select count(*)::int n from product_update_email_sends where update_id = $1', [postId])).rows[0].n, 0);
    assert.equal(
      (await asOwner("select count(*)::int n from product_update_subscribers where status = 'confirmed'")).rows[0].n,
      confirmedCount - 1,
    );
  } finally {
    await db.close();
  }
}

const MUTATIONS = [
  ['anon lê inscritos', 'create policy product_update_subscribers_read', "grant select on public.product_update_subscribers to anon;\ncreate policy anon_le on public.product_update_subscribers for select to anon using (true);\ncreate policy product_update_subscribers_read"],
  ['qualquer conta lê inscritos', 'on public.product_update_subscribers for select to authenticated\n  using (public.is_site_editor())', 'on public.product_update_subscribers for select to authenticated\n  using (true)'],
  ['editor lê token de descadastro', 'grant select (id, email, status,', 'grant select (unsubscribe_token, id, email, status,'],
  ['editor lê hash de confirmação', 'grant select (id, email, status,', 'grant select (confirm_token_hash, id, email, status,'],
  ['qualquer conta lê envios', 'on public.product_update_email_sends for select to authenticated\n  using (public.is_site_editor())', 'on public.product_update_email_sends for select to authenticated\n  using (true)'],
  ['qualquer conta lê entregas', 'on public.product_update_email_deliveries for select to authenticated\n  using (public.is_site_editor())', 'on public.product_update_email_deliveries for select to authenticated\n  using (true)'],
  ['resumo ignora RLS', 'with (security_invoker = true)', ''],
  ['editor escreve em inscritos', 'create policy product_update_subscribers_read', 'grant insert, update, delete on public.product_update_subscribers to authenticated;\ncreate policy editor_escreve on public.product_update_subscribers for all to authenticated using (public.is_site_editor()) with check (public.is_site_editor());\ncreate policy product_update_subscribers_read'],
  ['anon executa limite', 'revoke all on function public.consume_product_update_limit(text, text) from public, anon, authenticated;', ''],
  ['anon inscreve direto', 'revoke all on function public.subscribe_to_product_updates(text, text, text) from public, anon, authenticated;', ''],
  ['anon confirma direto', 'revoke all on function public.confirm_product_update_subscription(text) from public, anon, authenticated;', ''],
  ['anon descadastra direto', 'revoke all on function public.unsubscribe_from_product_updates(text) from public, anon, authenticated;', ''],
  ['anon inicia envio', 'revoke all on function public.start_product_update_send(uuid, uuid) from public, anon, authenticated;', ''],
  ['anon reivindica entregas', 'revoke all on function public.claim_product_update_deliveries(uuid, integer) from public, anon, authenticated;', ''],
  ['anon conclui entregas', 'revoke all on function public.finish_product_update_deliveries(uuid, jsonb) from public, anon, authenticated;', ''],
  ['e-mail com maiúsculas', '\n    and email = lower(email)', ''],
  ['e-mail sem formato', "\n    and email ~ '^[^@[:space:]]+@[^@[:space:]]+\\.[^@[:space:]]+$'", ''],
  ['e-mail sem limite', 'length(email) <= 254', 'length(email) <= 5000'],
  ['inscrição sem normalizar', 'lower(trim(p_email))', 'p_email'],
  ['versão livre', " check (consent_version ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$')", ''],
  ['origem livre', " check (consent_source ~ '^[a-z0-9-]{1,40}$')", ''],
  ['token curto aceito', " check (unsubscribe_token ~ '^[0-9a-f]{64}$')", ''],
  ['pendente sem token', "\n  check ((status = 'pending') = (confirm_token_hash is not null and confirm_expires_at is not null)),", ''],
  ['confirmado sem data', "\n  check (status <> 'confirmed' or confirmed_at is not null),", ''],
  ['token de confirmação em claro', 'private.product_update_token_hash(new_confirm_token),', 'new_confirm_token,'],
  ['inscrição repetida rebaixa confirmado', "where subscriber.status <> 'confirmed'\n", '\n'],
  ['reinscrição mantém token antigo', 'confirm_token_hash = excluded.confirm_token_hash,', 'confirm_token_hash = coalesce(subscriber.confirm_token_hash, excluded.confirm_token_hash),'],
  ['reinscrição mantém consentimento antigo', "      consent_source = excluded.consent_source,\n", ''],
  ['reinscrição mantém data do consentimento', "      consent_at = now(),\n", ''],
  ['reinscrição mantém descadastro', "      unsubscribed_at = null\n", "      unsubscribed_at = subscriber.unsubscribed_at\n"],
  ['confirmação ignora validade', "\n    and confirm_expires_at > now()", ''],
  ['confirmação aceita qualquer token', "\n    and confirm_token_hash = private.product_update_token_hash(p_token)", ''],
  ['descadastro mantém pendente', "delete from public.product_update_subscribers where unsubscribe_token = p_token;", "update public.product_update_subscribers set status = 'unsubscribed', unsubscribed_at = now(), confirm_token_hash = null, confirm_expires_at = null where unsubscribe_token = p_token;"],
  ['descadastro não muda status', "set status = 'unsubscribed', unsubscribed_at = now()\n    where unsubscribe_token = p_token;", "set consent_at = now()\n    where unsubscribe_token = p_token;"],
  ['token desconhecido aceito no descadastro', "if current_status is null then\n    return false;", "if current_status is null then\n    return true;"],
  ['limpeza não remove pendentes vencidos', "(status = 'pending' and confirm_expires_at < now())\n    or ", ''],
  ['limpeza não remove descadastros antigos', "\n    or (status = 'unsubscribed' and unsubscribed_at < now() - interval '180 days')", ''],
  ['limpeza remove descadastros recentes', "interval '180 days'", "interval '90 days'"],
  ['limite de e-mail maior', 'request_limit := 3;', 'request_limit := 4;'],
  ['limite de inscrições maior', 'request_limit := 100;', 'request_limit := 101;'],
  ['limite de confirmação maior', 'request_limit := 300;', 'request_limit := 301;'],
  ['limite de descadastro maior', 'request_limit := 600;', 'request_limit := 601;'],
  ['janela de e-mail menor', 'window_seconds := 86400;', 'window_seconds := 3600;'],
  ['limite aceita chave curta', "if length(coalesce(p_subject, '')) < 16 or length(p_subject) > 160 then", 'if false then'],
  ['limite aceita recurso desconhecido', "raise exception 'Limite desconhecido.';", "request_limit := 1000; window_seconds := 60;"],
  ['limite nunca bloqueia', 'where private.security_rate_limits.request_count < request_limit\n', '\n'],
  ['envio de rascunho', ' and update_row.published_at is not null', ''],
  ['envio duplicado', 'update_id uuid not null unique references', 'update_id uuid not null references'],
  ['envio inclui não confirmados', "where subscriber.status = 'confirmed';", ';'],
  ['envio repetido reenfileira', "    select send.id into current_send_id\n    from public.product_update_email_sends send\n    where send.update_id = p_update_id;\n  else\n", "    select send.id into current_send_id\n    from public.product_update_email_sends send\n    where send.update_id = p_update_id;\n    update public.product_update_email_deliveries set status = 'pending' where send_id = current_send_id;\n  else\n"],
  ['descadastrado recebe envio', "\n    and subscriber.status <> 'confirmed';", ';'],
  ['entrega presa não volta', "and delivery.attempted_at < now() - interval '15 minutes'", 'and false'],
  ['lote sem teto', 'least(coalesce(p_limit, 25), 100)', 'coalesce(p_limit, 25)'],
  ['conclusão aceita qualquer status', "\n    and result.status in ('sent', 'failed', 'pending')", ''],
  ['conclusão antes da hora', "and delivery.status in ('pending', 'sending')\n    );", "and false\n    );"],
  ['conclusão nunca marca', 'set completed_at = now()\n', 'set completed_at = null\n'],
  ['apagar publicação trava no envio', 'references public.product_updates(id) on delete cascade', 'references public.product_updates(id)'],
  ['apagar envio trava nas entregas', 'references public.product_update_email_sends(id) on delete cascade', 'references public.product_update_email_sends(id)'],
  ['apagar inscrito trava nas entregas', 'references public.product_update_subscribers(id) on delete cascade', 'references public.product_update_subscribers(id)'],
];

async function runMutations() {
  const survivors = [];
  for (const [name, from, to] of MUTATIONS) {
    assert.ok(subscribersMigration.includes(from), `Mutação sem alvo na migration: ${name}`);
    const mutated = subscribersMigration.replace(from, () => to);
    try {
      await runSuite(mutated);
      survivors.push(name);
      console.error(`Regra sem cobertura: ${name}`);
    } catch {
      console.log(`Detectada: ${name}`);
    }
  }
  assert.deepEqual(survivors, [], 'Há regras quebradas que o teste não detectou.');
  console.log(`Mutações: ${MUTATIONS.length} regras quebradas, todas detectadas.`);
}

async function main() {
  await runSuite(subscribersMigration);
  console.log('Inscritos SQL: consentimento, confirmação em duas etapas, descadastro, limites, sigilo dos tokens, envio único aos confirmados e retenção OK.');
  if (process.argv.includes('--mutations')) await runMutations();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
