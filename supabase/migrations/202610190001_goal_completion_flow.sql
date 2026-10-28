-- Fluxo de conclusão de metas:
-- * atingir o valor alvo NÃO conclui mais a meta automaticamente (o usuário escolhe
--   continuar com novo valor/prazo ou concluir);
-- * metas concluídas guardam completed_at e somem da listagem após 30 dias.

alter table public.financial_goals
  add column if not exists completed_at timestamptz;

update public.financial_goals
set completed_at = coalesce(completed_at, updated_at)
where status = 'completed'
  and completed_at is null;

create or replace function public.add_goal_contribution(
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
  current_user_id uuid := auth.uid();
  goal_row public.financial_goals%rowtype;
  new_contribution_id uuid;
  safe_amount numeric := round(coalesce(p_amount, 0), 2);
begin
  if current_user_id is null then
    raise exception 'Usuario nao autenticado.';
  end if;

  if safe_amount <= 0 then
    raise exception 'O aporte deve ser maior que zero.';
  end if;

  perform public.assert_owned_personal_account(current_user_id, p_account_id);

  select *
  into goal_row
  from public.financial_goals fg
  where fg.id = p_goal_id
    and fg.user_id = current_user_id
  for update;

  if goal_row.id is null then
    raise exception 'Meta nao encontrada.';
  end if;

  if goal_row.status <> 'active' then
    raise exception 'Esta meta nao esta ativa.';
  end if;

  if goal_row.current_amount >= goal_row.target_amount then
    raise exception 'Esta meta ja atingiu o valor alvo.';
  end if;

  if safe_amount > goal_row.target_amount - goal_row.current_amount then
    raise exception 'O aporte excede o que falta para a meta (R$ %).',
      to_char(goal_row.target_amount - goal_row.current_amount, 'FM999G999G990D00');
  end if;

  insert into public.goal_contributions (
    goal_id,
    user_id,
    account_id,
    amount,
    note,
    occurred_at
  )
  values (
    p_goal_id,
    current_user_id,
    p_account_id,
    safe_amount,
    trim(coalesce(p_note, '')),
    p_occurred_at
  )
  returning id into new_contribution_id;

  update public.financial_goals
  set
    current_amount = current_amount + safe_amount,
    updated_at = now()
  where id = p_goal_id;

  insert into public.personal_transactions (
    user_id,
    account_id,
    type,
    title,
    description,
    payment_method,
    amount,
    occurred_at,
    occurred_on,
    source_type,
    include_in_reports,
    notes
  )
  values (
    current_user_id,
    p_account_id,
    'expense',
    'Aporte para meta: ' || goal_row.title,
    trim(coalesce(p_note, '')),
    'Transferencia',
    safe_amount,
    p_occurred_at,
    p_occurred_at::date,
    'goal_contribution',
    false,
    trim(coalesce(p_note, ''))
  );

  return new_contribution_id;
end;
$$;

create or replace view public.v_goal_progress as
select
  fg.id as goal_id,
  fg.user_id,
  fg.title,
  fg.target_amount,
  fg.initial_amount,
  fg.current_amount,
  fg.color,
  fg.icon,
  fg.target_date,
  fg.status,
  coalesce(sum(gc.amount), 0)::numeric(14,2) as contributed_amount,
  round(case when fg.target_amount > 0 then (fg.current_amount / fg.target_amount) * 100 else 0 end, 2) as progress_percent,
  fg.completed_at
from public.financial_goals fg
left join public.goal_contributions gc on gc.goal_id = fg.id
where fg.status <> 'completed'
   or fg.completed_at is null
   or fg.completed_at > now() - interval '30 days'
group by
  fg.id,
  fg.user_id,
  fg.title,
  fg.target_amount,
  fg.initial_amount,
  fg.current_amount,
  fg.color,
  fg.icon,
  fg.target_date,
  fg.status,
  fg.completed_at;

alter view public.v_goal_progress set (security_invoker = true);
