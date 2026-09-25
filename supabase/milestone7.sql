-- ===== Milestone 7: PDF Viewer =====
-- Extend get_active_session to return pdf_path for the current presentation
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

-- Signed URL generator (callable by anon)
-- Returns a 1-hour signed URL for the given presentation's PDF
create or replace function get_pdf_signed_url(presentation_id uuid)
returns text language sql security definer as $$
  select storage.create_signed_url(
    'presentations',
    (select pdf_path from presentations where id = presentation_id),
    3600  -- 1 hour expiry
  ) as signed_url;
$$;

revoke all on function get_pdf_signed_url(uuid) from public;
grant execute on function get_pdf_signed_url(uuid) to anon;