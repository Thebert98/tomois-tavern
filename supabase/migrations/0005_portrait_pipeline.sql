-- Async pipeline progress for portraits.
--
-- `stage` is a fine-grained progress label updated as the mirror's
-- background pipeline moves through painting → sculpting → animating
-- → ready. `status` stays the coarse outcome (pending / ready / failed)
-- so existing UI keeps working.
--
-- Realtime: enable the portraits table on supabase_realtime so the
-- frontend can subscribe to row updates and drive a progress bar
-- without polling.

alter table portraits add column if not exists stage text;

-- Backfill rows that were created before this column existed.
update portraits set stage = 'ready'
  where stage is null and status = 'ready';
update portraits set stage = 'failed'
  where stage is null and status = 'failed';

-- Enable Realtime publication for portraits (idempotent).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'portraits'
  ) then
    alter publication supabase_realtime add table portraits;
  end if;
end $$;
