create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.security_rate_limits (
  subject_key text not null,
  feature text not null,
  window_started_at timestamptz not null,
  request_count integer not null default 0,
  unit_count bigint not null default 0,
  primary key (subject_key, feature, window_started_at)
);

revoke all on table private.security_rate_limits from public, anon, authenticated;

create or replace function private.effective_plan(p_user_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p.subscription_status = 'active' and p.subscription_plan = 'pro' then 'pro'
    when p.subscription_status = 'active' and p.subscription_plan = 'intermediate' then 'intermediate'
    when p.trial_ends_at > now() then 'intermediate'
    when p.subscription_status = 'active' and p.subscription_plan = 'basic' then 'basic'
    else 'free'
  end
  from public.profiles p
  where p.id = p_user_id;
$$;

create or replace function private.has_entitlement(p_user_id uuid, p_feature text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case p_feature
    when 'create_groups' then coalesce(private.effective_plan(p_user_id), 'free') in ('intermediate', 'pro')
    when 'voice_capture' then coalesce(private.effective_plan(p_user_id), 'free') in ('intermediate', 'pro')
    when 'support_chat' then coalesce(private.effective_plan(p_user_id), 'free') = 'pro'
    when 'data_import_export' then coalesce(private.effective_plan(p_user_id), 'free') = 'pro'
    else false
  end;
$$;

create or replace function private.account_limit(p_user_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select case coalesce(private.effective_plan(p_user_id), 'free')
    when 'pro' then 4
    when 'intermediate' then 2
    else 1
  end;
$$;

create or replace function public.user_has_entitlement(p_feature text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and private.has_entitlement((select auth.uid()), p_feature);
$$;

create or replace function public.assert_entitlement(p_feature text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Usuario nao autenticado.';
  end if;

  if not public.is_session_aal2_if_required() then
    raise exception 'Verificacao em duas etapas obrigatoria.' using errcode = '42501';
  end if;

  if not private.has_entitlement((select auth.uid()), p_feature) then
    raise exception 'Recurso indisponivel no plano atual.' using errcode = '42501';
  end if;

  return true;
end;
$$;

revoke all on function public.user_has_entitlement(text) from public, anon;
revoke all on function public.assert_entitlement(text) from public, anon;
grant execute on function public.user_has_entitlement(text) to authenticated;
grant execute on function public.assert_entitlement(text) to authenticated;

create or replace function public.consume_edge_quota(p_feature text, p_units bigint default 1)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  request_limit integer;
  unit_limit bigint;
  current_window timestamptz := date_trunc('hour', now());
  accepted boolean := false;
begin
  if current_user_id is null then
    raise exception 'Usuario nao autenticado.';
  end if;

  case p_feature
    when 'ocr' then
      request_limit := 30;
      unit_limit := 240 * 1024 * 1024;
    when 'voice' then
      request_limit := 20;
      unit_limit := 200 * 1024 * 1024;
    else
      raise exception 'Quota desconhecida.';
  end case;

  if p_units < 1 or p_units > 15 * 1024 * 1024 then
    raise exception 'Unidade de quota invalida.';
  end if;

  insert into private.security_rate_limits (
    subject_key,
    feature,
    window_started_at,
    request_count,
    unit_count
  )
  values (current_user_id::text, p_feature, current_window, 1, p_units)
  on conflict (subject_key, feature, window_started_at) do update
  set request_count = private.security_rate_limits.request_count + 1,
      unit_count = private.security_rate_limits.unit_count + excluded.unit_count
  where private.security_rate_limits.request_count < request_limit
    and private.security_rate_limits.unit_count + excluded.unit_count <= unit_limit
  returning true into accepted;

  if not coalesce(accepted, false) then
    raise exception 'Limite de uso temporario atingido.' using errcode = 'P0001';
  end if;

  return true;
end;
$$;

revoke all on function public.consume_edge_quota(text, bigint) from public, anon;
grant execute on function public.consume_edge_quota(text, bigint) to authenticated;

create or replace function public.consume_auth_rate_limit(p_key text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_window timestamptz := to_timestamp(floor(extract(epoch from now()) / 900) * 900);
  accepted boolean := false;
begin
  if length(coalesce(p_key, '')) < 16 or length(p_key) > 160 then
    raise exception 'Chave de limite invalida.';
  end if;

  insert into private.security_rate_limits (
    subject_key,
    feature,
    window_started_at,
    request_count,
    unit_count
  )
  values (p_key, 'cpf_auth', current_window, 1, 1)
  on conflict (subject_key, feature, window_started_at) do update
  set request_count = private.security_rate_limits.request_count + 1,
      unit_count = private.security_rate_limits.unit_count + 1
  where private.security_rate_limits.request_count < 5
  returning true into accepted;

  return coalesce(accepted, false);
end;
$$;

revoke all on function public.consume_auth_rate_limit(text) from public, anon, authenticated;
grant execute on function public.consume_auth_rate_limit(text) to service_role;

-- Enforce MFA at the database boundary whenever a verified factor exists.
create or replace function public.is_session_aal2_if_required()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when (select auth.uid()) is null then false
    when exists (
      select 1
      from auth.mfa_factors factor
      where factor.user_id = (select auth.uid())
        and factor.status::text = 'verified'
    ) then coalesce((select auth.jwt()) ->> 'aal', 'aal1') = 'aal2'
    else true
  end;
$$;

revoke all on function public.is_session_aal2_if_required() from public, anon;
grant execute on function public.is_session_aal2_if_required() to authenticated;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'profiles', 'personal_accounts', 'personal_transactions', 'credit_cards',
    'credit_card_charges', 'credit_card_installments', 'financial_goals',
    'goal_contributions', 'budget_plans', 'import_batches', 'import_batch_rows',
    'transaction_attachments', 'support_conversations', 'support_messages',
    'user_preferences', 'auth_login_events', 'data_export_requests',
    'account_deletion_requests', 'groups', 'group_members', 'group_splits',
    'group_split_shares', 'group_settlements', 'account_transfers',
    'recurring_transaction_rules', 'recurring_transaction_executions'
  ]
  loop
    if to_regclass(format('public.%I', table_name)) is not null then
      execute format('drop policy if exists mfa_aal_restriction on public.%I', table_name);
      execute format(
        'create policy mfa_aal_restriction on public.%I as restrictive for all to authenticated using (public.is_session_aal2_if_required()) with check (public.is_session_aal2_if_required())',
        table_name
      );
    end if;
  end loop;
end;
$$;

-- Billing/trial columns are provider-controlled. Authenticated profile updates cannot mutate them.
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
       or new.subscription_activated_at is distinct from old.subscription_activated_at
       or new.subscription_updated_at is distinct from old.subscription_updated_at
       or new.trial_started_at is distinct from old.trial_started_at
       or new.trial_ends_at is distinct from old.trial_ends_at
     ) then
    raise exception 'Campos de assinatura e trial sao gerenciados pelo servidor.' using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_profiles_protect_security_fields on public.profiles;
create trigger trg_profiles_protect_security_fields
before insert or update on public.profiles
for each row execute function private.protect_profile_security_fields();

create or replace function public.select_free_plan()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
begin
  if (select auth.uid()) is null then
    raise exception 'Usuario nao autenticado.';
  end if;

  select subscription_status into v_status
  from public.profiles
  where id = (select auth.uid())
  for update;

  if not found then
    raise exception 'Perfil nao encontrado.';
  end if;

  if v_status = 'active' then
    raise exception 'Cancele a assinatura ativa antes de mudar para o plano Free.';
  end if;

  perform set_config('app.trusted_profile_transition', 'on', true);
  update public.profiles
  set subscription_plan = 'free', subscription_status = 'inactive'
  where id = (select auth.uid());
end;
$$;

create or replace function public.start_intermediate_trial()
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile record;
  v_ends_at timestamptz;
begin
  if (select auth.uid()) is null then
    raise exception 'Usuario nao autenticado.';
  end if;

  select subscription_plan, subscription_status, trial_started_at
  into v_profile
  from public.profiles
  where id = (select auth.uid())
  for update;

  if not found then raise exception 'Perfil nao encontrado.'; end if;
  if v_profile.trial_started_at is not null then raise exception 'Periodo de teste ja utilizado.'; end if;
  if v_profile.subscription_status = 'active' and v_profile.subscription_plan in ('intermediate', 'pro') then
    raise exception 'Seu plano atual ja inclui esses recursos.';
  end if;

  v_ends_at := now() + interval '7 days';
  perform set_config('app.trusted_profile_transition', 'on', true);
  update public.profiles
  set trial_started_at = now(), trial_ends_at = v_ends_at
  where id = (select auth.uid());
  return v_ends_at;
end;
$$;

revoke all on function public.select_free_plan() from public, anon;
revoke all on function public.start_intermediate_trial() from public, anon;
grant execute on function public.select_free_plan() to authenticated;
grant execute on function public.start_intermediate_trial() to authenticated;

-- Profiles are self-readable only. Group UIs use a minimal, authorized projection.
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles for select to authenticated
using ((select auth.uid()) = id);

create or replace function public.get_group_member_profiles(p_user_ids uuid[])
returns table (id uuid, full_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.full_name
  from public.profiles p
  where p.id = any(coalesce(p_user_ids, array[]::uuid[]))
    and exists (
      select 1
      from public.group_members viewer
      join public.group_members target on target.group_id = viewer.group_id
      where viewer.user_id = (select auth.uid())
        and viewer.removed_at is null
        and target.user_id = p.id
        and target.removed_at is null
    );
$$;

revoke all on function public.get_group_member_profiles(uuid[]) from public, anon;
grant execute on function public.get_group_member_profiles(uuid[]) to authenticated;

-- CPF lookup is no longer a public enumeration API; the trusted Edge Function owns this flow.
revoke all on function public.lookup_account_by_cpf(text) from public, anon, authenticated;
grant execute on function public.lookup_account_by_cpf(text) to service_role;

-- Internal definer helpers must not be callable as public probes.
revoke all on function public.ensure_default_personal_account(uuid) from public, anon, authenticated;
revoke all on function public.assert_owned_personal_account(uuid, uuid) from public, anon, authenticated;
revoke all on function public.group_outstanding_amount(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.is_active_group_member(uuid, uuid) from public, anon, authenticated;
revoke all on function public.is_group_admin(uuid, uuid) from public, anon, authenticated;

drop function public.is_active_group_member(uuid, uuid) cascade;
drop function public.is_group_admin(uuid, uuid);

create or replace function public.is_active_group_member(p_group_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.group_members gm
    where gm.group_id = p_group_id
      and gm.user_id = p_user_id
      and gm.removed_at is null
  );
$$;

create or replace function public.is_group_admin(p_group_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.group_members gm
    where gm.group_id = p_group_id
      and gm.user_id = p_user_id
      and gm.role = 'admin'
      and gm.removed_at is null
  );
$$;

revoke all on function public.is_active_group_member(uuid, uuid) from public, anon, authenticated;
revoke all on function public.is_group_admin(uuid, uuid) from public, anon, authenticated;

create or replace function public.is_active_group_member(p_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.group_members gm
    where gm.group_id = p_group_id
      and gm.user_id = (select auth.uid())
      and gm.removed_at is null
  );
$$;

create or replace function public.is_group_admin(p_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.group_members gm
    where gm.group_id = p_group_id
      and gm.user_id = (select auth.uid())
      and gm.role = 'admin'
      and gm.removed_at is null
  );
$$;

revoke all on function public.is_active_group_member(uuid) from public, anon;
revoke all on function public.is_group_admin(uuid) from public, anon;
grant execute on function public.is_active_group_member(uuid) to authenticated;
grant execute on function public.is_group_admin(uuid) to authenticated;

-- Rebind pre-existing policies to the caller-bound one-argument helper.
drop policy if exists "groups_select_members" on public.groups;
create policy "groups_select_members" on public.groups
for select to authenticated using (public.is_active_group_member(id));

drop policy if exists "group_members_select_members" on public.group_members;
create policy "group_members_select_members" on public.group_members
for select to authenticated using (public.is_active_group_member(group_id));

drop policy if exists "group_splits_select_members" on public.group_splits;
create policy "group_splits_select_members" on public.group_splits
for select to authenticated using (public.is_active_group_member(group_id));

drop policy if exists "group_split_shares_select_members" on public.group_split_shares;
create policy "group_split_shares_select_members" on public.group_split_shares
for select to authenticated using (
  exists (
    select 1 from public.group_splits split
    where split.id = group_split_shares.split_id
      and public.is_active_group_member(split.group_id)
  )
);

drop policy if exists "group_settlements_select_members" on public.group_settlements;
create policy "group_settlements_select_members" on public.group_settlements
for select to authenticated using (public.is_active_group_member(group_id));

drop policy if exists "transaction_attachments_select_allowed" on public.transaction_attachments;
create policy "transaction_attachments_select_allowed" on public.transaction_attachments
for select to authenticated using (
  user_id = (select auth.uid())
  or (group_id is not null and public.is_active_group_member(group_id))
);

drop policy if exists "transaction_receipts_select_allowed" on storage.objects;
create policy "transaction_receipts_select_allowed" on storage.objects
for select to authenticated using (
  bucket_id = 'transaction-receipts'
  and public.is_session_aal2_if_required()
  and (
    (select auth.uid())::text = (storage.foldername(name))[1]
    or exists (
      select 1 from public.transaction_attachments attachment
      where attachment.storage_bucket = bucket_id
        and attachment.storage_path = name
        and attachment.group_id is not null
        and public.is_active_group_member(attachment.group_id)
    )
  )
);

-- Account quota is serialized to prevent concurrent inserts from racing the limit.
create or replace function private.enforce_personal_account_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  active_count integer;
  allowed_count integer;
begin
  if (select auth.uid()) is not null and new.user_id <> (select auth.uid()) then
    raise exception 'Conta deve pertencer ao usuario autenticado.' using errcode = '42501';
  end if;
  if (select auth.uid()) is not null and not public.is_session_aal2_if_required() then
    raise exception 'Verificacao em duas etapas obrigatoria.' using errcode = '42501';
  end if;

  if coalesce(new.is_active, true) then
    perform pg_advisory_xact_lock(hashtextextended(new.user_id::text, 918273));
    allowed_count := private.account_limit(new.user_id);
    select count(*) into active_count
    from public.personal_accounts account
    where account.user_id = new.user_id
      and account.is_active = true
      and (tg_op = 'INSERT' or account.id <> new.id);

    if active_count >= allowed_count then
      raise exception 'Limite de contas do plano atingido.' using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_personal_accounts_enforce_plan_limit on public.personal_accounts;
create trigger trg_personal_accounts_enforce_plan_limit
before insert or update of is_active, user_id on public.personal_accounts
for each row execute function private.enforce_personal_account_limit();

-- Group creation entitlement, stronger invite secrets, rejoin prevention and throttling.
create or replace function private.enforce_group_creation_entitlement()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or new.created_by <> (select auth.uid()) then
    raise exception 'Criador de grupo invalido.' using errcode = '42501';
  end if;
  if not public.is_session_aal2_if_required() then
    raise exception 'Verificacao em duas etapas obrigatoria.' using errcode = '42501';
  end if;
  if not private.has_entitlement((select auth.uid()), 'create_groups') then
    raise exception 'Criacao de grupos indisponivel no plano atual.' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_groups_enforce_plan on public.groups;
create trigger trg_groups_enforce_plan
before insert on public.groups
for each row execute function private.enforce_group_creation_entitlement();

alter table public.groups drop constraint if exists groups_share_code_format;

create or replace function public.generate_group_share_code()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  candidate text;
begin
  loop
    candidate := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 16));
    exit when not exists (select 1 from public.groups g where g.share_code = candidate);
  end loop;
  return candidate;
end;
$$;

-- BREAKING CHANGE: rotate every existing group share code to the new 16-character
-- hexadecimal format. Previously distributed invite/join codes stop working here.
update public.groups set share_code = public.generate_group_share_code();
alter table public.groups
  add constraint groups_share_code_format check (share_code ~ '^[A-F0-9]{16}$');

create or replace function private.rotate_group_code_after_removal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.removed_at is null and new.removed_at is not null then
    update public.groups
    set share_code = public.generate_group_share_code()
    where id = new.group_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_group_members_rotate_code on public.group_members;
create trigger trg_group_members_rotate_code
after update of removed_at on public.group_members
for each row execute function private.rotate_group_code_after_removal();

create or replace function public.join_group_by_code(p_share_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  target_group_id uuid;
  current_window timestamptz := to_timestamp(floor(extract(epoch from now()) / 900) * 900);
  accepted boolean := false;
begin
  if current_user_id is null then raise exception 'Usuario nao autenticado.'; end if;
  if not public.is_session_aal2_if_required() then
    raise exception 'Verificacao em duas etapas obrigatoria.' using errcode = '42501';
  end if;

  insert into private.security_rate_limits (subject_key, feature, window_started_at, request_count, unit_count)
  values (current_user_id::text, 'group_join', current_window, 1, 1)
  on conflict (subject_key, feature, window_started_at) do update
  set request_count = private.security_rate_limits.request_count + 1,
      unit_count = private.security_rate_limits.unit_count + 1
  where private.security_rate_limits.request_count < 10
  returning true into accepted;

  if not coalesce(accepted, false) then raise exception 'Muitas tentativas. Tente novamente mais tarde.'; end if;

  select g.id into target_group_id
  from public.groups g
  where g.share_code = upper(trim(coalesce(p_share_code, '')))
  limit 1;

  if target_group_id is null then raise exception 'Codigo de grupo invalido.'; end if;
  if exists (
    select 1 from public.group_members gm
    where gm.group_id = target_group_id
      and gm.user_id = current_user_id
      and gm.removed_at is not null
  ) then
    raise exception 'Um administrador precisa restaurar sua participacao.' using errcode = '42501';
  end if;

  insert into public.group_members (group_id, user_id, role, removed_at)
  values (target_group_id, current_user_id, 'member', null)
  on conflict (group_id, user_id) do nothing;

  return target_group_id;
end;
$$;

revoke all on function public.generate_group_share_code() from public, anon, authenticated;
revoke all on function public.join_group_by_code(text) from public, anon;
grant execute on function public.join_group_by_code(text) to authenticated;

-- Import rows are cryptographically/relationally bound to the owning batch.
delete from public.import_batch_rows row
using public.import_batches batch
where row.batch_id = batch.id and row.user_id <> batch.user_id;

create unique index if not exists import_batches_id_user_unique
on public.import_batches (id, user_id);

alter table public.import_batch_rows
drop constraint if exists import_batch_rows_batch_user_fkey;
alter table public.import_batch_rows
add constraint import_batch_rows_batch_user_fkey
foreign key (batch_id, user_id)
references public.import_batches (id, user_id)
on delete cascade;

create or replace function private.enforce_import_boundary()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
begin
  if current_user_id is null then return new; end if;
  if not public.is_session_aal2_if_required() then
    raise exception 'Verificacao em duas etapas obrigatoria.' using errcode = '42501';
  end if;
  if not private.has_entitlement(current_user_id, 'data_import_export') then
    raise exception 'Importacao indisponivel no plano atual.' using errcode = '42501';
  end if;

  if tg_table_name = 'import_batches' then
    new.user_id := current_user_id;
  else
    if not exists (
      select 1 from public.import_batches batch
      where batch.id = new.batch_id and batch.user_id = current_user_id
    ) then
      raise exception 'Lote de importacao invalido.' using errcode = '42501';
    end if;
    new.user_id := current_user_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_import_batches_enforce_boundary on public.import_batches;
create trigger trg_import_batches_enforce_boundary
before insert or update on public.import_batches
for each row execute function private.enforce_import_boundary();

drop trigger if exists trg_import_batch_rows_enforce_boundary on public.import_batch_rows;
create trigger trg_import_batch_rows_enforce_boundary
before insert or update on public.import_batch_rows
for each row execute function private.enforce_import_boundary();

drop policy if exists "import_batches_all_own" on public.import_batches;
create policy "import_batches_all_own" on public.import_batches
for all to authenticated
using (user_id = (select auth.uid()) and public.user_has_entitlement('data_import_export'))
with check (user_id = (select auth.uid()) and public.user_has_entitlement('data_import_export'));

drop policy if exists "import_batch_rows_all_own" on public.import_batch_rows;
create policy "import_batch_rows_all_own" on public.import_batch_rows
for all to authenticated
using (
  user_id = (select auth.uid())
  and public.user_has_entitlement('data_import_export')
  and exists (
    select 1 from public.import_batches batch
    where batch.id = import_batch_rows.batch_id
      and batch.user_id = (select auth.uid())
  )
)
with check (
  user_id = (select auth.uid())
  and public.user_has_entitlement('data_import_export')
  and exists (
    select 1 from public.import_batches batch
    where batch.id = import_batch_rows.batch_id
      and batch.user_id = (select auth.uid())
  )
);

-- Support identity is derived from auth; users may only mark provider messages as read.
create or replace function private.protect_support_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
begin
  if current_user_id is null then return new; end if;
  if not public.is_session_aal2_if_required() then
    raise exception 'Verificacao em duas etapas obrigatoria.' using errcode = '42501';
  end if;
  if not private.has_entitlement(current_user_id, 'support_chat') then
    raise exception 'Chat de suporte indisponivel no plano atual.' using errcode = '42501';
  end if;

  if tg_op = 'INSERT' then
    new.sender_user_id := current_user_id;
    new.sender_role := 'user';
    if char_length(trim(coalesce(new.body, ''))) = 0 then raise exception 'Mensagem vazia.'; end if;
    return new;
  end if;

  if new.conversation_id is distinct from old.conversation_id
     or new.sender_user_id is distinct from old.sender_user_id
     or new.sender_role is distinct from old.sender_role
     or new.body is distinct from old.body
     or new.created_at is distinct from old.created_at then
    raise exception 'Somente o estado de leitura pode ser alterado.' using errcode = '42501';
  end if;
  return new;
end;
$$;

create or replace function private.protect_support_conversation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare current_user_id uuid := (select auth.uid());
begin
  if current_user_id is null then return new; end if;
  if not public.is_session_aal2_if_required() then
    raise exception 'Verificacao em duas etapas obrigatoria.' using errcode = '42501';
  end if;
  if not private.has_entitlement(current_user_id, 'support_chat') then
    raise exception 'Chat de suporte indisponivel no plano atual.' using errcode = '42501';
  end if;
  if tg_op = 'INSERT' then new.user_id := current_user_id; end if;
  if new.user_id <> current_user_id then raise exception 'Conversa invalida.' using errcode = '42501'; end if;
  return new;
end;
$$;

drop trigger if exists trg_support_messages_protect on public.support_messages;
create trigger trg_support_messages_protect
before insert or update on public.support_messages
for each row execute function private.protect_support_message();

drop trigger if exists trg_support_conversations_protect on public.support_conversations;
create trigger trg_support_conversations_protect
before insert or update on public.support_conversations
for each row execute function private.protect_support_conversation();

drop policy if exists "support_conversations_all_own" on public.support_conversations;
create policy "support_conversations_all_own" on public.support_conversations
for all to authenticated
using (user_id = (select auth.uid()) and public.user_has_entitlement('support_chat'))
with check (user_id = (select auth.uid()) and public.user_has_entitlement('support_chat'));

drop policy if exists "support_messages_insert_own_conversation" on public.support_messages;
create policy "support_messages_insert_own_conversation" on public.support_messages
for insert to authenticated
with check (
  sender_user_id = (select auth.uid())
  and sender_role = 'user'
  and public.user_has_entitlement('support_chat')
  and exists (
    select 1 from public.support_conversations conversation
    where conversation.id = support_messages.conversation_id
      and conversation.user_id = (select auth.uid())
  )
);

drop policy if exists "support_messages_select_own_conversation" on public.support_messages;
create policy "support_messages_select_own_conversation" on public.support_messages
for select to authenticated
using (
  public.user_has_entitlement('support_chat')
  and exists (
    select 1 from public.support_conversations conversation
    where conversation.id = support_messages.conversation_id
      and conversation.user_id = (select auth.uid())
  )
);

drop policy if exists "support_messages_update_own_conversation" on public.support_messages;
create policy "support_messages_update_own_conversation" on public.support_messages
for update to authenticated
using (
  sender_role in ('support', 'system')
  and public.user_has_entitlement('support_chat')
  and exists (
    select 1 from public.support_conversations conversation
    where conversation.id = support_messages.conversation_id
      and conversation.user_id = (select auth.uid())
  )
)
with check (
  sender_role in ('support', 'system')
  and public.user_has_entitlement('support_chat')
  and exists (
    select 1 from public.support_conversations conversation
    where conversation.id = support_messages.conversation_id
      and conversation.user_id = (select auth.uid())
  )
);

-- Export requests and processing are restricted to a trusted Pro entitlement.
create or replace function private.enforce_export_entitlement()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare current_user_id uuid := (select auth.uid());
begin
  if current_user_id is null then return new; end if;
  if not public.is_session_aal2_if_required() then
    raise exception 'Verificacao em duas etapas obrigatoria.' using errcode = '42501';
  end if;
  if not private.has_entitlement(current_user_id, 'data_import_export') then
    raise exception 'Exportacao indisponivel no plano atual.' using errcode = '42501';
  end if;
  new.user_id := current_user_id;
  return new;
end;
$$;

drop trigger if exists trg_data_export_requests_enforce_plan on public.data_export_requests;
create trigger trg_data_export_requests_enforce_plan
before insert on public.data_export_requests
for each row execute function private.enforce_export_entitlement();

drop policy if exists "data_export_requests_all_own" on public.data_export_requests;
create policy "data_export_requests_all_own" on public.data_export_requests
for all to authenticated
using (user_id = (select auth.uid()) and public.user_has_entitlement('data_import_export'))
with check (user_id = (select auth.uid()) and public.user_has_entitlement('data_import_export'));

-- Storage bucket and object policy enforce actual byte/type/count quotas.
update storage.buckets
set file_size_limit = 10485760,
    allowed_mime_types = array[
      'image/jpeg', 'image/png', 'image/webp', 'application/pdf',
      'audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/wav', 'audio/x-m4a'
    ]::text[]
where id = 'transaction-receipts';

create or replace function public.can_upload_receipt_object(p_name text, p_metadata jsonb)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and split_part(p_name, '/', 1) = (select auth.uid())::text
    and cardinality(storage.foldername(p_name)) = 2
    and length((storage.foldername(p_name))[2]) between 1 and 180
    and coalesce((p_metadata ->> 'size')::bigint, 0) between 1 and 10485760
    and coalesce(p_metadata ->> 'mimetype', '') = any(array[
      'image/jpeg', 'image/png', 'image/webp', 'application/pdf',
      'audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/wav', 'audio/x-m4a'
    ])
    and (
      select count(*) < 200
      from storage.objects object
      where object.bucket_id = 'transaction-receipts'
        and split_part(object.name, '/', 1) = (select auth.uid())::text
    )
    and (
      select coalesce(sum(coalesce((object.metadata ->> 'size')::bigint, 0)), 0)
             + coalesce((p_metadata ->> 'size')::bigint, 0) <= 262144000
      from storage.objects object
      where object.bucket_id = 'transaction-receipts'
        and split_part(object.name, '/', 1) = (select auth.uid())::text
    );
$$;

revoke all on function public.can_upload_receipt_object(text, jsonb) from public, anon;
grant execute on function public.can_upload_receipt_object(text, jsonb) to authenticated;

drop policy if exists "transaction_receipts_insert_own" on storage.objects;
create policy "transaction_receipts_insert_own" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'transaction-receipts'
  and public.is_session_aal2_if_required()
  and public.can_upload_receipt_object(name, metadata)
);

drop policy if exists "user_data_exports_select_own" on storage.objects;
create policy "user_data_exports_select_own" on storage.objects
for select to authenticated
using (
  bucket_id = 'user-data-exports'
  and (select auth.uid())::text = (storage.foldername(name))[1]
  and public.is_session_aal2_if_required()
  and public.user_has_entitlement('data_import_export')
);

create or replace function private.validate_attachment_metadata()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actual_size bigint;
  actual_mime text;
begin
  if (select auth.uid()) is not null then
    new.user_id := (select auth.uid());
  end if;
  if new.storage_bucket <> 'transaction-receipts'
     or split_part(new.storage_path, '/', 1) <> new.user_id::text then
    raise exception 'Objeto de anexo invalido.' using errcode = '42501';
  end if;

  select coalesce((object.metadata ->> 'size')::bigint, 0), object.metadata ->> 'mimetype'
  into actual_size, actual_mime
  from storage.objects object
  where object.bucket_id = new.storage_bucket and object.name = new.storage_path;

  if actual_size is null or actual_size < 1 or actual_size > 10485760 then
    raise exception 'Tamanho de anexo invalido.';
  end if;
  if coalesce(actual_mime, '') <> any(array[
    'image/jpeg', 'image/png', 'image/webp', 'application/pdf',
    'audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/wav', 'audio/x-m4a'
  ]) then
    raise exception 'Tipo de anexo invalido.';
  end if;

  new.file_size := actual_size;
  new.mime_type := actual_mime;
  return new;
end;
$$;

drop trigger if exists trg_transaction_attachments_validate_metadata on public.transaction_attachments;
create trigger trg_transaction_attachments_validate_metadata
before insert or update of storage_bucket, storage_path, file_size, mime_type, user_id
on public.transaction_attachments
for each row execute function private.validate_attachment_metadata();
