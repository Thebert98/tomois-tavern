-- =============================================================
-- Flatten the parties / party_members RLS so neither policy walks
-- the other table. The SECURITY DEFINER helpers from the two prior
-- attempts didn't actually bypass RLS on this project (Supabase's
-- migration runner role isn't a superuser, so `SET row_security = off`
-- inside the function is silently ignored — Postgres still re-enters
-- the cross-table policy chain and 42P17s).
--
-- The fix: each policy checks ONE column on ITS OWN row. The
-- "owner sees all members in their party" and "member sees their
-- own parties" semantics move into the API layer (see the matching
-- parties.py refactor) where service-role queries can do the
-- cross-table fetch safely.
--
-- This trades a tiny bit of SQL-pure elegance for a structure
-- Postgres physically cannot recurse through.
-- =============================================================

-- ---- parties ----
drop policy if exists parties_member_select on parties;
drop policy if exists parties_owner_select on parties;
drop policy if exists parties_owner_or_member_select on parties;

create policy parties_owner_select on parties for select
  using (owner_id = auth.uid());

-- ---- party_members ----
drop policy if exists party_members_party_select on party_members;
drop policy if exists party_members_self_select on party_members;
drop policy if exists party_members_owner_select on party_members;

create policy party_members_self_select on party_members for select
  using (user_id = auth.uid());

drop policy if exists party_members_self_or_owner_insert on party_members;
drop policy if exists party_members_self_insert on party_members;
drop policy if exists party_members_owner_insert on party_members;

create policy party_members_self_insert on party_members for insert
  with check (user_id = auth.uid());

drop policy if exists party_members_self_or_owner_update on party_members;
drop policy if exists party_members_self_update on party_members;
drop policy if exists party_members_owner_update on party_members;

create policy party_members_self_update on party_members for update
  using (user_id = auth.uid());

drop policy if exists party_members_self_or_owner_delete on party_members;
drop policy if exists party_members_self_delete on party_members;
drop policy if exists party_members_owner_delete on party_members;

create policy party_members_self_delete on party_members for delete
  using (user_id = auth.uid());

-- The helpers stay (they're harmless and the bard/portrait route
-- might want them later), but no policy depends on them.

notify pgrst, 'reload schema';
