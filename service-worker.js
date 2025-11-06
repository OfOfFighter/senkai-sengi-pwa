const CACHE_NAME = 'senkai-sengi-cache-v1';
const urlsToCache = [
  '/',
  'index.html',
  // Since JSX/TSX is transpiled in the browser, we cache the source files.
  'index.tsx',
  'App.tsx',
  'types.ts',
  'components/MainMenu.tsx',
  'components/DeckBuilder.tsx',
  'components/GameBoard.tsx',
  'components/CardView.tsx',
  'contexts/LocalizationContext.tsx',
  'services/gameService.ts',
  'services/cpuService.ts',
  'services/localization.ts',
  // External libraries
  'https://unpkg.com/@babel/standalone/babel.min.js',
  'https://cdn.tailwindcss.com',
  // Fonts
  'https://fonts.googleapis.com/css2?family=Noto+Serif+JP:wght@700&display=swap',
  // App metadata
  'metadata.json'
];

// Add all card images to the cache list dynamically
const cardIds = [
  'b001', 'b002', 'b003', 'b004', 'b005', 'b006', 'b007', 'b008', 'b009', 'b010', 'b_magic', 'b_magic_awakened',
  'g001', 'g002', 'g003', 'g004', 'g005', 'g006', 'g007', 'g008', 'g009', 'g010', 'g_magic', 'g_magic_awakened',
  'r001', 'r002', 'r003', 'r004', 'r005', 'r006', 'r007', 'r008', 'r009', 'r010', 'r_magic', 'r_magic_awakened'
];
cardIds.forEach(id => urlsToCache.push(`./assets/cards/${id}.png`));


self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        // Use addAll with a catch to prevent install failure if one asset fails
        return cache.addAll(urlsToCache).catch(err => {
          console.error('Failed to cache one or more resources:', err);
        });
      })
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Cache hit - return response
        if (response) {
          return response;
        }

        const fetchRequest = event.request.clone();

        return fetch(fetchRequest).then(
          response => {
            // Check if we received a valid response
            if (!response || (response.status !== 200 && response.type !== 'opaque')) {
              return response;
            }

            const responseToCache = response.clone();

            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });

            return response;
          }
        );
      })
  );
});

// Clean up old caches
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
