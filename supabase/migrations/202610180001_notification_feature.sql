-- Notifications are generated server-side; clients can only read/acknowledge their own.
create table public.notification_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  budgets boolean not null default true,
  reminders boolean not null default true,
  groups boolean not null default true,
  security boolean not null default true,
  recommendations boolean not null default false,
  push_enabled boolean not null default false,
  hide_sensitive boolean not null default true,
  budget_thresholds integer[] not null default '{50,80,100}',
  reminder_days integer not null default 1 check (reminder_days between 0 and 14),
  quiet_start integer not null default 22 check (quiet_start between 0 and 23),
  quiet_end integer not null default 8 check (quiet_end between 0 and 23),
  timezone text not null default 'America/Sao_Paulo',
  constraint notification_thresholds_valid check (
    cardinality(budget_thresholds) between 1 and 5
    and 0 < all(budget_thresholds) and 200 >= all(budget_thresholds)
    and array_position(budget_thresholds, null) is null
  )
);
alter table public.notification_preferences enable row level security;
create policy notification_preferences_own on public.notification_preferences
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on public.notification_preferences to authenticated;

alter table public.user_notifications
  add column event_key text,
  add column interacted_at timestamptz;
create unique index notification_event_unique on public.user_notifications(user_id, event_key);

-- Keep deduplication even after a user clears their inbox.
create table public.notification_events (
  user_id uuid not null references public.profiles(id) on delete cascade,
  event_key text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, event_key)
);
alter table public.notification_events enable row level security;
revoke all on public.notification_events from anon, authenticated;

drop policy if exists user_notifications_all_own on public.user_notifications;
create policy notifications_read_own on public.user_notifications for select to authenticated using (user_id = auth.uid());
create policy notifications_update_own on public.user_notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notifications_delete_own on public.user_notifications for delete to authenticated using (user_id = auth.uid());
revoke insert, update on public.user_notifications from authenticated;
grant update (read_at, interacted_at) on public.user_notifications to authenticated;

create function public.emit_notification(
  p_user uuid, p_key text, p_category text, p_title text, p_body text,
  p_icon text, p_metadata jsonb default '{}'
) returns void language plpgsql security definer set search_path = public as $$
declare prefs public.notification_preferences%rowtype;
begin
  select * into prefs from public.notification_preferences where user_id = p_user;
  if (p_category = 'budgets' and not coalesce(prefs.budgets, true))
    or (p_category = 'reminders' and not coalesce(prefs.reminders, true))
    or (p_category = 'groups' and not coalesce(prefs.groups, true))
    or (p_category = 'security' and not coalesce(prefs.security, true))
    or (p_category = 'recommendations' and not coalesce(prefs.recommendations, false)) then return; end if;
  insert into public.notification_events(user_id, event_key) values (p_user, p_key) on conflict do nothing;
  if not found then return; end if;
  insert into public.user_notifications(user_id, event_key, title, description, icon, source_type, metadata)
  values (p_user, p_key, p_title, p_body, p_icon, p_category, p_metadata);
end;
$$;
revoke all on function public.emit_notification(uuid,text,text,text,text,text,jsonb) from public, anon, authenticated;

create function public.refresh_user_notifications() returns void
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  prefs public.notification_preferences%rowtype;
  today date;
  month_start date;
  r record;
  threshold integer;
  due date;
begin
  if uid is null then raise exception 'Autenticação necessária'; end if;
  insert into public.notification_preferences(user_id) values (uid) on conflict do nothing;
  select * into prefs from public.notification_preferences where user_id = uid;
  today := (now() at time zone prefs.timezone)::date;
  month_start := date_trunc('month', today)::date;
  for r in select * from public.v_budget_progress where user_id = uid and month_date = month_start loop
    -- Only the highest crossed threshold is useful when importing historical expenses.
    select max(t) into threshold from unnest(prefs.budget_thresholds) t where r.spent_amount >= r.limit_amount * t / 100.0;
    if threshold is not null then
      perform public.emit_notification(uid, 'budget:' || r.budget_id || ':' || threshold,
        'budgets', 'Alerta de orçamento',
        format('Você já utilizou %s%% do orçamento de %s neste mês.', round(r.spent_amount * 100 / r.limit_amount), r.category_label),
        'warning', jsonb_build_object('screen', 'Budgets', 'budgetId', r.budget_id));
      if prefs.budgets then
        insert into public.notification_events(user_id, event_key)
          select uid, 'budget:' || r.budget_id || ':' || t from unnest(prefs.budget_thresholds) t where t < threshold
          on conflict do nothing;
      end if;
    end if;
    if extract(day from today) >= 7 and r.spent_amount < r.limit_amount
      and r.spent_amount / extract(day from today) * extract(day from (month_start + interval '1 month - 1 day')) > r.limit_amount then
      perform public.emit_notification(uid, 'forecast:' || r.budget_id, 'recommendations', 'Atenção ao ritmo de gastos',
        format('Mantendo a média diária atual, seu orçamento de %s poderá ser ultrapassado antes do fim do mês.', r.category_label),
        'info', jsonb_build_object('screen', 'Budgets', 'method', 'daily_average'));
    end if;
  end loop;
  -- Include next month so reminders also work across month/year boundaries.
  for r in select rr.*, m.month_date from public.recurring_transaction_rules rr
    cross join (values (month_start), ((month_start + interval '1 month')::date)) m(month_date)
    where rr.user_id = uid and rr.is_active and rr.type = 'expense' loop
    due := r.month_date + (least(r.day_of_month, extract(day from (r.month_date + interval '1 month - 1 day'))::integer) - 1);
    if due between today and today + prefs.reminder_days and not exists (
      select 1 from public.recurring_transaction_executions where rule_id = r.id and execution_month = r.month_date
    ) then
      perform public.emit_notification(uid, 'recurring:' || r.id || ':' || due, 'reminders', 'Lembrete de vencimento',
        format('%s vence em %s. Confira o valor antes de confirmar o pagamento.', r.title, to_char(due, 'DD/MM/YYYY')),
        'warning', jsonb_build_object('screen', 'RecurringTransactions', 'ruleId', r.id));
    end if;
  end loop;
  for r in select * from public.v_card_invoice_summary where user_id = uid and open_amount > 0
    and due_date between today and today + prefs.reminder_days loop
    perform public.emit_notification(uid, 'invoice:' || r.card_id || ':' || r.invoice_month, 'reminders', 'Vencimento de fatura',
      format('A fatura de %s tem R$ %s em aberto e vence em %s.', r.name, r.open_amount, to_char(r.due_date, 'DD/MM/YYYY')),
      'warning', jsonb_build_object('screen', 'Cards', 'cardId', r.card_id, 'invoiceMonth', r.invoice_month));
  end loop;
  -- Compare the current month against three complete months, counting card installments too.
  for r in
    with history as (
      select category_id, month_date, sum(spent_amount) amount from (
        select category_id, date_trunc('month', occurred_on)::date month_date, amount spent_amount
        from public.personal_transactions where user_id = uid and type = 'expense' and include_in_reports
          and occurred_on >= month_start - interval '3 months' and occurred_on <= today
        union all
        select category_id, invoice_month, amount from public.v_card_installment_feed where user_id = uid
          and invoice_month between (month_start - interval '3 months')::date and month_start
      ) expenses group by category_id, month_date
    ) select h.category_id, fc.label, sum(h.amount) filter (where h.month_date = month_start) current_amount,
      sum(h.amount) filter (where h.month_date < month_start) / 3 average_amount
    from history h join public.financial_categories fc on fc.id = h.category_id
    group by h.category_id, fc.label
    having count(*) filter (where h.month_date < month_start) = 3
      and sum(h.amount) filter (where h.month_date = month_start) > sum(h.amount) filter (where h.month_date < month_start) / 3 * 1.35
  loop
    perform public.emit_notification(uid, 'pattern:' || r.category_id || ':' || month_start, 'recommendations', 'Mudança nos gastos',
      format('Seus gastos com %s estão %s%% acima da média dos últimos três meses completos.', r.label,
        round((r.current_amount / nullif(r.average_amount, 0) - 1) * 100)),
      'info', jsonb_build_object('screen', 'Reports', 'method', 'three_month_average'));
  end loop;
end;
$$;
revoke all on function public.refresh_user_notifications() from public, anon;
grant execute on function public.refresh_user_notifications() to authenticated;

create function public.notify_group_share() returns trigger
language plpgsql security definer set search_path = public as $$
declare s public.group_splits%rowtype;
begin
  select * into s from public.group_splits where id = new.split_id;
  if new.user_id = coalesce(auth.uid(), s.created_by) then return new; end if;
  if not exists (select 1 from public.group_members where group_id = s.group_id and user_id = new.user_id and removed_at is null) then return new; end if;
  if tg_op = 'UPDATE' and new.share_amount = old.share_amount then return new; end if;
  perform public.emit_notification(new.user_id, 'share:' || new.id || ':' || gen_random_uuid(), 'groups',
    case when tg_op = 'INSERT' then 'Nova despesa compartilhada' else 'Divisão atualizada' end,
    format('%s: sua parte é R$ %s.', s.title, new.share_amount), 'info',
    jsonb_build_object('screen', 'GroupDetails', 'groupId', s.group_id, 'splitId', s.id));
  return new;
end;
$$;
revoke all on function public.notify_group_share() from public, anon, authenticated;
create trigger notification_group_share after insert or update on public.group_split_shares
for each row execute function public.notify_group_share();

create function public.notify_security_event() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.event_type = 'sign_out' then return new; end if;
  if exists (select 1 from public.user_preferences where user_id = new.user_id and not login_alerts_enabled)
    and new.event_type = 'sign_in' then return new; end if;
  perform public.emit_notification(new.user_id, 'security:' || new.id, 'security',
    case when new.event_type = 'sign_in' then 'Novo acesso à conta' else 'Alteração de segurança' end,
    case new.event_type when 'sign_in' then 'Um acesso à sua conta foi registrado. Confira seus acessos recentes.'
      when 'mfa_enabled' then 'A autenticação em duas etapas foi ativada.'
      when 'mfa_disabled' then 'A autenticação em duas etapas foi desativada.'
      else 'Uma alteração de senha foi registrada na sua conta.' end,
    'security', jsonb_build_object('screen', 'Privacy'));
  return new;
end;
$$;
revoke all on function public.notify_security_event() from public, anon, authenticated;
create trigger notification_security_event after insert on public.auth_login_events
for each row execute function public.notify_security_event();
