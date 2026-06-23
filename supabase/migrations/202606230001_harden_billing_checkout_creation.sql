alter table public.billing_checkout_sessions
drop constraint if exists billing_checkout_sessions_status_check;

alter table public.billing_checkout_sessions
add constraint billing_checkout_sessions_status_check
check (status in ('provisioning', 'pending', 'active', 'cancelled', 'expired', 'refunded', 'failed'));

-- Keep the newest legacy pending checkout and close older duplicates before
-- enforcing a single in-flight provider operation per user.
with ranked_pending as (
  select
    id,
    row_number() over (partition by user_id order by created_at desc, id desc) as position
  from public.billing_checkout_sessions
  where status = 'pending'
)
update public.billing_checkout_sessions session
set status = 'failed', updated_at = now()
from ranked_pending ranked
where session.id = ranked.id
  and ranked.position > 1;

create unique index if not exists billing_checkout_sessions_one_inflight_per_user_idx
on public.billing_checkout_sessions (user_id)
where status in ('provisioning', 'pending');

create or replace function private.enforce_billing_checkout_status_transition()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  if (old.status = 'provisioning' and new.status in ('pending', 'failed'))
     or (old.status = 'pending' and new.status in ('active', 'cancelled', 'expired', 'refunded', 'failed'))
     or (old.status = 'active' and new.status in ('cancelled', 'expired', 'refunded')) then
    return new;
  end if;

  raise exception 'Transicao de checkout invalida: % -> %.', old.status, new.status
    using errcode = '42501';
end;
$$;

drop trigger if exists trg_billing_checkout_status_transition on public.billing_checkout_sessions;
create trigger trg_billing_checkout_status_transition
before update of status on public.billing_checkout_sessions
for each row execute function private.enforce_billing_checkout_status_transition();

create or replace function public.reserve_billing_checkout(p_plan_id text)
returns table (
  session_id uuid,
  external_id text,
  checkout_url text,
  should_create boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  current_window timestamptz := date_trunc('hour', now());
  v_existing record;
  v_profile_status text;
  v_session_id uuid := pg_catalog.gen_random_uuid();
  v_external_id text;
  accepted boolean := false;
begin
  if current_user_id is null then
    raise exception 'Usuario nao autenticado.' using errcode = '42501';
  end if;

  if p_plan_id is null or p_plan_id not in ('basic', 'intermediate', 'pro') then
    raise exception 'Plano invalido.';
  end if;

  -- Serialize all plan choices for the user so concurrent requests cannot each
  -- reserve a separate external checkout.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(current_user_id::text, 471109)
  );

  select session.id, session.plan_id, session.external_id, session.checkout_url, session.status
  into v_existing
  from public.billing_checkout_sessions session
  where session.user_id = current_user_id
    and session.status in ('provisioning', 'pending')
  order by session.created_at desc
  limit 1;

  if found then
    if v_existing.status = 'pending'
       and v_existing.plan_id = p_plan_id
       and v_existing.checkout_url is not null then
      session_id := v_existing.id;
      external_id := v_existing.external_id;
      checkout_url := v_existing.checkout_url;
      should_create := false;
      return next;
      return;
    end if;

    if v_existing.status = 'provisioning' then
      raise exception 'Checkout em preparacao. Tente novamente em instantes.' using errcode = '55000';
    end if;

    raise exception 'Checkout pendente ja existe para outro plano.' using errcode = '55000';
  end if;

  select profile.subscription_status
  into v_profile_status
  from public.profiles profile
  where profile.id = current_user_id
  for update;

  if not found then
    raise exception 'Perfil nao encontrado.';
  end if;

  if v_profile_status = 'active' then
    raise exception 'Cancele a assinatura ativa antes de iniciar outro checkout.' using errcode = '55000';
  end if;

  if v_profile_status = 'pending' then
    raise exception 'Checkout pendente sem sessao reutilizavel. Contate o suporte.' using errcode = '55000';
  end if;

  insert into private.security_rate_limits (
    subject_key,
    feature,
    window_started_at,
    request_count,
    unit_count
  )
  values (current_user_id::text, 'billing_checkout', current_window, 1, 1)
  on conflict (subject_key, feature, window_started_at) do update
  set request_count = private.security_rate_limits.request_count + 1,
      unit_count = private.security_rate_limits.unit_count + 1
  where private.security_rate_limits.request_count < 5
  returning true into accepted;

  if not coalesce(accepted, false) then
    raise exception 'Limite de checkouts temporario atingido.' using errcode = 'P0001';
  end if;

  v_external_id := 'sub_' || replace(v_session_id::text, '-', '');

  insert into public.billing_checkout_sessions (
    id,
    user_id,
    plan_id,
    external_id,
    status
  )
  values (
    v_session_id,
    current_user_id,
    p_plan_id,
    v_external_id,
    'provisioning'
  );

  perform set_config('app.trusted_profile_transition', 'on', true);
  update public.profiles
  set subscription_status = 'pending', subscription_updated_at = now()
  where id = current_user_id;

  session_id := v_session_id;
  external_id := v_external_id;
  checkout_url := null;
  should_create := true;
  return next;
end;
$$;

revoke all on function public.reserve_billing_checkout(text) from public, anon;
grant execute on function public.reserve_billing_checkout(text) to authenticated;
