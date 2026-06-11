// Presence + relative-time helpers for chat (WhatsApp-style).

// "online" if last_seen within this window OR live presence says so.
export const ONLINE_WINDOW_MS = 60 * 1000

const time = (d: Date) =>
  d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })

// "terakhir dilihat ..." text, Indonesian, WA-like.
export function lastSeenText(iso: string | null | undefined): string {
  if (!iso) return ''
  const d    = new Date(iso)
  const now  = Date.now()
  const diff = now - d.getTime()
  const mins = Math.floor(diff / 60000)

  if (mins < 1)  return 'terakhir dilihat baru saja'
  if (mins < 60) return `terakhir dilihat ${mins} menit lalu`

  const startToday = new Date(); startToday.setHours(0, 0, 0, 0)
  if (d.getTime() >= startToday.getTime()) return `terakhir dilihat pukul ${time(d)}`

  const startYest = startToday.getTime() - 86_400_000
  if (d.getTime() >= startYest) return `terakhir dilihat kemarin ${time(d)}`

  return `terakhir dilihat ${d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })} ${time(d)}`
}

// Bubble-level time, just HH:MM.
export const msgTime = (iso: string) => time(new Date(iso))
