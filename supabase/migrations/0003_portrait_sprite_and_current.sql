-- Add a pixel sprite alongside each portrait, and let one portrait be the
-- character's "current" (shown on the Round Table / Notice Board / party UI).

alter table portraits
  add column if not exists sprite_url text;

alter table portraits
  add column if not exists is_current boolean not null default false;

-- At most one current portrait per character. Partial unique index so the
-- constraint only applies to rows where is_current = true.
create unique index if not exists portraits_one_current_per_character
  on portraits (character_id)
  where is_current;
