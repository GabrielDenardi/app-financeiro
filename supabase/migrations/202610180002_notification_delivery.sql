create table public.notification_devices (
  token text primary key check (token ~ '^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$'),
  user_id uuid not null references public.profiles(id) on delete cascade,
  session_id uuid not null references auth.sessions(id) on delete cascade,
  platform text not null check (platform in ('android','ios')),
  updated_at timestamptz not null default now()
);
alter table public.notification_devices enable row level security;
revoke all on public.notification_devices from anon, authenticated;

create function public.register_notification_device(p_token text, p_platform text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Autenticação necessária'; end if;
  insert into public.notification_devices(token, user_id, session_id, platform)
    values(p_token, auth.uid(), (auth.jwt() ->> 'session_id')::uuid, p_platform)
    on conflict(token) do update set user_id = excluded.user_id, session_id = excluded.session_id,
      platform = excluded.platform, updated_at = now();
end;
$$;
revoke all on function public.register_notification_device(text,text) from public, anon;
grant execute on function public.register_notification_device(text,text) to authenticated;

create function public.unregister_notification_devices() returns void
language sql security definer set search_path = public as $$
  delete from public.notification_devices where user_id = auth.uid();
$$;
revoke all on function public.unregister_notification_devices() from public, anon;
grant execute on function public.unregister_notification_devices() to authenticated;

create table public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.user_notifications(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  token text not null references public.notification_devices(token) on delete cascade,
  status text not null default 'pending' check (status in ('pending','processing','accepted','delivered','failed','unknown','skipped')),
  ticket_id text,
  error_code text,
  attempted_at timestamptz,
  completed_at timestamptz,
  unique (notification_id, token)
);
alter table public.notification_deliveries enable row level security;
revoke all on public.notification_deliveries from anon, authenticated;
grant all on public.notification_devices, public.notification_deliveries to service_role;
grant select on public.notification_preferences to service_role;
create index notification_delivery_pending on public.notification_deliveries(status, attempted_at);

create function public.enqueue_notification_push() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists(select 1 from public.notification_preferences where user_id = new.user_id and push_enabled) then
    insert into public.notification_deliveries(notification_id, user_id, token)
    select new.id, new.user_id, token from public.notification_devices where user_id = new.user_id
    on conflict do nothing;
  end if;
  return new;
end;
$$;
revoke all on function public.enqueue_notification_push() from public, anon, authenticated;
create trigger notification_enqueue after insert on public.user_notifications
for each row execute function public.enqueue_notification_push();

-- Atomic claims prevent two workers from sending the same delivery.
create function public.claim_notification_deliveries() returns setof public.notification_deliveries
language plpgsql security definer set search_path = public as $$
begin
  -- A crashed worker has an unknown outcome; do not blindly resend and duplicate it.
  update public.notification_deliveries set status = 'unknown', error_code = 'worker_interrupted'
    where status = 'processing' and attempted_at < now() - interval '10 minutes';
  update public.notification_deliveries d set status = 'skipped', completed_at = now()
    where d.status = 'pending' and (
      exists(select 1 from public.user_notifications n where n.id = d.notification_id and
        (n.read_at is not null or n.created_at < now() - interval '7 days'))
      or not exists(select 1 from public.notification_devices device where device.token = d.token and device.user_id = d.user_id)
      or exists(select 1 from public.notification_preferences p where p.user_id = d.user_id and not p.push_enabled)
    );
  return query
    update public.notification_deliveries d set status = 'processing', attempted_at = now()
    where d.id in (
      select q.id from public.notification_deliveries q
      join public.notification_preferences p on p.user_id = q.user_id
      join public.user_notifications n on n.id = q.notification_id
      join public.notification_devices device on device.token = q.token and device.user_id = q.user_id
      where q.status = 'pending' and p.push_enabled and n.read_at is null
        and (n.source_type = 'security' or p.quiet_start = p.quiet_end or
          case when p.quiet_start < p.quiet_end then
            extract(hour from now() at time zone p.timezone) not between p.quiet_start and p.quiet_end - 1
          else extract(hour from now() at time zone p.timezone) >= p.quiet_end
            and extract(hour from now() at time zone p.timezone) < p.quiet_start end)
      order by n.created_at limit 100 for update of q skip locked
    ) returning d.*;
end;
$$;
revoke all on function public.claim_notification_deliveries() from public, anon, authenticated;
grant execute on function public.claim_notification_deliveries() to service_role;

-- A scheduled worker can generate date-dependent alerts even while the app is closed.
create table public.notification_generation_state (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  refreshed_at timestamptz not null default now()
);
alter table public.notification_generation_state enable row level security;
revoke all on public.notification_generation_state from anon, authenticated;
create index notification_generation_refreshed on public.notification_generation_state(refreshed_at);

create function public.refresh_all_user_notifications() returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid; previous_claims text := current_setting('request.jwt.claims', true);
  previous_sub text := current_setting('request.jwt.claim.sub', true);
begin
  -- Bounded round-robin batches keep a growing user base within worker timeouts.
  for uid in select p.id from public.profiles p
    left join public.notification_generation_state s on s.user_id = p.id
    order by s.refreshed_at nulls first, p.id limit 100 for update of p skip locked loop
    perform set_config('request.jwt.claims', jsonb_build_object('sub', uid, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', uid::text, true);
    perform public.refresh_user_notifications();
    insert into public.notification_generation_state(user_id) values(uid)
      on conflict(user_id) do update set refreshed_at = now();
  end loop;
  perform set_config('request.jwt.claims', coalesce(previous_claims, '{}'), true);
  perform set_config('request.jwt.claim.sub', coalesce(previous_sub, ''), true);
end;
$$;
revoke all on function public.refresh_all_user_notifications() from public, anon, authenticated;
grant execute on function public.refresh_all_user_notifications() to service_role;

create function public.validate_notification_timezone() returns trigger
language plpgsql set search_path = public as $$
begin
  if not exists(select 1 from pg_timezone_names where name = new.timezone) then raise exception 'Fuso horário inválido'; end if;
  return new;
end;
$$;
create trigger notification_timezone before insert or update on public.notification_preferences
for each row execute function public.validate_notification_timezone();
