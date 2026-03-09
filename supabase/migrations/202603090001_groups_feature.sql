create extension if not exists pgcrypto;

create or replace function public.set_generic_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  share_code text not null unique,
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint groups_title_not_blank check (char_length(trim(title)) between 1 and 80),
  constraint groups_share_code_format check (share_code ~ '^[A-Z0-9]{6}$')
);

create table if not exists public.group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member',
  joined_at timestamptz not null default now(),
  removed_at timestamptz,
  constraint group_members_role_check check (role in ('admin', 'member')),
  constraint group_members_group_user_unique unique (group_id, user_id)
);

create table if not exists public.group_splits (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade,
  owner_user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text not null default '',
  kind text not null,
  split_mode text not null,
  total_amount numeric(14,2) not null,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint group_splits_title_not_blank check (char_length(trim(title)) between 1 and 120),
  constraint group_splits_kind_check check (kind in ('income', 'expense')),
  constraint group_splits_mode_check check (split_mode in ('equal', 'percentage', 'custom')),
  constraint group_splits_total_positive check (total_amount > 0)
);

create table if not exists public.group_split_shares (
  id uuid primary key default gen_random_uuid(),
  split_id uuid not null references public.group_splits(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  share_amount numeric(14,2) not null,
  share_percentage numeric(7,4),
  created_at timestamptz not null default now(),
  constraint group_split_shares_amount_positive check (share_amount >= 0),
  constraint group_split_shares_split_user_unique unique (split_id, user_id),
  constraint group_split_shares_percentage_range check (
    share_percentage is null or (share_percentage >= 0 and share_percentage <= 100)
  )
);

create table if not exists public.group_settlements (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  from_user_id uuid not null references public.profiles(id) on delete cascade,
  to_user_id uuid not null references public.profiles(id) on delete cascade,
  requested_by_user_id uuid not null references public.profiles(id) on delete cascade,
  confirmed_by_user_id uuid references public.profiles(id) on delete set null,
  amount numeric(14,2) not null,
  payment_method text not null,
  note text not null default '',
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  confirmed_at timestamptz,
  constraint group_settlements_amount_positive check (amount > 0),
  constraint group_settlements_status_check check (status in ('pending', 'confirmed')),
  constraint group_settlements_method_check check (
    payment_method in ('PIX', 'Dinheiro', 'Transferencia')
  ),
  constraint group_settlements_different_users check (from_user_id <> to_user_id)
);

create table if not exists public.personal_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null default 'Conta principal',
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint personal_accounts_name_not_blank check (char_length(trim(name)) between 1 and 80)
);

create table if not exists public.personal_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  account_id uuid not null references public.personal_accounts(id) on delete cascade,
  group_id uuid references public.groups(id) on delete set null,
  settlement_id uuid references public.group_settlements(id) on delete set null,
  type text not null,
  title text not null,
  description text not null default '',
  payment_method text not null default 'Transferencia',
  amount numeric(14,2) not null,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint personal_transactions_type_check check (type in ('income', 'expense')),
  constraint personal_transactions_amount_positive check (amount > 0),
  constraint personal_transactions_title_not_blank check (char_length(trim(title)) between 1 and 120)
);

create index if not exists group_members_group_idx on public.group_members (group_id);
create index if not exists group_members_user_idx on public.group_members (user_id);
create index if not exists group_members_active_idx
on public.group_members (group_id, user_id)
where removed_at is null;

create index if not exists group_splits_group_idx on public.group_splits (group_id, occurred_at desc);
create index if not exists group_split_shares_split_idx on public.group_split_shares (split_id);
create index if not exists group_settlements_group_idx on public.group_settlements (group_id, created_at desc);
create index if not exists group_settlements_status_idx on public.group_settlements (status);
create unique index if not exists personal_accounts_default_unique
on public.personal_accounts (user_id)
where is_default;
create unique index if not exists personal_transactions_settlement_user_unique
on public.personal_transactions (settlement_id, user_id);

drop trigger if exists trg_groups_updated_at on public.groups;
create trigger trg_groups_updated_at
before update on public.groups
for each row
execute function public.set_generic_updated_at();

drop trigger if exists trg_personal_accounts_updated_at on public.personal_accounts;
create trigger trg_personal_accounts_updated_at
before update on public.personal_accounts
for each row
execute function public.set_generic_updated_at();

create or replace function public.generate_group_share_code()
returns text
language plpgsql
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  candidate text;
  idx integer;
  attempts integer := 0;
begin
  loop
    attempts := attempts + 1;
    candidate := '';

    for idx in 1..6 loop
      candidate := candidate || substr(alphabet, 1 + floor(random() * char_length(alphabet))::int, 1);
    end loop;

    exit when not exists (select 1 from public.groups g where g.share_code = candidate);

    if attempts > 25 then
      raise exception 'Nao foi possivel gerar um codigo unico para o grupo.';
    end if;
  end loop;

  return candidate;
end;
$$;

create or replace function public.ensure_default_personal_account(p_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_account_id uuid;
begin
  if p_user_id is null then
    raise exception 'Usuario invalido para conta padrao.';
  end if;

  select pa.id
  into existing_account_id
  from public.personal_accounts pa
  where pa.user_id = p_user_id
    and pa.is_default = true
  limit 1;

  if existing_account_id is not null then
    return existing_account_id;
  end if;

  insert into public.personal_accounts (user_id, name, is_default)
  values (p_user_id, 'Conta principal', true)
  returning id into existing_account_id;

  return existing_account_id;
end;
$$;

create or replace function public.handle_profile_default_personal_account()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.ensure_default_personal_account(new.id);
  return new;
end;
$$;

drop trigger if exists trg_profile_default_personal_account on public.profiles;
create trigger trg_profile_default_personal_account
after insert on public.profiles
for each row
execute function public.handle_profile_default_personal_account();

insert into public.personal_accounts (user_id, name, is_default)
select p.id, 'Conta principal', true
from public.profiles p
where not exists (
  select 1
  from public.personal_accounts pa
  where pa.user_id = p.id
    and pa.is_default = true
);

create or replace function public.is_active_group_member(
  p_group_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.group_members gm
    where gm.group_id = p_group_id
      and gm.user_id = p_user_id
      and gm.removed_at is null
  );
$$;

create or replace function public.is_group_admin(
  p_group_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.group_members gm
    where gm.group_id = p_group_id
      and gm.user_id = p_user_id
      and gm.role = 'admin'
      and gm.removed_at is null
  );
$$;

create or replace function public.group_outstanding_amount(
  p_group_id uuid,
  p_from_user_id uuid,
  p_to_user_id uuid
)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  with split_obligations as (
    select
      gss.user_id as debtor_id,
      gs.owner_user_id as creditor_id,
      gss.share_amount as amount
    from public.group_splits gs
    join public.group_split_shares gss on gss.split_id = gs.id
    where gs.group_id = p_group_id
      and gs.kind = 'expense'
      and gss.user_id <> gs.owner_user_id

    union all

    select
      gs.owner_user_id as debtor_id,
      gss.user_id as creditor_id,
      gss.share_amount as amount
    from public.group_splits gs
    join public.group_split_shares gss on gss.split_id = gs.id
    where gs.group_id = p_group_id
      and gs.kind = 'income'
      and gss.user_id <> gs.owner_user_id
  ),
  confirmed_settlements as (
    select
      gst.from_user_id as debtor_id,
      gst.to_user_id as creditor_id,
      gst.amount as amount
    from public.group_settlements gst
    where gst.group_id = p_group_id
      and gst.status = 'confirmed'
  ),
  forward_totals as (
    select coalesce(sum(amount), 0)::numeric as total
    from (
      select amount
      from split_obligations
      where debtor_id = p_from_user_id
        and creditor_id = p_to_user_id

      union all

      select -amount
      from confirmed_settlements
      where debtor_id = p_from_user_id
        and creditor_id = p_to_user_id
    ) forward_values
  ),
  reverse_totals as (
    select coalesce(sum(amount), 0)::numeric as total
    from (
      select amount
      from split_obligations
      where debtor_id = p_to_user_id
        and creditor_id = p_from_user_id

      union all

      select -amount
      from confirmed_settlements
      where debtor_id = p_to_user_id
        and creditor_id = p_from_user_id
    ) reverse_values
  )
  select round(((select total from forward_totals) - (select total from reverse_totals))::numeric, 2);
$$;

create or replace function public.create_group(
  p_title text,
  p_description text default ''
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  new_group_id uuid;
begin
  if current_user_id is null then
    raise exception 'Usuario nao autenticado.';
  end if;

  if char_length(trim(coalesce(p_title, ''))) = 0 then
    raise exception 'Informe um titulo para o grupo.';
  end if;

  insert into public.groups (title, description, share_code, created_by)
  values (
    trim(p_title),
    trim(coalesce(p_description, '')),
    public.generate_group_share_code(),
    current_user_id
  )
  returning id into new_group_id;

  insert into public.group_members (group_id, user_id, role)
  values (new_group_id, current_user_id, 'admin');

  perform public.ensure_default_personal_account(current_user_id);

  return new_group_id;
end;
$$;

create or replace function public.join_group_by_code(p_share_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  target_group_id uuid;
begin
  if current_user_id is null then
    raise exception 'Usuario nao autenticado.';
  end if;

  select g.id
  into target_group_id
  from public.groups g
  where g.share_code = upper(trim(coalesce(p_share_code, '')))
  limit 1;

  if target_group_id is null then
    raise exception 'Codigo de grupo invalido.';
  end if;

  insert into public.group_members (group_id, user_id, role, removed_at)
  values (target_group_id, current_user_id, 'member', null)
  on conflict (group_id, user_id) do update
  set removed_at = null,
      joined_at = now();

  perform public.ensure_default_personal_account(current_user_id);

  return target_group_id;
end;
$$;

create or replace function public.create_group_split(
  p_group_id uuid,
  p_payload jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  target_group_id uuid := p_group_id;
  payload_title text := trim(coalesce(p_payload ->> 'title', ''));
  payload_description text := trim(coalesce(p_payload ->> 'description', ''));
  payload_kind text := lower(trim(coalesce(p_payload ->> 'kind', '')));
  payload_mode text := lower(trim(coalesce(p_payload ->> 'split_mode', '')));
  payload_total numeric := round(coalesce((p_payload ->> 'total_amount')::numeric, 0), 2);
  payload_owner_user_id uuid := coalesce((p_payload ->> 'owner_user_id')::uuid, current_user_id);
  payload_occurred_at timestamptz := coalesce((p_payload ->> 'occurred_at')::timestamptz, now());
  shares_payload jsonb := coalesce(p_payload -> 'shares', '[]'::jsonb);
  share_item jsonb;
  participant_user_id uuid;
  participant_amount numeric;
  participant_percentage numeric;
  participant_ids uuid[] := array[]::uuid[];
  amount_sum numeric := 0;
  percentage_sum numeric := 0;
  new_split_id uuid;
begin
  if current_user_id is null then
    raise exception 'Usuario nao autenticado.';
  end if;

  if not public.is_active_group_member(target_group_id, current_user_id) then
    raise exception 'Voce nao participa deste grupo.';
  end if;

  if char_length(payload_title) = 0 then
    raise exception 'Informe um titulo para a divisao.';
  end if;

  if payload_kind not in ('income', 'expense') then
    raise exception 'Tipo de divisao invalido.';
  end if;

  if payload_mode not in ('equal', 'percentage', 'custom') then
    raise exception 'Modo de divisao invalido.';
  end if;

  if payload_total <= 0 then
    raise exception 'O valor total deve ser maior que zero.';
  end if;

  if not public.is_active_group_member(target_group_id, payload_owner_user_id) then
    raise exception 'O pagador ou recebedor precisa participar do grupo.';
  end if;

  if jsonb_typeof(shares_payload) <> 'array' or jsonb_array_length(shares_payload) = 0 then
    raise exception 'Selecione ao menos um participante para a divisao.';
  end if;

  for share_item in
    select value
    from jsonb_array_elements(shares_payload)
  loop
    participant_user_id := (share_item ->> 'user_id')::uuid;
    participant_amount := round(coalesce((share_item ->> 'amount')::numeric, 0), 2);
    participant_percentage := nullif(share_item ->> 'percentage', '')::numeric;

    if participant_user_id is null then
      raise exception 'Participante invalido na divisao.';
    end if;

    if participant_user_id = any(participant_ids) then
      raise exception 'Participante duplicado na divisao.';
    end if;

    if not public.is_active_group_member(target_group_id, participant_user_id) then
      raise exception 'Todos os participantes precisam ser membros ativos do grupo.';
    end if;

    if participant_amount < 0 then
      raise exception 'Os valores da divisao nao podem ser negativos.';
    end if;

    participant_ids := array_append(participant_ids, participant_user_id);
    amount_sum := amount_sum + participant_amount;

    if participant_percentage is not null then
      percentage_sum := percentage_sum + participant_percentage;
    end if;
  end loop;

  if abs(round(amount_sum, 2) - payload_total) > 0.009 then
    raise exception 'A soma dos participantes deve ser igual ao valor total.';
  end if;

  if payload_mode = 'percentage' and abs(round(percentage_sum, 2) - 100) > 0.05 then
    raise exception 'As porcentagens devem somar 100.';
  end if;

  insert into public.group_splits (
    group_id,
    created_by,
    owner_user_id,
    title,
    description,
    kind,
    split_mode,
    total_amount,
    occurred_at
  )
  values (
    target_group_id,
    current_user_id,
    payload_owner_user_id,
    payload_title,
    payload_description,
    payload_kind,
    payload_mode,
    payload_total,
    payload_occurred_at
  )
  returning id into new_split_id;

  for share_item in
    select value
    from jsonb_array_elements(shares_payload)
  loop
    insert into public.group_split_shares (split_id, user_id, share_amount, share_percentage)
    values (
      new_split_id,
      (share_item ->> 'user_id')::uuid,
      round(coalesce((share_item ->> 'amount')::numeric, 0), 2),
      nullif(share_item ->> 'percentage', '')::numeric
    );
  end loop;

  return new_split_id;
end;
$$;

create or replace function public.request_group_settlement(
  p_group_id uuid,
  p_to_user_id uuid,
  p_amount numeric,
  p_payment_method text,
  p_note text default ''
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  requested_amount numeric := round(coalesce(p_amount, 0), 2);
  open_amount numeric;
  pending_amount numeric;
  new_settlement_id uuid;
begin
  if current_user_id is null then
    raise exception 'Usuario nao autenticado.';
  end if;

  if p_payment_method not in ('PIX', 'Dinheiro', 'Transferencia') then
    raise exception 'Forma de pagamento invalida.';
  end if;

  if not public.is_active_group_member(p_group_id, current_user_id)
     or not public.is_active_group_member(p_group_id, p_to_user_id) then
    raise exception 'Os usuarios precisam participar do grupo.';
  end if;

  if requested_amount <= 0 then
    raise exception 'O valor do acerto deve ser maior que zero.';
  end if;

  open_amount := public.group_outstanding_amount(p_group_id, current_user_id, p_to_user_id);

  if open_amount <= 0 then
    raise exception 'Nao existe saldo em aberto para este acerto.';
  end if;

  select coalesce(sum(amount), 0)::numeric
  into pending_amount
  from public.group_settlements gst
  where gst.group_id = p_group_id
    and gst.from_user_id = current_user_id
    and gst.to_user_id = p_to_user_id
    and gst.status = 'pending';

  if requested_amount > round(open_amount - pending_amount, 2) then
    raise exception 'O valor solicitado excede o saldo em aberto.';
  end if;

  insert into public.group_settlements (
    group_id,
    from_user_id,
    to_user_id,
    requested_by_user_id,
    amount,
    payment_method,
    note
  )
  values (
    p_group_id,
    current_user_id,
    p_to_user_id,
    current_user_id,
    requested_amount,
    p_payment_method,
    trim(coalesce(p_note, ''))
  )
  returning id into new_settlement_id;

  return new_settlement_id;
end;
$$;

create or replace function public.confirm_group_settlement(p_settlement_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  settlement_row public.group_settlements%rowtype;
  group_title text;
  payer_account_id uuid;
  receiver_account_id uuid;
  open_amount numeric;
begin
  if current_user_id is null then
    raise exception 'Usuario nao autenticado.';
  end if;

  select *
  into settlement_row
  from public.group_settlements gst
  where gst.id = p_settlement_id
  limit 1;

  if settlement_row.id is null then
    raise exception 'Acerto nao encontrado.';
  end if;

  if settlement_row.status <> 'pending' then
    raise exception 'Somente acertos pendentes podem ser confirmados.';
  end if;

  if settlement_row.to_user_id <> current_user_id then
    raise exception 'Somente quem vai receber pode confirmar o acerto.';
  end if;

  open_amount := public.group_outstanding_amount(
    settlement_row.group_id,
    settlement_row.from_user_id,
    settlement_row.to_user_id
  );

  if settlement_row.amount > open_amount + 0.009 then
    raise exception 'Este acerto excede o saldo ainda em aberto.';
  end if;

  update public.group_settlements
  set status = 'confirmed',
      confirmed_by_user_id = current_user_id,
      confirmed_at = now()
  where id = settlement_row.id;

  select g.title
  into group_title
  from public.groups g
  where g.id = settlement_row.group_id;

  payer_account_id := public.ensure_default_personal_account(settlement_row.from_user_id);
  receiver_account_id := public.ensure_default_personal_account(settlement_row.to_user_id);

  insert into public.personal_transactions (
    user_id,
    account_id,
    group_id,
    settlement_id,
    type,
    title,
    description,
    payment_method,
    amount,
    occurred_at
  )
  values (
    settlement_row.from_user_id,
    payer_account_id,
    settlement_row.group_id,
    settlement_row.id,
    'expense',
    'Acerto de grupo: ' || coalesce(group_title, 'Grupo'),
    trim(coalesce(settlement_row.note, '')),
    settlement_row.payment_method,
    settlement_row.amount,
    now()
  )
  on conflict (settlement_id, user_id) do nothing;

  insert into public.personal_transactions (
    user_id,
    account_id,
    group_id,
    settlement_id,
    type,
    title,
    description,
    payment_method,
    amount,
    occurred_at
  )
  values (
    settlement_row.to_user_id,
    receiver_account_id,
    settlement_row.group_id,
    settlement_row.id,
    'income',
    'Acerto de grupo: ' || coalesce(group_title, 'Grupo'),
    trim(coalesce(settlement_row.note, '')),
    settlement_row.payment_method,
    settlement_row.amount,
    now()
  )
  on conflict (settlement_id, user_id) do nothing;

  return settlement_row.group_id;
end;
$$;

create or replace function public.remove_group_member(
  p_group_id uuid,
  p_user_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  target_role text;
begin
  if current_user_id is null then
    raise exception 'Usuario nao autenticado.';
  end if;

  if not public.is_group_admin(p_group_id, current_user_id) then
    raise exception 'Somente administradores podem remover membros.';
  end if;

  select gm.role
  into target_role
  from public.group_members gm
  where gm.group_id = p_group_id
    and gm.user_id = p_user_id
    and gm.removed_at is null
  limit 1;

  if target_role is null then
    raise exception 'Membro nao encontrado.';
  end if;

  if target_role = 'admin' then
    raise exception 'O administrador principal nao pode ser removido.';
  end if;

  if exists (
    select 1
    from public.group_settlements gst
    where gst.group_id = p_group_id
      and gst.status = 'pending'
      and (gst.from_user_id = p_user_id or gst.to_user_id = p_user_id)
  ) then
    raise exception 'Nao e possivel remover um membro com acertos pendentes.';
  end if;

  if exists (
    select 1
    from public.group_members gm
    where gm.group_id = p_group_id
      and gm.user_id <> p_user_id
      and gm.removed_at is null
      and (
        public.group_outstanding_amount(p_group_id, p_user_id, gm.user_id) > 0.009
        or public.group_outstanding_amount(p_group_id, gm.user_id, p_user_id) > 0.009
      )
  ) then
    raise exception 'Nao e possivel remover um membro com saldo em aberto.';
  end if;

  update public.group_members
  set removed_at = now()
  where group_id = p_group_id
    and user_id = p_user_id
    and removed_at is null;

  return true;
end;
$$;

alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.group_splits enable row level security;
alter table public.group_split_shares enable row level security;
alter table public.group_settlements enable row level security;
alter table public.personal_accounts enable row level security;
alter table public.personal_transactions enable row level security;

drop policy if exists "groups_select_members" on public.groups;
create policy "groups_select_members"
on public.groups
for select
to authenticated
using (public.is_active_group_member(id));

drop policy if exists "group_members_select_members" on public.group_members;
create policy "group_members_select_members"
on public.group_members
for select
to authenticated
using (public.is_active_group_member(group_id));

drop policy if exists "group_splits_select_members" on public.group_splits;
create policy "group_splits_select_members"
on public.group_splits
for select
to authenticated
using (public.is_active_group_member(group_id));

drop policy if exists "group_split_shares_select_members" on public.group_split_shares;
create policy "group_split_shares_select_members"
on public.group_split_shares
for select
to authenticated
using (
  exists (
    select 1
    from public.group_splits gs
    where gs.id = group_split_shares.split_id
      and public.is_active_group_member(gs.group_id)
  )
);

drop policy if exists "group_settlements_select_members" on public.group_settlements;
create policy "group_settlements_select_members"
on public.group_settlements
for select
to authenticated
using (public.is_active_group_member(group_id));

drop policy if exists "personal_accounts_select_own" on public.personal_accounts;
create policy "personal_accounts_select_own"
on public.personal_accounts
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "personal_accounts_insert_own" on public.personal_accounts;
create policy "personal_accounts_insert_own"
on public.personal_accounts
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "personal_accounts_update_own" on public.personal_accounts;
create policy "personal_accounts_update_own"
on public.personal_accounts
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "personal_transactions_select_own" on public.personal_transactions;
create policy "personal_transactions_select_own"
on public.personal_transactions
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "personal_transactions_insert_own" on public.personal_transactions;
create policy "personal_transactions_insert_own"
on public.personal_transactions
for insert
to authenticated
with check (auth.uid() = user_id);

grant execute on function public.ensure_default_personal_account(uuid) to authenticated;
grant execute on function public.is_active_group_member(uuid, uuid) to authenticated;
grant execute on function public.is_group_admin(uuid, uuid) to authenticated;
grant execute on function public.group_outstanding_amount(uuid, uuid, uuid) to authenticated;
grant execute on function public.create_group(text, text) to authenticated;
grant execute on function public.join_group_by_code(text) to authenticated;
grant execute on function public.create_group_split(uuid, jsonb) to authenticated;
grant execute on function public.request_group_settlement(uuid, uuid, numeric, text, text) to authenticated;
grant execute on function public.confirm_group_settlement(uuid) to authenticated;
grant execute on function public.remove_group_member(uuid, uuid) to authenticated;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles
for select
to authenticated
using (
  auth.uid() = id
  or exists (
    select 1
    from public.group_members viewer_membership
    join public.group_members target_membership
      on target_membership.group_id = viewer_membership.group_id
    where viewer_membership.user_id = auth.uid()
      and viewer_membership.removed_at is null
      and target_membership.user_id = profiles.id
      and target_membership.removed_at is null
  )
);
