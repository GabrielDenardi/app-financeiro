-- Encerramento (desativação) de grupos.
-- O grupo nunca é apagado: apenas muda de status, preservando splits, acertos,
-- membros e anexos. Toda regra é aplicada no banco (RPCs + triggers), não só no app.

alter table public.groups
  add column if not exists status text not null default 'active',
  add column if not exists closed_at timestamptz,
  add column if not exists closed_by uuid references public.profiles(id) on delete set null;

alter table public.groups drop constraint if exists groups_status_check;
alter table public.groups
  add constraint groups_status_check check (status in ('active', 'inactive'));

alter table public.groups drop constraint if exists groups_closure_consistent;
alter table public.groups
  add constraint groups_closure_consistent check (
    (status = 'inactive' and closed_at is not null)
    or (status = 'active' and closed_at is null)
  );

create index if not exists groups_status_idx on public.groups (status);

-- Trilha de auditoria: quando e por quem o grupo foi encerrado/reativado.
create table if not exists public.group_status_events (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  action text not null,
  performed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint group_status_events_action_check check (action in ('closed', 'reopened'))
);

create index if not exists group_status_events_group_idx
on public.group_status_events (group_id, created_at desc);

alter table public.group_status_events enable row level security;

drop policy if exists "group_status_events_select_members" on public.group_status_events;
create policy "group_status_events_select_members"
on public.group_status_events
for select
to authenticated
using (public.is_active_group_member(group_id) and public.is_session_aal2_if_required());

revoke all on public.group_status_events from public, anon, authenticated;
grant select on public.group_status_events to authenticated;

-- Bloqueio de novas movimentações em grupo inativo.
-- FOR SHARE serializa com close_group (FOR UPDATE na linha do grupo): ou a
-- movimentação confirma antes do encerramento (e é considerada na validação),
-- ou espera o encerramento terminar e é rejeitada.
create or replace function private.enforce_group_active()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_row jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) else '{}'::jsonb end;
  new_row jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) else '{}'::jsonb end;
  target_group_id uuid;
  current_status text;
begin
  -- Check both sides of updates so links cannot be cleared or moved to bypass
  -- closure. Lock groups in a stable order when an operation references two.
  for target_group_id in
    select distinct group_id from (
      select (old_row ->> 'group_id')::uuid as group_id
      union select (new_row ->> 'group_id')::uuid
      union select gs.group_id from public.group_splits gs
        where gs.id in ((old_row ->> 'split_id')::uuid, (new_row ->> 'split_id')::uuid,
          (old_row ->> 'group_split_id')::uuid, (new_row ->> 'group_split_id')::uuid)
      union select gst.group_id from public.group_settlements gst
        where gst.id in ((old_row ->> 'settlement_id')::uuid, (new_row ->> 'settlement_id')::uuid)
    ) linked_groups
    where group_id is not null order by group_id
  loop
    select g.status into current_status from public.groups g
    where g.id = target_group_id for share;
    if current_status = 'inactive' then
      raise exception 'Este grupo foi encerrado e não aceita novas movimentações.';
    end if;
  end loop;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

revoke all on function private.enforce_group_active() from public, anon, authenticated;

drop trigger if exists trg_group_splits_enforce_active on public.group_splits;
create trigger trg_group_splits_enforce_active
before insert or update or delete on public.group_splits
for each row execute function private.enforce_group_active();

drop trigger if exists trg_group_split_shares_enforce_active on public.group_split_shares;
create trigger trg_group_split_shares_enforce_active
before insert or update or delete on public.group_split_shares
for each row execute function private.enforce_group_active();

drop trigger if exists trg_group_settlements_enforce_active on public.group_settlements;
create trigger trg_group_settlements_enforce_active
before insert or update or delete on public.group_settlements
for each row execute function private.enforce_group_active();

drop trigger if exists trg_group_members_enforce_active on public.group_members;
create trigger trg_group_members_enforce_active
before insert or update or delete on public.group_members
for each row execute function private.enforce_group_active();

create trigger trg_personal_transactions_enforce_group_active
before insert or update or delete on public.personal_transactions
for each row execute function private.enforce_group_active();

create trigger trg_transaction_attachments_enforce_group_active
before insert or update or delete on public.transaction_attachments
for each row execute function private.enforce_group_active();

create or replace function public.close_group(p_group_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  group_row public.groups%rowtype;
  pending_settlements integer;
  open_pairs integer;
begin
  if current_user_id is null then
    raise exception 'Usuário não autenticado.';
  end if;
  if not public.is_session_aal2_if_required() then
    raise exception 'Confirme a autenticação de dois fatores para continuar.';
  end if;

  -- Trava a linha do grupo: nenhuma movimentação nova passa pelos triggers
  -- enquanto a verificação de pendências e a desativação não terminarem.
  select * into group_row
  from public.groups g
  where g.id = p_group_id
  for update;

  if group_row.id is null then
    raise exception 'Grupo não encontrado.';
  end if;

  if not public.is_group_admin(p_group_id, current_user_id) then
    raise exception 'Somente administradores podem encerrar o grupo.';
  end if;

  if group_row.status = 'inactive' then
    raise exception 'Este grupo já está encerrado.';
  end if;

  select count(*) into pending_settlements
  from public.group_settlements gst
  where gst.group_id = p_group_id
    and gst.status = 'pending';

  if pending_settlements > 0 then
    raise exception 'Não é possível encerrar: existem % acerto(s) aguardando confirmação.', pending_settlements;
  end if;

  with participants as (
    select user_id from public.group_members where group_id = p_group_id
    union select owner_user_id from public.group_splits where group_id = p_group_id
    union select gss.user_id from public.group_split_shares gss
      join public.group_splits gs on gs.id = gss.split_id where gs.group_id = p_group_id
    union select from_user_id from public.group_settlements where group_id = p_group_id
    union select to_user_id from public.group_settlements where group_id = p_group_id
  )
  select count(*) into open_pairs
  from participants m1 join participants m2 on m2.user_id > m1.user_id
  where abs(public.group_outstanding_amount(p_group_id, m1.user_id, m2.user_id)) > 0.009;

  if open_pairs > 0 then
    raise exception 'Não é possível encerrar: ainda existem saldos em aberto entre os membros. Quite todos os saldos antes de encerrar o grupo.';
  end if;

  update public.groups
  set status = 'inactive',
      closed_at = now(),
      closed_by = current_user_id
  where id = p_group_id;

  insert into public.group_status_events (group_id, action, performed_by)
  values (p_group_id, 'closed', current_user_id);

  return p_group_id;
end;
$$;

create or replace function public.reopen_group(p_group_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  group_row public.groups%rowtype;
begin
  if current_user_id is null then
    raise exception 'Usuário não autenticado.';
  end if;
  if not public.is_session_aal2_if_required() then
    raise exception 'Confirme a autenticação de dois fatores para continuar.';
  end if;

  select * into group_row
  from public.groups g
  where g.id = p_group_id
  for update;

  if group_row.id is null then
    raise exception 'Grupo não encontrado.';
  end if;

  if not public.is_group_admin(p_group_id, current_user_id) then
    raise exception 'Somente administradores podem reativar o grupo.';
  end if;

  if group_row.status <> 'inactive' then
    raise exception 'Este grupo já está ativo.';
  end if;

  update public.groups
  set status = 'active',
      closed_at = null,
      closed_by = null
  where id = p_group_id;

  insert into public.group_status_events (group_id, action, performed_by)
  values (p_group_id, 'reopened', current_user_id);

  return p_group_id;
end;
$$;

revoke all on function public.close_group(uuid) from public, anon;
revoke all on function public.reopen_group(uuid) from public, anon;
grant execute on function public.close_group(uuid) to authenticated;
grant execute on function public.reopen_group(uuid) to authenticated;
