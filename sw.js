const CACHE_NAME = 'expense-tracker-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/style.css',
  '/script.js',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js',
  'https://cdn.jsdelivr.net/npm/chart.js',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap',
  'https://fonts.googleapis.com/css2?family=Roboto+Mono:wght@400;700&display=swap'
];

// Event 'install': Buka cache dan tambahkan semua file aset ke dalamnya.
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Cache dibuka, aset ditambahkan');
        return cache.addAll(urlsToCache);
      })
  );
});

// Event 'fetch': Sajikan file dari cache jika tersedia, jika tidak, ambil dari jaringan.
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Jika ada di cache, kembalikan dari cache. Jika tidak, ambil dari jaringan.
        return response || fetch(event.request);
      })
  );
});