// sw.js — minimal offline cache for the static shell (HTML/CSS/JS only;
// Supabase content and GitHub API calls always go to the network).
const CACHE_NAME = 'portfolio-shell-v1';
const SHELL_FILES = ['index.html', 'style.css', 'app.js', 'data.js', 'manifest.json'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES)).catch(() => {})
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
});

self.addEventListener('fetch', (event) => {
  const url = event.request.url;
  // Never cache Supabase, GitHub API, or storage — always fetch fresh.
  if (url.includes('supabase.co') || url.includes('api.github.com')) return;
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)).catch(() => {});
        return response;
      }).catch(() => cached);
    })
  );
});
