-- supabase_schema.sql
-- Run this once in your Supabase project's SQL editor (SQL Editor -> New query -> paste all -> Run).

-- ===== CONTENT TABLE =====
create table if not exists site_content (
  id text primary key,
  content jsonb not null,
  updated_at timestamp with time zone default now()
);
alter table site_content enable row level security;

create policy "Public can read site content" on site_content for select using ( true );
create policy "Only signed-in owner can insert site content" on site_content for insert to authenticated with check ( true );
create policy "Only signed-in owner can update site content" on site_content for update to authenticated using ( true );

-- ===== STORAGE BUCKET (for photo / certificate / screenshot uploads from admin.html) =====
insert into storage.buckets (id, name, public)
values ('portfolio-media', 'portfolio-media', true)
on conflict (id) do nothing;

create policy "Public can view portfolio media" on storage.objects for select
  using ( bucket_id = 'portfolio-media' );

create policy "Only signed-in owner can upload portfolio media" on storage.objects for insert
  to authenticated with check ( bucket_id = 'portfolio-media' );

create policy "Only signed-in owner can update portfolio media" on storage.objects for update
  to authenticated using ( bucket_id = 'portfolio-media' );

create policy "Only signed-in owner can delete portfolio media" on storage.objects for delete
  to authenticated using ( bucket_id = 'portfolio-media' );

-- ---------------------------------------------------------------------
-- SETUP STEPS AFTER RUNNING THIS FILE:
-- 1. Authentication -> Providers -> confirm "Email" is enabled.
-- 2. Authentication -> Users -> Add user -> your email + a strong password
--    -> toggle "Auto Confirm User" ON. This is the ONLY account that can
--    sign into admin.html.
-- 3. Authentication -> Settings -> turn off public sign-ups so nobody else
--    can ever create an account.
-- 4. Project Settings -> API -> copy the Project URL + anon public key into
--    config.js.
-- ---------------------------------------------------------------------
