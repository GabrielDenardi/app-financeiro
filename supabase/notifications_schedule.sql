-- Optional deployment step, after the feature migrations and Edge Function.
-- First create two Vault secrets through the Supabase dashboard:
-- notification_worker_url: https://<project>.supabase.co/functions/v1/deliver-notifications
-- notification_worker_secret: same value as the Edge Function NOTIFICATION_WORKER_SECRET.
-- No credentials belong in this file.
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

select cron.schedule('deliver-financial-notifications', '* * * * *', $job$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'notification_worker_url'),
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization',
      'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'notification_worker_secret')),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
$job$);
