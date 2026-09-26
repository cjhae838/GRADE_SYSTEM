-- ===== Milestone 8: Database-Triggered Broadcast for Sessions =====
-- Run in Supabase Dashboard → SQL Editor (after schema.sql and milestone4.sql)

-- 1. Broadcast function for sessions
create or replace function public.broadcast_session_changes()
returns trigger
language plpgsql
security definer
set search_path = '' as $$
begin
  -- Broadcast to room-based topic: room:<room_code>:sessions
  perform realtime.broadcast_changes(
    'room:' || coalesce(new.room_code, old.room_code)::text || ':sessions',
    tg_op,
    tg_op,
    tg_table_name,
    tg_table_schema,
    new,
    old
  );
  return null;
end;
$$;

-- Trigger on sessions table
create trigger sessions_broadcast_changes
after insert or update or delete on public.sessions
for each row
execute function public.broadcast_session_changes();

-- RLS policy for broadcast messages
create policy "Room participants receive session broadcasts"
on realtime.messages
for select
to anon, authenticated
using (
  realtime.messages.extension = 'broadcast'
  and realtime.topic() like 'room:%:sessions'
);

-- Ensure Realtime is enabled on sessions
ALTER PUBLICATION supabase_realtime ADD TABLE sessions;