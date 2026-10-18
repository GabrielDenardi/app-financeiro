alter table public.notification_preferences add column ai_enabled boolean not null default false;
create table public.notification_ai_requests (
  user_id uuid not null references public.profiles(id) on delete cascade,
  day date not null,
  created_at timestamptz not null default now(),
  primary key(user_id, day)
);
alter table public.notification_ai_requests enable row level security;
revoke all on public.notification_ai_requests from anon, authenticated;

create function public.claim_notification_recommendation() returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); prefs public.notification_preferences%rowtype; today date; result jsonb;
begin
  if uid is null then raise exception 'Autenticação necessária'; end if;
  select * into prefs from public.notification_preferences where user_id = uid;
  if not coalesce(prefs.ai_enabled and prefs.recommendations, false) then raise exception 'Autorize as recomendações com IA nas preferências'; end if;
  today := (now() at time zone prefs.timezone)::date;
  select jsonb_agg(jsonb_build_object('id', budget_id, 'percentage', round(spent_amount / limit_amount * 100),
    'projectedPercentage', round(spent_amount / limit_amount * 100 / extract(day from today)
      * extract(day from (date_trunc('month', today) + interval '1 month - 1 day'))))) into result
  from (select * from public.v_budget_progress where user_id = uid and month_date = date_trunc('month', today)::date and spent_amount > 0
    order by budget_id limit 50) budgets;
  if result is null then return '[]'::jsonb; end if;
  insert into public.notification_ai_requests(user_id, day) values(uid, today) on conflict do nothing;
  if not found then raise exception 'Você já solicitou uma recomendação hoje. Tente novamente amanhã.'; end if;
  return result;
end;
$$;
revoke all on function public.claim_notification_recommendation() from public, anon;
grant execute on function public.claim_notification_recommendation() to authenticated;

-- Called only by the authenticated Edge Function's service client, after validating AI output.
create function public.complete_notification_recommendation(p_user uuid, p_budget uuid, p_action text) returns void
language plpgsql security definer set search_path = public as $$
declare r record; prefs public.notification_preferences%rowtype; today date;
begin
  select * into prefs from public.notification_preferences where user_id = p_user;
  if not coalesce(prefs.ai_enabled and prefs.recommendations, false) then return; end if;
  today := (now() at time zone prefs.timezone)::date;
  if not exists(select 1 from public.notification_ai_requests where user_id = p_user and day = today) then return; end if;
  select * into r from public.v_budget_progress where user_id = p_user and budget_id = p_budget
    and month_date = date_trunc('month', today)::date;
  if not found or p_action not in ('review_budget', 'reduce_spending') then return; end if;
  perform public.emit_notification(p_user, 'ai:' || today, 'recommendations', 'Recomendação com IA',
    case p_action when 'reduce_spending' then format('Considere reduzir os próximos gastos de %s. Você já utilizou %s%% do orçamento mensal.',
      r.category_label, round(r.spent_amount / r.limit_amount * 100))
    else format('Revise o planejamento de %s. Compare seu limite mensal com os gastos registrados antes de ajustá-lo.', r.category_label) end,
    'info', jsonb_build_object('screen', 'Budgets', 'budgetId', p_budget, 'method', 'ai'));
end;
$$;
revoke all on function public.complete_notification_recommendation(uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.complete_notification_recommendation(uuid,uuid,text) to service_role;
