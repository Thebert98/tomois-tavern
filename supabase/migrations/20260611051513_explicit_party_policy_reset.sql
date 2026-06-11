-- The prior DO-block reset apparently didn't take. Replay every drop
-- as an explicit top-level statement and add a couple of names I
-- might've missed. Postgres ignores DROP POLICY IF EXISTS that doesn't
-- match, so this is safe to over-list.

drop policy if exists parties_member_select         on parties;
drop policy if exists parties_owner_select          on parties;
drop policy if exists parties_owner_or_member_select on parties;
drop policy if exists parties_owner_insert          on parties;
drop policy if exists parties_owner_update          on parties;
drop policy if exists parties_owner_delete          on parties;

drop policy if exists party_members_party_select          on party_members;
drop policy if exists party_members_self_select           on party_members;
drop policy if exists party_members_owner_select          on party_members;
drop policy if exists party_members_self_or_owner_insert  on party_members;
drop policy if exists party_members_self_insert           on party_members;
drop policy if exists party_members_owner_insert          on party_members;
drop policy if exists party_members_self_or_owner_update  on party_members;
drop policy if exists party_members_self_update           on party_members;
drop policy if exists party_members_owner_update          on party_members;
drop policy if exists party_members_self_or_owner_delete  on party_members;
drop policy if exists party_members_self_delete           on party_members;
drop policy if exists party_members_owner_delete          on party_members;

-- Bounce RLS so any plan referencing dropped policies is purged.
alter table parties        disable row level security;
alter table party_members  disable row level security;
alter table parties        enable  row level security;
alter table party_members  enable  row level security;

-- ---- Flat, non-recursive policies ----
create policy parties_owner_select on parties for select
  using (owner_id = auth.uid());
create policy parties_owner_insert on parties for insert
  with check (owner_id = auth.uid());
create policy parties_owner_update on parties for update
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy parties_owner_delete on parties for delete
  using (owner_id = auth.uid());

create policy party_members_self_select on party_members for select
  using (user_id = auth.uid());
create policy party_members_self_insert on party_members for insert
  with check (user_id = auth.uid());
create policy party_members_self_update on party_members for update
  using (user_id = auth.uid());
create policy party_members_self_delete on party_members for delete
  using (user_id = auth.uid());

notify pgrst, 'reload schema';
