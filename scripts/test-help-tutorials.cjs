const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require('@electric-sql/pglite');

async function main() {
  const db = new PGlite();
  try {
    const root = path.resolve(__dirname, '..');
    const base = fs.readFileSync(path.join(root, 'supabase/migrations/202605120001_backend_pending_screens.sql'), 'utf8');
    await db.exec(base.slice(0, base.indexOf('create table if not exists public.app_content_blocks')));
    await db.exec(`
      insert into help_categories (code, label) values ('transactions', 'Transações');
      insert into help_articles (category_id, title)
      select id, 'Como registrar uma nova transação?' from help_categories;
      insert into help_article_steps (article_id, step_order, text)
      select id, 9, 'Passo antigo' from help_articles;
      insert into help_articles (category_id, title)
      select id, 'Artigo personalizado' from help_categories;
      insert into help_article_steps (article_id, step_order, text)
      select id, 1, 'Conteúdo preservado' from help_articles where title = 'Artigo personalizado';
    `);
    const original = (await db.query("select id from help_articles where title = 'Como registrar uma nova transação?'")).rows[0].id;
    const migration = fs.readFileSync(path.join(root, 'supabase/migrations/202610280001_expand_help_tutorials.sql'), 'utf8');
    await db.exec(migration);
    const snapshot = async () => (await db.query(`
      select a.id, a.title, a.display_order, a.is_active, c.code,
        jsonb_agg(jsonb_build_object('order', s.step_order, 'text', s.text) order by s.step_order) as steps
      from help_articles a join help_categories c on c.id = a.category_id
      join help_article_steps s on s.article_id = a.id
      group by a.id, c.code order by a.id
    `)).rows;
    const first = await snapshot();
    const tutorials = first.filter((row) => row.title !== 'Artigo personalizado');
    assert.ok(tutorials.length >= 29);
    assert.equal(new Set(tutorials.map((row) => row.code)).size, 16);
    for (const article of tutorials) {
      assert.equal(article.is_active, true);
      assert.ok(article.display_order > 0);
      assert.deepEqual(article.steps.map((step) => step.order), [1, 2, 3, 4]);
      assert.ok(article.steps.every((step) => step.text.trim().length > 0));
    }
    assert.equal(first.find((row) => row.title === 'Como registrar uma nova transação?').id, original);
    assert.equal(first.find((row) => row.title === 'Artigo personalizado').steps[0].text, 'Conteúdo preservado');
    await db.exec(migration);
    assert.deepEqual(await snapshot(), first, 'A segunda execução deve preservar IDs, passos e quantidade de artigos');
    const emptyCategories = await db.query(`
      select code from help_categories c where not exists (
        select 1 from help_articles a where a.category_id = c.id and a.is_active
      )
    `);
    assert.equal(emptyCategories.rows.length, 0);
    console.log(`Help tutorials SQL: ${tutorials.length} tutoriais, 16 assuntos; atualização, preservação e idempotência OK.`);
  } finally {
    await db.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
