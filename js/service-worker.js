// CNC AI Academy Service Worker
const CACHE_NAME = 'cnc-ai-academy-v2'; // Incremented version
const APP_SHELL = 'app-shell-v1';
const CONTENT_CACHE = 'content-v1';
const API_CACHE = 'api-cache-v1';

// App Shell - core assets
const appShellFiles = [
  '/',
  '/index.html',
  '/js/main.js', 
  'https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css',
  'https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.5.2/css/all.min.css',
  'https://cdn.jsdelivr.net/npm/@fontsource/roboto@3.3.1/400.css',
  'https://cdn.jsdelivr.net/npm/highlight.js@11.7.0/styles/atom-one-dark.min.css',
  'https://cdn.jsdelivr.net/npm/highlight.js@11.7.0/lib/highlight.min.js',
  'https://cdn.jsdelivr.net/npm/highlight.js@11.7.0/lib/languages/gcode.min.js',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.3/dist/chart.umd.min.js'
];

// Install event - cache the essential app shell files
self.addEventListener('install', event => {
  self.skipWaiting(); // Ensure new service worker activates immediately
  event.waitUntil(
    caches.open(APP_SHELL)
      .then(cache => {
        console.log('Caching app shell resources');
        return cache.addAll(appShellFiles);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  const currentCaches = [APP_SHELL, CONTENT_CACHE, API_CACHE];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (!currentCaches.includes(cacheName)) {
            console.log('Deleting outdated cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      // Ensure the service worker takes control immediately
      return self.clients.claim();
    })
  );
});

// Helper function to determine cache strategy based on request
function getCacheStrategy(request) {
  const url = new URL(request.url);
  
  // API requests - network first with timeout fallback
  if (url.href.includes('openrouter.ai')) {
    return 'api';
  }
  
  // HTML documents - network first for freshness
  if (request.destination === 'document') {
    return 'network-first';
  }
  
  // JS/CSS/Images - cache first for performance
  if (['style', 'script', 'image'].includes(request.destination)) {
    return 'cache-first';
  }
  
  // Default - network first
  return 'network-first';
}

// Network first strategy with timeout fallback
async function networkFirstWithTimeout(request, cacheName, timeout = 3000) {
  const timeoutPromise = new Promise(resolve => {
    setTimeout(() => resolve(caches.match(request)), timeout);
  });
  
  try {
    const networkResponse = await Promise.race([
      fetch(request.clone()),
      timeoutPromise
    ]);
    
    // If we got a response from the network
    if (networkResponse && networkResponse.type !== 'error' && networkResponse.status === 200) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
      return networkResponse;
    }
    
    // Fall back to cache
    const cachedResponse = await caches.match(request);
    return cachedResponse || await fetch(request).catch(() => {
      // If all fails, show offline page for document requests
      if (request.destination === 'document') {
        return caches.match('/index.html');
      }
      return new Response('Network error occurred', { 
        status: 408, 
        headers: { 'Content-Type': 'text/plain' } 
      });
    });
  } catch (error) {
    console.error('Error in network-first strategy:', error);
    const cachedResponse = await caches.match(request);
    return cachedResponse || new Response('Network error occurred', {
      status: 408,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
}

// Cache first strategy
async function cacheFirst(request, cacheName) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.error('Error in cache-first strategy:', error);
    return new Response('Network error occurred', {
      status: 408,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
}

// Handle API requests with specific caching strategy
async function handleApiRequest(request) {
  // For API requests, try network first with short timeout
  try {
    const response = await fetch(request.clone());
    
    // Cache successful GET responses
    if (response && response.status === 200 && request.method === 'GET') {
      const cache = await caches.open(API_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    // If network fails, try to return from cache
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // If no cached response, return error
    return new Response(JSON.stringify({
      error: true,
      message: 'You appear to be offline. Please check your connection.'
    }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Fetch event - apply appropriate caching strategy based on request type
self.addEventListener('fetch', event => {
  const strategy = getCacheStrategy(event.request);
  
  if (strategy === 'api') {
    event.respondWith(handleApiRequest(event.request));
  } else if (strategy === 'cache-first') {
    event.respondWith(cacheFirst(event.request, CONTENT_CACHE));
  } else {
    event.respondWith(networkFirstWithTimeout(event.request, CONTENT_CACHE));
  }
});

// Listen for messages from the client
self.addEventListener('message', event => {
  if (event.data.action === 'skipWaiting') {
    self.skipWaiting();
  }
  
  // Handle module caching for offline access
  if (event.data.action === 'cacheModule' && event.data.module) {
    caches.open(CONTENT_CACHE).then(cache => {
      // Store the module data
      const moduleData = new Response(JSON.stringify(event.data.module));
      const moduleUrl = `/modules/${event.data.module.id}`;
      cache.put(moduleUrl, moduleData);
      
      // Inform client the module was cached
      if (event.ports && event.ports[0]) {
        event.ports[0].postMessage({
          success: true,
          message: 'Module cached for offline use'
        });
      }
    });
  }
});