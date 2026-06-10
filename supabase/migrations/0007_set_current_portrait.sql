-- =============================================================
-- Atomic "set this portrait as the active one" RPC.
--
-- Background: the workshop used to clear `is_current` on every other
-- portrait in a first UPDATE, then set `is_current = true` on the
-- target in a second. Between those two statements a concurrent call
-- could violate the partial unique index `portraits_one_current_per_character`,
-- and the second request would surface a 500 to the user instead of a
-- clean swap.
--
-- This RPC does it as a single UPDATE — PostgreSQL evaluates the
-- partial unique index after every row update in the statement is
-- applied, so the "old current is being cleared / new current is being
-- set" intermediate state is never observable.
-- =============================================================

create or replace function public.set_current_portrait(p_portrait_id uuid)
returns portraits
language plpgsql
security invoker
as $$
declare
  v_character_id uuid;
  v_result portraits;
begin
  select character_id into v_character_id
  from portraits
  where id = p_portrait_id;

  if v_character_id is null then
    raise exception 'Portrait not found' using errcode = 'PGRST';
  end if;

  -- Single atomic UPDATE: target row becomes is_current = true; every
  -- other portrait for the same character becomes is_current = false.
  -- RLS still applies — invoker rights — so a non-owner is filtered out.
  update portraits
  set is_current = (id = p_portrait_id)
  where character_id = v_character_id;

  select * into v_result from portraits where id = p_portrait_id;
  return v_result;
end;
$$;

grant execute on function public.set_current_portrait(uuid) to authenticated;
