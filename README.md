# Yashwanth R — Portfolio Site

A polished, glassmorphism portfolio website with a public homepage and a separate admin dashboard. The site is now fully backed by Supabase for live content editing, and it includes a richer set of interactions such as search, recruiter mode, animated effects, and mini-games.

## What the project includes now
- A single-page portfolio experience with animated background effects, scroll reveals, and a modern glass UI.
- A Supabase-powered admin dashboard for editing content without touching code.
- Live GitHub repository cards pulled from the GitHub API.
- Project popups with tags, metrics, features, and screenshots.
- A YouTube card with banner/logo support.
- Light/dark mode, theme palette presets, wallpaper controls, and section visibility settings.
- Command palette/global search with Ctrl+K.
- Recruiter mode for a cleaner, more focused view.
- Mini-games and easter-egg style extras for visitors.

## Where content lives
All editable site content is stored in Supabase in the table `site_content` under the row `id = 'main'`. The file `data.js` is only the initial seed content used the first time the site loads with an empty database. After that, the live site reads and writes content through Supabase.

## Project files
- `index.html` — public homepage structure
- `app.js` — public site rendering and interactions
- `admin.html` — admin sign-in and dashboard UI
- `admin.js` — admin forms, repeater editors, uploads, and save logic
- `style.css` — shared styling for both the public and admin pages
- `data.js` — initial seed content only
- `config.js` — Supabase connection settings
- `supabase_schema.sql` — SQL needed to initialize the database and storage bucket
- `images/` — profile photos, channel art, logos, and other uploaded media
- `Yashwanth_Resume.pdf` — résumé download link

## One-time setup
1. Create a free Supabase project at https://supabase.com.
2. Open the SQL editor and run `supabase_schema.sql`.
   - This creates the `site_content` table and the `portfolio-media` storage bucket.
3. Enable email auth in Supabase and create one admin user account.
4. Copy your Supabase project URL and anon key into `config.js`.
5. Open `admin.html`, sign in, and start editing.

## Editing content
1. Visit `admin.html` (or use the lock icon in the main navigation).
2. Sign in with the admin account created during setup.
3. Use the tabs to edit sections such as hero/about, skills, projects, certifications, experience, education, achievements, hobbies, connect links, and settings.
4. Upload images or PDFs directly for profile photos, project screenshots, YouTube assets, and certificates.
5. Click Save changes. The changes appear on the live site immediately.

## Admin features worth noting
- Reorderable repeaters for projects, certifications, experience, education, and more.
- Section visibility and heading controls for the main homepage sections.
- Theme palette presets and wallpaper opacity settings.
- Custom sections can be added from the dashboard.
- Reset to data.js defaults is available from the Settings area if you want to start over.

## Deployment
This project is a static site, so it can be deployed to GitHub Pages or any other static host.

1. Push all project files to your GitHub repository.
2. Enable GitHub Pages in the repository settings.
3. Deploy from the main branch.
4. Open your Pages URL.

> After editing content through the admin dashboard, you do not need to redeploy. The content is stored in Supabase and updates live.

## Notes
- The résumé PDF is already included and linked from the hero section.
- The site is designed to work even before full Supabase setup by falling back to the seed content in `data.js`.
