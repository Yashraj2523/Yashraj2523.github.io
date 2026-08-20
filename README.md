# Yashwanth R — Portfolio

A single-page, glass/iOS-style portfolio. Self-contained static site (HTML/CSS/JS)
that you can host anywhere free: GitHub Pages, Netlify, Vercel, or Cloudflare Pages.

## What's already working out of the box (no setup needed)
- Full one-page layout: hero, about, skills, projects, certifications, hobbies, connect, contact
- **Live GitHub repos** — pulled directly from `https://api.github.com/users/Yashraj2523/repos`
  every time someone loads the page. No key needed, updates automatically as you push new repos.
- LinkedIn + YouTube cards with redirect buttons (YouTube has a live embedded preview)
- **Light / dark mode toggle** (sun/moon icon, top-right) — remembers your choice, also respects
  the visitor's OS preference on first visit
- Smooth scroll-reveal animations, animated constellation background (recolors with the theme), glass panels
- Résumé download button (pointed at `Yashwanth_Resume.pdf` in this folder)
- Back-to-top button, one-click "copy email" button in the contact section
- Fully responsive, reduced-motion respected, social link preview tags (Open Graph) for nicer link shares

## New in this update
- **Profile photo slideshow** — add as many photos as you like via `profile_photos` in `data.js` (or live-edit the list by double-clicking the slideshow while signed in). Auto-advances every ~4s, hover/click/tap to skip ahead manually, dot indicators show position.
- **Project popup modal** — clicking a project card opens a modal with description, tags, features, GitHub/demo links, and screenshots if you've added any. Click the same card again, click outside, or press Escape to close.
- **Certification popup viewer** — clicking a certification opens its file (image or PDF, auto-detected from the URL) in a viewer with zoom in/out/reset/fit-to-screen, mouse-wheel zoom, drag-to-pan, and touch pinch-zoom on mobile.
- **Redesigned light mode** — higher-contrast palette built specifically for readability, with smooth transition animations whenever you switch themes.
- **YouTube card redesign** — banner + channel logo + visit button instead of an embedded player. Set `youtube_banner` / `youtube_logo` / `youtube_subs` in `data.js`.
- Keyboard accessibility: all popups respond to Escape, focus outlines are visible everywhere, cards are reachable and triggerable via Tab + Enter/Space.
- Lazy-loaded images throughout (slideshow, screenshots, certificates) to keep the page fast.

### Adding your own content for these features
In `data.js`:
- `profile_photos`: array of image URLs (or filenames if you upload them into this same folder)
- Each project: add `features` (array of strings), `github`, `demo` (leave `""` if none), `screenshots` (array of image URLs, leave `[]` if none)
- Each certification: add `file` — a URL to the certificate image or PDF (leave `""` if you haven't uploaded one yet)
- `youtube_banner`, `youtube_logo`, `youtube_subs` — your channel's banner image URL, logo/avatar URL, and subscriber count text

All of the above are also editable live through the sign-in/edit mode described below — double-click a project or certification card while signed in for a quick-edit prompt covering these fields.

## Turning on real, owner-only editing (Supabase)

Content lives in `data.js` by default. To make it genuinely editable — by **only you**,
through a real sign-in, with changes stored in a database that updates instantly for
every visitor:

1. Go to https://supabase.com → create a free project.
2. Open **SQL Editor** → paste in the contents of `supabase_schema.sql` → run it.
   (This creates the content table AND locks editing to signed-in users only — there
   is no shared passphrase anyone could guess.)
3. Go to **Authentication → Providers** → confirm "Email" is enabled.
4. Go to **Authentication → Users → Add user** and create **exactly one account**:
   your own email + a strong password. Optionally go to **Authentication → Settings**
   and turn off public sign-ups, so nobody else can ever create an account.
5. Go to **Project Settings → API** → copy your **Project URL** and **anon public key**.
6. Open `config.js` and paste them in:
   ```js
   const SUPABASE_URL = "https://xxxxxxxx.supabase.co";
   const SUPABASE_ANON_KEY = "eyJhbGciOi....";
   ```
7. Reload the site. The first load automatically seeds your Supabase table with
   everything currently in `data.js`. From then on, the site reads from Supabase.

### How editing works now
- Click the **lock icon** (top-right of the nav) → a sign-in modal opens.
- Enter the email + password of the one account you created in step 4. Anyone else
  who tries will just get "Invalid login credentials" — there's no passphrase to leak.
- Once signed in, a banner appears at the top confirming edit mode, and:
  - Hero name, hero subtitle, the About paragraph, and the LinkedIn blurb become
    click-and-type editable directly on the page — click in, type, click out, it saves.
  - Double-click any **skill card**, **project card**, **certification row**, or
    **hobby chip** for a focused quick-edit prompt.
- Every change writes straight to Supabase — live for every visitor immediately,
  no rebuild or redeploy needed, and it persists forever.
- Click **"Sign out"** in the banner when you're done.

If Supabase isn't configured, clicking the lock icon just lets you know editing isn't
set up yet on that deployment — no broken passphrase prompt, no fallback admin mode.

## Keeping GitHub/LinkedIn/YouTube "auto-updated"
- **GitHub**: fully automatic already — it's a live API call on every page load.
- **LinkedIn**: LinkedIn does not allow public, unauthenticated live embedding of
  profile data (no public API for this) — this is a platform restriction, not a
  limitation of this site. The LinkedIn card is a polished preview + a button
  straight to your live profile, which is the realistic, ToS-compliant best option.
- **YouTube**: the channel preview embed updates automatically as you add videos —
  no action needed. The subscribe/visit button always points to your real channel.

## File map
```
index.html            -- page structure & content
style.css              -- all visual design (glass/iOS aesthetic, animations)
data.js                -- your editable content, seeds the database on first run
config.js              -- Supabase keys + admin passphrase (fill this in)
app.js                 -- rendering, GitHub fetch, animations, edit-mode logic
supabase_schema.sql     -- run once in Supabase to create the content table
Yashwanth_Resume.pdf    -- linked from the "Download résumé" button
```

## Deploying for free (recommended: GitHub Pages, since you already use GitHub)
1. Create a new repo, e.g. `yashwanthr.github.io` (or any name + enable Pages on it).
2. Upload all files in this folder to the repo root.
3. Repo → Settings → Pages → set source to the `main` branch, root folder.
4. Your live site will be at `https://<your-username>.github.io/<repo-name>/`
   (or just `https://<your-username>.github.io/` if you used the special repo name).

Before sending this link to recruiters: complete the Supabase setup above so editing
is truly locked to your account, and double check your phone/email in `data.js` are correct.
