const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { PGlite } = require('@electric-sql/pglite');

const migration = fs.readFileSync(
  path.resolve(__dirname, '../supabase/migrations/202610310001_product_updates.sql'),
  'utf8',
);

async function main() {
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
      grant usage on schema public, auth, storage to anon, authenticated;
      grant select, insert, delete on storage.objects to anon, authenticated;
      insert into profiles values ('${editor}'), ('${member}');
    `);
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
    const asEditor = (sql, params = []) => asUser(editor, sql, params);
    const count = result => result.rows[0].n;
    const countUpdates = 'select count(*)::int n from product_updates';

    assert.equal(count(await asAnon('select count(*)::int n from product_update_categories')), 5);
    assert.equal(count(await asEditor(countUpdates)), 8);
    assert.equal(count(await asEditor(`${countUpdates} where published_at is not null`)), 0);
    assert.equal(count(await asAnon(countUpdates)), 0);
    assert.equal(count(await asUser(member, countUpdates)), 0);

    const categoryId = (await asAnon("select id from product_update_categories where slug = 'melhorias'")).rows[0].id;
    const insert = 'insert into product_updates(slug,title,summary,category_id) values ($1,$2,$3,$4) returning id';
    const postValues = slug => [slug, 'Título', 'Resumo', categoryId];
    await assert.rejects(() => asAnon(insert, postValues('anonimo')));
    await assert.rejects(() => asUser(member, insert, postValues('membro')));
    await assert.rejects(() => asUser(editor, insert, postValues('sem-mfa'), 'aal1'));
    await assert.rejects(() => asEditor(insert, postValues('Link Inválido')));
    await assert.rejects(() => asEditor(insert, postValues('admin')));

    const postId = (await asEditor(insert, postValues('primeira-publicacao'))).rows[0].id;
    assert.equal(count(await asAnon(`${countUpdates} where id = $1`, [postId])), 0);

    await asEditor('update product_updates set published_at = now() where id = $1', [postId]);
    assert.equal(count(await asAnon(`${countUpdates} where id = $1`, [postId])), 1);
    assert.equal(count(await asUser(member, `${countUpdates} where id = $1`, [postId])), 1);

    await assert.rejects(() => asEditor("update product_updates set slug = 'outro-link' where id = $1", [postId]));
    await asEditor("update product_updates set published_at = null, slug = 'outro-link' where id = $1", [postId]);
    await asEditor('update product_updates set published_at = now() where id = $1', [postId]);

    const setImages = 'update product_updates set images = $1::jsonb where id = $2';
    const validImage = { path: '2026/imagem.webp', alt: 'Tela do app', width: 1200, height: 800 };
    await asEditor(setImages, [JSON.stringify([validImage]), postId]);
    for (const invalid of [
      { ...validImage, path: 'https://exemplo.test/imagem.webp' },
      { ...validImage, path: '../segredo.webp' },
      { ...validImage, path: '2026/../imagem.webp' },
      { ...validImage, alt: '' },
      { ...validImage, width: 0 },
      'imagem.webp',
    ]) {
      await assert.rejects(() => asEditor(setImages, [JSON.stringify([invalid]), postId]));
    }
    await assert.rejects(() => asEditor(setImages, [JSON.stringify(Array(7).fill(validImage)), postId]));

    await asUser(member, 'update product_updates set title = $1 where id = $2', ['Invasão', postId]);
    await asAnon('update product_updates set title = $1 where id = $2', ['Invasão', postId]).catch(() => {});
    await asUser(member, 'delete from product_updates where id = $1', [postId]);
    const survivor = (await asEditor('select title from product_updates where id = $1', [postId])).rows[0];
    assert.equal(survivor.title, 'Título');

    await assert.rejects(() => asUser(member, 'select * from site_editors'));
    await assert.rejects(() => asUser(member, 'insert into site_editors values ($1,$2,true)', [member, 'Impostor']));
    await assert.rejects(() => asAnon('select is_site_editor()'));
    assert.equal((await asUser(member, 'select is_site_editor() ok')).rows[0].ok, false);
    assert.equal((await asEditor('select is_site_editor() ok')).rows[0].ok, true);
    assert.equal((await asUser(editor, 'select is_site_editor() ok', [], 'aal1')).rows[0].ok, false);

    const addCategory = "insert into product_update_categories(slug,label,stage) values ($1,'Segurança','released') returning id";
    await assert.rejects(() => asUser(member, addCategory, ['seguranca']));
    const newCategoryId = (await asEditor(addCategory, ['seguranca'])).rows[0].id;
    await assert.rejects(() => asEditor("insert into product_update_categories(slug,label,stage) values ('invalida','Inválida','archived')"));
    await assert.rejects(() => asEditor('delete from product_update_categories where id = $1', [categoryId]));
    await asEditor('delete from product_update_categories where id = $1', [newCategoryId]);

    const upload = "insert into storage.objects(bucket_id,name) values ('product-updates',$1)";
    await assert.rejects(() => asAnon(upload, ['anonimo.webp']));
    await assert.rejects(() => asUser(member, upload, ['membro.webp']));
    await assert.rejects(() => asEditor("insert into storage.objects(bucket_id,name) values ('outro-bucket','x.webp')"));
    await asEditor(upload, ['2026/imagem.webp']);
    assert.equal(count(await asAnon('select count(*)::int n from storage.objects')), 0);
    assert.equal(count(await asUser(member, 'select count(*)::int n from storage.objects')), 0);
    assert.equal(count(await asEditor('select count(*)::int n from storage.objects')), 1);

    await asEditor('delete from product_updates where id = $1', [postId]);
    assert.equal(count(await asAnon(`${countUpdates} where id = $1`, [postId])), 0);

    await db.exec(`reset role; update site_editors set is_active = false where user_id = '${editor}';`);
    await assert.rejects(() => asEditor(insert, postValues('revogado')));
    assert.equal(count(await asEditor(countUpdates)), 0);

    console.log('Novidades SQL: rascunhos ocultos, leitura pública, escrita restrita, MFA, revogação, link fixo, imagens, categorias e storage OK.');
  } finally {
    await db.close();
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
