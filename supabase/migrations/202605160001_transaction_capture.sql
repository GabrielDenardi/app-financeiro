alter table public.user_preferences
add column if not exists require_group_expense_receipt boolean not null default false;

create table if not exists public.transaction_attachments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  group_id uuid references public.groups(id) on delete set null,
  transaction_id uuid references public.personal_transactions(id) on delete set null,
  group_split_id uuid references public.group_splits(id) on delete set null,
  attachment_kind text not null default 'receipt',
  source_type text not null default 'manual',
  storage_bucket text not null default 'transaction-receipts',
  storage_path text not null unique,
  file_name text not null,
  mime_type text not null default 'application/octet-stream',
  file_size bigint not null default 0,
  capture_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint transaction_attachments_kind_check check (
    attachment_kind in ('receipt', 'invoice', 'ocr_document', 'audio_note')
  ),
  constraint transaction_attachments_source_type_check check (
    source_type in ('manual', 'voice', 'ocr')
  ),
  constraint transaction_attachments_file_size_non_negative check (file_size >= 0)
);

create index if not exists transaction_attachments_user_created_idx
on public.transaction_attachments (user_id, created_at desc);

create index if not exists transaction_attachments_group_idx
on public.transaction_attachments (group_id, created_at desc);

create unique index if not exists transaction_attachments_transaction_unique
on public.transaction_attachments (transaction_id)
where transaction_id is not null;

create unique index if not exists transaction_attachments_group_split_unique
on public.transaction_attachments (group_split_id)
where group_split_id is not null;

drop trigger if exists trg_transaction_attachments_updated_at on public.transaction_attachments;
create trigger trg_transaction_attachments_updated_at
before update on public.transaction_attachments
for each row
execute function public.set_generic_updated_at();

alter table public.personal_transactions
add column if not exists capture_metadata jsonb not null default '{}'::jsonb;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'personal_transactions_source_type_check'
  ) then
    alter table public.personal_transactions
    drop constraint personal_transactions_source_type_check;
  end if;
end;
$$;

alter table public.personal_transactions
add constraint personal_transactions_source_type_check
check (
  source_type in (
    'manual',
    'transfer',
    'group_split',
    'group_settlement',
    'goal_contribution',
    'imported',
    'card_payment',
    'voice',
    'ocr'
  )
);

create or replace function public.create_personal_transaction(p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  payload_account_id uuid := (p_payload ->> 'account_id')::uuid;
  payload_category_id uuid := nullif(p_payload ->> 'category_id', '')::uuid;
  payload_type text := lower(trim(coalesce(p_payload ->> 'type', 'expense')));
  payload_title text := trim(coalesce(p_payload ->> 'title', ''));
  payload_notes text := trim(coalesce(p_payload ->> 'notes', ''));
  payload_payment_method text := trim(coalesce(p_payload ->> 'payment_method', 'Transferencia'));
  payload_amount numeric := round(coalesce((p_payload ->> 'amount')::numeric, 0), 2);
  payload_occurred_at timestamptz := coalesce((p_payload ->> 'occurred_at')::timestamptz, now());
  payload_source_type text := lower(trim(coalesce(p_payload ->> 'source_type', 'manual')));
  payload_is_recurring boolean := coalesce((p_payload ->> 'is_recurring')::boolean, false);
  payload_attachment_id uuid := nullif(p_payload ->> 'attachment_id', '')::uuid;
  payload_capture_metadata jsonb := coalesce(p_payload -> 'capture_metadata', '{}'::jsonb);
  new_transaction_id uuid;
  new_recurring_rule_id uuid;
  attachment_row public.transaction_attachments%rowtype;
begin
  if current_user_id is null then
    raise exception 'Usuario nao autenticado.';
  end if;

  if payload_account_id is null then
    raise exception 'Selecione uma conta valida.';
  end if;

  perform public.assert_owned_personal_account(current_user_id, payload_account_id);

  if payload_type not in ('income', 'expense') then
    raise exception 'Tipo de transacao invalido.';
  end if;

  if payload_source_type not in ('manual', 'voice', 'ocr') then
    raise exception 'Origem da transacao invalida.';
  end if;

  if char_length(payload_title) = 0 then
    raise exception 'Informe um titulo para a transacao.';
  end if;

  if payload_amount <= 0 then
    raise exception 'O valor da transacao deve ser maior que zero.';
  end if;

  if payload_attachment_id is not null then
    select *
    into attachment_row
    from public.transaction_attachments ta
    where ta.id = payload_attachment_id
      and ta.user_id = current_user_id
    limit 1;

    if attachment_row.id is null then
      raise exception 'Comprovante nao encontrado para o usuario atual.';
    end if;

    if attachment_row.transaction_id is not null or attachment_row.group_split_id is not null then
      raise exception 'Este comprovante ja esta vinculado a outro registro.';
    end if;
  end if;

  insert into public.personal_transactions (
    user_id,
    account_id,
    category_id,
    type,
    title,
    amount,
    payment_method,
    occurred_at,
    occurred_on,
    notes,
    description,
    source_type,
    include_in_reports,
    capture_metadata
  )
  values (
    current_user_id,
    payload_account_id,
    payload_category_id,
    payload_type,
    payload_title,
    payload_amount,
    payload_payment_method,
    payload_occurred_at,
    payload_occurred_at::date,
    payload_notes,
    payload_notes,
    payload_source_type,
    true,
    payload_capture_metadata
  )
  returning id into new_transaction_id;

  if payload_attachment_id is not null then
    update public.transaction_attachments
    set
      transaction_id = new_transaction_id,
      group_id = null
    where id = payload_attachment_id
      and user_id = current_user_id;
  end if;

  if payload_is_recurring then
    insert into public.recurring_transaction_rules (
      user_id,
      account_id,
      category_id,
      type,
      title,
      notes,
      payment_method,
      amount,
      day_of_month,
      cadence,
      is_active
    )
    values (
      current_user_id,
      payload_account_id,
      payload_category_id,
      payload_type,
      payload_title,
      payload_notes,
      payload_payment_method,
      payload_amount,
      extract(day from payload_occurred_at)::integer,
      'monthly',
      true
    )
    returning id into new_recurring_rule_id;

    update public.personal_transactions
    set recurring_rule_id = new_recurring_rule_id
    where id = new_transaction_id;
  end if;

  return new_transaction_id;
end;
$$;

create or replace function public.create_group_split(
  p_group_id uuid,
  p_payload jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  target_group_id uuid := p_group_id;
  payload_title text := trim(coalesce(p_payload ->> 'title', ''));
  payload_description text := trim(coalesce(p_payload ->> 'description', ''));
  payload_kind text := lower(trim(coalesce(p_payload ->> 'kind', '')));
  payload_mode text := lower(trim(coalesce(p_payload ->> 'split_mode', '')));
  payload_total numeric := round(coalesce((p_payload ->> 'total_amount')::numeric, 0), 2);
  payload_owner_user_id uuid := coalesce((p_payload ->> 'owner_user_id')::uuid, current_user_id);
  payload_occurred_at timestamptz := coalesce((p_payload ->> 'occurred_at')::timestamptz, now());
  payload_attachment_id uuid := nullif(p_payload ->> 'attachment_id', '')::uuid;
  shares_payload jsonb := coalesce(p_payload -> 'shares', '[]'::jsonb);
  share_item jsonb;
  participant_user_id uuid;
  participant_amount numeric;
  participant_percentage numeric;
  participant_ids uuid[] := array[]::uuid[];
  amount_sum numeric := 0;
  percentage_sum numeric := 0;
  new_split_id uuid;
  require_receipt boolean := false;
  attachment_row public.transaction_attachments%rowtype;
begin
  if current_user_id is null then
    raise exception 'Usuario nao autenticado.';
  end if;

  if not public.is_active_group_member(target_group_id, current_user_id) then
    raise exception 'Voce nao participa deste grupo.';
  end if;

  select up.require_group_expense_receipt
  into require_receipt
  from public.user_preferences up
  where up.user_id = current_user_id;

  if char_length(payload_title) = 0 then
    raise exception 'Informe um titulo para a divisao.';
  end if;

  if payload_kind not in ('income', 'expense') then
    raise exception 'Tipo de divisao invalido.';
  end if;

  if payload_mode not in ('equal', 'percentage', 'custom') then
    raise exception 'Modo de divisao invalido.';
  end if;

  if payload_total <= 0 then
    raise exception 'O valor total deve ser maior que zero.';
  end if;

  if not public.is_active_group_member(target_group_id, payload_owner_user_id) then
    raise exception 'O pagador ou recebedor precisa participar do grupo.';
  end if;

  if require_receipt and payload_kind = 'expense' and payload_attachment_id is null then
    raise exception 'Esta despesa em grupo exige comprovante.';
  end if;

  if payload_attachment_id is not null then
    select *
    into attachment_row
    from public.transaction_attachments ta
    where ta.id = payload_attachment_id
      and ta.user_id = current_user_id
    limit 1;

    if attachment_row.id is null then
      raise exception 'Comprovante nao encontrado para o usuario atual.';
    end if;

    if attachment_row.transaction_id is not null or attachment_row.group_split_id is not null then
      raise exception 'Este comprovante ja esta vinculado a outro registro.';
    end if;
  end if;

  if jsonb_typeof(shares_payload) <> 'array' or jsonb_array_length(shares_payload) = 0 then
    raise exception 'Selecione ao menos um participante para a divisao.';
  end if;

  for share_item in
    select value
    from jsonb_array_elements(shares_payload)
  loop
    participant_user_id := (share_item ->> 'user_id')::uuid;
    participant_amount := round(coalesce((share_item ->> 'amount')::numeric, 0), 2);
    participant_percentage := nullif(share_item ->> 'percentage', '')::numeric;

    if participant_user_id is null then
      raise exception 'Participante invalido na divisao.';
    end if;

    if participant_user_id = any(participant_ids) then
      raise exception 'Participante duplicado na divisao.';
    end if;

    if not public.is_active_group_member(target_group_id, participant_user_id) then
      raise exception 'Todos os participantes precisam ser membros ativos do grupo.';
    end if;

    if participant_amount < 0 then
      raise exception 'Os valores da divisao nao podem ser negativos.';
    end if;

    participant_ids := array_append(participant_ids, participant_user_id);
    amount_sum := amount_sum + participant_amount;

    if participant_percentage is not null then
      percentage_sum := percentage_sum + participant_percentage;
    end if;
  end loop;

  if abs(round(amount_sum, 2) - payload_total) > 0.009 then
    raise exception 'A soma dos participantes deve ser igual ao valor total.';
  end if;

  if payload_mode = 'percentage' and abs(round(percentage_sum, 2) - 100) > 0.05 then
    raise exception 'As porcentagens devem somar 100.';
  end if;

  insert into public.group_splits (
    group_id,
    created_by,
    owner_user_id,
    title,
    description,
    kind,
    split_mode,
    total_amount,
    occurred_at
  )
  values (
    target_group_id,
    current_user_id,
    payload_owner_user_id,
    payload_title,
    payload_description,
    payload_kind,
    payload_mode,
    payload_total,
    payload_occurred_at
  )
  returning id into new_split_id;

  for share_item in
    select value
    from jsonb_array_elements(shares_payload)
  loop
    insert into public.group_split_shares (split_id, user_id, share_amount, share_percentage)
    values (
      new_split_id,
      (share_item ->> 'user_id')::uuid,
      round(coalesce((share_item ->> 'amount')::numeric, 0), 2),
      nullif(share_item ->> 'percentage', '')::numeric
    );
  end loop;

  if payload_attachment_id is not null then
    update public.transaction_attachments
    set
      group_id = target_group_id,
      group_split_id = new_split_id
    where id = payload_attachment_id
      and user_id = current_user_id;
  end if;

  return new_split_id;
end;
$$;

alter table public.transaction_attachments enable row level security;

drop policy if exists "transaction_attachments_insert_own" on public.transaction_attachments;
create policy "transaction_attachments_insert_own"
on public.transaction_attachments
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "transaction_attachments_select_allowed" on public.transaction_attachments;
create policy "transaction_attachments_select_allowed"
on public.transaction_attachments
for select
to authenticated
using (
  user_id = auth.uid()
  or (
    group_id is not null
    and public.is_active_group_member(group_id)
  )
);

drop policy if exists "transaction_attachments_update_own" on public.transaction_attachments;
create policy "transaction_attachments_update_own"
on public.transaction_attachments
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "transaction_attachments_delete_own" on public.transaction_attachments;
create policy "transaction_attachments_delete_own"
on public.transaction_attachments
for delete
to authenticated
using (user_id = auth.uid());

insert into storage.buckets (id, name, public)
values ('transaction-receipts', 'transaction-receipts', false)
on conflict (id) do nothing;

drop policy if exists "transaction_receipts_select_allowed" on storage.objects;
create policy "transaction_receipts_select_allowed"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'transaction-receipts'
  and (
    auth.uid()::text = (storage.foldername(name))[1]
    or exists (
      select 1
      from public.transaction_attachments ta
      where ta.storage_bucket = bucket_id
        and ta.storage_path = name
        and ta.group_id is not null
        and public.is_active_group_member(ta.group_id)
    )
  )
);

drop policy if exists "transaction_receipts_insert_own" on storage.objects;
create policy "transaction_receipts_insert_own"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'transaction-receipts'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "transaction_receipts_delete_own" on storage.objects;
create policy "transaction_receipts_delete_own"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'transaction-receipts'
  and auth.uid()::text = (storage.foldername(name))[1]
);

grant execute on function public.create_personal_transaction(jsonb) to authenticated;
