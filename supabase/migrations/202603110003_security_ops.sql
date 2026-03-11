create table if not exists public.user_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  hide_values_home boolean not null default false,
  biometric_enabled boolean not null default false,
  login_alerts_enabled boolean not null default true,
  share_anonymous_stats boolean not null default true,
  two_factor_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.auth_login_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  event_type text not null default 'sign_in',
  device_label text not null default '',
  platform text not null default '',
  ip_address text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint auth_login_events_event_type_check check (
    event_type in ('sign_in', 'sign_out', 'mfa_enabled', 'mfa_disabled', 'password_reset')
  )
);

create table if not exists public.data_export_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending',
  storage_path text,
  requested_at timestamptz not null default now(),
  completed_at timestamptz,
  error_message text not null default '',
  constraint data_export_requests_status_check check (status in ('pending', 'processing', 'completed', 'failed'))
);

create table if not exists public.account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending',
  reason text not null default '',
  requested_at timestamptz not null default now(),
  completed_at timestamptz,
  error_message text not null default '',
  constraint account_deletion_requests_status_check check (status in ('pending', 'processing', 'completed', 'failed'))
);

create index if not exists auth_login_events_user_created_idx
on public.auth_login_events (user_id, created_at desc);
create index if not exists data_export_requests_user_requested_idx
on public.data_export_requests (user_id, requested_at desc);
create index if not exists account_deletion_requests_user_requested_idx
on public.account_deletion_requests (user_id, requested_at desc);

create or replace function public.ensure_user_preferences(p_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_preferences (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  return p_user_id;
end;
$$;

create or replace function public.handle_profile_user_preferences()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.ensure_user_preferences(new.id);
  return new;
end;
$$;

drop trigger if exists trg_profile_user_preferences on public.profiles;
create trigger trg_profile_user_preferences
after insert on public.profiles
for each row
execute function public.handle_profile_user_preferences();

insert into public.user_preferences (user_id)
select p.id
from public.profiles p
where not exists (
  select 1
  from public.user_preferences up
  where up.user_id = p.id
);

drop trigger if exists trg_user_preferences_updated_at on public.user_preferences;
create trigger trg_user_preferences_updated_at
before update on public.user_preferences
for each row
execute function public.set_generic_updated_at();

alter table public.user_preferences enable row level security;
alter table public.auth_login_events enable row level security;
alter table public.data_export_requests enable row level security;
alter table public.account_deletion_requests enable row level security;

drop policy if exists "user_preferences_all_own" on public.user_preferences;
create policy "user_preferences_all_own"
on public.user_preferences
for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "auth_login_events_all_own" on public.auth_login_events;
create policy "auth_login_events_all_own"
on public.auth_login_events
for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "data_export_requests_all_own" on public.data_export_requests;
create policy "data_export_requests_all_own"
on public.data_export_requests
for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "account_deletion_requests_all_own" on public.account_deletion_requests;
create policy "account_deletion_requests_all_own"
on public.account_deletion_requests
for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

insert into storage.buckets (id, name, public)
values ('user-data-exports', 'user-data-exports', false)
on conflict (id) do nothing;

drop policy if exists "user_data_exports_select_own" on storage.objects;
create policy "user_data_exports_select_own"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'user-data-exports'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "user_data_exports_insert_own" on storage.objects;
create policy "user_data_exports_insert_own"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'user-data-exports'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "user_data_exports_delete_own" on storage.objects;
create policy "user_data_exports_delete_own"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'user-data-exports'
  and auth.uid()::text = (storage.foldername(name))[1]
);

grant execute on function public.ensure_user_preferences(uuid) to authenticated;
