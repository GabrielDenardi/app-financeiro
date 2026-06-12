-- Trial gratuito de 7 dias do plano Intermediario (opt-in, sem cartao).
-- O plano do usuario NAO muda durante o trial: os entitlements sao calculados
-- no app comparando trial_ends_at com a data atual (expiracao automatica,
-- sem necessidade de job agendado).

-- 1) Colunas de controle do trial
alter table public.profiles
add column if not exists trial_started_at timestamptz,
add column if not exists trial_ends_at timestamptz;

-- 2) RPC para iniciar o trial (uma unica vez por conta)
create or replace function public.start_intermediate_trial()
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile record;
  v_ends_at timestamptz;
begin
  if auth.uid() is null then
    raise exception 'Usuario nao autenticado.';
  end if;

  select subscription_plan, subscription_status, trial_started_at
  into v_profile
  from public.profiles
  where id = auth.uid()
  for update;

  if not found then
    raise exception 'Perfil nao encontrado.';
  end if;

  if v_profile.trial_started_at is not null then
    raise exception 'Voce ja utilizou seu periodo de teste gratuito.';
  end if;

  if v_profile.subscription_status = 'active'
     or v_profile.subscription_plan in ('intermediate', 'pro') then
    raise exception 'Seu plano atual ja inclui esses recursos.';
  end if;

  -- Must stay in sync with TRIAL_DURATION_DAYS = 7 in src/features/plans/plans.ts.
  v_ends_at := now() + interval '7 days';

  update public.profiles
  set
    trial_started_at = now(),
    trial_ends_at = v_ends_at
  where id = auth.uid();

  return v_ends_at;
end;
$$;

revoke all on function public.start_intermediate_trial() from public;
grant execute on function public.start_intermediate_trial() to authenticated;
