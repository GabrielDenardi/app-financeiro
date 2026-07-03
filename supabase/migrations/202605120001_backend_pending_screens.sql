create table if not exists public.help_categories (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  label text not null,
  color text not null default '#2563EB',
  icon text not null default 'help-circle',
  display_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.help_articles (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.help_categories(id) on delete cascade,
  title text not null,
  level text not null default 'Intermediario',
  popular boolean not null default false,
  tip text not null default '',
  display_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.help_article_steps (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.help_articles(id) on delete cascade,
  step_order integer not null,
  text text not null,
  created_at timestamptz not null default now(),
  unique (article_id, step_order)
);

create table if not exists public.app_content_blocks (
  id uuid primary key default gen_random_uuid(),
  area text not null,
  key text not null,
  title text not null default '',
  body text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  display_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (area, key)
);

create table if not exists public.app_external_links (
  id uuid primary key default gen_random_uuid(),
  area text not null,
  key text not null,
  label text not null,
  url text not null,
  icon text not null default 'link',
  display_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (area, key)
);

create table if not exists public.support_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz,
  constraint support_conversations_status_check check (status in ('active', 'working', 'done'))
);

create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.support_conversations(id) on delete cascade,
  sender_user_id uuid references public.profiles(id) on delete set null,
  sender_role text not null default 'user',
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint support_messages_sender_role_check check (sender_role in ('user', 'support', 'system'))
);

create table if not exists public.user_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text not null default '',
  icon text not null default 'info',
  source_type text not null default 'system',
  read_at timestamptz,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint user_notifications_icon_check check (icon in ('info', 'success', 'warning', 'security'))
);

alter table public.recurring_transaction_rules
add column if not exists is_variable boolean not null default false;

create table if not exists public.recurring_transaction_executions (
  id uuid primary key default gen_random_uuid(),
  rule_id uuid not null references public.recurring_transaction_rules(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  execution_month date not null,
  transaction_id uuid references public.personal_transactions(id) on delete set null,
  amount numeric(14,2) not null,
  note text not null default '',
  created_at timestamptz not null default now(),
  unique (rule_id, execution_month)
);

drop trigger if exists trg_help_categories_updated_at on public.help_categories;
create trigger trg_help_categories_updated_at
before update on public.help_categories
for each row
execute function public.set_generic_updated_at();

drop trigger if exists trg_help_articles_updated_at on public.help_articles;
create trigger trg_help_articles_updated_at
before update on public.help_articles
for each row
execute function public.set_generic_updated_at();

drop trigger if exists trg_app_content_blocks_updated_at on public.app_content_blocks;
create trigger trg_app_content_blocks_updated_at
before update on public.app_content_blocks
for each row
execute function public.set_generic_updated_at();

drop trigger if exists trg_app_external_links_updated_at on public.app_external_links;
create trigger trg_app_external_links_updated_at
before update on public.app_external_links
for each row
execute function public.set_generic_updated_at();

drop trigger if exists trg_support_conversations_updated_at on public.support_conversations;
create trigger trg_support_conversations_updated_at
before update on public.support_conversations
for each row
execute function public.set_generic_updated_at();

create or replace function public.touch_support_conversation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.support_conversations
  set updated_at = now()
  where id = new.conversation_id;

  return new;
end;
$$;

drop trigger if exists trg_support_messages_touch_conversation on public.support_messages;
create trigger trg_support_messages_touch_conversation
after insert on public.support_messages
for each row
execute function public.touch_support_conversation();

create index if not exists help_categories_order_idx
on public.help_categories (display_order, label);
create index if not exists help_articles_category_order_idx
on public.help_articles (category_id, display_order, title);
create index if not exists help_article_steps_article_order_idx
on public.help_article_steps (article_id, step_order);
create index if not exists app_content_blocks_area_order_idx
on public.app_content_blocks (area, display_order);
create index if not exists app_external_links_area_order_idx
on public.app_external_links (area, display_order);
create index if not exists support_conversations_user_updated_idx
on public.support_conversations (user_id, updated_at desc);
create index if not exists support_messages_conversation_created_idx
on public.support_messages (conversation_id, created_at asc);
create index if not exists user_notifications_user_created_idx
on public.user_notifications (user_id, created_at desc);
create index if not exists recurring_transaction_executions_rule_month_idx
on public.recurring_transaction_executions (rule_id, execution_month desc);

create or replace function public.confirm_recurring_transaction(
  p_rule_id uuid,
  p_amount numeric,
  p_note text default '',
  p_execution_month date default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  target_month date := public.make_month_date(coalesce(p_execution_month, current_date));
  safe_amount numeric := round(coalesce(p_amount, 0), 2);
  rule_row public.recurring_transaction_rules%rowtype;
  new_transaction_id uuid;
begin
  if current_user_id is null then
    raise exception 'Usuário não autenticado.';
  end if;

  if safe_amount <= 0 then
    raise exception 'O valor deve ser maior que zero.';
  end if;

  select *
  into rule_row
  from public.recurring_transaction_rules
  where id = p_rule_id
    and user_id = current_user_id;

  if not found then
    raise exception 'Regra recorrente não encontrada.';
  end if;

  insert into public.personal_transactions (
    user_id,
    account_id,
    category_id,
    type,
    title,
    notes,
    description,
    payment_method,
    amount,
    occurred_at,
    occurred_on,
    source_type,
    include_in_reports,
    recurring_rule_id
  )
  values (
    current_user_id,
    rule_row.account_id,
    rule_row.category_id,
    rule_row.type,
    rule_row.title,
    trim(coalesce(p_note, rule_row.notes, '')),
    trim(coalesce(p_note, rule_row.notes, '')),
    rule_row.payment_method,
    safe_amount,
    target_month::timestamptz,
    target_month,
    'manual',
    true,
    rule_row.id
  )
  returning id into new_transaction_id;

  insert into public.recurring_transaction_executions (
    rule_id,
    user_id,
    execution_month,
    transaction_id,
    amount,
    note
  )
  values (
    rule_row.id,
    current_user_id,
    target_month,
    new_transaction_id,
    safe_amount,
    trim(coalesce(p_note, ''))
  )
  on conflict (rule_id, execution_month) do update
  set transaction_id = excluded.transaction_id,
      amount = excluded.amount,
      note = excluded.note;

  if rule_row.is_variable then
    update public.recurring_transaction_rules
    set amount = safe_amount
    where id = rule_row.id;
  end if;

  return new_transaction_id;
end;
$$;

alter table public.help_categories enable row level security;
alter table public.help_articles enable row level security;
alter table public.help_article_steps enable row level security;
alter table public.app_content_blocks enable row level security;
alter table public.app_external_links enable row level security;
alter table public.support_conversations enable row level security;
alter table public.support_messages enable row level security;
alter table public.user_notifications enable row level security;
alter table public.recurring_transaction_executions enable row level security;

drop policy if exists "help_categories_select_authenticated" on public.help_categories;
create policy "help_categories_select_authenticated"
on public.help_categories
for select
to authenticated
using (is_active = true);

drop policy if exists "help_articles_select_authenticated" on public.help_articles;
create policy "help_articles_select_authenticated"
on public.help_articles
for select
to authenticated
using (is_active = true);

drop policy if exists "help_article_steps_select_authenticated" on public.help_article_steps;
create policy "help_article_steps_select_authenticated"
on public.help_article_steps
for select
to authenticated
using (
  exists (
    select 1
    from public.help_articles article
    where article.id = help_article_steps.article_id
      and article.is_active = true
  )
);

drop policy if exists "app_content_blocks_select_authenticated" on public.app_content_blocks;
create policy "app_content_blocks_select_authenticated"
on public.app_content_blocks
for select
to authenticated
using (is_active = true);

drop policy if exists "app_external_links_select_authenticated" on public.app_external_links;
create policy "app_external_links_select_authenticated"
on public.app_external_links
for select
to authenticated
using (is_active = true);

drop policy if exists "support_conversations_all_own" on public.support_conversations;
create policy "support_conversations_all_own"
on public.support_conversations
for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "support_messages_select_own_conversation" on public.support_messages;
create policy "support_messages_select_own_conversation"
on public.support_messages
for select
to authenticated
using (
  exists (
    select 1
    from public.support_conversations conversation
    where conversation.id = support_messages.conversation_id
      and conversation.user_id = auth.uid()
  )
);

drop policy if exists "support_messages_insert_own_conversation" on public.support_messages;
create policy "support_messages_insert_own_conversation"
on public.support_messages
for insert
to authenticated
with check (
  exists (
    select 1
    from public.support_conversations conversation
    where conversation.id = support_messages.conversation_id
      and conversation.user_id = auth.uid()
  )
);

drop policy if exists "support_messages_update_own_conversation" on public.support_messages;
create policy "support_messages_update_own_conversation"
on public.support_messages
for update
to authenticated
using (
  exists (
    select 1
    from public.support_conversations conversation
    where conversation.id = support_messages.conversation_id
      and conversation.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.support_conversations conversation
    where conversation.id = support_messages.conversation_id
      and conversation.user_id = auth.uid()
  )
);

drop policy if exists "user_notifications_all_own" on public.user_notifications;
create policy "user_notifications_all_own"
on public.user_notifications
for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "recurring_transaction_executions_all_own" on public.recurring_transaction_executions;
create policy "recurring_transaction_executions_all_own"
on public.recurring_transaction_executions
for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

insert into public.help_categories (code, label, color, icon, display_order)
values
  ('transactions', 'Transações', '#10B981', 'arrow-left-right', 1),
  ('cards', 'Cartões', '#2563EB', 'credit-card', 2),
  ('goals', 'Metas', '#F59E0B', 'target', 3),
  ('groups', 'Grupos', '#8B5CF6', 'message-circle', 4),
  ('budgets', 'Orçamentos', '#EF4444', 'chart-pie', 5),
  ('accounts', 'Contas', '#4F46E5', 'landmark', 6),
  ('voice', 'Voz', '#EC4899', 'mic', 7),
  ('reports', 'Relatórios', '#06B6D4', 'newspaper', 8)
on conflict (code) do update
set label = excluded.label,
    color = excluded.color,
    icon = excluded.icon,
    display_order = excluded.display_order,
    is_active = true;

with category_map as (
  select code, id
  from public.help_categories
),
articles as (
  insert into public.help_articles (category_id, title, level, popular, tip, display_order)
  values
    ((select id from category_map where code = 'transactions'), 'Como registrar uma nova transação?', 'Iniciante', true, 'Preencha a descrição e confirme o valor antes de salvar.', 1),
    ((select id from category_map where code = 'cards'), 'Como lançar uma compra no cartão?', 'Intermediário', true, 'Compras parceladas já alimentam a fatura automaticamente.', 2),
    ((select id from category_map where code = 'groups'), 'Como criar um grupo para dividir despesas?', 'Intermediário', true, 'Use o código de compartilhamento para convidar outras pessoas.', 3)
  on conflict do nothing
  returning id, title
)
insert into public.help_article_steps (article_id, step_order, text)
select article.id, step.step_order, step.text
from articles article
join (
  values
    ('Como registrar uma nova transação?', 1, 'Abra a tela inicial ou a aba de transações.'),
    ('Como registrar uma nova transação?', 2, 'Escolha conta, categoria e método de pagamento.'),
    ('Como registrar uma nova transação?', 3, 'Revise valor e descrição antes de salvar.'),
    ('Como lançar uma compra no cartão?', 1, 'Acesse a tela de cartões e toque em lançar compra.'),
    ('Como lançar uma compra no cartão?', 2, 'Selecione o cartão, a categoria e o número de parcelas.'),
    ('Como lançar uma compra no cartão?', 3, 'Confirme para atualizar a fatura aberta.'),
    ('Como criar um grupo para dividir despesas?', 1, 'Entre em Grupos e toque em criar grupo.'),
    ('Como criar um grupo para dividir despesas?', 2, 'Defina nome e descrição do grupo.'),
    ('Como criar um grupo para dividir despesas?', 3, 'Compartilhe o código com os participantes.')
) as step(title, step_order, text)
  on step.title = article.title
on conflict (article_id, step_order) do update
set text = excluded.text;

insert into public.app_content_blocks (area, key, title, body, metadata, display_order)
values
  ('about', 'hero', 'nitin', 'O nitin é o seu parceiro para organizar finanças, acompanhar metas, dividir despesas e entender sua vida financeira em um só lugar. Entradas e saídas, sempre em equilíbrio.', '{"version":"1.0.0"}'::jsonb, 1),
  ('about', 'rating', 'Sua opinião importa', 'Avalie sua experiência no app e ajude a priorizar as próximas melhorias.', '{}'::jsonb, 2),
  ('about_feature', 'feature_transactions', 'Controle completo de receitas e despesas', '', '{}'::jsonb, 1),
  ('about_feature', 'feature_goals', 'Metas financeiras personalizadas', '', '{}'::jsonb, 2),
  ('about_feature', 'feature_budgets', 'Orçamentos mensais com alertas', '', '{}'::jsonb, 3),
  ('about_feature', 'feature_groups', 'Grupos para dividir despesas', '', '{}'::jsonb, 4),
  ('about_feature', 'feature_reports', 'Relatórios e gráficos detalhados', '', '{}'::jsonb, 5),
  ('about_feature', 'feature_accounts', 'Múltiplas contas e cartões', '', '{}'::jsonb, 6),
  ('about_feature', 'feature_sync', 'Sincronização em tempo real', '', '{}'::jsonb, 7)
on conflict (area, key) do update
set title = excluded.title,
    body = excluded.body,
    metadata = excluded.metadata,
    display_order = excluded.display_order,
    is_active = true;

insert into public.app_external_links (area, key, label, url, icon, display_order)
values
  ('about_social', 'instagram', 'Instagram', 'https://instagram.com', 'instagram', 1),
  ('about_social', 'twitter', 'Twitter', 'https://twitter.com', 'twitter', 2),
  ('about_social', 'github', 'GitHub', 'https://github.com', 'github', 3),
  ('about_legal', 'terms', 'Termos de Uso', 'https://seusite.com/termos', 'external-link', 1),
  ('about_legal', 'privacy', 'Política de Privacidade', 'https://seusite.com/privacidade', 'external-link', 2)
on conflict (area, key) do update
set label = excluded.label,
    url = excluded.url,
    icon = excluded.icon,
    display_order = excluded.display_order,
    is_active = true;

grant execute on function public.confirm_recurring_transaction(uuid, numeric, text, date) to authenticated;
