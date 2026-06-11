-- =============================================================
-- Brute-force reset of parties + party_members RLS. Two earlier
-- migrations (50026, 50610, 50754) tried to flatten the recursive
-- policy. The flat policies are in pg_policy now, but Postgres is
-- still raising 42P17 on SELECTs against ``parties`` — almost
-- certainly because the planner is holding a cached plan from an
-- earlier prepared statement that referenced the recursive shape.
--
-- The reliable way to invalidate every cached plan that touches a
-- table's policies is to DISABLE then RE-ENABLE row-level security.
-- We also drop EVERY policy by querying pg_policy, so any leftover
-- policy from an older migration we didn't account for is wiped.
-- Then we recreate the flat, non-recursive set.
-- =============================================================

-- Drop every existing policy on parties + party_members by enumerating
-- pg_policy. Postgres makes the policy names visible there.
do $$
declare
  rec record;
begin
  for rec in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('parties', 'party_members')
  loop
    execute format(
      'drop policy if exists %I on %I.%I',
      rec.policyname, rec.schemaname, rec.tablename
    );
  end loop;
end;
$$;

-- Bounce RLS to invalidate cached plans referencing the old policies.
alter table parties        disable row level security;
alter table party_members  disable row level security;
alter table parties        enable  row level security;
alter table party_members  enable  row level security;

-- ---- Recreate the flat, non-recursive policies ----

-- parties: owner sees own. Member-of-but-not-owner case is handled
-- in app code via the user's own party_members rows + a service-client
-- targeted read.
create policy parties_owner_select on parties for select
  using (owner_id = auth.uid());

create policy parties_owner_insert on parties for insert
  with check (owner_id = auth.uid());

create policy parties_owner_update on parties for update
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy parties_owner_delete on parties for delete
  using (owner_id = auth.uid());

-- party_members: each user sees / writes their own row. Owner-sees-all
-- is reached via the API doing a service-client read after confirming
-- ownership.
create policy party_members_self_select on party_members for select
  using (user_id = auth.uid());

create policy party_members_self_insert on party_members for insert
  with check (user_id = auth.uid());

create policy party_members_self_update on party_members for update
  using (user_id = auth.uid());

create policy party_members_self_delete on party_members for delete
  using (user_id = auth.uid());

notify pgrst, 'reload schema';
