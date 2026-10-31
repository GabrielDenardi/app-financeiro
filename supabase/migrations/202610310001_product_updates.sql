create table public.site_editors (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  display_name text not null check (length(trim(display_name)) between 1 and 100),
  is_active boolean not null default true
);
alter table public.site_editors enable row level security;
revoke all on public.site_editors from public, anon, authenticated;

create function public.is_site_editor() returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and public.is_session_aal2_if_required()
    and exists(select 1 from public.site_editors where user_id = auth.uid() and is_active);
$$;
revoke all on function public.is_site_editor() from public, anon;
grant execute on function public.is_site_editor() to authenticated;

create table public.product_update_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (length(slug) <= 60 and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  label text not null check (length(trim(label)) between 1 and 60),
  stage text not null check (stage in ('released', 'in_development', 'planned')),
  position integer not null default 0
);

create table public.product_updates (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (length(slug) <= 120 and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and slug <> 'admin'),
  title text not null check (length(trim(title)) between 1 and 120),
  summary text not null check (length(trim(summary)) between 1 and 280),
  body text not null default '' check (length(body) <= 20000),
  category_id uuid not null references public.product_update_categories(id) on delete restrict,
  update_date date not null default current_date,
  images jsonb not null default '[]'::jsonb check (jsonb_typeof(images) = 'array' and jsonb_array_length(images) <= 6),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index product_updates_published_idx on public.product_updates(update_date desc, published_at desc)
  where published_at is not null;
create index product_updates_category_idx on public.product_updates(category_id);

create function private.product_update_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if jsonb_typeof(new.images) = 'array' and exists(
    select 1 from jsonb_array_elements(new.images) as image
    where jsonb_typeof(image) <> 'object'
      or coalesce(image->>'path', '') !~ '^[a-z0-9][a-z0-9/_.-]*$'
      or image->>'path' like '%..%'
      or length(trim(coalesce(image->>'alt', ''))) not between 1 and 200
      or coalesce(image->>'width', '') !~ '^[1-9][0-9]{0,4}$'
      or coalesce(image->>'height', '') !~ '^[1-9][0-9]{0,4}$'
  ) then
    raise exception 'Imagem inválida.' using errcode = '23514';
  end if;
  if tg_op = 'UPDATE' then
    if old.published_at is not null and new.published_at is not null and new.slug <> old.slug then
      raise exception 'O link de uma publicação não pode mudar enquanto ela estiver publicada.' using errcode = '23514';
    end if;
    new.updated_at := now();
  end if;
  return new;
end;
$$;
revoke all on function private.product_update_guard() from public, anon, authenticated;
create trigger product_update_guard before insert or update on public.product_updates
for each row execute function private.product_update_guard();

alter table public.product_update_categories enable row level security;
alter table public.product_updates enable row level security;
revoke all on public.product_update_categories, public.product_updates from public, anon, authenticated;
grant select on public.product_update_categories, public.product_updates to anon, authenticated;
grant insert, update, delete on public.product_update_categories, public.product_updates to authenticated;

create policy product_update_categories_read on public.product_update_categories for select to anon, authenticated
  using (true);
create policy product_update_categories_insert on public.product_update_categories for insert to authenticated
  with check (public.is_site_editor());
create policy product_update_categories_update on public.product_update_categories for update to authenticated
  using (public.is_site_editor()) with check (public.is_site_editor());
create policy product_update_categories_delete on public.product_update_categories for delete to authenticated
  using (public.is_site_editor());

create policy product_updates_read_published on public.product_updates for select to anon
  using (published_at is not null);
create policy product_updates_read_team on public.product_updates for select to authenticated
  using (published_at is not null or public.is_site_editor());
create policy product_updates_insert on public.product_updates for insert to authenticated
  with check (public.is_site_editor());
create policy product_updates_update on public.product_updates for update to authenticated
  using (public.is_site_editor()) with check (public.is_site_editor());
create policy product_updates_delete on public.product_updates for delete to authenticated
  using (public.is_site_editor());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-updates', 'product-updates', true, 2097152, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy product_update_images_select on storage.objects for select to authenticated
  using (bucket_id = 'product-updates' and public.is_site_editor());
create policy product_update_images_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'product-updates' and public.is_site_editor());
create policy product_update_images_delete on storage.objects for delete to authenticated
  using (bucket_id = 'product-updates' and public.is_site_editor());

insert into public.product_update_categories (slug, label, stage, position) values
  ('novidades', 'Novidades', 'released', 10),
  ('melhorias', 'Melhorias', 'released', 20),
  ('correcoes', 'Correções', 'released', 30),
  ('em-desenvolvimento', 'Em desenvolvimento', 'in_development', 40),
  ('planejado', 'Planejado', 'planned', 50);

insert into public.product_updates (slug, title, summary, body, category_id, update_date)
select draft.slug, draft.title, draft.summary, draft.body, category.id, draft.update_date::date
from (values
  (
    'notificacoes-financeiras',
    'Notificações financeiras no app e no celular',
    'Avisos de orçamento, vencimentos, grupos e segurança na central do app, com push opcional e horário silencioso.',
    E'O nitin agora avisa quando algo pede atenção no seu dinheiro.\n\n- Orçamentos: alerta ao cruzar os percentuais que você escolher.\n- Vencimentos: lembrete de recorrências ainda não confirmadas e de faturas em aberto.\n- Grupos: aviso quando uma participação sua é incluída ou muda de valor.\n- Segurança: aviso de acessos e de alterações importantes na conta.\n\nVocê escolhe as categorias nas preferências, decide se quer receber push no celular e pode definir um horário silencioso. Os avisos de segurança continuam chegando nesse horário.',
    'novidades',
    '2026-10-18'
  ),
  (
    'retirada-de-metas',
    'Retire valores das metas para uma conta',
    'Agora dá para tirar dinheiro de uma meta e devolver o valor para uma das suas contas.',
    E'Mudou o plano? Você pode retirar parte do valor guardado em uma meta e escolher a conta que vai receber o dinheiro.\n\nCada retirada fica registrada e gera uma transação na conta escolhida.',
    'novidades',
    '2026-10-21'
  ),
  (
    'atendimento-humano',
    'Atendimento humano dentro do app',
    'Assinantes do plano Pro conversam com a equipe do nitin pelo chat do app.',
    E'O chat de suporte agora é atendido pela equipe do nitin. Você abre a conversa pelo app e acompanha as respostas no mesmo lugar.\n\nQuando a equipe responde, você recebe uma notificação. O atendimento está disponível no plano Pro.',
    'novidades',
    '2026-10-28'
  ),
  (
    'central-de-ajuda',
    'Central de ajuda com mais tutoriais',
    'A central foi reorganizada e ganhou tutoriais sobre mais assuntos do app.',
    E'Reorganizamos a central de ajuda para facilitar a busca por respostas e ampliamos os tutoriais sobre os recursos do app.',
    'melhorias',
    '2026-10-28'
  ),
  (
    'contraste-modo-escuro',
    'Mais contraste no modo escuro',
    'Textos e ícones ficaram mais legíveis no modo escuro.',
    E'Ajustamos as cores de textos e ícones em telas como cartões, ajuda, menu e privacidade para facilitar a leitura no modo escuro.',
    'melhorias',
    '2026-10-28'
  ),
  (
    'divisao-em-grupos',
    'Cadastro de divisões em grupos corrigido',
    'Corrigimos um erro que podia aparecer ao cadastrar uma divisão em um grupo.',
    E'Cadastrar uma divisão em um grupo podia terminar em erro por causa de um conflito ao gravar a transação. O problema foi corrigido.',
    'correcoes',
    '2026-10-22'
  ),
  (
    'copiar-codigo-do-grupo',
    'Copiar o código de acesso do grupo',
    'Um atalho para copiar o código de acesso e compartilhar com quem vai entrar no grupo.',
    '',
    'em-desenvolvimento',
    '2026-10-31'
  ),
  (
    'nitin-para-iphone',
    'nitin para iPhone',
    'O lançamento começa pelo Android. A versão para iPhone, na App Store, vem depois.',
    '',
    'planejado',
    '2026-10-31'
  )
) as draft(slug, title, summary, body, category_slug, update_date)
join public.product_update_categories category on category.slug = draft.category_slug;
