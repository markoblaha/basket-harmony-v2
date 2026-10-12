-- Každých 5 minút označ vypršané nákupy ako EXPIRED, aby sa to hneď
-- prejavilo vo všetkých otvorených aplikáciách.
create extension if not exists pg_cron with schema pg_catalog;
grant usage on schema cron to postgres;
select cron.schedule('expire-stale-shopping-sessions', '*/5 * * * *',
                     $$select public.expire_stale_sessions()$$);
