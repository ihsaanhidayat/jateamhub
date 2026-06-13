// Indonesian national holidays (tanggal merah). Bundled — no network/3rd party.
//
// FIXED = same Gregorian date every year. VARIABLE = movable (Islamic/lunar/
// Christian) dates that must be refreshed per year from the official SKB.
// 2026 is verified from SKB 3 Menteri (No. 1497/2025). Refresh other years.

const FIXED: Record<string, string> = {
  '01-01': 'Tahun Baru Masehi',
  '05-01': 'Hari Buruh Internasional',
  '06-01': 'Hari Lahir Pancasila',
  '08-17': 'Hari Kemerdekaan RI',
  '12-25': 'Hari Raya Natal',
}

// keyed by full 'YYYY-MM-DD'
const VARIABLE: Record<string, string> = {
  // ── 2026 (verified, SKB 3 Menteri) ──
  '2026-01-16': 'Isra Mikraj Nabi Muhammad SAW',
  '2026-02-17': 'Tahun Baru Imlek 2577',
  '2026-03-19': 'Hari Suci Nyepi (Saka 1948)',
  '2026-03-21': 'Idul Fitri 1447 H',
  '2026-03-22': 'Idul Fitri 1447 H',
  '2026-04-03': 'Wafat Yesus Kristus',
  '2026-04-05': 'Kebangkitan Yesus Kristus (Paskah)',
  '2026-05-14': 'Kenaikan Yesus Kristus',
  '2026-05-27': 'Idul Adha 1447 H',
  '2026-05-31': 'Hari Raya Waisak 2570 BE',
  '2026-06-16': 'Tahun Baru Islam 1448 H',
  '2026-08-25': 'Maulid Nabi Muhammad SAW',
}

// Returns the holiday name for a 'YYYY-MM-DD' date, or undefined.
export function holidayOn(ymd: string): string | undefined {
  return VARIABLE[ymd] ?? FIXED[ymd.slice(5)]
}
export function isHoliday(ymd: string): boolean {
  return holidayOn(ymd) !== undefined
}
