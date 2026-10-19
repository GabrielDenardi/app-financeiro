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
using (public.is_active_group_member(group_id));

revoke insert, update, delete on public.group_status_events from anon, authenticated;

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
  target_group_id uuid;
  current_status text;
begin
  if tg_table_name = 'group_split_shares' then
    select gs.group_id into target_group_id
    from public.group_splits gs
    where gs.id = new.split_id;
  else
    target_group_id := new.group_id;
  end if;

  if target_group_id is null then
    return new;
  end if;

  select g.status into current_status
  from public.groups g
  where g.id = target_group_id
  for share;

  if current_status = 'inactive' then
    raise exception 'Este grupo foi encerrado e não aceita novas movimentações.';
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_group_active() from public, anon, authenticated;

drop trigger if exists trg_group_splits_enforce_active on public.group_splits;
create trigger trg_group_splits_enforce_active
before insert on public.group_splits
for each row execute function private.enforce_group_active();

drop trigger if exists trg_group_split_shares_enforce_active on public.group_split_shares;
create trigger trg_group_split_shares_enforce_active
before insert on public.group_split_shares
for each row execute function private.enforce_group_active();

drop trigger if exists trg_group_settlements_enforce_active on public.group_settlements;
create trigger trg_group_settlements_enforce_active
before insert or update on public.group_settlements
for each row execute function private.enforce_group_active();

drop trigger if exists trg_group_members_enforce_active on public.group_members;
create trigger trg_group_members_enforce_active
before insert or update on public.group_members
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

  if not public.is_group_admin(p_group_id, current_user_id) then
    raise exception 'Somente administradores podem encerrar o grupo.';
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

  select count(*) into open_pairs
  from public.group_members m1
  join public.group_members m2
    on m2.group_id = m1.group_id
   and m2.user_id > m1.user_id
  where m1.group_id = p_group_id
    and abs(public.group_outstanding_amount(p_group_id, m1.user_id, m2.user_id)) > 0.009;

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

  if not public.is_group_admin(p_group_id, current_user_id) then
    raise exception 'Somente administradores podem reativar o grupo.';
  end if;

  select * into group_row
  from public.groups g
  where g.id = p_group_id
  for update;

  if group_row.id is null then
    raise exception 'Grupo não encontrado.';
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
