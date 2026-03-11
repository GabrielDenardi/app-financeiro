create extension if not exists pgcrypto;

create table if not exists public.financial_categories (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  label text not null,
  kind text not null default 'expense',
  color text not null default '#64748B',
  icon text not null default 'wallet',
  is_system boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'financial_categories_kind_check'
  ) then
    alter table public.financial_categories
    add constraint financial_categories_kind_check
    check (kind in ('income', 'expense', 'both'));
  end if;
end;
$$;

insert into public.financial_categories (code, label, kind, color, icon, display_order)
values
  ('salary', 'Salario', 'income', '#16A34A', 'wallet', 10),
  ('freelance', 'Freelance', 'income', '#0F766E', 'briefcase', 20),
  ('investments', 'Investimentos', 'income', '#2563EB', 'line-chart', 30),
  ('gifts', 'Presentes', 'income', '#D97706', 'gift', 40),
  ('food', 'Alimentacao', 'expense', '#F97316', 'utensils', 50),
  ('housing', 'Moradia', 'expense', '#1D4ED8', 'home', 60),
  ('transport', 'Transporte', 'expense', '#0EA5E9', 'car', 70),
  ('health', 'Saude', 'expense', '#DC2626', 'heart-pulse', 80),
  ('education', 'Educacao', 'expense', '#7C3AED', 'graduation-cap', 90),
  ('leisure', 'Lazer', 'expense', '#DB2777', 'party-popper', 100),
  ('shopping', 'Compras', 'expense', '#F59E0B', 'shopping-bag', 110),
  ('services', 'Servicos', 'expense', '#475569', 'settings', 120),
  ('taxes', 'Impostos', 'expense', '#991B1B', 'receipt', 130),
  ('other', 'Outros', 'both', '#64748B', 'circle', 140)
on conflict (code) do update
set
  label = excluded.label,
  kind = excluded.kind,
  color = excluded.color,
  icon = excluded.icon,
  display_order = excluded.display_order;

alter table public.personal_accounts
add column if not exists type text not null default 'checking',
add column if not exists institution text not null default '',
add column if not exists color text not null default '#2563EB',
add column if not exists opening_balance numeric(14,2) not null default 0,
add column if not exists is_active boolean not null default true,
add column if not exists display_order integer not null default 0,
add column if not exists archived_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'personal_accounts_type_check'
  ) then
    alter table public.personal_accounts
    add constraint personal_accounts_type_check
    check (type in ('checking', 'savings', 'investment', 'cash', 'other'));
  end if;
end;
$$;

create table if not exists public.account_transfers (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references public.profiles(id) on delete cascade,
  from_account_id uuid not null references public.personal_accounts(id) on delete cascade,
  to_account_id uuid not null references public.personal_accounts(id) on delete cascade,
  amount numeric(14,2) not null,
  note text not null default '',
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint account_transfers_amount_positive check (amount > 0),
  constraint account_transfers_accounts_different check (from_account_id <> to_account_id)
);

create table if not exists public.recurring_transaction_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  account_id uuid not null references public.personal_accounts(id) on delete cascade,
  category_id uuid references public.financial_categories(id) on delete set null,
  type text not null,
  title text not null,
  notes text not null default '',
  payment_method text not null default 'Transferencia',
  amount numeric(14,2) not null,
  cadence text not null default 'monthly',
  day_of_month integer not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint recurring_transaction_rules_type_check check (type in ('income', 'expense')),
  constraint recurring_transaction_rules_amount_positive check (amount > 0),
  constraint recurring_transaction_rules_cadence_check check (cadence in ('monthly')),
  constraint recurring_transaction_rules_day_of_month_check check (day_of_month between 1 and 31)
);

create table if not exists public.financial_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  target_amount numeric(14,2) not null,
  initial_amount numeric(14,2) not null default 0,
  current_amount numeric(14,2) not null default 0,
  color text not null default '#2563EB',
  icon text not null default 'target',
  target_date date,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint financial_goals_title_not_blank check (char_length(trim(title)) between 1 and 120),
  constraint financial_goals_target_positive check (target_amount > 0),
  constraint financial_goals_initial_non_negative check (initial_amount >= 0),
  constraint financial_goals_current_non_negative check (current_amount >= 0),
  constraint financial_goals_status_check check (status in ('active', 'completed', 'archived'))
);

create table if not exists public.goal_contributions (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.financial_goals(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  account_id uuid not null references public.personal_accounts(id) on delete cascade,
  amount numeric(14,2) not null,
  note text not null default '',
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint goal_contributions_amount_positive check (amount > 0)
);

create table if not exists public.budget_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  category_id uuid not null references public.financial_categories(id) on delete cascade,
  month_date date not null,
  limit_amount numeric(14,2) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint budget_plans_limit_positive check (limit_amount > 0),
  constraint budget_plans_month_is_first_day check (extract(day from month_date) = 1),
  constraint budget_plans_user_category_month_unique unique (user_id, category_id, month_date)
);

create table if not exists public.import_batches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  file_name text not null,
  file_type text not null,
  row_count integer not null default 0,
  imported_count integer not null default 0,
  duplicate_count integer not null default 0,
  failed_count integer not null default 0,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  finalized_at timestamptz,
  constraint import_batches_status_check check (status in ('draft', 'processing', 'completed', 'failed'))
);

create table if not exists public.import_batch_rows (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.import_batches(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  row_index integer not null,
  fingerprint text not null,
  raw_data jsonb not null default '{}'::jsonb,
  normalized_title text,
  normalized_amount numeric(14,2),
  normalized_type text,
  normalized_category_code text,
  normalized_payment_method text,
  occurred_on date,
  status text not null default 'pending',
  error_message text not null default '',
  created_at timestamptz not null default now(),
  constraint import_batch_rows_status_check check (status in ('pending', 'accepted', 'duplicate', 'failed')),
  constraint import_batch_rows_type_check check (
    normalized_type is null or normalized_type in ('income', 'expense')
  ),
  constraint import_batch_rows_batch_row_unique unique (batch_id, row_index),
  constraint import_batch_rows_batch_fingerprint_unique unique (batch_id, fingerprint)
);

alter table public.personal_transactions
add column if not exists category_id uuid references public.financial_categories(id) on delete set null,
add column if not exists source_type text not null default 'manual',
add column if not exists transfer_id uuid references public.account_transfers(id) on delete set null,
add column if not exists recurring_rule_id uuid references public.recurring_transaction_rules(id) on delete set null,
add column if not exists import_batch_id uuid references public.import_batches(id) on delete set null,
add column if not exists group_split_id uuid references public.group_splits(id) on delete set null,
add column if not exists notes text not null default '',
add column if not exists include_in_reports boolean not null default true,
add column if not exists occurred_on date;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'personal_transactions_source_type_check'
  ) then
    alter table public.personal_transactions
    add constraint personal_transactions_source_type_check
    check (
      source_type in (
        'manual',
        'transfer',
        'group_split',
        'group_settlement',
        'goal_contribution',
        'imported',
        'card_payment'
      )
    );
  end if;
end;
$$;

update public.personal_transactions
set
  occurred_on = coalesce(occurred_on, occurred_at::date),
  notes = case when notes = '' then coalesce(description, '') else notes end,
  source_type = case
    when settlement_id is not null then 'group_settlement'
    else source_type
  end,
  include_in_reports = case
    when settlement_id is not null then false
    else include_in_reports
  end;

create index if not exists financial_categories_kind_idx on public.financial_categories (kind, display_order);
create index if not exists personal_accounts_user_active_idx
on public.personal_accounts (user_id, is_active, display_order, created_at);
create index if not exists account_transfers_created_by_idx
on public.account_transfers (created_by, occurred_at desc);
create index if not exists recurring_transaction_rules_user_idx
on public.recurring_transaction_rules (user_id, is_active);
create index if not exists financial_goals_user_status_idx
on public.financial_goals (user_id, status, created_at desc);
create index if not exists goal_contributions_goal_idx
on public.goal_contributions (goal_id, occurred_at desc);
create index if not exists budget_plans_user_month_idx
on public.budget_plans (user_id, month_date);
create index if not exists import_batches_user_idx
on public.import_batches (user_id, created_at desc);
create index if not exists import_batch_rows_batch_status_idx
on public.import_batch_rows (batch_id, status);
create index if not exists personal_transactions_user_occurred_on_idx
on public.personal_transactions (user_id, occurred_on desc, created_at desc);
create index if not exists personal_transactions_category_idx
on public.personal_transactions (user_id, category_id, occurred_on desc);
create unique index if not exists personal_transactions_group_split_user_unique
on public.personal_transactions (group_split_id, user_id)
where group_split_id is not null;

create or replace function public.make_month_date(p_input_date date)
returns date
language sql
immutable
as $$
  select make_date(extract(year from p_input_date)::int, extract(month from p_input_date)::int, 1);
$$;

create or replace function public.assert_owned_personal_account(
  p_user_id uuid,
  p_account_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.personal_accounts pa
    where pa.id = p_account_id
      and pa.user_id = p_user_id
      and pa.is_active = true
  ) then
    raise exception 'Conta invalida para o usuario informado.';
  end if;

  return p_account_id;
end;
$$;

create or replace function public.normalize_personal_transaction()
returns trigger
language plpgsql
as $$
begin
  new.title := trim(coalesce(new.title, ''));
  new.description := trim(coalesce(new.description, ''));
  new.notes := trim(coalesce(new.notes, new.description, ''));
  new.occurred_on := coalesce(new.occurred_on, new.occurred_at::date);

  if new.settlement_id is not null and coalesce(new.source_type, 'manual') = 'manual' then
    new.source_type := 'group_settlement';
  end if;

  if new.transfer_id is not null then
    new.source_type := 'transfer';
  end if;

  if new.source_type in ('transfer', 'goal_contribution', 'card_payment', 'group_settlement') then
    new.include_in_reports := false;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_personal_transactions_normalize on public.personal_transactions;
create trigger trg_personal_transactions_normalize
before insert or update on public.personal_transactions
for each row
execute function public.normalize_personal_transaction();

create or replace function public.create_group_split_personal_transaction()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  default_account_id uuid;
begin
  default_account_id := public.ensure_default_personal_account(new.owner_user_id);

  insert into public.personal_transactions (
    user_id,
    account_id,
    group_id,
    group_split_id,
    type,
    title,
    description,
    payment_method,
    amount,
    occurred_at,
    occurred_on,
    source_type,
    include_in_reports
  )
  values (
    new.owner_user_id,
    default_account_id,
    new.group_id,
    new.id,
    new.kind,
    'Divisao de grupo: ' || new.title,
    trim(coalesce(new.description, '')),
    'Transferencia',
    new.total_amount,
    new.occurred_at,
    new.occurred_at::date,
    'group_split',
    true
  )
  on conflict (group_split_id, user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists trg_group_splits_personal_transaction on public.group_splits;
create trigger trg_group_splits_personal_transaction
after insert on public.group_splits
for each row
execute function public.create_group_split_personal_transaction();

create or replace function public.create_account_transfer(
  p_from_account_id uuid,
  p_to_account_id uuid,
  p_amount numeric,
  p_note text default '',
  p_occurred_at timestamptz default now()
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  new_transfer_id uuid;
  safe_amount numeric := round(coalesce(p_amount, 0), 2);
begin
  if current_user_id is null then
    raise exception 'Usuario nao autenticado.';
  end if;

  perform public.assert_owned_personal_account(current_user_id, p_from_account_id);
  perform public.assert_owned_personal_account(current_user_id, p_to_account_id);

  if safe_amount <= 0 then
    raise exception 'O valor da transferencia deve ser maior que zero.';
  end if;

  insert into public.account_transfers (
    created_by,
    from_account_id,
    to_account_id,
    amount,
    note,
    occurred_at
  )
  values (
    current_user_id,
    p_from_account_id,
    p_to_account_id,
    safe_amount,
    trim(coalesce(p_note, '')),
    p_occurred_at
  )
  returning id into new_transfer_id;

  insert into public.personal_transactions (
    user_id,
    account_id,
    type,
    title,
    description,
    payment_method,
    amount,
    occurred_at,
    occurred_on,
    transfer_id,
    source_type,
    include_in_reports
  )
  values
    (
      current_user_id,
      p_from_account_id,
      'expense',
      'Transferencia entre contas',
      trim(coalesce(p_note, '')),
      'Transferencia',
      safe_amount,
      p_occurred_at,
      p_occurred_at::date,
      new_transfer_id,
      'transfer',
      false
    ),
    (
      current_user_id,
      p_to_account_id,
      'income',
      'Transferencia entre contas',
      trim(coalesce(p_note, '')),
      'Transferencia',
      safe_amount,
      p_occurred_at,
      p_occurred_at::date,
      new_transfer_id,
      'transfer',
      false
    );

  return new_transfer_id;
end;
$$;

create or replace function public.add_goal_contribution(
  p_goal_id uuid,
  p_account_id uuid,
  p_amount numeric,
  p_note text default '',
  p_occurred_at timestamptz default now()
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  goal_row public.financial_goals%rowtype;
  new_contribution_id uuid;
  safe_amount numeric := round(coalesce(p_amount, 0), 2);
begin
  if current_user_id is null then
    raise exception 'Usuario nao autenticado.';
  end if;

  if safe_amount <= 0 then
    raise exception 'O aporte deve ser maior que zero.';
  end if;

  perform public.assert_owned_personal_account(current_user_id, p_account_id);

  select *
  into goal_row
  from public.financial_goals fg
  where fg.id = p_goal_id
    and fg.user_id = current_user_id;

  if goal_row.id is null then
    raise exception 'Meta nao encontrada.';
  end if;

  insert into public.goal_contributions (
    goal_id,
    user_id,
    account_id,
    amount,
    note,
    occurred_at
  )
  values (
    p_goal_id,
    current_user_id,
    p_account_id,
    safe_amount,
    trim(coalesce(p_note, '')),
    p_occurred_at
  )
  returning id into new_contribution_id;

  update public.financial_goals
  set
    current_amount = current_amount + safe_amount,
    status = case
      when current_amount + safe_amount >= target_amount then 'completed'
      else status
    end,
    updated_at = now()
  where id = p_goal_id;

  insert into public.personal_transactions (
    user_id,
    account_id,
    type,
    title,
    description,
    payment_method,
    amount,
    occurred_at,
    occurred_on,
    source_type,
    include_in_reports,
    notes
  )
  values (
    current_user_id,
    p_account_id,
    'expense',
    'Aporte para meta: ' || goal_row.title,
    trim(coalesce(p_note, '')),
    'Transferencia',
    safe_amount,
    p_occurred_at,
    p_occurred_at::date,
    'goal_contribution',
    false,
    trim(coalesce(p_note, ''))
  );

  return new_contribution_id;
end;
$$;

create or replace function public.finalize_import_batch(p_batch_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  batch_row public.import_batches%rowtype;
  imported_rows integer := 0;
  duplicate_rows integer := 0;
  failed_rows integer := 0;
begin
  if current_user_id is null then
    raise exception 'Usuario nao autenticado.';
  end if;

  select *
  into batch_row
  from public.import_batches ib
  where ib.id = p_batch_id
    and ib.user_id = current_user_id;

  if batch_row.id is null then
    raise exception 'Lote de importacao nao encontrado.';
  end if;

  insert into public.personal_transactions (
    user_id,
    account_id,
    type,
    title,
    payment_method,
    amount,
    occurred_at,
    occurred_on,
    category_id,
    import_batch_id,
    source_type,
    include_in_reports,
    notes
  )
  select
    current_user_id,
    public.ensure_default_personal_account(current_user_id),
    ibr.normalized_type,
    coalesce(nullif(trim(ibr.normalized_title), ''), 'Importacao'),
    coalesce(nullif(trim(ibr.normalized_payment_method), ''), 'Transferencia'),
    ibr.normalized_amount,
    coalesce(ibr.occurred_on::timestamptz, now()),
    ibr.occurred_on,
    fc.id,
    batch_row.id,
    'imported',
    true,
    'Importado via arquivo'
  from public.import_batch_rows ibr
  left join public.financial_categories fc on fc.code = ibr.normalized_category_code
  where ibr.batch_id = batch_row.id
    and ibr.user_id = current_user_id
    and ibr.status = 'accepted';

  get diagnostics imported_rows = row_count;

  select count(*) into duplicate_rows
  from public.import_batch_rows
  where batch_id = batch_row.id
    and user_id = current_user_id
    and status = 'duplicate';

  select count(*) into failed_rows
  from public.import_batch_rows
  where batch_id = batch_row.id
    and user_id = current_user_id
    and status = 'failed';

  update public.import_batches
  set
    status = 'completed',
    row_count = (
      select count(*)
      from public.import_batch_rows
      where batch_id = batch_row.id
    ),
    imported_count = imported_rows,
    duplicate_count = duplicate_rows,
    failed_count = failed_rows,
    finalized_at = now()
  where id = batch_row.id;

  return batch_row.id;
end;
$$;

create or replace view public.v_account_current_balance as
select
  pa.id as account_id,
  pa.user_id,
  pa.name,
  pa.type,
  pa.institution,
  pa.color,
  pa.is_active,
  pa.display_order,
  pa.opening_balance,
  round(
    pa.opening_balance +
    coalesce(sum(
      case
        when pt.type = 'income' then pt.amount
        else -pt.amount
      end
    ), 0),
    2
  ) as current_balance
from public.personal_accounts pa
left join public.personal_transactions pt
  on pt.account_id = pa.id
 and pt.user_id = pa.user_id
group by
  pa.id,
  pa.user_id,
  pa.name,
  pa.type,
  pa.institution,
  pa.color,
  pa.is_active,
  pa.display_order,
  pa.opening_balance;

create or replace view public.v_goal_progress as
select
  fg.id as goal_id,
  fg.user_id,
  fg.title,
  fg.target_amount,
  fg.initial_amount,
  fg.current_amount,
  fg.color,
  fg.icon,
  fg.target_date,
  fg.status,
  coalesce(sum(gc.amount), 0)::numeric(14,2) as contributed_amount,
  round(case when fg.target_amount > 0 then (fg.current_amount / fg.target_amount) * 100 else 0 end, 2) as progress_percent
from public.financial_goals fg
left join public.goal_contributions gc on gc.goal_id = fg.id
group by
  fg.id,
  fg.user_id,
  fg.title,
  fg.target_amount,
  fg.initial_amount,
  fg.current_amount,
  fg.color,
  fg.icon,
  fg.target_date,
  fg.status;

create or replace view public.v_budget_progress as
select
  bp.id as budget_id,
  bp.user_id,
  bp.category_id,
  fc.code as category_code,
  fc.label as category_label,
  fc.color as category_color,
  bp.month_date,
  bp.limit_amount,
  round(
    coalesce(sum(
      case
        when pt.type = 'expense'
         and pt.include_in_reports = true
         and public.make_month_date(pt.occurred_on) = bp.month_date
        then pt.amount
        else 0
      end
    ), 0),
    2
  ) as spent_amount
from public.budget_plans bp
join public.financial_categories fc on fc.id = bp.category_id
left join public.personal_transactions pt
  on pt.user_id = bp.user_id
 and pt.category_id = bp.category_id
group by
  bp.id,
  bp.user_id,
  bp.category_id,
  fc.code,
  fc.label,
  fc.color,
  bp.month_date,
  bp.limit_amount;

alter table public.financial_categories enable row level security;
alter table public.account_transfers enable row level security;
alter table public.recurring_transaction_rules enable row level security;
alter table public.financial_goals enable row level security;
alter table public.goal_contributions enable row level security;
alter table public.budget_plans enable row level security;
alter table public.import_batches enable row level security;
alter table public.import_batch_rows enable row level security;

drop policy if exists "financial_categories_select_all" on public.financial_categories;
create policy "financial_categories_select_all"
on public.financial_categories
for select
to authenticated
using (true);

drop policy if exists "account_transfers_select_own" on public.account_transfers;
create policy "account_transfers_select_own"
on public.account_transfers
for select
to authenticated
using (
  exists (
    select 1
    from public.personal_accounts from_account
    where from_account.id = account_transfers.from_account_id
      and from_account.user_id = auth.uid()
  )
);

drop policy if exists "recurring_transaction_rules_all_own" on public.recurring_transaction_rules;
create policy "recurring_transaction_rules_all_own"
on public.recurring_transaction_rules
for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "financial_goals_all_own" on public.financial_goals;
create policy "financial_goals_all_own"
on public.financial_goals
for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "goal_contributions_all_own" on public.goal_contributions;
create policy "goal_contributions_all_own"
on public.goal_contributions
for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "budget_plans_all_own" on public.budget_plans;
create policy "budget_plans_all_own"
on public.budget_plans
for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "import_batches_all_own" on public.import_batches;
create policy "import_batches_all_own"
on public.import_batches
for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "import_batch_rows_all_own" on public.import_batch_rows;
create policy "import_batch_rows_all_own"
on public.import_batch_rows
for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "personal_transactions_update_own" on public.personal_transactions;
create policy "personal_transactions_update_own"
on public.personal_transactions
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "personal_transactions_delete_own" on public.personal_transactions;
create policy "personal_transactions_delete_own"
on public.personal_transactions
for delete
to authenticated
using (auth.uid() = user_id);

grant execute on function public.make_month_date(date) to authenticated;
grant execute on function public.assert_owned_personal_account(uuid, uuid) to authenticated;
grant execute on function public.create_account_transfer(uuid, uuid, numeric, text, timestamptz) to authenticated;
grant execute on function public.add_goal_contribution(uuid, uuid, numeric, text, timestamptz) to authenticated;
grant execute on function public.finalize_import_batch(uuid) to authenticated;
