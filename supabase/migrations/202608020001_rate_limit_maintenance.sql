-- Manutencao dos contadores de rate limit + quota de exportacao.
--
-- 1. private.security_rate_limits nunca era limpa: cada (subject, feature, window)
--    ficava na tabela para sempre. A limpeza acontece nas proprias funcoes que
--    escrevem os contadores, sem depender de pg_cron.
-- 2. export-user-data so checava entitlement; agora tem quota por hora.
-- 3. Um login por CPF bem-sucedido zera o contador de tentativas, para que acessos
--    legitimos nao consumam o orcamento compartilhado com a recuperacao de senha.

create index if not exists security_rate_limits_window_idx
  on private.security_rate_limits (window_started_at);

-- Remove contadores de quem nunca mais voltou. E amostrada a partir do caminho de
-- escrita em vez de agendada, e desiste na hora se outra transacao ja estiver
-- varrendo, para nunca somar latencia a uma requisicao.
create or replace function private.sweep_rate_limits()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not pg_catalog.pg_try_advisory_xact_lock(471110) then
    return;
  end if;

  delete from private.security_rate_limits
  where window_started_at < now() - interval '1 day';
end;
$$;

revoke all on function private.sweep_rate_limits() from public, anon, authenticated;

-- Descarta as janelas que o proprio subject ja fechou, mantendo no maximo uma
-- linha viva por (subject, feature).
create or replace function private.prune_rate_limit(
  p_subject_key text,
  p_feature text,
  p_current_window timestamptz
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from private.security_rate_limits
  where subject_key = p_subject_key
    and feature = p_feature
    and window_started_at < p_current_window;

  if random() < 0.01 then
    perform private.sweep_rate_limits();
  end if;
end;
$$;

revoke all on function private.prune_rate_limit(text, text, timestamptz) from public, anon, authenticated;

-- Acrescenta a quota 'export' e a limpeza da janela anterior.
create or replace function public.consume_edge_quota(p_feature text, p_units bigint default 1)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  request_limit integer;
  unit_limit bigint;
  current_window timestamptz := date_trunc('hour', now());
  accepted boolean := false;
begin
  if current_user_id is null then
    raise exception 'Usuario nao autenticado.';
  end if;

  case p_feature
    when 'ocr' then
      request_limit := 30;
      unit_limit := 240 * 1024 * 1024;
    when 'voice' then
      request_limit := 20;
      unit_limit := 200 * 1024 * 1024;
    when 'export' then
      request_limit := 3;
      unit_limit := 3;
    else
      raise exception 'Quota desconhecida.';
  end case;

  if p_units < 1 or p_units > 15 * 1024 * 1024 then
    raise exception 'Unidade de quota invalida.';
  end if;

  insert into private.security_rate_limits (
    subject_key,
    feature,
    window_started_at,
    request_count,
    unit_count
  )
  values (current_user_id::text, p_feature, current_window, 1, p_units)
  on conflict (subject_key, feature, window_started_at) do update
  set request_count = private.security_rate_limits.request_count + 1,
      unit_count = private.security_rate_limits.unit_count + excluded.unit_count
  where private.security_rate_limits.request_count < request_limit
    and private.security_rate_limits.unit_count + excluded.unit_count <= unit_limit
  returning true into accepted;

  if not coalesce(accepted, false) then
    raise exception 'Limite de uso temporario atingido.' using errcode = 'P0001';
  end if;

  perform private.prune_rate_limit(current_user_id::text, p_feature, current_window);

  return true;
end;
$$;

revoke all on function public.consume_edge_quota(text, bigint) from public, anon;
grant execute on function public.consume_edge_quota(text, bigint) to authenticated;

-- Acrescenta a limpeza da janela anterior.
create or replace function public.consume_auth_rate_limit(p_key text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_window timestamptz := to_timestamp(floor(extract(epoch from now()) / 900) * 900);
  accepted boolean := false;
begin
  if length(coalesce(p_key, '')) < 16 or length(p_key) > 160 then
    raise exception 'Chave de limite invalida.';
  end if;

  insert into private.security_rate_limits (
    subject_key,
    feature,
    window_started_at,
    request_count,
    unit_count
  )
  values (p_key, 'cpf_auth', current_window, 1, 1)
  on conflict (subject_key, feature, window_started_at) do update
  set request_count = private.security_rate_limits.request_count + 1,
      unit_count = private.security_rate_limits.unit_count + 1
  where private.security_rate_limits.request_count < 5
  returning true into accepted;

  if coalesce(accepted, false) then
    perform private.prune_rate_limit(p_key, 'cpf_auth', current_window);
  end if;

  return coalesce(accepted, false);
end;
$$;

revoke all on function public.consume_auth_rate_limit(text) from public, anon, authenticated;
grant execute on function public.consume_auth_rate_limit(text) to service_role;

-- Chamada apenas depois de uma autenticacao bem-sucedida para o mesmo CPF, entao
-- nao ha como zerar o contador sem apresentar credenciais validas.
create or replace function public.reset_auth_rate_limit(p_key text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if length(coalesce(p_key, '')) < 16 or length(p_key) > 160 then
    raise exception 'Chave de limite invalida.';
  end if;

  delete from private.security_rate_limits
  where subject_key = p_key
    and feature = 'cpf_auth';
end;
$$;

revoke all on function public.reset_auth_rate_limit(text) from public, anon, authenticated;
grant execute on function public.reset_auth_rate_limit(text) to service_role;
