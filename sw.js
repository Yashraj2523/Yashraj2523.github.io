// sw.js — minimal offline cache for the static shell.
// NETWORK-FIRST for HTML/CSS/JS: always tries the network first so you see
// updates immediately after a normal deploy, and only falls back to the
// cached copy if the visitor is offline. Supabase and GitHub API calls are
// never touched by this worker — they always go straight to the network.
const CACHE_NAME = 'portfolio-shell-v2';
const SHELL_FILES = ['index.html', 'style.css', 'app.js', 'data.js', 'admin.html', 'admin.js', 'manifest.json'];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES)).catch(() => {})
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = event.request.url;
  if (url.includes('supabase.co') || url.includes('api.github.com')) return;
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)).catch(() => {});
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
