const CACHE = 'jateamhub-v3'
const STATIC = [
  '/',
  '/index.html',
  '/manifest.json',
]

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(STATIC)))
  self.skipWaiting()
})

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', e => {
  const { request } = e
  // Skip non-GET and API/supabase calls
  if (request.method !== 'GET') return
  if (request.url.includes('supabase') || request.url.includes('/api/')) return

  e.respondWith(
    fetch(request)
      .then(res => {
        // Cache successful responses for static assets
        if (res.ok && (request.url.match(/\.(js|css|woff2?|png|svg|ico)$/) || request.url.endsWith('/'))) {
          const clone = res.clone()
          caches.open(CACHE).then(c => c.put(request, clone))
        }
        return res
      })
      .catch(() => caches.match(request).then(r => r || caches.match('/')))
  )
})
