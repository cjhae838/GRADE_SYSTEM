-- ===== Milestone 3: storage policies =====
-- Run once in the Supabase SQL editor (after schema.sql).
-- Grants teachers manage-only access to files in their own folder:
--   presentations/{teacher}/{presentation_id}/documentation.pdf
--   presentations/{teacher}/{presentation_id}/main.py
-- Access requires a currently active admin session, same as table RLS.

create policy classroom_objects_insert on storage.objects for insert to anon
with check (
  bucket_id = 'presentations'
  and (storage.foldername(name))[1] = classroom_request_teacher()
  and classroom_has_active_session((storage.foldername(name))[1])
);

create policy classroom_objects_select on storage.objects for select to anon
using (
  bucket_id = 'presentations'
  and (storage.foldername(name))[1] = classroom_request_teacher()
  and classroom_has_active_session((storage.foldername(name))[1])
);

create policy classroom_objects_update on storage.objects for update to anon
using (
  bucket_id = 'presentations'
  and (storage.foldername(name))[1] = classroom_request_teacher()
  and classroom_has_active_session((storage.foldername(name))[1])
)
with check (
  bucket_id = 'presentations'
  and (storage.foldername(name))[1] = classroom_request_teacher()
  and classroom_has_active_session((storage.foldername(name))[1])
);

create policy classroom_objects_delete on storage.objects for delete to anon
using (
  bucket_id = 'presentations'
  and (storage.foldername(name))[1] = classroom_request_teacher()
  and classroom_has_active_session((storage.foldername(name))[1])
);