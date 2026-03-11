create table if not exists public.credit_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  institution text not null default '',
  network text not null default 'Visa',
  last_digits text not null,
  limit_amount numeric(14,2) not null,
  due_day integer not null,
  closing_day integer not null,
  color text not null default '#1E3A8A',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint credit_cards_name_not_blank check (char_length(trim(name)) between 1 and 120),
  constraint credit_cards_last_digits_check check (last_digits ~ '^[0-9]{4}$'),
  constraint credit_cards_limit_positive check (limit_amount > 0),
  constraint credit_cards_due_day_check check (due_day between 1 and 31),
  constraint credit_cards_closing_day_check check (closing_day between 1 and 31),
  constraint credit_cards_day_order_check check (closing_day <> due_day)
);

create table if not exists public.credit_card_charges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  card_id uuid not null references public.credit_cards(id) on delete cascade,
  category_id uuid references public.financial_categories(id) on delete set null,
  title text not null,
  notes text not null default '',
  purchase_date date not null,
  total_amount numeric(14,2) not null,
  installment_count integer not null default 1,
  created_at timestamptz not null default now(),
  constraint credit_card_charges_title_not_blank check (char_length(trim(title)) between 1 and 120),
  constraint credit_card_charges_total_positive check (total_amount > 0),
  constraint credit_card_charges_installment_count_check check (installment_count between 1 and 24)
);

create table if not exists public.credit_card_installments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  card_id uuid not null references public.credit_cards(id) on delete cascade,
  charge_id uuid not null references public.credit_card_charges(id) on delete cascade,
  installment_number integer not null,
  total_installments integer not null,
  amount numeric(14,2) not null,
  paid_amount numeric(14,2) not null default 0,
  invoice_month date not null,
  due_date date not null,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  constraint credit_card_installments_number_check check (installment_number between 1 and 24),
  constraint credit_card_installments_total_check check (total_installments between 1 and 24),
  constraint credit_card_installments_amount_positive check (amount > 0),
  constraint credit_card_installments_paid_amount_non_negative check (paid_amount >= 0),
  constraint credit_card_installments_invoice_month_check check (extract(day from invoice_month) = 1),
  constraint credit_card_installments_unique unique (charge_id, installment_number)
);

alter table public.personal_transactions
add column if not exists card_id uuid references public.credit_cards(id) on delete set null;

create index if not exists credit_cards_user_active_idx
on public.credit_cards (user_id, is_active, created_at desc);
create index if not exists credit_card_charges_user_purchase_idx
on public.credit_card_charges (user_id, purchase_date desc);
create index if not exists credit_card_installments_card_month_idx
on public.credit_card_installments (card_id, invoice_month, due_date);
create index if not exists credit_card_installments_user_month_idx
on public.credit_card_installments (user_id, invoice_month, due_date);

create or replace function public.compute_card_invoice_month(
  p_purchase_date date,
  p_closing_day integer
)
returns date
language plpgsql
immutable
as $$
declare
  base_month date := public.make_month_date(p_purchase_date);
begin
  if extract(day from p_purchase_date)::int > p_closing_day then
    return (base_month + interval '1 month')::date;
  end if;

  return base_month;
end;
$$;

create or replace function public.compute_card_due_date(
  p_invoice_month date,
  p_due_day integer
)
returns date
language plpgsql
immutable
as $$
declare
  last_day integer := extract(day from (date_trunc('month', p_invoice_month + interval '1 month') - interval '1 day'))::int;
  safe_day integer := least(greatest(p_due_day, 1), last_day);
begin
  return make_date(
    extract(year from p_invoice_month)::int,
    extract(month from p_invoice_month)::int,
    safe_day
  );
end;
$$;

create or replace function public.record_card_charge(
  p_card_id uuid,
  p_title text,
  p_total_amount numeric,
  p_category_id uuid default null,
  p_purchase_date date default current_date,
  p_installment_count integer default 1,
  p_notes text default ''
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  card_row public.credit_cards%rowtype;
  new_charge_id uuid;
  safe_total numeric := round(coalesce(p_total_amount, 0), 2);
  safe_installments integer := greatest(1, least(coalesce(p_installment_count, 1), 24));
  total_cents bigint;
  base_installment_cents bigint;
  installment_cents bigint;
  idx integer;
  base_invoice_month date;
  current_invoice_month date;
begin
  if current_user_id is null then
    raise exception 'Usuario nao autenticado.';
  end if;

  select *
  into card_row
  from public.credit_cards cc
  where cc.id = p_card_id
    and cc.user_id = current_user_id
    and cc.is_active = true;

  if card_row.id is null then
    raise exception 'Cartao nao encontrado.';
  end if;

  if safe_total <= 0 then
    raise exception 'O valor da compra deve ser maior que zero.';
  end if;

  insert into public.credit_card_charges (
    user_id,
    card_id,
    category_id,
    title,
    notes,
    purchase_date,
    total_amount,
    installment_count
  )
  values (
    current_user_id,
    p_card_id,
    p_category_id,
    trim(coalesce(p_title, '')),
    trim(coalesce(p_notes, '')),
    coalesce(p_purchase_date, current_date),
    safe_total,
    safe_installments
  )
  returning id into new_charge_id;

  total_cents := round(safe_total * 100);
  base_installment_cents := floor(total_cents::numeric / safe_installments)::bigint;
  base_invoice_month := public.compute_card_invoice_month(coalesce(p_purchase_date, current_date), card_row.closing_day);

  for idx in 1..safe_installments loop
    if idx = safe_installments then
      installment_cents := total_cents - (base_installment_cents * (safe_installments - 1));
    else
      installment_cents := base_installment_cents;
    end if;

    current_invoice_month := (base_invoice_month + make_interval(months => idx - 1))::date;

    insert into public.credit_card_installments (
      user_id,
      card_id,
      charge_id,
      installment_number,
      total_installments,
      amount,
      invoice_month,
      due_date
    )
    values (
      current_user_id,
      p_card_id,
      new_charge_id,
      idx,
      safe_installments,
      round((installment_cents::numeric / 100), 2),
      current_invoice_month,
      public.compute_card_due_date(current_invoice_month, card_row.due_day)
    );
  end loop;

  return new_charge_id;
end;
$$;

create or replace function public.pay_card_invoice(
  p_card_id uuid,
  p_invoice_month date,
  p_account_id uuid,
  p_amount numeric default null,
  p_note text default ''
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  card_row public.credit_cards%rowtype;
  installment_row public.credit_card_installments%rowtype;
  safe_invoice_month date := public.make_month_date(p_invoice_month);
  open_amount numeric(14,2);
  payment_amount numeric(14,2);
  remaining_amount numeric(14,2);
  delta numeric(14,2);
  transaction_id uuid;
begin
  if current_user_id is null then
    raise exception 'Usuario nao autenticado.';
  end if;

  perform public.assert_owned_personal_account(current_user_id, p_account_id);

  select *
  into card_row
  from public.credit_cards cc
  where cc.id = p_card_id
    and cc.user_id = current_user_id;

  if card_row.id is null then
    raise exception 'Cartao nao encontrado.';
  end if;

  select round(coalesce(sum(amount - paid_amount), 0), 2)
  into open_amount
  from public.credit_card_installments cci
  where cci.card_id = p_card_id
    and cci.user_id = current_user_id
    and cci.invoice_month = safe_invoice_month
    and cci.amount > cci.paid_amount;

  if open_amount <= 0 then
    raise exception 'Nao existe saldo em aberto para esta fatura.';
  end if;

  payment_amount := round(coalesce(p_amount, open_amount), 2);

  if payment_amount <= 0 or payment_amount > open_amount then
    raise exception 'Valor de pagamento invalido para a fatura.';
  end if;

  remaining_amount := payment_amount;

  for installment_row in
    select *
    from public.credit_card_installments cci
    where cci.card_id = p_card_id
      and cci.user_id = current_user_id
      and cci.invoice_month = safe_invoice_month
      and cci.amount > cci.paid_amount
    order by cci.due_date, cci.installment_number, cci.created_at
  loop
    exit when remaining_amount <= 0;

    delta := least(remaining_amount, installment_row.amount - installment_row.paid_amount);

    update public.credit_card_installments
    set
      paid_amount = round(paid_amount + delta, 2),
      paid_at = case
        when round(paid_amount + delta, 2) >= amount then now()
        else paid_at
      end
    where id = installment_row.id;

    remaining_amount := round(remaining_amount - delta, 2);
  end loop;

  insert into public.personal_transactions (
    user_id,
    account_id,
    card_id,
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
    p_card_id,
    'expense',
    'Pagamento fatura: ' || card_row.name,
    trim(coalesce(p_note, '')),
    'Transferencia',
    payment_amount,
    now(),
    current_date,
    'card_payment',
    false,
    trim(coalesce(p_note, ''))
  )
  returning id into transaction_id;

  return transaction_id;
end;
$$;

create or replace view public.v_card_installment_feed as
select
  cci.id as installment_id,
  cci.user_id,
  cci.card_id,
  cc.name as card_name,
  cc.institution,
  cc.color as card_color,
  cci.charge_id,
  ccc.title,
  ccc.notes,
  ccc.category_id,
  fc.code as category_code,
  fc.label as category_label,
  fc.color as category_color,
  cci.installment_number,
  cci.total_installments,
  cci.amount,
  cci.paid_amount,
  round(cci.amount - cci.paid_amount, 2) as remaining_amount,
  cci.invoice_month,
  cci.due_date,
  cci.paid_at,
  case
    when cci.paid_amount >= cci.amount then 'paid'
    when cci.paid_amount > 0 then 'partial'
    else 'open'
  end as status
from public.credit_card_installments cci
join public.credit_card_charges ccc on ccc.id = cci.charge_id
join public.credit_cards cc on cc.id = cci.card_id
left join public.financial_categories fc on fc.id = ccc.category_id;

create or replace view public.v_card_invoice_summary as
select
  cc.id as card_id,
  cc.user_id,
  cc.name,
  cc.institution,
  cc.network,
  cc.last_digits,
  cc.limit_amount,
  cc.due_day,
  cc.closing_day,
  cc.color,
  feed.invoice_month,
  min(feed.due_date) as due_date,
  round(coalesce(sum(feed.amount), 0), 2) as invoice_amount,
  round(coalesce(sum(feed.remaining_amount), 0), 2) as open_amount,
  round(coalesce(sum(feed.amount - feed.remaining_amount), 0), 2) as paid_amount,
  count(*) as installment_count,
  round(
    coalesce((
      select sum(cci.amount - cci.paid_amount)
      from public.credit_card_installments cci
      where cci.card_id = cc.id
        and cci.user_id = cc.user_id
    ), 0),
    2
  ) as used_limit_amount
from public.credit_cards cc
left join public.v_card_installment_feed feed
  on feed.card_id = cc.id
group by
  cc.id,
  cc.user_id,
  cc.name,
  cc.institution,
  cc.network,
  cc.last_digits,
  cc.limit_amount,
  cc.due_day,
  cc.closing_day,
  cc.color,
  feed.invoice_month;

create or replace view public.v_budget_progress as
with reportable_expenses as (
  select
    pt.user_id,
    pt.category_id,
    public.make_month_date(pt.occurred_on) as month_date,
    pt.amount
  from public.personal_transactions pt
  where pt.type = 'expense'
    and pt.include_in_reports = true

  union all

  select
    feed.user_id,
    feed.category_id,
    feed.invoice_month as month_date,
    feed.amount
  from public.v_card_installment_feed feed
)
select
  bp.id as budget_id,
  bp.user_id,
  bp.category_id,
  fc.code as category_code,
  fc.label as category_label,
  fc.color as category_color,
  bp.month_date,
  bp.limit_amount,
  round(coalesce(sum(re.amount), 0), 2) as spent_amount
from public.budget_plans bp
join public.financial_categories fc on fc.id = bp.category_id
left join reportable_expenses re
  on re.user_id = bp.user_id
 and re.category_id = bp.category_id
 and re.month_date = bp.month_date
group by
  bp.id,
  bp.user_id,
  bp.category_id,
  fc.code,
  fc.label,
  fc.color,
  bp.month_date,
  bp.limit_amount;

alter table public.credit_cards enable row level security;
alter table public.credit_card_charges enable row level security;
alter table public.credit_card_installments enable row level security;

drop policy if exists "credit_cards_all_own" on public.credit_cards;
create policy "credit_cards_all_own"
on public.credit_cards
for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "credit_card_charges_all_own" on public.credit_card_charges;
create policy "credit_card_charges_all_own"
on public.credit_card_charges
for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "credit_card_installments_all_own" on public.credit_card_installments;
create policy "credit_card_installments_all_own"
on public.credit_card_installments
for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

grant execute on function public.compute_card_invoice_month(date, integer) to authenticated;
grant execute on function public.compute_card_due_date(date, integer) to authenticated;
grant execute on function public.record_card_charge(uuid, text, numeric, uuid, date, integer, text) to authenticated;
grant execute on function public.pay_card_invoice(uuid, date, uuid, numeric, text) to authenticated;
