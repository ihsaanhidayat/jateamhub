// Islamic (Hijri) + Javanese (Weton/pasaran) date helpers — no dependencies.

// ── Hijri (Islamic) ───────────────────────────────────────────
// Uses the Umm al-Qura calendar (common in Indonesia), with a graceful
// fallback to the generic 'islamic' calendar on older engines.
let _hijriFmt: Intl.DateTimeFormat | null = null
function hijriFormatter(): Intl.DateTimeFormat {
  if (_hijriFmt) return _hijriFmt
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' }
  try { _hijriFmt = new Intl.DateTimeFormat('id-ID-u-ca-islamic-umalqura', opts) }
  catch { _hijriFmt = new Intl.DateTimeFormat('id-ID-u-ca-islamic', opts) }
  return _hijriFmt
}
// e.g. "28 Zulhijah 1447 H"
export function hijriDate(d: Date): string {
  try { return hijriFormatter().format(d).replace(/\s*H?$/i, '') + ' H' }
  catch { return '' }
}

function hijriParts(d: Date): { day: string; month: string; year: string } {
  const parts = hijriFormatter().formatToParts(d)
  const get = (t: string) => parts.find(p => p.type === t)?.value ?? ''
  return { day: get('day'), month: get('month'), year: get('year') }
}
// e.g. "1 Zulhijah"
export function hijriDayMonth(d: Date): string {
  const p = hijriParts(d)
  return p.day && p.month ? `${p.day} ${p.month}` : ''
}
// e.g. "Muharam 1448 H"
export function hijriMonthYear(d: Date): string {
  const p = hijriParts(d)
  return p.month && p.year ? `${p.month} ${p.year} H` : ''
}

// ── Javanese Weton (dino + pasaran) ───────────────────────────
const DINO    = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']
const PASARAN = ['Legi', 'Pahing', 'Pon', 'Wage', 'Kliwon']
// Anchor: 17 Aug 1945 (Indonesian Independence) = Jumat Legi → pasaran index 0.
const WETON_ANCHOR = Date.UTC(1945, 7, 17)

export function pasaran(d: Date): string {
  const cur  = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())
  const days = Math.round((cur - WETON_ANCHOR) / 86_400_000)
  return PASARAN[((days % 5) + 5) % 5]
}
// e.g. "Jumat Legi"
export function weton(d: Date): string {
  return `${DINO[d.getDay()]} ${pasaran(d)}`
}

// Parse a 'YYYY-MM-DD' string to a local Date at midnight.
export function dateFromYmd(ymd: string): Date {
  return new Date(ymd + 'T00:00:00')
}
