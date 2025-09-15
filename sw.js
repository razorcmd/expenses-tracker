const CACHE_NAME = 'expense-tracker-v5'; // Versi cache dinaikkan untuk memuat script.js yang baru
const urlsToCache = [
  '/',
  '/index.html',
  '/style.css',
  '/script.js',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js',
  'https://cdn.jsdelivr.net/npm/chart.js',
  'https://cdnjs.cloudflare.com/ajax/libs/qrious/4.0.2/qrious.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.3.2/papaparse.min.js',
  'https://cdn.jsdelivr.net/npm/marked/marked.min.js',
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

// Event 'activate': Membersihkan cache lama saat service worker baru aktif.
self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          // Jika nama cache tidak ada di dalam whitelist, hapus.
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('Service Worker: Menghapus cache lama -> ', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Event 'fetch': Menerapkan strategi "Network first, falling back to cache".
self.addEventListener('fetch', (event) => {
  event.respondWith(
    // 1. Coba ambil dari jaringan terlebih dahulu
    fetch(event.request).then(networkResponse => {
      // Jika berhasil, simpan ke cache dan kembalikan respons jaringan
      return caches.open(CACHE_NAME).then(cache => {
        cache.put(event.request, networkResponse.clone());
        return networkResponse;
      });
    }).catch(() => {
      // 2. Jika jaringan gagal (offline), coba ambil dari cache
      return caches.match(event.request).then(cachedResponse => {
        // Kembalikan dari cache jika ada, jika tidak, biarkan browser handle (akan gagal)
        if (cachedResponse) {
          return cachedResponse;
        }
        // Optional: Anda bisa mengembalikan halaman offline kustom di sini
        // return caches.match('/offline.html');
      });
    })
  );
});