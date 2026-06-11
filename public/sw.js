const CACHE = 'jateamhub-v5'
const STATIC = ['/', '/index.html', '/manifest.json', '/icon-192.png', '/icon-512.png']

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
  const url = request.url

  // Skip non-GET, Supabase API, Google Fonts API, and analytics
  if (request.method !== 'GET') return
  if (url.includes('supabase.co') || url.includes('/api/') || url.includes('google-analytics')) return

  // For Google Fonts CSS — network-first with cache fallback
  if (url.includes('fonts.googleapis.com') || url.includes('fonts.gstatic.com')) {
    e.respondWith(
      fetch(request)
        .then(res => {
          if (res.ok) {
            const clone = res.clone()
            caches.open(CACHE).then(c => c.put(request, clone))
          }
          return res
        })
        .catch(() => caches.match(request))
    )
    return
  }

  // For app navigations — network-first, fall back to cached index.html
  if (request.mode === 'navigate') {
    e.respondWith(
      fetch(request)
        .catch(() => caches.match('/index.html'))
    )
    return
  }

  // For static assets (JS, CSS, images, fonts) — cache-first
  if (/\.(js|css|woff2?|png|svg|ico|webp|jpg|jpeg)(\?.*)?$/.test(url)) {
    e.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached
        return fetch(request).then(res => {
          if (res.ok) {
            const clone = res.clone()
            caches.open(CACHE).then(c => c.put(request, clone))
          }
          return res
        })
      })
    )
    return
  }

  // Default — network with cache fallback
  e.respondWith(
    fetch(request)
      .then(res => {
        if (res.ok) {
          const clone = res.clone()
          caches.open(CACHE).then(c => c.put(request, clone))
        }
        return res
      })
      .catch(() => caches.match(request))
  )
})

// Notification clicked — focus existing window (navigating to the target
// hash if provided) or open a new one.
self.addEventListener('notificationclick', e => {
  e.notification.close()
  const target = e.notification.data?.url || '/'
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const client of list) {
        if ('focus' in client) {
          if (target && target !== '/' && 'navigate' in client) {
            client.navigate(target).catch(() => {})
          }
          return client.focus()
        }
      }
      return clients.openWindow(target)
    })
  )
})

// Push from server (VAPID) — ready for future backend integration
self.addEventListener('push', e => {
  const data = e.data?.json?.() ?? {}
  e.waitUntil(
    self.registration.showNotification(data.title ?? 'JateamHub', {
      body:  data.body  ?? '',
      icon:  '/icon-192.png',
      badge: '/icon-192.png',
      tag:   data.tag ?? 'jateamhub-push',
      data:  { url: data.url ?? '/#chat' },
      vibrate: [80, 40, 80],
    })
  )
})
