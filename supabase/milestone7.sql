-- ===== Milestone 7: PDF Viewer =====
-- Extend get_active_session to return pdf_path for the current presentation
drop function if exists get_active_session(text);
create or replace function get_active_session(code text)
returns table (
  id uuid,
  room_code text,
  created_at timestamptz,
  current_presentation_id uuid,
  presentation_title text,
  pdf_path text
)
language sql stable security definer as $$
  select s.id, s.room_code, s.created_at,
         s.current_presentation_id, p.title, p.pdf_path
  from sessions s
  left join presentations p on p.id = s.current_presentation_id
  where s.room_code = code and s.status = 'active'
  limit 1
$$;

-- Note: storage.create_signed_url() not available in this Supabase version.
-- Signed URLs will be generated client-side via the Storage REST API:
-- POST ${SUPABASE_URL}/storage/v1/object/sign/presentations/${pdf_path}
-- with body: {"expiresIn": 3600}