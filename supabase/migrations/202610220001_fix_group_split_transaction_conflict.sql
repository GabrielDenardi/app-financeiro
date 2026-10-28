-- Match the predicate of personal_transactions_group_split_user_unique.
create or replace function public.create_group_split_personal_transaction()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  default_account_id uuid;
begin
  default_account_id := public.ensure_default_personal_account(new.owner_user_id);

  insert into public.personal_transactions (
    user_id,
    account_id,
    group_id,
    group_split_id,
    type,
    title,
    description,
    payment_method,
    amount,
    occurred_at,
    occurred_on,
    source_type,
    include_in_reports
  )
  values (
    new.owner_user_id,
    default_account_id,
    new.group_id,
    new.id,
    new.kind,
    'Divisao de grupo: ' || new.title,
    trim(coalesce(new.description, '')),
    'Transferencia',
    new.total_amount,
    new.occurred_at,
    new.occurred_at::date,
    'group_split',
    true
  )
  on conflict (group_split_id, user_id) where group_split_id is not null do nothing;

  return new;
end;
$$;
