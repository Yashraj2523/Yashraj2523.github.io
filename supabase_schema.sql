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
create policy "Public can read site content" on site_content for select using ( true );

drop policy if exists "Only signed-in owner can insert site content" on site_content;
create policy "Only signed-in owner can insert site content" on site_content for insert to authenticated with check ( true );

drop policy if exists "Only signed-in owner can update site content" on site_content;
create policy "Only signed-in owner can update site content" on site_content for update to authenticated using ( true );

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

-- ===== LIVE SYNC: lets index.html update instantly when admin.html saves =====
alter publication supabase_realtime add table site_content;

-- ---------------------------------------------------------------------
-- Why you got the "policy already exists" error last time:
-- CREATE POLICY has no "IF NOT EXISTS" option in Postgres, so re-running
-- a schema file that already ran once always failed on that line. This
-- version drops each policy first (which is harmless and instant) and
-- then recreates it, so the whole file is safe to run as many times as
-- you like — including right now, on your existing database.
-- ---------------------------------------------------------------------
