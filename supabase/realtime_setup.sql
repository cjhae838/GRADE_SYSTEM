-- ===== Enable Supabase Realtime for Sessions & Presentations =====
-- Run in Supabase Dashboard → SQL Editor (one-time setup)

-- Enable Realtime on sessions table (for session updates, presentation switches, session end)
ALTER PUBLICATION supabase_realtime ADD TABLE sessions;

-- Enable Realtime on presentations table (for title changes, though not strictly needed for current flow)
ALTER PUBLICATION supabase_realtime ADD TABLE presentations;