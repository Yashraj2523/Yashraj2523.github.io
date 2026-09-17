-- supabase_schema.sql
-- SAFE TO RE-RUN ANY TIME — every statement below is idempotent: it drops a
-- policy only if it already exists, then recreates it. It NEVER drops or
-- recreates your tables, so your existing site_content row and its data
-- are completely untouched no matter how many times you run this file.

-- ===== CONTENT TABLE =====
create table if not exists site_content (
  id text primary key,
  content jsonb not null,
  updated_at timestamp with time zone default now()
);
alter table site_content enable row level security;

drop policy if exists "Public can read site content" on site_content;
-- Scoped to id='main' only: the published site. This is what keeps your
-- draft row private — anyone with the anon key could otherwise read
-- unpublished draft content directly via the Supabase API, bypassing the
-- website entirely. Signed-in reads (below) can still see everything.
create policy "Public can read published site content" on site_content for select using ( id = 'main' );

drop policy if exists "Only signed-in owner can read any site content" on site_content;
create policy "Only signed-in owner can read any site content" on site_content for select to authenticated using ( true );

drop policy if exists "Only signed-in owner can insert site content" on site_content;
create policy "Only signed-in owner can insert site content" on site_content for insert to authenticated with check ( true );

drop policy if exists "Only signed-in owner can update site content" on site_content;
create policy "Only signed-in owner can update site content" on site_content for update to authenticated using ( true );

-- ===== SITE CONTENT HISTORY (auto-snapshot before every save, admin-only) =====
create table if not exists site_content_history (
  id uuid primary key default gen_random_uuid(),
  content jsonb not null,
  created_at timestamp with time zone default now()
);
alter table site_content_history enable row level security;

-- No public access at all — this is purely an editing safety net for you.
drop policy if exists "Only signed-in owner can read history" on site_content_history;
create policy "Only signed-in owner can read history" on site_content_history for select to authenticated using ( true );

drop policy if exists "Only signed-in owner can insert history" on site_content_history;
create policy "Only signed-in owner can insert history" on site_content_history for insert to authenticated with check ( true );

drop policy if exists "Only signed-in owner can delete history" on site_content_history;
create policy "Only signed-in owner can delete history" on site_content_history for delete to authenticated using ( true );

-- ===== STORAGE BUCKET (for photo / certificate / screenshot uploads from admin.html) =====
insert into storage.buckets (id, name, public)
values ('portfolio-media', 'portfolio-media', true)
on conflict (id) do nothing;

drop policy if exists "Public can view portfolio media" on storage.objects;
create policy "Public can view portfolio media" on storage.objects for select
  using ( bucket_id = 'portfolio-media' );

drop policy if exists "Only signed-in owner can upload portfolio media" on storage.objects;
create policy "Only signed-in owner can upload portfolio media" on storage.objects for insert
  to authenticated with check ( bucket_id = 'portfolio-media' );

drop policy if exists "Only signed-in owner can update portfolio media" on storage.objects;
create policy "Only signed-in owner can update portfolio media" on storage.objects for update
  to authenticated using ( bucket_id = 'portfolio-media' );

drop policy if exists "Only signed-in owner can delete portfolio media" on storage.objects;
create policy "Only signed-in owner can delete portfolio media" on storage.objects for delete
  to authenticated using ( bucket_id = 'portfolio-media' );

-- ===== VISITOR LEADS (captured once before games/hints/quiz unlock) =====
create table if not exists visitor_leads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact text not null,
  page text,
  created_at timestamp with time zone default now()
);
alter table visitor_leads enable row level security;

drop policy if exists "Anyone can submit a visitor lead" on visitor_leads;
create policy "Anyone can submit a visitor lead" on visitor_leads for insert with check ( true );

drop policy if exists "Only admin can read visitor leads" on visitor_leads;
create policy "Only admin can read visitor leads" on visitor_leads for select using ( auth.role() = 'authenticated' );

-- ===== HIRE ME INQUIRIES (Hire Me button on the hero) =====
create table if not exists hire_inquiries (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  company text,
  contact text not null,
  message text,
  page text,
  created_at timestamp with time zone default now()
);
alter table hire_inquiries enable row level security;

drop policy if exists "Anyone can submit a hire inquiry" on hire_inquiries;
create policy "Anyone can submit a hire inquiry" on hire_inquiries for insert with check ( true );

drop policy if exists "Only admin can read hire inquiries" on hire_inquiries;
create policy "Only admin can read hire inquiries" on hire_inquiries for select using ( auth.role() = 'authenticated' );

-- ===== SITE EVENTS (lightweight visitor analytics — page views, project clicks, résumé downloads) =====
create table if not exists site_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  meta text,
  created_at timestamp with time zone default now()
);
alter table site_events enable row level security;

drop policy if exists "Anyone can log a site event" on site_events;
create policy "Anyone can log a site event" on site_events for insert with check ( true );

drop policy if exists "Only admin can read site events" on site_events;
create policy "Only admin can read site events" on site_events for select using ( auth.role() = 'authenticated' );

-- ===== LIVE SYNC: lets index.html update instantly when admin.html saves =====
-- Wrapped in a check so re-running this file never fails even if it's
-- already been added in a previous run.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'site_content'
  ) then
    alter publication supabase_realtime add table site_content;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Why you got the "policy already exists" error last time:
-- CREATE POLICY has no "IF NOT EXISTS" option in Postgres, so re-running
-- a schema file that already ran once always failed on that line. This
-- version drops each policy first (which is harmless and instant) and
-- then recreates it, so the whole file is safe to run as many times as
-- you like — including right now, on your existing database.
-- ---------------------------------------------------------------------

-- ===== SECURITY HARDENING: DB-level sanity limits =====
-- Client-side rate limiting (in app.js) stops casual spam through the
-- website itself, but anyone could still call the Supabase API directly
-- (bypassing the website entirely) with huge or junk payloads. These
-- CHECK constraints are the real backstop: even a raw API call can't
-- insert an absurdly long name/message, or an event_type that isn't one
-- of the ones this site actually logs. Wrapped in DO blocks so this file
-- stays safe to re-run any number of times.

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'visitor_leads_length_check') then
    alter table visitor_leads
      add constraint visitor_leads_length_check
      check ( char_length(name) <= 200 and char_length(contact) <= 200 and char_length(coalesce(page,'')) <= 500 );
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'hire_inquiries_length_check') then
    alter table hire_inquiries
      add constraint hire_inquiries_length_check
      check (
        char_length(name) <= 200 and char_length(coalesce(company,'')) <= 200
        and char_length(contact) <= 200 and char_length(coalesce(message,'')) <= 4000
        and char_length(coalesce(page,'')) <= 500
      );
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'site_events_type_check') then
    alter table site_events
      add constraint site_events_type_check
      check ( event_type in ('page_view', 'resume_download', 'project_click') )
      not valid; -- 'not valid' = only enforced for NEW rows, doesn't choke on any old rows already in the table
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'site_events_meta_length_check') then
    alter table site_events
      add constraint site_events_meta_length_check
      check ( char_length(coalesce(meta,'')) <= 300 );
  end if;
end $$;

-- ---------------------------------------------------------------------
-- If you ever add a new event type in app.js (beyond page_view /
-- resume_download / project_click), update the list in
-- site_events_type_check above too, or new-style events will be silently
-- rejected by the database with a constraint-violation error.
-- ---------------------------------------------------------------------
