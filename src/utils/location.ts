// Best-effort city-level location for the footer.
//  · Try browser GPS → reverse-geocode to a friendly city (BigDataCloud, free,
//    no key, client-side, city-level only).
//  · Fall back to IP-based city (ipapi.co) if GPS is denied/unavailable.
//  · Cached in localStorage for a day so we don't re-prompt/re-fetch.

export interface Loc { city: string; cc: string }
const CACHE_KEY = 'jateamhub-loc'
const ONE_DAY = 24 * 60 * 60 * 1000

async function reverseGeocode(lat: number, lon: number): Promise<Loc | null> {
  try {
    const r = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=id`)
    const d = await r.json()
    const city = d.city || d.locality || d.principalSubdivision || ''
    if (!city) return null
    return { city, cc: d.countryCode || '' }
  } catch { return null }
}

async function ipFallback(): Promise<Loc | null> {
  try {
    const r = await fetch('https://ipapi.co/json/')
    const d = await r.json()
    if (d.city) return { city: d.city, cc: d.country_code || d.country || '' }
  } catch { /* ignore */ }
  return null
}

async function fetchLocation(): Promise<Loc | null> {
  const gps = await new Promise<Loc | null>(resolve => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return resolve(null)
    navigator.geolocation.getCurrentPosition(
      async pos => resolve(await reverseGeocode(pos.coords.latitude, pos.coords.longitude)),
      () => resolve(null),
      { timeout: 8000, maximumAge: 10 * 60 * 1000 },
    )
  })
  return gps ?? ipFallback()
}

export async function getLocation(): Promise<Loc | null> {
  try {
    const cached = localStorage.getItem(CACHE_KEY)
    if (cached) {
      const c = JSON.parse(cached)
      if (c?.loc && Date.now() - c.t < ONE_DAY) return c.loc
    }
  } catch { /* ignore */ }
  const loc = await fetchLocation()
  if (loc) { try { localStorage.setItem(CACHE_KEY, JSON.stringify({ t: Date.now(), loc })) } catch {} }
  return loc
}
