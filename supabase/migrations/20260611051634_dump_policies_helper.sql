-- Diagnostic: a SECURITY DEFINER function that returns every policy
-- on the given table so we can inspect what's actually live. Will be
-- dropped in the next migration once we know.

create or replace function public._debug_policies(_tablename text)
returns table(
  policyname text,
  cmd text,
  permissive text,
  roles text[],
  qual text,
  with_check text
)
language sql
security definer
stable
set search_path = pg_catalog, public
as $$
  select
    polname::text       as policyname,
    case polcmd
      when 'r' then 'SELECT' when 'a' then 'INSERT'
      when 'w' then 'UPDATE' when 'd' then 'DELETE'
      when '*' then 'ALL' else polcmd::text end as cmd,
    case when polpermissive then 'PERMISSIVE' else 'RESTRICTIVE' end as permissive,
    (select array_agg(rolname::text) from pg_roles where oid = any(polroles)) as roles,
    pg_get_expr(polqual, polrelid)::text       as qual,
    pg_get_expr(polwithcheck, polrelid)::text  as with_check
  from pg_policy
  where polrelid = ('public.' || _tablename)::regclass
  order by polname;
$$;

grant execute on function public._debug_policies(text) to authenticated, service_role;

notify pgrst, 'reload schema';
