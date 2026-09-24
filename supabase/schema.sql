-- ===== Milestone 2: Supabase schema =====
-- Run once in the Supabase SQL editor.

-- ===== presentations =====
create table if not exists presentations (
  id          uuid primary key default gen_random_uuid(),
  teacher_id  text not null,                -- config.js account name
  title       text not null,
  pdf_path    text not null,
  python_path text not null,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end; $$ language plpgsql;

create trigger presentations_upd before update on presentations
for each row execute function set_updated_at();

-- ===== sessions =====
create table if not exists sessions (
  id                      uuid primary key default gen_random_uuid(),
  teacher_id              text not null,
  room_code               text unique not null,
  current_presentation_id uuid references presentations(id) on delete set null,
  status                  text not null default 'active' check (status in ('active','ended')),
  created_at              timestamptz default now(),
  ended_at                timestamptz
);

create unique index if not exists sessions_one_active_per_teacher
on sessions (teacher_id) where status = 'active';

-- ===== storage: private bucket =====
insert into storage.buckets (id, name, public)
values ('presentations', 'presentations', false);

-- ===== RLS: session-token-scoped =====
-- Requests must send x-teacher and x-session-token headers.
-- Access granted only when that teacher has a currently active
-- admin_sessions row whose token matches.

create or replace function classroom_request_teacher() returns text
language sql stable as $$
  select coalesce(current_setting('request.headers', true)::json->>'x-teacher', '')
$$;

create or replace function classroom_request_token() returns text
language sql stable as $$
  select coalesce(current_setting('request.headers', true)::json->>'x-session-token', '')
$$;

create or replace function classroom_has_active_session(t text) returns boolean
language sql stable as $$
  select exists (
    select 1 from admin_sessions s
    where s.account_name = t
      and s.session_token = classroom_request_token()
      and s.last_activity > now() - interval '10 minutes'
  )
$$;

alter table presentations enable row level security;
alter table sessions enable row level security;

create policy presentations_select on presentations for select
  using (teacher_id = classroom_request_teacher() and classroom_has_active_session(teacher_id));
create policy presentations_insert on presentations for insert
  with check (teacher_id = classroom_request_teacher() and classroom_has_active_session(teacher_id));
create policy presentations_update on presentations for update
  using (teacher_id = classroom_request_teacher() and classroom_has_active_session(teacher_id));
create policy presentations_delete on presentations for delete
  using (teacher_id = classroom_request_teacher() and classroom_has_active_session(teacher_id));

create policy sessions_select on sessions for select
  using (teacher_id = classroom_request_teacher() and classroom_has_active_session(teacher_id));
create policy sessions_insert on sessions for insert
  with check (teacher_id = classroom_request_teacher() and classroom_has_active_session(teacher_id));
create policy sessions_update on sessions for update
  using (teacher_id = classroom_request_teacher() and classroom_has_active_session(teacher_id));
create policy sessions_delete on sessions for delete
  using (teacher_id = classroom_request_teacher() and classroom_has_active_session(teacher_id));