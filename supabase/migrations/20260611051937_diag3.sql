do $$
declare r record;
begin
  raise warning 'DIAG3: enumerating policies on parties + party_members';
  for r in
    select polrelid::regclass::text as tbl,
           polname,
           case polcmd when 'r' then 'SELECT' when 'a' then 'INSERT' when 'w' then 'UPDATE' when 'd' then 'DELETE' when '*' then 'ALL' else polcmd::text end as cmd,
           pg_get_expr(polqual, polrelid) as qual,
           pg_get_expr(polwithcheck, polrelid) as with_check
    from pg_policy
    where polrelid in ('public.parties'::regclass, 'public.party_members'::regclass)
    order by polrelid::regclass::text, polname
  loop
    raise warning 'POL % | % | [%] | USING=% | CHECK=%',
      r.tbl, r.polname, r.cmd, coalesce(r.qual, '(none)'), coalesce(r.with_check, '(none)');
  end loop;
end$$;
