-- ===== Milestone 7c: Public Bucket - Public PDF URLs =====
-- Make the presentations bucket public (run in Supabase Dashboard: Storage → presentations → Settings → Public bucket: ON)

-- Update get_active_session to return public URL instead of signed URL
drop function if exists get_active_session(text);
create or replace function get_active_session(code text)
returns table (
  id uuid,
  room_code text,
  created_at timestamptz,
  current_presentation_id uuid,
  presentation_title text,
  pdf_path text,
  pdf_public_url text
)
language sql stable security definer as $$
  select s.id, s.room_code, s.created_at,
         s.current_presentation_id, p.title, p.pdf_path,
         -- Construct public URL: ${SUPABASE_URL}/storage/v1/object/public/presentations/${pdf_path}
         concat('https://ruiikjyiqsfrzwqymixs.supabase.co/storage/v1/object/public/presentations/', p.pdf_path) as pdf_public_url
  from sessions s
  left join presentations p on p.id = s.current_presentation_id
  where s.room_code = code and s.status = 'active'
  limit 1
$$;

revoke all on function get_active_session(text) from public;
grant execute on function get_active_session(text) to anon;

-- Remove unused pdf_signed_url column
alter table sessions drop column if exists pdf_signed_url;