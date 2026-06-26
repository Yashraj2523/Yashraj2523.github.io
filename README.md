# Yashwanth R — Portfolio Site

A single-page, glass/iOS-style portfolio + a separate admin dashboard for editing
everything, with all content stored in a real free database (Supabase).
 
## Where your content actually lives
**Everything is stored in Supabase**, in a table called `site_content` (one row,
`id = 'main'`, containing all your text/links/lists as JSON). `data.js` is ONLY
the one-time seed used the very first time the database is empty — after that,
editing `data.js` does nothing on the live site. To change content, always use
**admin.html**, never edit data.js directly once you're live.
 
## Files
```
index.html             -- the public site
admin.html              -- the separate admin dashboard (login required)
app.js                  -- public site logic (read-only, renders from Supabase)
admin.js                -- admin dashboard logic (forms, uploads, save)
style.css               -- shared styles for both pages
data.js                 -- one-time seed content (see note above)
config.js               -- your Supabase URL/key (fill this in)
supabase_schema.sql      -- run once in Supabase: creates table + storage bucket
Yashwanth_Resume.pdf     -- linked from the "Download résumé" button
images/                  -- your uploaded photos (also editable via admin.html)
```

## One-time setup (Supabase)
1. https://supabase.com → create a free project.
2. **SQL Editor** → paste in all of `supabase_schema.sql` → Run.
   (Creates the content table AND a `portfolio-media` storage bucket for uploads.)
3. **Authentication → Providers** → confirm Email is enabled.
4. **Authentication → Users → Add user** → your email + a strong password →
   toggle **Auto Confirm User: ON**. This is the only account that can sign in.
5. **Authentication → Settings** → disable public sign-ups so nobody else can register.
6. **Project Settings → API** → copy the **Project URL** and **anon public key**
   into `config.js`:
   ```js
   const SUPABASE_URL = "https://xxxxxxxx.supabase.co";
   const SUPABASE_ANON_KEY = "eyJhbGciOi....";
   ```

## How to edit your content (admin.html)
1. Go to `yourdomain/admin.html` (there's also a lock icon in the main site's nav).
2. Sign in with the one account from step 4 above.
3. Use the tabs across the top — Hero & About, Profile Photos, Skills, Projects,
   Certifications, Experience, Education, Achievements & Pubs, Hobbies,
   Connect/YouTube, Settings.
4. **Profile Photos / YouTube banner / YouTube logo**: use the file upload
   buttons directly — they upload to Supabase Storage and the URL is filled
   in automatically. No need to paste links or touch code.
5. **Certifications / project screenshots**: paste a URL, or upload through the
   Profile Photos uploader and copy the resulting URL into the relevant field.
6. Click **Save changes** (bottom-right, always visible) after editing any tab.
   It writes straight to Supabase — visible on the live site immediately, no
   rebuild or redeploy needed.
7. **Settings tab** controls site-wide sizing: icon button size, profile photo
   size, card corner roundness, glass blur strength, section spacing — change
   a number, save, and the whole site updates.
8. **Reset to data.js defaults** (Settings tab, danger zone) wipes your database
   back to whatever is written in `data.js` — use only if you want a clean slate.

## What's included
- **Live GitHub repos** — pulled directly from the GitHub API on every page load.
- **Profile photo slideshow** — auto-advances, click/hover/tap to skip, left/right
  arrow buttons, swipe on mobile, dot indicators.
- **Project popup modals** — description, tags, metrics badges (e.g. "Accuracy: 95%"),
  features, GitHub/demo links, screenshots. Escape/click-outside/re-click closes it.
- **Certification popup viewer** — auto-detects image vs PDF, zoom in/out/reset,
  mouse-wheel zoom, drag-to-pan, touch pinch-zoom.
- **YouTube card** — channel banner + logo + "Visit My YouTube Channel" button
  (no embedded player). Falls back to a styled placeholder if no banner is set yet.
- **Experience, Education, Achievements, Publications, Timeline** sections —
  all empty-state-aware (show a friendly message until you add content via admin.html).
- **Light/dark mode** with a high-contrast light palette and smooth transitions.
- **SEO**: title, description, keywords, canonical URL, Open Graph tags, favicon.
  Google Analytics and Search Console snippets are included but commented out in
  `index.html` — paste in your own IDs and uncomment when ready.
- Back-to-top button, copy-email button, keyboard-accessible modals (Escape to close,
  visible focus rings, Tab-reachable cards).

## Deploying (GitHub Pages — free)
1. Repo named `<your-username>.github.io` (or any name with Pages enabled), Public.
2. Upload every file in this folder (including the `images/` folder) to the repo root.
3. Settings → Pages → Source: Deploy from branch → `main` → `/ (root)` → Save.
4. Live at `https://<your-username>.github.io/`.
5. After any admin.html edit, you do NOT need to redeploy — content is in Supabase
   and updates instantly. You only need to re-upload files if you change the actual
   code (style.css, app.js, etc).

## Notes
- The résumé PDF is already small (~190KB) — no further compression needed.
- LinkedIn has no public API for live-embedding profile data — the LinkedIn card
  is a polished preview + button to your live profile, which is the realistic,
  ToS-compliant option.
