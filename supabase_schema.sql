-- supabase_schema.sql
-- SAFE TO RE-RUN ANY TIME. Every policy is dropped first, then recreated,
-- so running this again never fails and never touches your existing data.

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

-- ===== STORAGE BUCKET (photo / certificate / résumé / video uploads from admin.html) =====
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

-- ===== VISITOR LEADS (captured before games/hints/quiz unlock) =====
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

-- ===== HIRE ME LEADS (from the Hire Me popup) =====
create table if not exists hire_me_leads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  company text,
  email text not null,
  phone text,
  message text not null,
  created_at timestamp with time zone default now()
);
alter table hire_me_leads enable row level security;
drop policy if exists "Anyone can submit a hire-me lead" on hire_me_leads;
create policy "Anyone can submit a hire-me lead" on hire_me_leads for insert with check ( true );

-- ---------------------------------------------------------------------
-- SETUP STEPS:
-- 1. Authentication -> Providers -> confirm Email is enabled.
-- 2. Authentication -> Users -> Add user -> your email + password ->
--    toggle "Auto Confirm User" ON. This is the only account that can
--    sign into admin.html.
-- 3. Authentication -> Settings -> disable public sign-ups.
-- 4. Project Settings -> API -> copy Project URL + anon public key into
--    config.js.
-- 5. To read visitor_leads / hire_me_leads, use Supabase's Table Editor
--    (Dashboard -> Table Editor) — these tables are insert-only from the
--    public site, so only you can view the submitted entries there.
-- ---------------------------------------------------------------------
