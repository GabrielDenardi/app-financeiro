-- Withdrawals are audited separately from positive goal contributions.
create table public.goal_withdrawals (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.financial_goals(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  account_id uuid not null references public.personal_accounts(id) on delete cascade,
  transaction_id uuid not null unique references public.personal_transactions(id) on delete cascade,
  amount numeric(14,2) not null check (amount > 0),
  note text not null default '',
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index goal_withdrawals_user_goal_idx on public.goal_withdrawals(user_id, goal_id);
alter table public.goal_withdrawals enable row level security;
revoke all on public.goal_withdrawals from public, anon, authenticated;
grant select on public.goal_withdrawals to authenticated;
create policy goal_withdrawals_read_own on public.goal_withdrawals for select to authenticated
  using (user_id = (select auth.uid()) and public.is_session_aal2_if_required());

alter table public.personal_transactions drop constraint personal_transactions_source_type_check;
alter table public.personal_transactions add constraint personal_transactions_source_type_check
  check (source_type in ('manual', 'transfer', 'group_split', 'group_settlement',
    'goal_contribution', 'goal_withdrawal', 'imported', 'card_payment', 'voice', 'ocr'));

create or replace function public.normalize_personal_transaction()
returns trigger language plpgsql as $$
begin
  new.title := trim(coalesce(new.title, ''));
  new.description := trim(coalesce(new.description, ''));
  new.notes := trim(coalesce(new.notes, new.description, ''));
  new.occurred_on := coalesce(new.occurred_on, new.occurred_at::date);
  if new.settlement_id is not null and coalesce(new.source_type, 'manual') = 'manual' then
    new.source_type := 'group_settlement';
  end if;
  if new.transfer_id is not null then new.source_type := 'transfer'; end if;
  if new.source_type in ('transfer', 'goal_contribution', 'goal_withdrawal', 'card_payment', 'group_settlement') then
    new.include_in_reports := false;
  end if;
  return new;
end;
$$;

create function public.withdraw_from_goal(
  p_goal_id uuid,
  p_account_id uuid,
  p_amount numeric,
  p_note text default '',
  p_occurred_at timestamptz default now()
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  goal public.financial_goals%rowtype;
  safe_amount numeric;
  transaction_id uuid;
  withdrawal_id uuid;
  occurred_at timestamptz := coalesce(p_occurred_at, now());
begin
  if uid is null then raise exception 'Usuário não autenticado.'; end if;
  if not public.is_session_aal2_if_required() then
    raise exception 'Confirme a autenticação de dois fatores para continuar.';
  end if;
  if p_amount is null or p_amount::text in ('NaN', 'Infinity', '-Infinity') then
    raise exception 'Informe um valor válido para retirar.';
  end if;
  safe_amount := round(p_amount, 2);
  if safe_amount <= 0 then raise exception 'Informe um valor válido para retirar.'; end if;

  -- Serialize withdrawals (and contributions updating this row) before checking funds.
  select * into goal from public.financial_goals
    where id = p_goal_id and user_id = uid for update;
  if not found then raise exception 'Meta não encontrada.'; end if;
  if safe_amount > goal.current_amount then
    raise exception 'O valor da retirada não pode ser maior que o saldo da meta.';
  end if;
  -- Keep the destination active and owned until the transaction commits.
  perform 1 from public.personal_accounts
    where id = p_account_id and user_id = uid and is_active for share;
  if not found then raise exception 'Selecione uma conta ativa do seu usuário.'; end if;

  insert into public.personal_transactions(
    user_id, account_id, type, title, description, notes, payment_method,
    amount, occurred_at, occurred_on, source_type, include_in_reports
  ) values (
    uid, p_account_id, 'income', 'Retirada da meta: ' || goal.title,
    trim(coalesce(p_note, '')), trim(coalesce(p_note, '')), 'Transferencia',
    safe_amount, occurred_at, occurred_at::date, 'goal_withdrawal', false
  ) returning id into transaction_id;

  insert into public.goal_withdrawals(goal_id, user_id, account_id, transaction_id, amount, note, occurred_at)
  values (goal.id, uid, p_account_id, transaction_id, safe_amount, trim(coalesce(p_note, '')), occurred_at)
  returning id into withdrawal_id;

  update public.financial_goals set
    current_amount = goal.current_amount - safe_amount,
    updated_at = now(),
    status = case when goal.status = 'archived' then 'archived'
      when goal.current_amount - safe_amount >= goal.target_amount then 'completed' else 'active' end
  where id = goal.id;
  return withdrawal_id;
end;
$$;
revoke all on function public.withdraw_from_goal(uuid, uuid, numeric, text, timestamptz) from public, anon;
grant execute on function public.withdraw_from_goal(uuid, uuid, numeric, text, timestamptz) to authenticated;
