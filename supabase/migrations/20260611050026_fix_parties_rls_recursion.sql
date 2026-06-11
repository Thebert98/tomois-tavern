-- =============================================================
-- Fix infinite recursion between parties + party_members RLS.
--
-- The original 0001_tavern_init policies cross-referenced each other:
--   parties.select        had EXISTS(party_members WHERE …)
--   party_members.select  had EXISTS(parties        WHERE …)
-- Postgres re-runs RLS during the nested query, so the moment the
-- caller wasn't the party owner, the planner pinged the two policies
-- back and forth indefinitely. PostgREST surfaces this as 42P17
-- (`infinite recursion detected in policy for relation "parties"`)
-- and the workshop's GET /parties + GET /friends (which enumerates
-- friendships and then dereferences user emails through PostgREST RPC)
-- both 500.
--
-- The standard Supabase fix is to push the EXISTS lookups into
-- ``SECURITY DEFINER`` helpers that bypass RLS — that breaks the
-- cycle because the helper does its own privileged query against the
-- table, and the policy that calls the helper never re-enters the
-- recursive policy chain. The helpers are STABLE + scoped to the
-- ``public`` search_path so they can be inlined safely.
-- =============================================================

create or replace function public.is_party_member(_party_id uuid, _user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists(
    select 1 from party_members
    where party_id = _party_id
      and user_id = _user_id
  );
$$;

create or replace function public.is_party_owner(_party_id uuid, _user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists(
    select 1 from parties
    where id = _party_id
      and owner_id = _user_id
  );
$$;

grant execute on function public.is_party_member(uuid, uuid) to authenticated;
grant execute on function public.is_party_owner(uuid, uuid) to authenticated;

-- Replace the four recursive policies.

drop policy if exists parties_member_select on parties;
create policy parties_member_select on parties for select
  using (
    owner_id = auth.uid()
    or public.is_party_member(id, auth.uid())
  );

drop policy if exists party_members_party_select on party_members;
create policy party_members_party_select on party_members for select
  using (
    user_id = auth.uid()
    or public.is_party_owner(party_id, auth.uid())
  );

drop policy if exists party_members_self_or_owner_insert on party_members;
create policy party_members_self_or_owner_insert on party_members for insert
  with check (
    user_id = auth.uid()
    or public.is_party_owner(party_id, auth.uid())
  );

drop policy if exists party_members_self_or_owner_update on party_members;
create policy party_members_self_or_owner_update on party_members for update
  using (
    user_id = auth.uid()
    or public.is_party_owner(party_id, auth.uid())
  );

drop policy if exists party_members_self_or_owner_delete on party_members;
create policy party_members_self_or_owner_delete on party_members for delete
  using (
    user_id = auth.uid()
    or public.is_party_owner(party_id, auth.uid())
  );

-- Nudge PostgREST. Adding helper functions invalidates the cache; this
-- NOTIFY makes the refresh prompt rather than waiting for the next
-- periodic poll (which is what blocked GET /friends from finding
-- lookup_users_by_ids after the previous 0007 push).
notify pgrst, 'reload schema';
