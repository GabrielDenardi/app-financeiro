alter table public.profiles
alter column subscription_plan drop not null;

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_plan text := nullif(coalesce(new.raw_user_meta_data ->> 'subscription_plan', ''), '');
begin
  if selected_plan is not null and selected_plan not in ('basic', 'intermediate', 'pro') then
    selected_plan := null;
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
    subscription_plan = excluded.subscription_plan,
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
