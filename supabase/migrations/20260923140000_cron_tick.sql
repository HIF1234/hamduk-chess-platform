-- Free scheduler: pg_cron calls the app's /api/cron/tick endpoint every minute to
-- start due tournaments, pair arenas, flag expired correspondence games and retry
-- webhooks. The URL and bearer secret are read from Vault (set outside migrations:
-- secrets 'cron_tick_url' and 'cron_secret'); the job is a no-op until both exist.
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.schedule(
  'platform-tick',
  '* * * * *',
  $job$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_tick_url'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 55000
  )
  WHERE EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name = 'cron_secret')
    AND EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name = 'cron_tick_url');
  $job$
);
