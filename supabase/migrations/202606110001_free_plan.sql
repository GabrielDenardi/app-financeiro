-- Plano Free: passa a ser o plano padrao de novos cadastros (sem checkout).

-- 1) Permite 'free' na constraint de planos
alter table public.profiles
drop constraint if exists profiles_subscription_plan_check;

alter table public.profiles
add constraint profiles_subscription_plan_check
check (subscription_plan in ('free', 'basic', 'intermediate', 'pro'));

-- 2) Usuarios sem plano definido passam a ser Free
update public.profiles
set subscription_plan = 'free'
where subscription_plan is null;

alter table public.profiles
alter column subscription_plan set default 'free';

-- 3) Novos cadastros recebem o plano Free quando nenhum plano valido for informado
create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_plan text := nullif(coalesce(new.raw_user_meta_data ->> 'subscription_plan', ''), '');
begin
  if selected_plan is null or selected_plan not in ('free', 'basic', 'intermediate', 'pro') then
    selected_plan := 'free';
  end if;

  insert into public.profiles (
    id,
    cpf,
    email,
    subscription_plan,
    full_name,
    phone,
    birth_date,
    birth_country,
    mother_name,
    cep,
    street,
    address_number,
    complement,
    city,
    state
  )
  values (
    new.id,
    regexp_replace(coalesce(new.raw_user_meta_data ->> 'cpf', ''), '\D', '', 'g'),
    lower(coalesce(new.email, '')),
    selected_plan,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    regexp_replace(coalesce(new.raw_user_meta_data ->> 'phone', ''), '\D', '', 'g'),
    case
      when coalesce(new.raw_user_meta_data ->> 'birth_date', '') ~ '^\d{2}/\d{2}/\d{4}$'
        then to_date(new.raw_user_meta_data ->> 'birth_date', 'DD/MM/YYYY')
      else null
    end,
    coalesce(new.raw_user_meta_data ->> 'birth_country', 'Brasil'),
    coalesce(new.raw_user_meta_data ->> 'mother_name', ''),
    regexp_replace(coalesce(new.raw_user_meta_data ->> 'cep', ''), '\D', '', 'g'),
    coalesce(new.raw_user_meta_data ->> 'street', ''),
    regexp_replace(coalesce(new.raw_user_meta_data ->> 'address_number', ''), '\D', '', 'g'),
    coalesce(new.raw_user_meta_data ->> 'complement', ''),
    coalesce(new.raw_user_meta_data ->> 'city', ''),
    upper(coalesce(new.raw_user_meta_data ->> 'state', ''))
  )
  on conflict (id) do update
  set
    cpf = excluded.cpf,
    email = excluded.email,
    -- Nunca rebaixa um plano ja existente: o 'free' so entra quando o perfil
    -- ainda nao tem plano definido (planos pagos sao escritos pelo webhook).
    subscription_plan = coalesce(profiles.subscription_plan, excluded.subscription_plan),
    full_name = excluded.full_name,
    phone = excluded.phone,
    birth_date = excluded.birth_date,
    birth_country = excluded.birth_country,
    mother_name = excluded.mother_name,
    cep = excluded.cep,
    street = excluded.street,
    address_number = excluded.address_number,
    complement = excluded.complement,
    city = excluded.city,
    state = excluded.state,
    updated_at = now();

  return new;
end;
$$;

-- 4) RPC para o usuario voltar/entrar no plano Free sem passar pelo checkout
create or replace function public.select_free_plan()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
begin
  if auth.uid() is null then
    raise exception 'Usuario nao autenticado.';
  end if;

  select subscription_status
  into v_status
  from public.profiles
  where id = auth.uid()
  for update;

  if not found then
    raise exception 'Perfil nao encontrado.';
  end if;

  -- Bloqueia o downgrade enquanto houver assinatura ativa no AbacatePay:
  -- o cancelamento deve acontecer primeiro, senao o plano local fica
  -- inconsistente com a cobranca recorrente.
  if v_status = 'active' then
    raise exception 'Voce possui uma assinatura ativa. Cancele a assinatura antes de mudar para o plano Free.';
  end if;

  update public.profiles
  set
    subscription_plan = 'free',
    subscription_status = 'inactive'
  where id = auth.uid();
end;
$$;

revoke all on function public.select_free_plan() from public;
grant execute on function public.select_free_plan() to authenticated;
