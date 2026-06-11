do $$
declare r record;
begin
  raise warning 'DIAG4: policies on parties:';
  for r in
    select polname,
           case polcmd when 'r' then 'SELECT' when 'a' then 'INSERT' when 'w' then 'UPDATE' when 'd' then 'DELETE' when '*' then 'ALL' else polcmd::text end as cmd,
           pg_get_expr(polqual, polrelid) as qual,
           pg_get_expr(polwithcheck, polrelid) as with_check
    from pg_policy where polrelid = 'public.parties'::regclass
  loop
    raise warning '  parties · % [%]  USING=%  CHECK=%', r.polname, r.cmd,
      coalesce(r.qual, 'n/a'), coalesce(r.with_check, 'n/a');
  end loop;

  raise warning 'DIAG4: policies on party_members:';
  for r in
    select polname,
           case polcmd when 'r' then 'SELECT' when 'a' then 'INSERT' when 'w' then 'UPDATE' when 'd' then 'DELETE' when '*' then 'ALL' else polcmd::text end as cmd,
           pg_get_expr(polqual, polrelid) as qual,
           pg_get_expr(polwithcheck, polrelid) as with_check
    from pg_policy where polrelid = 'public.party_members'::regclass
  loop
    raise warning '  party_members · % [%]  USING=%  CHECK=%', r.polname, r.cmd,
      coalesce(r.qual, 'n/a'), coalesce(r.with_check, 'n/a');
  end loop;
end$$;
