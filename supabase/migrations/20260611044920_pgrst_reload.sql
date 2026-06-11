-- Force PostgREST to refresh its schema cache so the
-- set_current_portrait RPC added in 0007 becomes callable through
-- /rest/v1/rpc/. PostgREST listens on the `pgrst` channel; the NOTIFY
-- only takes effect after the next request, which is fine.
notify pgrst, 'reload schema';
