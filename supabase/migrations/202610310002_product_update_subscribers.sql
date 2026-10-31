create table public.product_update_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (
    length(email) <= 254
    and email = lower(email)
    and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
  ),
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'unsubscribed')),
  consent_at timestamptz not null default now(),
  consent_source text not null check (consent_source ~ '^[a-z0-9-]{1,40}$'),
  consent_version text not null check (consent_version ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'),
  confirm_token_hash text unique check (confirm_token_hash ~ '^[0-9a-f]{64}$'),
  confirm_expires_at timestamptz,
  confirmed_at timestamptz,
  unsubscribe_token text not null unique check (unsubscribe_token ~ '^[0-9a-f]{64}$'),
  unsubscribed_at timestamptz,
  created_at timestamptz not null default now(),
  check ((status = 'pending') = (confirm_token_hash is not null and confirm_expires_at is not null)),
  check (status <> 'confirmed' or confirmed_at is not null),
  check ((status = 'unsubscribed') = (unsubscribed_at is not null))
);
create index product_update_subscribers_list_idx on public.product_update_subscribers(status, created_at desc);
create index product_update_subscribers_pending_idx on public.product_update_subscribers(confirm_expires_at)
  where status = 'pending';
create index product_update_subscribers_unsubscribed_idx on public.product_update_subscribers(unsubscribed_at)
  where status = 'unsubscribed';

create table public.product_update_email_sends (
  id uuid primary key default gen_random_uuid(),
  update_id uuid not null unique references public.product_updates(id) on delete cascade,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table public.product_update_email_deliveries (
  send_id uuid not null references public.product_update_email_sends(id) on delete cascade,
  subscriber_id uuid not null references public.product_update_subscribers(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'sending', 'sent', 'failed', 'skipped')),
  provider_id text check (length(provider_id) <= 200),
  error_code text check (length(error_code) <= 100),
  attempted_at timestamptz,
  primary key (send_id, subscriber_id)
);
create index product_update_email_deliveries_subscriber_idx on public.product_update_email_deliveries(subscriber_id);
create index product_update_email_deliveries_status_idx on public.product_update_email_deliveries(send_id, status);

create view public.product_update_email_send_summaries with (security_invoker = true) as
select
  send.id as send_id,
  send.update_id,
  send.created_at,
  send.completed_at,
  count(delivery.subscriber_id)::integer as total,
  (count(*) filter (where delivery.status = 'sent'))::integer as sent,
  (count(*) filter (where delivery.status = 'failed'))::integer as failed,
  (count(*) filter (where delivery.status = 'skipped'))::integer as skipped,
  (count(*) filter (where delivery.status in ('pending', 'sending')))::integer as remaining
from public.product_update_email_sends send
left join public.product_update_email_deliveries delivery on delivery.send_id = send.id
group by send.id;

alter table public.product_update_subscribers enable row level security;
alter table public.product_update_email_sends enable row level security;
alter table public.product_update_email_deliveries enable row level security;
revoke all on public.product_update_subscribers, public.product_update_email_sends,
  public.product_update_email_deliveries, public.product_update_email_send_summaries
  from public, anon, authenticated;
grant select (id, email, status, consent_at, consent_source, consent_version, confirmed_at, unsubscribed_at, created_at)
  on public.product_update_subscribers to authenticated;
grant select on public.product_update_email_sends, public.product_update_email_deliveries,
  public.product_update_email_send_summaries to authenticated;

create policy product_update_subscribers_read on public.product_update_subscribers for select to authenticated
  using (public.is_site_editor());
create policy product_update_email_sends_read on public.product_update_email_sends for select to authenticated
  using (public.is_site_editor());
create policy product_update_email_deliveries_read on public.product_update_email_deliveries for select to authenticated
  using (public.is_site_editor());

create function private.new_product_update_token() returns text
language sql volatile set search_path = '' as $$
  select replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
$$;
revoke all on function private.new_product_update_token() from public, anon, authenticated;

create function private.product_update_token_hash(p_token text) returns text
language sql immutable set search_path = '' as $$
  select encode(sha256(convert_to(p_token, 'UTF8')), 'hex');
$$;
revoke all on function private.product_update_token_hash(text) from public, anon, authenticated;

create function private.purge_product_update_subscribers() returns void
language sql security definer set search_path = '' as $$
  delete from public.product_update_subscribers
  where (status = 'pending' and confirm_expires_at < now())
    or (status = 'unsubscribed' and unsubscribed_at < now() - interval '180 days');
$$;
revoke all on function private.purge_product_update_subscribers() from public, anon, authenticated;

create function public.consume_product_update_limit(p_feature text, p_subject text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  request_limit integer;
  window_seconds integer;
  current_window timestamptz;
  accepted boolean := false;
begin
  case p_feature
    when 'news_subscribe_email' then
      request_limit := 3;
      window_seconds := 86400;
    when 'news_subscribe' then
      request_limit := 100;
      window_seconds := 3600;
    when 'news_confirm' then
      request_limit := 300;
      window_seconds := 900;
    when 'news_unsubscribe' then
      request_limit := 600;
      window_seconds := 900;
    else
      raise exception 'Limite desconhecido.';
  end case;

  if length(coalesce(p_subject, '')) < 16 or length(p_subject) > 160 then
    raise exception 'Chave de limite invalida.';
  end if;

  current_window := to_timestamp(floor(extract(epoch from now()) / window_seconds) * window_seconds);

  insert into private.security_rate_limits (subject_key, feature, window_started_at, request_count, unit_count)
  values (p_subject, p_feature, current_window, 1, 1)
  on conflict (subject_key, feature, window_started_at) do update
  set request_count = private.security_rate_limits.request_count + 1,
      unit_count = private.security_rate_limits.unit_count + 1
  where private.security_rate_limits.request_count < request_limit
  returning true into accepted;

  if coalesce(accepted, false) then
    perform private.prune_rate_limit(p_subject, p_feature, current_window);
  end if;

  return coalesce(accepted, false);
end;
$$;
revoke all on function public.consume_product_update_limit(text, text) from public, anon, authenticated;
grant execute on function public.consume_product_update_limit(text, text) to service_role;

create function public.subscribe_to_product_updates(p_email text, p_source text, p_consent_version text)
returns table(outcome text, confirm_token text, unsubscribe_token text)
language plpgsql security definer set search_path = '' as $$
declare
  normalized_email text := lower(trim(p_email));
  new_confirm_token text := private.new_product_update_token();
  stored_unsubscribe_token text;
begin
  perform private.purge_product_update_subscribers();

  insert into public.product_update_subscribers as subscriber (
    email, consent_source, consent_version, confirm_token_hash, confirm_expires_at, unsubscribe_token
  )
  values (
    normalized_email,
    p_source,
    p_consent_version,
    private.product_update_token_hash(new_confirm_token),
    now() + interval '48 hours',
    private.new_product_update_token()
  )
  on conflict (email) do update
  set status = 'pending',
      consent_at = now(),
      consent_source = excluded.consent_source,
      consent_version = excluded.consent_version,
      confirm_token_hash = excluded.confirm_token_hash,
      confirm_expires_at = excluded.confirm_expires_at,
      confirmed_at = null,
      unsubscribed_at = null
  where subscriber.status <> 'confirmed'
  returning subscriber.unsubscribe_token into stored_unsubscribe_token;

  if stored_unsubscribe_token is not null then
    return query select 'confirm'::text, new_confirm_token, stored_unsubscribe_token;
    return;
  end if;

  return query
  select 'already_confirmed'::text, null::text, subscriber.unsubscribe_token
  from public.product_update_subscribers subscriber
  where subscriber.email = normalized_email;
end;
$$;
revoke all on function public.subscribe_to_product_updates(text, text, text) from public, anon, authenticated;
grant execute on function public.subscribe_to_product_updates(text, text, text) to service_role;

create function public.confirm_product_update_subscription(p_token text) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  update public.product_update_subscribers
  set status = 'confirmed',
      confirmed_at = now(),
      confirm_token_hash = null,
      confirm_expires_at = null
  where status = 'pending'
    and confirm_expires_at > now()
    and confirm_token_hash = private.product_update_token_hash(p_token);
  return found;
end;
$$;
revoke all on function public.confirm_product_update_subscription(text) from public, anon, authenticated;
grant execute on function public.confirm_product_update_subscription(text) to service_role;

create function public.unsubscribe_from_product_updates(p_token text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  current_status text;
begin
  select status into current_status
  from public.product_update_subscribers
  where unsubscribe_token = p_token
  for update;

  if current_status is null then
    return false;
  end if;

  if current_status = 'pending' then
    delete from public.product_update_subscribers where unsubscribe_token = p_token;
  elsif current_status = 'confirmed' then
    update public.product_update_subscribers
    set status = 'unsubscribed', unsubscribed_at = now()
    where unsubscribe_token = p_token;
  end if;

  return true;
end;
$$;
revoke all on function public.unsubscribe_from_product_updates(text) from public, anon, authenticated;
grant execute on function public.unsubscribe_from_product_updates(text) to service_role;

create function public.start_product_update_send(p_update_id uuid, p_editor uuid)
returns table(send_id uuid, slug text, title text, summary text)
language plpgsql security definer set search_path = '' as $$
declare
  post public.product_updates%rowtype;
  current_send_id uuid;
begin
  select * into post from public.product_updates update_row
  where update_row.id = p_update_id and update_row.published_at is not null;

  if post.id is null then
    raise exception 'Publicação indisponível.' using errcode = 'P0002';
  end if;

  perform private.purge_product_update_subscribers();

  insert into public.product_update_email_sends as send (update_id, created_by)
  values (p_update_id, p_editor)
  on conflict (update_id) do nothing
  returning send.id into current_send_id;

  if current_send_id is null then
    select send.id into current_send_id
    from public.product_update_email_sends send
    where send.update_id = p_update_id;
  else
    insert into public.product_update_email_deliveries (send_id, subscriber_id)
    select current_send_id, subscriber.id
    from public.product_update_subscribers subscriber
    where subscriber.status = 'confirmed';
  end if;

  return query select current_send_id, post.slug, post.title, post.summary;
end;
$$;
revoke all on function public.start_product_update_send(uuid, uuid) from public, anon, authenticated;
grant execute on function public.start_product_update_send(uuid, uuid) to service_role;

create function public.claim_product_update_deliveries(p_send_id uuid, p_limit integer default 25)
returns table(subscriber_id uuid, email text, unsubscribe_token text)
language plpgsql security definer set search_path = '' as $$
begin
  update public.product_update_email_deliveries delivery
  set status = 'pending', attempted_at = null
  where delivery.send_id = p_send_id
    and delivery.status = 'sending'
    and delivery.attempted_at < now() - interval '15 minutes';

  update public.product_update_email_deliveries delivery
  set status = 'skipped'
  from public.product_update_subscribers subscriber
  where delivery.subscriber_id = subscriber.id
    and delivery.send_id = p_send_id
    and delivery.status = 'pending'
    and subscriber.status <> 'confirmed';

  return query
  with next_deliveries as (
    select delivery.subscriber_id as id
    from public.product_update_email_deliveries delivery
    where delivery.send_id = p_send_id and delivery.status = 'pending'
    order by delivery.subscriber_id
    limit greatest(1, least(coalesce(p_limit, 25), 100))
    for update skip locked
  ), claimed as (
    update public.product_update_email_deliveries delivery
    set status = 'sending', attempted_at = now()
    from next_deliveries
    where delivery.send_id = p_send_id and delivery.subscriber_id = next_deliveries.id
    returning delivery.subscriber_id as id
  )
  select subscriber.id, subscriber.email, subscriber.unsubscribe_token
  from claimed
  join public.product_update_subscribers subscriber on subscriber.id = claimed.id;
end;
$$;
revoke all on function public.claim_product_update_deliveries(uuid, integer) from public, anon, authenticated;
grant execute on function public.claim_product_update_deliveries(uuid, integer) to service_role;

create function public.finish_product_update_deliveries(p_send_id uuid, p_results jsonb)
returns setof public.product_update_email_send_summaries
language plpgsql security definer set search_path = '' as $$
begin
  update public.product_update_email_deliveries delivery
  set status = result.status,
      provider_id = result.provider_id,
      error_code = result.error_code,
      attempted_at = case when result.status = 'pending' then null else delivery.attempted_at end
  from jsonb_to_recordset(coalesce(p_results, '[]'::jsonb))
    as result(subscriber_id uuid, status text, provider_id text, error_code text)
  where delivery.send_id = p_send_id
    and delivery.subscriber_id = result.subscriber_id
    and delivery.status = 'sending'
    and result.status in ('sent', 'failed', 'pending');

  update public.product_update_email_sends send
  set completed_at = now()
  where send.id = p_send_id
    and send.completed_at is null
    and not exists (
      select 1 from public.product_update_email_deliveries delivery
      where delivery.send_id = p_send_id and delivery.status in ('pending', 'sending')
    );

  return query
  select * from public.product_update_email_send_summaries summary
  where summary.send_id = p_send_id;
end;
$$;
revoke all on function public.finish_product_update_deliveries(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.finish_product_update_deliveries(uuid, jsonb) to service_role;
