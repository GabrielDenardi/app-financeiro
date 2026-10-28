-- A equipe é provisionada por um administrador no banco, nunca pelo navegador.
create table public.support_agents (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  display_name text not null check (length(trim(display_name)) between 1 and 100),
  is_active boolean not null default true
);
alter table public.support_agents enable row level security;
revoke all on public.support_agents from public, anon, authenticated;

create function public.is_support_agent() returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and public.is_session_aal2_if_required()
    and exists(select 1 from public.support_agents where user_id = auth.uid() and is_active);
$$;
revoke all on function public.is_support_agent() from public, anon;
grant execute on function public.is_support_agent() to authenticated;

alter table public.support_conversations add column request_id uuid;
create unique index support_conversation_request on public.support_conversations(user_id, request_id);
alter table public.support_messages add column request_id uuid;
alter table public.support_messages add column sender_name text;
create unique index support_message_request on public.support_messages(sender_user_id, request_id);

-- Escrita somente por RPCs atômicas com validação explícita de acesso.
alter table public.support_conversations enable row level security;
alter table public.support_messages enable row level security;
revoke insert, update, delete on public.support_conversations, public.support_messages from anon, authenticated;
drop trigger if exists trg_support_messages_protect on public.support_messages;
drop trigger if exists trg_support_conversations_protect on public.support_conversations;
drop policy if exists support_conversations_all_own on public.support_conversations;
drop policy if exists support_messages_insert_own_conversation on public.support_messages;
drop policy if exists support_messages_update_own_conversation on public.support_messages;
drop policy if exists support_messages_select_own_conversation on public.support_messages;
create policy support_conversations_read on public.support_conversations for select to authenticated
using (public.is_support_agent() or (user_id = auth.uid() and public.user_has_entitlement('support_chat')));
create policy support_messages_read on public.support_messages for select to authenticated using (
  exists(select 1 from public.support_conversations c where c.id = conversation_id)
);
grant select on public.support_conversations, public.support_messages to authenticated;

create function public.create_support_conversation(p_title text, p_body text, p_request_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); cid uuid;
begin
  if uid is null or not public.user_has_entitlement('support_chat') or not public.is_session_aal2_if_required() then
    raise exception 'Acesso ao suporte não autorizado.' using errcode = '42501';
  end if;
  if p_request_id is null or length(trim(coalesce(p_title,''))) not between 1 and 160
    or length(trim(coalesce(p_body,''))) not between 1 and 5000 then
    raise exception 'Informe assunto e mensagem válidos.';
  end if;
  insert into public.support_conversations(user_id, title, request_id)
    values(uid, trim(p_title), p_request_id)
    on conflict (user_id, request_id) do nothing returning id into cid;
  if cid is null then
    select id into cid from public.support_conversations where user_id = uid and request_id = p_request_id;
    if not exists(select 1 from public.support_conversations where id = cid and title = trim(p_title))
      or not exists(select 1 from public.support_messages where conversation_id = cid and request_id = p_request_id and body = trim(p_body)) then
      raise exception 'Identificador de criação já utilizado.';
    end if;
    return cid;
  end if;
  insert into public.support_messages(conversation_id, sender_user_id, sender_role, body, request_id)
    values(cid, uid, 'user', trim(p_body), p_request_id);
  return cid;
end;
$$;

create function public.send_support_message(p_conversation_id uuid, p_body text, p_request_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); c public.support_conversations%rowtype; mid uuid; agent boolean;
begin
  agent := public.is_support_agent();
  select * into c from public.support_conversations where id = p_conversation_id for update;
  if uid is null or c.id is null or not public.is_session_aal2_if_required()
    or not (agent or (c.user_id = uid and public.user_has_entitlement('support_chat'))) then
    raise exception 'Conversa não disponível.' using errcode = '42501';
  end if;
  if p_request_id is null or length(trim(coalesce(p_body,''))) not between 1 and 5000 then
    raise exception 'A mensagem deve conter de 1 a 5000 caracteres.';
  end if;
  select id into mid from public.support_messages where sender_user_id = uid and request_id = p_request_id;
  if mid is not null then
    if not exists(select 1 from public.support_messages where id = mid and conversation_id = c.id and body = trim(p_body)) then
      raise exception 'Identificador de envio já utilizado.';
    end if;
    return mid;
  end if;
  insert into public.support_messages(conversation_id, sender_user_id, sender_role, sender_name, body, request_id)
    values(c.id, uid, case when agent then 'support' else 'user' end,
      case when agent then (select display_name from public.support_agents where user_id = uid) end,
      trim(p_body), p_request_id) returning id into mid;
  return mid;
end;
$$;

create function public.mark_support_read(p_conversation_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare agent boolean := public.is_support_agent();
begin
  if auth.uid() is null or not public.is_session_aal2_if_required() or not exists(
    select 1 from public.support_conversations where id = p_conversation_id
      and (agent or (user_id = auth.uid() and public.user_has_entitlement('support_chat')))
  ) then raise exception 'Conversa não disponível.' using errcode = '42501'; end if;
  update public.support_messages set read_at = now() where conversation_id = p_conversation_id and read_at is null
    and ((agent and sender_role = 'user') or (not agent and sender_role in ('support','system')));
end;
$$;

create function public.set_support_status(p_conversation_id uuid, p_status text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_support_agent() then raise exception 'Acesso restrito à equipe.' using errcode = '42501'; end if;
  if p_status not in ('active','working','done') or p_status is null then raise exception 'Status inválido.'; end if;
  update public.support_conversations set status = p_status,
    closed_at = case when p_status = 'done' then now() else null end where id = p_conversation_id;
  if not found then raise exception 'Conversa não encontrada.'; end if;
end;
$$;

create function public.list_support_inbox() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_support_agent() then raise exception 'Acesso restrito à equipe.' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(row_to_json(r) order by r.updated_at desc) from (
    select c.id, c.title, c.status, c.updated_at, c.user_id, p.full_name as user_name, p.email as user_email,
      (select body from public.support_messages where conversation_id = c.id order by created_at desc, id desc limit 1) as last_message,
      (select count(*) from public.support_messages where conversation_id = c.id and sender_role = 'user' and read_at is null) as unread_count,
      (select sender_role from public.support_messages where conversation_id = c.id order by created_at desc, id desc limit 1) = 'user' as needs_reply
    from public.support_conversations c join public.profiles p on p.id = c.user_id
  ) r), '[]'::jsonb);
end;
$$;

create function private.support_message_event() returns trigger
language plpgsql security definer set search_path = '' as $$
declare owner_id uuid;
begin
  update public.support_conversations set updated_at = now(),
    status = case when new.sender_role = 'user' then 'active' else 'working' end,
    closed_at = null where id = new.conversation_id returning user_id into owner_id;
  if new.sender_role = 'support' then
    perform public.emit_notification(owner_id, 'support:' || new.id, 'system', 'Nova resposta do suporte',
      'A equipe nitin respondeu ao seu atendimento.', 'info',
      jsonb_build_object('screen','Chat','chatId',new.conversation_id,'chatTitle','Atendimento nitin'));
  end if;
  return new;
end;
$$;
revoke all on function private.support_message_event() from public, anon, authenticated;
create trigger support_message_event after insert on public.support_messages
for each row execute function private.support_message_event();

revoke all on function public.create_support_conversation(text,text,uuid),
  public.send_support_message(uuid,text,uuid), public.mark_support_read(uuid),
  public.set_support_status(uuid,text), public.list_support_inbox() from public, anon;
grant execute on function public.create_support_conversation(text,text,uuid),
  public.send_support_message(uuid,text,uuid), public.mark_support_read(uuid),
  public.set_support_status(uuid,text), public.list_support_inbox() to authenticated;

do $$
declare t text;
begin
  if exists(select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['support_conversations','support_messages'] loop
      if not exists(select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end;
$$;
