-- Tomoi's Tavern — additive schema. Shares the ReRoll Supabase project; the
-- characters / character_versions / generation_runs / documents / document_chunks
-- tables already exist from the ReRoll migrations.
--
-- Order: (1) all tables, (2) enable RLS on each, (3) all policies. Policies on
-- one table sometimes reference another via EXISTS — they must come last so
-- every referenced relation already exists.

-- =============================================================
-- TABLES
-- =============================================================

-- Magic Mirror — portraits
create table if not exists portraits (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  character_id uuid references characters(id) on delete set null,
  image_url    text,
  prompt       text not null,
  model        text not null,
  status       text not null default 'pending'
               check (status in ('pending','ready','failed')),
  cost_usd     numeric,
  created_at   timestamptz not null default now()
);
create index if not exists portraits_user_id_idx on portraits(user_id);
create index if not exists portraits_character_id_idx on portraits(character_id);

-- Friends
create table if not exists friendships (
  requester_id uuid not null references auth.users(id) on delete cascade,
  addressee_id uuid not null references auth.users(id) on delete cascade,
  status       text not null default 'pending'
               check (status in ('pending','accepted','blocked')),
  created_at   timestamptz not null default now(),
  primary key (requester_id, addressee_id),
  check (requester_id <> addressee_id)
);
create index if not exists friendships_addressee_idx on friendships(addressee_id);

-- Parties
create table if not exists parties (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references auth.users(id) on delete cascade,
  name       text not null,
  created_at timestamptz not null default now()
);
create index if not exists parties_owner_idx on parties(owner_id);

create table if not exists party_members (
  party_id     uuid not null references parties(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  character_id uuid references characters(id) on delete set null,
  role         text,
  joined_at    timestamptz not null default now(),
  primary key (party_id, user_id)
);
create index if not exists party_members_user_idx on party_members(user_id);

-- World lore
create table if not exists world_lore (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  title      text not null,
  body       text not null,
  created_at timestamptz not null default now()
);
create index if not exists world_lore_user_idx on world_lore(user_id);

-- Tavern Bard — songs
create table if not exists bard_songs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  scope       text not null check (scope in ('feat','party','lore')),
  source_id   uuid,
  prompt      text not null,
  lyrics      text,
  audio_url   text,
  model       text not null,
  duration_s  int,
  status      text not null default 'pending'
              check (status in ('pending','ready','failed')),
  cost_usd    numeric,
  created_at  timestamptz not null default now()
);
create index if not exists bard_songs_user_idx on bard_songs(user_id);
create index if not exists bard_songs_source_idx on bard_songs(scope, source_id);

-- =============================================================
-- ENABLE ROW LEVEL SECURITY
-- =============================================================
alter table portraits     enable row level security;
alter table friendships   enable row level security;
alter table parties       enable row level security;
alter table party_members enable row level security;
alter table world_lore    enable row level security;
alter table bard_songs    enable row level security;

-- =============================================================
-- POLICIES — tables referenced by other policies (party_members,
-- parties) already exist by this point.
-- =============================================================

-- portraits: owner only
drop policy if exists portraits_owner_select on portraits;
create policy portraits_owner_select on portraits for select
  using (user_id = auth.uid());

drop policy if exists portraits_owner_insert on portraits;
create policy portraits_owner_insert on portraits for insert
  with check (user_id = auth.uid());

drop policy if exists portraits_owner_update on portraits;
create policy portraits_owner_update on portraits for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists portraits_owner_delete on portraits;
create policy portraits_owner_delete on portraits for delete
  using (user_id = auth.uid());

-- friendships: either party can read or end; requester inserts
drop policy if exists friendships_party_select on friendships;
create policy friendships_party_select on friendships for select
  using (requester_id = auth.uid() or addressee_id = auth.uid());

drop policy if exists friendships_requester_insert on friendships;
create policy friendships_requester_insert on friendships for insert
  with check (requester_id = auth.uid());

drop policy if exists friendships_either_update on friendships;
create policy friendships_either_update on friendships for update
  using (requester_id = auth.uid() or addressee_id = auth.uid());

drop policy if exists friendships_either_delete on friendships;
create policy friendships_either_delete on friendships for delete
  using (requester_id = auth.uid() or addressee_id = auth.uid());

-- parties: owner or member can read; only owner writes
drop policy if exists parties_member_select on parties;
create policy parties_member_select on parties for select
  using (
    owner_id = auth.uid()
    or exists (
      select 1 from party_members pm
      where pm.party_id = parties.id and pm.user_id = auth.uid()
    )
  );

drop policy if exists parties_owner_insert on parties;
create policy parties_owner_insert on parties for insert
  with check (owner_id = auth.uid());

drop policy if exists parties_owner_update on parties;
create policy parties_owner_update on parties for update
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists parties_owner_delete on parties;
create policy parties_owner_delete on parties for delete
  using (owner_id = auth.uid());

-- party_members: members see themselves; party owner sees all in their party.
-- Writes: member can join/leave themselves; owner can manage anyone.
drop policy if exists party_members_party_select on party_members;
create policy party_members_party_select on party_members for select
  using (
    user_id = auth.uid()
    or exists (
      select 1 from parties p where p.id = party_members.party_id and p.owner_id = auth.uid()
    )
  );

drop policy if exists party_members_self_or_owner_insert on party_members;
create policy party_members_self_or_owner_insert on party_members for insert
  with check (
    user_id = auth.uid()
    or exists (
      select 1 from parties p where p.id = party_members.party_id and p.owner_id = auth.uid()
    )
  );

drop policy if exists party_members_self_or_owner_update on party_members;
create policy party_members_self_or_owner_update on party_members for update
  using (
    user_id = auth.uid()
    or exists (
      select 1 from parties p where p.id = party_members.party_id and p.owner_id = auth.uid()
    )
  );

drop policy if exists party_members_self_or_owner_delete on party_members;
create policy party_members_self_or_owner_delete on party_members for delete
  using (
    user_id = auth.uid()
    or exists (
      select 1 from parties p where p.id = party_members.party_id and p.owner_id = auth.uid()
    )
  );

-- world_lore: owner only
drop policy if exists world_lore_owner_all on world_lore;
create policy world_lore_owner_all on world_lore for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- bard_songs: owner only
drop policy if exists bard_songs_owner_all on bard_songs;
create policy bard_songs_owner_all on bard_songs for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
