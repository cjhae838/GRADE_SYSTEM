-- ===== Milestone 4: session join lookup =====
-- Run once in the Supabase SQL editor (after schema.sql).
-- Students have no RLS read access to sessions, so joins go through
-- this narrow security-definer RPC. Returns minimal fields, and only
-- for a currently active session.

create or replace function get_active_session(code text)
returns table (id uuid, room_code text, created_at timestamptz)
language sql stable security definer as $$
  select id, room_code, created_at
  from sessions
  where room_code = code and status = 'active'
  limit 1
$$;

revoke all on function get_active_session(text) from public;
grant execute on function get_active_session(text) to anon;