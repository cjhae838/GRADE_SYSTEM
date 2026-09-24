-- ===== Milestone 4: session join lookup =====
-- Run once in the Supabase SQL editor (after schema.sql).
-- Students have no RLS read access to sessions, so joins go through
-- this narrow security-definer RPC. Returns minimal fields, and only
-- for a currently active session.

create or replace function get_active_session(code text)
returns table (
  id uuid,
  room_code text,
  created_at timestamptz,
  current_presentation_id uuid,
  presentation_title text
)
language sql stable security definer as $$
  select s.id, s.room_code, s.created_at,
         s.current_presentation_id, p.title as presentation_title
  from sessions s
  left join presentations p on p.id = s.current_presentation_id
  where s.room_code = code and s.status = 'active'
  limit 1
$$;

revoke all on function get_active_session(text) from public;
grant execute on function get_active_session(text) to anon;