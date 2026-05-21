// JateamHub Service Worker v4 — Minimal, stable
const CACHE = 'jateamhub-v4'

self.addEventListener('install', e => {
  self.skipWaiting()
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(['/', '/index.html'])).catch(() => { })
  )
})

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', e => {
  const url = e.request.url

  // Skip non-GET dan third-party
  if (e.request.method !== 'GET') return
  if (url.includes('supabase.co')) return
  if (url.includes('fonts.gstatic.com')) return
  if (url.includes('fonts.googleapis.com')) return

  // Navigation — network first, fallback index.html
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request).catch(() => caches.match('/index.html'))
    )
    return
  }

  // Assets — cache first
  if (url.includes('/assets/')) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached
        return fetch(e.request).then(res => {
          if (res.ok) {
            const clone = res.clone()
            caches.open(CACHE).then(c => c.put(e.request, clone))
          }
          return res
        })
      })
    )
    return
  }

  // Semua lain — network only, tidak cache
})