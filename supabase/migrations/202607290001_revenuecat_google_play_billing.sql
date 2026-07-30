alter table public.profiles
add column if not exists subscription_provider text,
add column if not exists subscription_product_id text,
add column if not exists subscription_transaction_id text,
add column if not exists subscription_expires_at timestamptz,
add column if not exists subscription_auto_renews boolean,
add column if not exists subscription_environment text,
add column if not exists subscription_event_at timestamptz;

alter table public.profiles
drop constraint if exists profiles_subscription_status_check;

alter table public.profiles
add constraint profiles_subscription_status_check
check (
  subscription_status in (
    'inactive',
    'pending',
    'active',
    'cancelled',
    'expired',
    'refunded',
    'grace_period',
    'paused'
  )
);

alter table public.profiles
drop constraint if exists profiles_subscription_provider_check;

alter table public.profiles
add constraint profiles_subscription_provider_check
check (subscription_provider is null or subscription_provider in ('abacatepay', 'google_play'));

create table if not exists public.billing_provider_events (
  id text primary key,
  provider text not null,
  event_name text not null,
  user_id uuid references public.profiles(id) on delete set null,
  product_id text,
  environment text,
  event_at timestamptz not null,
  payload jsonb not null default '{}'::jsonb,
  processed_at timestamptz not null default now(),
  constraint billing_provider_events_provider_check
    check (provider in ('abacatepay', 'revenuecat'))
);

create index if not exists billing_provider_events_user_idx
on public.billing_provider_events (user_id, event_at desc);

alter table public.billing_provider_events enable row level security;
revoke all on table public.billing_provider_events from public, anon, authenticated;

create or replace function private.effective_plan(p_user_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p.subscription_status in ('active', 'cancelled', 'grace_period')
      and (p.subscription_expires_at is null or p.subscription_expires_at > now())
      and p.subscription_plan = 'pro' then 'pro'
    when p.subscription_status in ('active', 'cancelled', 'grace_period')
      and (p.subscription_expires_at is null or p.subscription_expires_at > now())
      and p.subscription_plan = 'intermediate' then 'intermediate'
    when p.trial_ends_at > now() then 'intermediate'
    when p.subscription_status in ('active', 'cancelled', 'grace_period')
      and (p.subscription_expires_at is null or p.subscription_expires_at > now())
      and p.subscription_plan = 'basic' then 'basic'
    else 'free'
  end
  from public.profiles p
  where p.id = p_user_id;
$$;

create or replace function private.protect_profile_security_fields()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.subscription_plan := 'free';
    new.subscription_status := 'inactive';
    new.abacatepay_customer_id := null;
    new.abacatepay_subscription_id := null;
    new.subscription_provider := null;
    new.subscription_product_id := null;
    new.subscription_transaction_id := null;
    new.subscription_expires_at := null;
    new.subscription_auto_renews := null;
    new.subscription_environment := null;
    new.subscription_event_at := null;
    new.subscription_activated_at := null;
    new.subscription_updated_at := null;
    new.trial_started_at := null;
    new.trial_ends_at := null;
    return new;
  end if;

  if (select auth.uid()) is not null
     and coalesce(current_setting('app.trusted_profile_transition', true), '') <> 'on'
     and (
       new.subscription_plan is distinct from old.subscription_plan
       or new.subscription_status is distinct from old.subscription_status
       or new.abacatepay_customer_id is distinct from old.abacatepay_customer_id
       or new.abacatepay_subscription_id is distinct from old.abacatepay_subscription_id
       or new.subscription_provider is distinct from old.subscription_provider
       or new.subscription_product_id is distinct from old.subscription_product_id
       or new.subscription_transaction_id is distinct from old.subscription_transaction_id
       or new.subscription_expires_at is distinct from old.subscription_expires_at
       or new.subscription_auto_renews is distinct from old.subscription_auto_renews
       or new.subscription_environment is distinct from old.subscription_environment
       or new.subscription_event_at is distinct from old.subscription_event_at
       or new.subscription_activated_at is distinct from old.subscription_activated_at
       or new.subscription_updated_at is distinct from old.subscription_updated_at
       or new.trial_started_at is distinct from old.trial_started_at
       or new.trial_ends_at is distinct from old.trial_ends_at
     ) then
    raise exception 'Campos de assinatura e trial sao gerenciados pelo servidor.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

create or replace function public.apply_revenuecat_subscription_event(
  p_event_id text,
  p_event_name text,
  p_user_id uuid,
  p_plan_id text,
  p_status text,
  p_product_id text,
  p_transaction_id text,
  p_expires_at timestamptz,
  p_auto_renews boolean,
  p_environment text,
  p_event_at timestamptz,
  p_payload jsonb
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_inserted integer;
begin
  if p_event_id is null or length(p_event_id) < 8 or length(p_event_id) > 255 then
    raise exception 'Identificador de evento invalido.';
  end if;

  if p_plan_id not in ('free', 'basic', 'intermediate', 'pro') then
    raise exception 'Plano de assinatura invalido.';
  end if;

  if p_status not in (
    'inactive',
    'active',
    'cancelled',
    'expired',
    'refunded',
    'grace_period',
    'paused'
  ) then
    raise exception 'Status de assinatura invalido.';
  end if;

  insert into public.billing_provider_events (
    id,
    provider,
    event_name,
    user_id,
    product_id,
    environment,
    event_at,
    payload
  )
  values (
    p_event_id,
    'revenuecat',
    p_event_name,
    p_user_id,
    p_product_id,
    p_environment,
    p_event_at,
    coalesce(p_payload, '{}'::jsonb)
  )
  on conflict (id) do nothing;

  get diagnostics event_inserted = row_count;
  if event_inserted = 0 then
    return false;
  end if;

  update public.profiles
  set subscription_plan = p_plan_id,
      subscription_status = p_status,
      subscription_provider = case when p_plan_id = 'free' then null else 'google_play' end,
      subscription_product_id = p_product_id,
      subscription_transaction_id = p_transaction_id,
      subscription_expires_at = p_expires_at,
      subscription_auto_renews = p_auto_renews,
      subscription_environment = p_environment,
      subscription_event_at = p_event_at,
      subscription_activated_at = case
        when p_plan_id <> 'free' then coalesce(subscription_activated_at, p_event_at)
        else null
      end,
      subscription_updated_at = now()
  where id = p_user_id
    and (
      subscription_event_at is null
      or subscription_event_at <= p_event_at
    );

  if not found then
    if not exists (select 1 from public.profiles where id = p_user_id) then
      raise exception 'Perfil da assinatura nao encontrado.';
    end if;
  end if;

  return true;
end;
$$;

revoke all on function public.apply_revenuecat_subscription_event(
  text,
  text,
  uuid,
  text,
  text,
  text,
  text,
  timestamptz,
  boolean,
  text,
  timestamptz,
  jsonb
) from public, anon, authenticated;

grant execute on function public.apply_revenuecat_subscription_event(
  text,
  text,
  uuid,
  text,
  text,
  text,
  text,
  timestamptz,
  boolean,
  text,
  timestamptz,
  jsonb
) to service_role;

create or replace function public.select_free_plan()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile record;
begin
  if (select auth.uid()) is null then
    raise exception 'Usuario nao autenticado.';
  end if;

  select subscription_status, subscription_expires_at
  into v_profile
  from public.profiles
  where id = (select auth.uid())
  for update;

  if not found then
    raise exception 'Perfil nao encontrado.';
  end if;

  if v_profile.subscription_status in ('active', 'cancelled', 'grace_period')
     and (
       v_profile.subscription_expires_at is null
       or v_profile.subscription_expires_at > now()
     ) then
    raise exception 'Cancele a assinatura ativa na loja antes de mudar para o plano Free.';
  end if;

  perform set_config('app.trusted_profile_transition', 'on', true);
  update public.profiles
  set subscription_plan = 'free',
      subscription_status = 'inactive',
      subscription_provider = null,
      subscription_product_id = null,
      subscription_transaction_id = null,
      subscription_expires_at = null,
      subscription_auto_renews = null,
      subscription_environment = null
  where id = (select auth.uid());
end;
$$;
