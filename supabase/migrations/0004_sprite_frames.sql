-- Sprite animation frames for the party screen hover-idle.
-- Stored as a jsonb array of public URLs so the frontend can cycle them
-- frame-by-frame for an FF-style idle bounce.

alter table portraits
  add column if not exists sprite_frames jsonb;
