-- =============================================================
-- Harden the parties / party_members RLS so the recursion is
-- *structurally* impossible, not just "logically shouldn't happen."
--
-- Why this is needed even after 20260611050026:
--
--   PostgreSQL's RLS bypass for SECURITY DEFINER only kicks in if the
--   function's owner is a SUPERUSER. On Supabase the migration runner
--   role isn't always a superuser, so a SECURITY DEFINER helper
--   queried from inside a policy can still re-enter the policy chain
--   and trip Postgres's recursion guard.
--
--   The robust fix is two-pronged: (a) force the helper into
--   ``row_security = off`` so RLS is disabled inside the function
--   even without superuser, and (b) split the recursive policy into
--   two non-recursive policies (one per access mode), so neither
--   needs an EXISTS into the other table.
-- =============================================================

-- ---- 1. SECURITY DEFINER helpers, with row_security = off ----------

create or replace function public.is_party_member(_party_id uuid, _user_id uuid)
returns boolean
language plpgsql
security definer
stable
set search_path = public
set row_security = off
as $$
begin
  return exists(
    select 1 from party_members
    where party_id = _party_id
      and user_id = _user_id
  );
end;
$$;

create or replace function public.is_party_owner(_party_id uuid, _user_id uuid)
returns boolean
language plpgsql
security definer
stable
set search_path = public
set row_security = off
as $$
begin
  return exists(
    select 1 from parties
    where id = _party_id
      and owner_id = _user_id
  );
end;
$$;

grant execute on function public.is_party_member(uuid, uuid) to authenticated;
grant execute on function public.is_party_owner(uuid, uuid) to authenticated;


-- ---- 2. Replace the policies with non-recursive per-mode versions --
--
-- Postgres OR's all applicable SELECT policies on a table, so we can
-- decompose "owner OR member" into two policies. Each one checks a
-- single condition that doesn't need to walk the other table.

drop policy if exists parties_member_select on parties;
drop policy if exists parties_owner_select on parties;
drop policy if exists parties_owner_or_member_select on parties;

create policy parties_owner_select on parties for select
  using (owner_id = auth.uid());

create policy parties_member_select on parties for select
  using (public.is_party_member(id, auth.uid()));


drop policy if exists party_members_party_select on party_members;
drop policy if exists party_members_self_select on party_members;
drop policy if exists party_members_owner_select on party_members;

create policy party_members_self_select on party_members for select
  using (user_id = auth.uid());

create policy party_members_owner_select on party_members for select
  using (public.is_party_owner(party_id, auth.uid()));


-- ---- 3. Writes (insert / update / delete) ----
-- Same split: self vs owner, two non-recursive policies each.

drop policy if exists party_members_self_or_owner_insert on party_members;
drop policy if exists party_members_self_insert on party_members;
drop policy if exists party_members_owner_insert on party_members;

create policy party_members_self_insert on party_members for insert
  with check (user_id = auth.uid());

create policy party_members_owner_insert on party_members for insert
  with check (public.is_party_owner(party_id, auth.uid()));


drop policy if exists party_members_self_or_owner_update on party_members;
drop policy if exists party_members_self_update on party_members;
drop policy if exists party_members_owner_update on party_members;

create policy party_members_self_update on party_members for update
  using (user_id = auth.uid());

create policy party_members_owner_update on party_members for update
  using (public.is_party_owner(party_id, auth.uid()));


drop policy if exists party_members_self_or_owner_delete on party_members;
drop policy if exists party_members_self_delete on party_members;
drop policy if exists party_members_owner_delete on party_members;

create policy party_members_self_delete on party_members for delete
  using (user_id = auth.uid());

create policy party_members_owner_delete on party_members for delete
  using (public.is_party_owner(party_id, auth.uid()));


-- ---- 4. Nudge PostgREST again --------------------------------------
notify pgrst, 'reload schema';
