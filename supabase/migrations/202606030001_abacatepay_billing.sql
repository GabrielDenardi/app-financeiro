alter table public.profiles
add column if not exists subscription_status text not null default 'inactive',
add column if not exists abacatepay_customer_id text,
add column if not exists abacatepay_subscription_id text,
add column if not exists subscription_activated_at timestamptz,
add column if not exists subscription_updated_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_subscription_status_check'
  ) then
    alter table public.profiles
    add constraint profiles_subscription_status_check
    check (subscription_status in ('inactive', 'pending', 'active', 'cancelled', 'expired', 'refunded'));
  end if;
end;
$$;

create table if not exists public.billing_checkout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  plan_id text not null,
  external_id text not null unique,
  abacatepay_customer_id text,
  abacatepay_checkout_id text,
  abacatepay_subscription_id text,
  checkout_url text,
  status text not null default 'pending',
  raw_response jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint billing_checkout_sessions_plan_check check (plan_id in ('basic', 'intermediate', 'pro')),
  constraint billing_checkout_sessions_status_check check (status in ('pending', 'active', 'cancelled', 'expired', 'refunded', 'failed'))
);

create index if not exists billing_checkout_sessions_user_idx
on public.billing_checkout_sessions (user_id, created_at desc);

create index if not exists billing_checkout_sessions_external_idx
on public.billing_checkout_sessions (external_id);

create table if not exists public.billing_webhook_events (
  id text primary key,
  event_name text not null,
  payload jsonb not null default '{}'::jsonb,
  processed_at timestamptz not null default now()
);

alter table public.billing_checkout_sessions enable row level security;
alter table public.billing_webhook_events enable row level security;

drop policy if exists "billing_checkout_sessions_select_own" on public.billing_checkout_sessions;
create policy "billing_checkout_sessions_select_own"
on public.billing_checkout_sessions
for select
to authenticated
using (user_id = auth.uid());
