-- Profiles for CPF-first onboarding flow
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  cpf text not null unique,
  email text not null unique,
  full_name text not null default '',
  phone text not null default '',
  birth_date date,
  birth_country text not null default 'Brasil',
  mother_name text not null default '',
  cep text not null default '',
  street text not null default '',
  address_number text not null default '',
  complement text not null default '',
  city text not null default '',
  state text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_cpf_digits check (cpf ~ '^[0-9]{11}$'),
  constraint profiles_phone_digits check (phone = '' or phone ~ '^[0-9]{10,11}$'),
  constraint profiles_cep_digits check (cep = '' or cep ~ '^[0-9]{8}$'),
  constraint profiles_address_number_digits check (address_number = '' or address_number ~ '^[0-9]{1,6}$'),
  constraint profiles_state_uf check (state = '' or state ~ '^[A-Z]{2}$')
);

create index if not exists profiles_email_idx on public.profiles (email);
create index if not exists profiles_cpf_idx on public.profiles (cpf);

create or replace function public.set_profiles_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
before update on public.profiles
for each row
execute function public.set_profiles_updated_at();

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id,
    cpf,
    email,
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

drop trigger if exists on_auth_user_profile_created on auth.users;
create trigger on_auth_user_profile_created
after insert on auth.users
for each row
execute function public.handle_new_user_profile();

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles
for select
to authenticated
using (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

create or replace function public.lookup_account_by_cpf(p_cpf text)
returns table (
  account_exists boolean,
  email text,
  email_masked text,
  email_confirmed boolean
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  normalized_cpf text := regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g');
  found_email text;
  confirmed boolean := false;
  local_part text;
  domain_part text;
  masked text;
begin
  select au.email, (au.email_confirmed_at is not null)
  into found_email, confirmed
  from public.profiles p
  join auth.users au on au.id = p.id
  where p.cpf = normalized_cpf
  limit 1;

  if found_email is null then
    return query select false, null::text, null::text, false;
    return;
  end if;

  local_part := split_part(found_email, '@', 1);
  domain_part := split_part(found_email, '@', 2);
  masked := case
    when length(local_part) <= 1 then local_part || '***@' || domain_part
    when length(local_part) = 2 then left(local_part, 1) || '***@' || domain_part
    else left(local_part, 2) || '***' || right(local_part, 1) || '@' || domain_part
  end;

  return query
  select true, found_email, masked, confirmed;
end;
$$;

grant execute on function public.lookup_account_by_cpf(text) to anon;
grant execute on function public.lookup_account_by_cpf(text) to authenticated;
