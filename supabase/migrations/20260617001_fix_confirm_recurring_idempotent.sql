-- Fix: make confirm_recurring_transaction idempotent.
-- Previously, each call always inserted a new personal_transaction, causing
-- duplicates when the user confirmed the same month more than once.
-- Now: if an execution record already exists for (rule_id, month), the existing
-- transaction is updated in-place instead of a new one being created.

create or replace function public.confirm_recurring_transaction(
  p_rule_id uuid,
  p_amount numeric,
  p_note text default '',
  p_execution_month date default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id  uuid    := auth.uid();
  target_month     date    := public.make_month_date(coalesce(p_execution_month, current_date));
  safe_amount      numeric := round(coalesce(p_amount, 0), 2);
  rule_row         public.recurring_transaction_rules%rowtype;
  existing_tx_id   uuid;
  new_tx_id        uuid;
begin
  if current_user_id is null then
    raise exception 'Usuário não autenticado.';
  end if;

  if safe_amount <= 0 then
    raise exception 'O valor deve ser maior que zero.';
  end if;

  select * into rule_row
  from public.recurring_transaction_rules
  where id = p_rule_id and user_id = current_user_id;

  if not found then
    raise exception 'Regra recorrente não encontrada.';
  end if;

  -- Check if this month was already confirmed
  select transaction_id into existing_tx_id
  from public.recurring_transaction_executions
  where rule_id = p_rule_id
    and user_id = current_user_id
    and execution_month = target_month;

  if existing_tx_id is not null then
    -- Update existing transaction instead of inserting a duplicate
    update public.personal_transactions
    set amount      = safe_amount,
        notes       = trim(coalesce(p_note, rule_row.notes, '')),
        description = trim(coalesce(p_note, rule_row.notes, ''))
    where id = existing_tx_id
      and user_id = current_user_id;

    -- Update execution record
    update public.recurring_transaction_executions
    set amount = safe_amount,
        note   = trim(coalesce(p_note, ''))
    where rule_id        = p_rule_id
      and user_id        = current_user_id
      and execution_month = target_month;

    new_tx_id := existing_tx_id;
  else
    -- First confirmation for this month: insert new transaction
    insert into public.personal_transactions (
      user_id, account_id, category_id, type, title, notes, description,
      payment_method, amount, occurred_at, occurred_on, source_type,
      include_in_reports, recurring_rule_id
    ) values (
      current_user_id,
      rule_row.account_id,
      rule_row.category_id,
      rule_row.type,
      rule_row.title,
      trim(coalesce(p_note, rule_row.notes, '')),
      trim(coalesce(p_note, rule_row.notes, '')),
      rule_row.payment_method,
      safe_amount,
      target_month::timestamptz,
      target_month,
      'manual',
      true,
      rule_row.id
    )
    returning id into new_tx_id;

    -- Register execution
    insert into public.recurring_transaction_executions (
      rule_id, user_id, execution_month, transaction_id, amount, note
    ) values (
      rule_row.id, current_user_id, target_month, new_tx_id, safe_amount,
      trim(coalesce(p_note, ''))
    );
  end if;

  -- For variable rules, keep the amount in sync with the latest confirmed value
  if rule_row.is_variable then
    update public.recurring_transaction_rules
    set amount = safe_amount
    where id = rule_row.id;
  end if;

  return new_tx_id;
end;
$$;
