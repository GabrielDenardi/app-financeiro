alter table public.profiles
add column if not exists subscription_plan text not null default 'basic';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_subscription_plan_check'
  ) then
    alter table public.profiles
    add constraint profiles_subscription_plan_check
    check (subscription_plan in ('basic', 'intermediate', 'pro'));
  end if;
end;
$$;
