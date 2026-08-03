begin;

-- Simulate the Data API grants used by the linked project; RLS/triggers remain authoritative.
grant select, update on public.profiles to authenticated;
grant select, insert, update on public.personal_accounts to authenticated;
grant select, insert, update on public.import_batches to authenticated;
grant select, insert, update on public.import_batch_rows to authenticated;
grant select, insert, update on public.support_conversations to authenticated;
grant select, insert, update on public.support_messages to authenticated;
grant select on public.groups, public.group_members to authenticated;

insert into auth.users (id, email, raw_user_meta_data)
values
  (
    '11111111-1111-4111-8111-111111111111',
    'one@example.test',
    '{"cpf":"11144477735","full_name":"User One"}'::jsonb
  ),
  (
    '22222222-2222-4222-8222-222222222222',
    'two@example.test',
    '{"cpf":"52998224725","full_name":"User Two","subscription_plan":"pro"}'::jsonb
  );

do $$
begin
  if (select subscription_plan from public.profiles where id = '22222222-2222-4222-8222-222222222222') <> 'free' then
    raise exception 'SEC-BILL-SIGNUP-PLAN-014 reproduced';
  end if;
end;
$$;

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","aal":"aal1"}',
  true
);

do $$
begin
  begin
    update public.profiles set subscription_plan = 'pro' where id = auth.uid();
    raise exception 'SEC-BILL-MASSASSIGN-013 reproduced';
  exception when insufficient_privilege then null;
  end;

  begin
    insert into public.personal_accounts (user_id, name) values (auth.uid(), 'Second account');
    raise exception 'SEC-PLAN-ACCOUNT-LIMIT-031 reproduced';
  exception when insufficient_privilege then null;
  end;

  begin
    insert into public.import_batches (user_id, file_name, file_type)
    values (auth.uid(), 'attack.xlsx', 'xlsx');
    raise exception 'SEC-IMPORT-ENTITLEMENT-010 reproduced';
  exception when insufficient_privilege then null;
  end;

  begin
    insert into public.support_conversations (user_id, title)
    values (auth.uid(), 'Bypass');
    raise exception 'SEC-PLAN-SUPPORT-CHAT-032 reproduced';
  exception when insufficient_privilege then null;
  end;

  begin
    perform public.lookup_account_by_cpf('52998224725');
    raise exception 'SEC-CPF-ENUM-018 reproduced';
  exception when insufficient_privilege then null;
  end;

  begin
    perform public.ensure_default_personal_account('22222222-2222-4222-8222-222222222222');
    raise exception 'SEC-RPC-DEFAULT-ACCOUNT-022 reproduced';
  exception when insufficient_privilege then null;
  end;
end;
$$;

reset role;
select set_config('request.jwt.claims', '{}', true);
update public.profiles
set subscription_plan = 'pro', subscription_status = 'active'
where id = '11111111-1111-4111-8111-111111111111';

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","aal":"aal1"}',
  true
);

do $$
declare
  created_group uuid;
  conversation_id uuid;
  message_id uuid;
  actual_role text;
  affected_rows integer;
begin
  created_group := public.create_group('Secure group', 'test');
  perform set_config('test.created_group_id', created_group::text, true);
  perform set_config('test.old_group_code', (select share_code from public.groups where id = created_group), true);

  insert into public.support_conversations (user_id, title)
  values (auth.uid(), 'Secure support') returning id into conversation_id;
  insert into public.support_messages (conversation_id, sender_user_id, sender_role, body)
  values (
    conversation_id,
    '22222222-2222-4222-8222-222222222222',
    'system',
    'hello'
  )
  returning id, sender_role into message_id, actual_role;
  if actual_role <> 'user' then raise exception 'SEC-SUPPORT-SENDER-FORGE-006 reproduced'; end if;

  update public.support_messages set body = 'tampered' where id = message_id;
  get diagnostics affected_rows = row_count;
  if affected_rows <> 0 then raise exception 'SEC-SUPPORT-MESSAGE-TAMPER-007 reproduced'; end if;
end;
$$;

reset role;
do $$
begin
  if length((select share_code from public.groups where id = current_setting('test.created_group_id')::uuid)) <> 16 then
    raise exception 'SEC-GROUP-CODE-020 reproduced';
  end if;
end;
$$;

insert into public.group_members (group_id, user_id, role)
values (
  current_setting('test.created_group_id')::uuid,
  '22222222-2222-4222-8222-222222222222',
  'member'
);
update public.group_members
set removed_at = now()
where group_id = current_setting('test.created_group_id')::uuid
  and user_id = '22222222-2222-4222-8222-222222222222';

do $$
begin
  if (select share_code from public.groups where id = current_setting('test.created_group_id')::uuid)
     = current_setting('test.old_group_code') then
    raise exception 'SEC-GROUP-REJOIN-019 code was not rotated';
  end if;
end;
$$;

select set_config(
  'request.jwt.claims',
  '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated","aal":"aal1"}',
  true
);
set local role authenticated;
do $$
begin
  begin
    perform public.join_group_by_code(current_setting('test.old_group_code'));
    raise exception 'SEC-GROUP-REJOIN-019 reproduced';
  exception
    when others then
      if sqlerrm not like '%Codigo de grupo invalido%' then raise; end if;
  end;
end;
$$;

reset role;
select set_config('request.jwt.claims', '{}', true);
insert into public.import_batches (id, user_id, file_name, file_type)
values (
  '44444444-4444-4444-8444-444444444444',
  '22222222-2222-4222-8222-222222222222',
  'other.xlsx',
  'xlsx'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","aal":"aal1"}',
  true
);
do $$
begin
  begin
    insert into public.import_batch_rows (batch_id, user_id, row_index, fingerprint)
    values ('44444444-4444-4444-8444-444444444444', auth.uid(), 1, 'cross-batch');
    raise exception 'SEC-IMPORT-CROSSBATCH-026 reproduced';
  exception when insufficient_privilege then null;
  end;
end;
$$;

reset role;
insert into auth.mfa_factors (
  id, user_id, factor_type, status, created_at, updated_at, secret
) values (
  '33333333-3333-4333-8333-333333333333',
  '11111111-1111-4111-8111-111111111111',
  'totp', 'verified', now(), now(), 'TESTSECRET'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","aal":"aal1"}',
  true
);

do $$
begin
  if (select count(*) from public.profiles where id = auth.uid()) <> 0 then
    raise exception 'SEC-MFA-NOT-ENFORCED-009 reproduced at aal1';
  end if;
end;
$$;

select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","aal":"aal2"}',
  true
);

do $$
begin
  if (select count(*) from public.profiles where id = auth.uid()) <> 1 then
    raise exception 'Legitimate aal2 profile access failed';
  end if;
  if (select count(*) from public.profiles where id = '22222222-2222-4222-8222-222222222222') <> 0 then
    raise exception 'SEC-GROUP-PII-021 reproduced';
  end if;
end;
$$;

-- A checkout reservation must be provider-idempotent, serialized per user, and
-- reusable only after the provisioning transition completes.
reset role;
select set_config('request.jwt.claims', '{}', true);
update public.profiles
set subscription_status = 'inactive', subscription_plan = 'free'
where id = '11111111-1111-4111-8111-111111111111';
delete from public.billing_checkout_sessions
where user_id = '11111111-1111-4111-8111-111111111111';
delete from private.security_rate_limits
where subject_key = '11111111-1111-4111-8111-111111111111'
  and feature = 'billing_checkout';

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","aal":"aal2"}',
  true
);

do $$
declare
  reservation record;
begin
  select * into reservation from public.reserve_billing_checkout('basic');

  if not reservation.should_create then
    raise exception 'SEC-BILL-CHECKOUT-QUOTA-033 failed to create the first reservation';
  end if;
  if reservation.external_id <> 'sub_' || replace(reservation.session_id::text, '-', '') then
    raise exception 'SEC-BILL-CHECKOUT-QUOTA-033 did not use a stable idempotency key';
  end if;

  perform set_config('test.billing_session_id', reservation.session_id::text, true);

  begin
    perform public.reserve_billing_checkout('basic');
    raise exception 'SEC-BILL-CHECKOUT-QUOTA-033 allowed concurrent provider creation';
  exception
    when others then
      if sqlerrm not like '%Checkout em preparacao%' then raise; end if;
  end;
end;
$$;

reset role;
select set_config('request.jwt.claims', '{}', true);
do $$
begin
  begin
    update public.billing_checkout_sessions
    set status = 'active'
    where id = current_setting('test.billing_session_id')::uuid;
    raise exception 'SEC-BILL-CHECKOUT-QUOTA-033 allowed an invalid state transition';
  exception when insufficient_privilege then null;
  end;

  update public.billing_checkout_sessions
  set status = 'pending', checkout_url = 'https://checkout.example.test/reuse'
  where id = current_setting('test.billing_session_id')::uuid;
end;
$$;

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","aal":"aal2"}',
  true
);
do $$
declare
  reservation record;
begin
  select * into reservation from public.reserve_billing_checkout('basic');
  if reservation.should_create or reservation.checkout_url <> 'https://checkout.example.test/reuse' then
    raise exception 'SEC-BILL-CHECKOUT-QUOTA-033 failed to reuse a pending checkout';
  end if;
end;
$$;

reset role;
select set_config('request.jwt.claims', '{}', true);
update public.billing_checkout_sessions
set status = 'failed'
where id = current_setting('test.billing_session_id')::uuid;
update public.profiles
set subscription_status = 'inactive'
where id = '11111111-1111-4111-8111-111111111111';
insert into private.security_rate_limits (
  subject_key, feature, window_started_at, request_count, unit_count
)
values (
  '11111111-1111-4111-8111-111111111111',
  'billing_checkout',
  date_trunc('hour', now()),
  5,
  5
)
on conflict (subject_key, feature, window_started_at) do update
set request_count = 5, unit_count = 5;

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","aal":"aal2"}',
  true
);
do $$
begin
  begin
    perform public.reserve_billing_checkout('basic');
    raise exception 'SEC-BILL-CHECKOUT-QUOTA-033 allowed an over-quota checkout';
  exception
    when others then
      if sqlerrm not like '%Limite de checkouts%' then raise; end if;
  end;
end;
$$;

reset role;
select set_config('request.jwt.claims', '{}', true);
delete from private.security_rate_limits
where subject_key = '11111111-1111-4111-8111-111111111111'
  and feature = 'billing_checkout';
update public.profiles
set subscription_status = 'active', subscription_plan = 'basic'
where id = '11111111-1111-4111-8111-111111111111';

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","aal":"aal2"}',
  true
);
do $$
begin
  begin
    perform public.reserve_billing_checkout('pro');
    raise exception 'SEC-BILL-CHECKOUT-QUOTA-033 allowed checkout with an active subscription';
  exception
    when others then
      if sqlerrm not like '%assinatura ativa%' then raise; end if;
  end;
end;
$$;

-- A exportacao de dados precisa ter teto por hora, e cada consumo deve descartar as
-- janelas ja fechadas do mesmo subject em vez de acumular linhas para sempre.
reset role;
select set_config('request.jwt.claims', '{}', true);
delete from private.security_rate_limits
where subject_key = '11111111-1111-4111-8111-111111111111'
  and feature = 'export';
insert into private.security_rate_limits (
  subject_key, feature, window_started_at, request_count, unit_count
)
values (
  '11111111-1111-4111-8111-111111111111',
  'export',
  date_trunc('hour', now()) - interval '3 hours',
  3,
  3
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","aal":"aal2"}',
  true
);
do $$
declare
  live_rows integer;
begin
  perform public.consume_edge_quota('export', 1);

  select count(*) into live_rows
  from private.security_rate_limits
  where subject_key = '11111111-1111-4111-8111-111111111111'
    and feature = 'export';

  if live_rows <> 1 then
    raise exception 'SEC-RATE-LIMIT-PRUNE-034 kept % stale counter rows', live_rows - 1;
  end if;

  perform public.consume_edge_quota('export', 1);
  perform public.consume_edge_quota('export', 1);

  begin
    perform public.consume_edge_quota('export', 1);
    raise exception 'SEC-EXPORT-QUOTA-035 allowed an unbounded export';
  exception
    when others then
      if sqlerrm not like '%Limite de uso temporario%' then raise; end if;
  end;
end;
$$;

-- Uma autenticacao por CPF bem-sucedida devolve o orcamento de tentativas ao dono
-- da conta; tentativas invalidas continuam somando ate o bloqueio.
reset role;
select set_config('request.jwt.claims', '{}', true);
do $$
declare
  rate_key text := repeat('a1b2c3d4', 8);
begin
  delete from private.security_rate_limits where subject_key = rate_key;

  for i in 1..5 loop
    if not public.consume_auth_rate_limit(rate_key) then
      raise exception 'SEC-AUTH-RATE-RESET-036 blocked attempt % of 5', i;
    end if;
  end loop;

  if public.consume_auth_rate_limit(rate_key) then
    raise exception 'SEC-AUTH-RATE-RESET-036 allowed a sixth attempt';
  end if;

  perform public.reset_auth_rate_limit(rate_key);

  if not public.consume_auth_rate_limit(rate_key) then
    raise exception 'SEC-AUTH-RATE-RESET-036 kept a valid sign-in locked out';
  end if;

  delete from private.security_rate_limits where subject_key = rate_key;
end;
$$;

rollback;
