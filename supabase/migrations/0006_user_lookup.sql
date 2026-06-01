-- Friend invites and party rosters need to map between auth.users.id and
-- auth.users.email. PostgREST doesn't expose auth.users by default, and we
-- don't want clients listing every user, so we offer two narrow
-- SECURITY DEFINER functions granted only to authenticated users:
--
--   lookup_user_by_email(email)    → uuid | null
--   lookup_users_by_ids(uuid[])    → setof (id, email)
--
-- Tradeoff: lookup_user_by_email allows email enumeration by an authenticated
-- traveller. That matches Discord/Slack-style "add by email" friend invites
-- and is an acceptable tradeoff for this app's scope. Rate-limiting at the
-- API layer is a future improvement.

create or replace function public.lookup_user_by_email(p_email text)
returns uuid
security definer
set search_path = public, auth
language sql
stable
as $$
  select id from auth.users where lower(email) = lower(p_email) limit 1
$$;

revoke all on function public.lookup_user_by_email(text) from public;
grant execute on function public.lookup_user_by_email(text) to authenticated;

create or replace function public.lookup_users_by_ids(p_ids uuid[])
returns table(id uuid, email text)
security definer
set search_path = public, auth
language sql
stable
as $$
  select id, email from auth.users where id = any(p_ids)
$$;

revoke all on function public.lookup_users_by_ids(uuid[]) from public;
grant execute on function public.lookup_users_by_ids(uuid[]) to authenticated;
