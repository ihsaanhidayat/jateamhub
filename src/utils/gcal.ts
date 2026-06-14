// On-demand, client-side Google Calendar sync.
//  · We only ever hold the Google access token Supabase hands us right after an
//    OAuth redirect (session.provider_token). It lives ~1h and can't be
//    refreshed client-side, so sync is on-demand: re-auth to get a fresh token.
//  · Requires the OAuth consent screen to grant `.../auth/calendar.events`.
import type { CalendarEvent } from '../types'

export const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.events'
const TOKEN_KEY = 'gcal-token'
const API = 'https://www.googleapis.com/calendar/v3'

function pad(n: number) { return String(n).padStart(2, '0') }

// ── Token storage (captured by authStore after the calendar OAuth) ──────
export function storeGcalToken(token: string | null | undefined) {
  if (!token) return
  try { localStorage.setItem(TOKEN_KEY, JSON.stringify({ token, exp: Date.now() + 55 * 60_000 })) } catch {}
}
function getToken(): string | null {
  try {
    const raw = localStorage.getItem(TOKEN_KEY)
    if (!raw) return null
    const o = JSON.parse(raw)
    if (o?.token && o.exp > Date.now()) return o.token
  } catch {}
  return null
}
export function gcalReady(): boolean { return !!getToken() }
export function clearGcalToken() { try { localStorage.removeItem(TOKEN_KEY) } catch {} }

export interface GcalResult<T = any> { ok: boolean; data?: T; needsAuth?: boolean; needsScope?: boolean }

async function call<T = any>(path: string, init?: RequestInit): Promise<GcalResult<T>> {
  const tok = getToken()
  if (!tok) return { ok: false, needsAuth: true }
  try {
    const r = await fetch(`${API}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json', ...(init?.headers || {}) },
    })
    // 401 = token expired/invalid → just re-auth. 403 = the granted token lacks
    // the calendar.events scope (consent screen not configured / not consented)
    // → re-auth alone won't fix it; the user must add the scope in Cloud Console.
    if (r.status === 401) { clearGcalToken(); return { ok: false, needsAuth: true } }
    if (r.status === 403) { clearGcalToken(); return { ok: false, needsScope: true } }
    if (!r.ok) return { ok: false }
    const data = r.status === 204 ? (null as any) : await r.json()
    return { ok: true, data }
  } catch { return { ok: false } }
}

// ── App event → Google event body ──────────────────────────────────────
function toGoogle(ev: CalendarEvent) {
  if (ev.time) {
    const start = new Date(`${ev.date}T${ev.time}:00`)
    const end = new Date(start.getTime() + 60 * 60 * 1000)
    return { summary: ev.title, description: 'JATEAMHUB', start: { dateTime: start.toISOString() }, end: { dateTime: end.toISOString() } }
  }
  const nd = new Date(`${ev.date}T00:00:00`); nd.setDate(nd.getDate() + 1)
  return { summary: ev.title, description: 'JATEAMHUB', start: { date: ev.date }, end: { date: `${nd.getFullYear()}-${pad(nd.getMonth() + 1)}-${pad(nd.getDate())}` } }
}

export const pushEvent  = (ev: CalendarEvent) => call(`/calendars/primary/events`, { method: 'POST', body: JSON.stringify(toGoogle(ev)) })
export const patchEvent = (gid: string, ev: CalendarEvent) => call(`/calendars/primary/events/${encodeURIComponent(gid)}`, { method: 'PATCH', body: JSON.stringify(toGoogle(ev)) })
export const deleteEvent = (gid: string) => call(`/calendars/primary/events/${encodeURIComponent(gid)}`, { method: 'DELETE' })

export interface GEvent { id: string; title: string; date: string; time?: string }
export async function listEvents(timeMinISO: string, timeMaxISO: string): Promise<GcalResult<GEvent[]>> {
  const p = new URLSearchParams({ timeMin: timeMinISO, timeMax: timeMaxISO, singleEvents: 'true', orderBy: 'startTime', maxResults: '120' })
  const r = await call<{ items?: any[] }>(`/calendars/primary/events?${p.toString()}`)
  if (!r.ok) return r as GcalResult<GEvent[]>
  const items: GEvent[] = (r.data?.items ?? []).map(it => {
    const s = it.start?.dateTime || it.start?.date || ''
    return {
      id: it.id,
      title: it.summary || '(tanpa judul)',
      date: s.slice(0, 10),
      time: it.start?.dateTime ? new Date(it.start.dateTime).toTimeString().slice(0, 5) : undefined,
    }
  })
  return { ok: true, data: items }
}
