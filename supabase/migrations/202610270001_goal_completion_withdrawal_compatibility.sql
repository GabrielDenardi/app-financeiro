-- Completion is an explicit user decision; keep its timestamp on the server.
create or replace function public.set_goal_completed_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status <> 'completed' then
    new.completed_at := null;
  elsif tg_op = 'INSERT' then
    new.completed_at := now();
  elsif old.status is distinct from 'completed' then
    new.completed_at := now();
  else
    new.completed_at := old.completed_at;
  end if;
  return new;
end;
$$;

create trigger trg_financial_goals_completed_at
before insert or update on public.financial_goals
for each row execute function public.set_goal_completed_at();

create or replace function public.withdraw_from_goal(
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

  select * into goal from public.financial_goals
    where id = p_goal_id and user_id = uid for update;
  if not found then raise exception 'Meta não encontrada.'; end if;
  if safe_amount > goal.current_amount then
    raise exception 'O valor da retirada não pode ser maior que o saldo da meta.';
  end if;
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
    status = case
      when goal.status = 'completed' and goal.current_amount - safe_amount < goal.target_amount then 'active'
      else goal.status
    end
  where id = goal.id;
  return withdrawal_id;
end;
$$;

revoke all on function public.withdraw_from_goal(uuid, uuid, numeric, text, timestamptz) from public, anon;
grant execute on function public.withdraw_from_goal(uuid, uuid, numeric, text, timestamptz) to authenticated;
