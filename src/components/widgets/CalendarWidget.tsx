import { memo, useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useStore } from '../../store/dashboardStore'
import { useAuthStore } from '../../store/authStore'
import { saveTodoHistory } from '../../utils/supabaseClient'
import type { CalendarEvent, CalendarKind } from '../../types'

// ── Constants ─────────────────────────────────────────────────────────
const MONTH_NAMES = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember']
const DAY_NAMES   = ['Min','Sen','Sel','Rab','Kam','Jum','Sab']
const COLOR_MAP   = { accent: 'var(--accent)', red: 'var(--red)', green: '#16A34A', yellow: '#D97706' }
const COLOR_OPTS  = ['accent','red','green','yellow'] as const
const CHALK_RED   = '#E2483D'

function pad(n: number) { return String(n).padStart(2, '0') }
function today() { return new Date().toISOString().split('T')[0] }
const kindOf = (e: CalendarEvent): CalendarKind => e.kind ?? 'todo'

// ── To-do timing helpers ──────────────────────────────────────────────
const isOverdue = (e: CalendarEvent) => kindOf(e) === 'todo' && !e.done && e.date < today()
const isDueOver = (e: CalendarEvent) => {
  if (kindOf(e) !== 'todo' || e.done || !e.time || e.date !== today()) return false
  const [h, m] = e.time.split(':').map(Number)
  const due = new Date(); due.setHours(h, m, 0, 0); return due.getTime() < Date.now()
}
const isDueSoon = (e: CalendarEvent) => {
  if (kindOf(e) !== 'todo' || e.done || !e.time || e.date !== today()) return false
  const [h, m] = e.time.split(':').map(Number)
  const due = new Date(); due.setHours(h, m, 0, 0)
  const d = due.getTime() - Date.now(); return d > 0 && d < 30 * 60_000
}

function buildGrid(year: number, month: number) {
  const daysInMonth  = new Date(year, month + 1, 0).getDate()
  const firstWeekday = new Date(year, month, 1).getDay()
  const daysInPrev   = new Date(year, month, 0).getDate()
  const cells: { date: string; curr: boolean }[] = []
  for (let i = firstWeekday - 1; i >= 0; i--) {
    const d = daysInPrev - i
    cells.push({ date: `${year}-${pad(month === 0 ? 12 : month)}-${pad(d)}`, curr: false })
  }
  for (let d = 1; d <= daysInMonth; d++) cells.push({ date: `${year}-${pad(month + 1)}-${pad(d)}`, curr: true })
  while (cells.length < 42) {
    const d = cells.length - firstWeekday - daysInMonth + 1
    const nm = month + 2 > 12 ? 1 : month + 2
    const ny = month + 2 > 12 ? year + 1 : year
    cells.push({ date: `${ny}-${pad(nm)}-${pad(d)}`, curr: false })
  }
  return cells
}

// ── Google Calendar template URL (Google delivers the phone push). ─────
function gcalUrl(ev: CalendarEvent) {
  let dates: string
  if (ev.time) {
    const start = new Date(`${ev.date}T${ev.time}:00`)
    const end   = new Date(start.getTime() + 60 * 60 * 1000)
    const f = (d: Date) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`
    dates = `${f(start)}/${f(end)}`
  } else {
    const start = ev.date.replace(/-/g, '')
    const d = new Date(`${ev.date}T00:00:00`); d.setDate(d.getDate() + 1)
    dates = `${start}/${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`
  }
  const p = new URLSearchParams({ action: 'TEMPLATE', text: ev.title, dates, details: 'Dibuat dari JATEAMHUB' })
  return `https://calendar.google.com/calendar/render?${p.toString()}`
}

function downloadIcs(ev: CalendarEvent) {
  const stamp = (d: Date) => `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`
  let dt: string
  if (ev.time) {
    const start = new Date(`${ev.date}T${ev.time}:00`)
    const end   = new Date(start.getTime() + 60 * 60 * 1000)
    dt = `DTSTART:${stamp(start)}\r\nDTEND:${stamp(end)}`
  } else {
    const d = new Date(`${ev.date}T00:00:00`); const nd = new Date(d); nd.setDate(nd.getDate() + 1)
    dt = `DTSTART;VALUE=DATE:${ev.date.replace(/-/g, '')}\r\nDTEND;VALUE=DATE:${nd.getFullYear()}${pad(nd.getMonth() + 1)}${pad(nd.getDate())}`
  }
  const ics = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//JATEAMHUB//Calendar//ID', 'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT', `UID:${ev.id}@jateamhub`, `DTSTAMP:${stamp(new Date())}`, dt,
    `SUMMARY:${ev.title.replace(/([,;\\])/g, '\\$1')}`,
    'BEGIN:VALARM', 'TRIGGER:-PT30M', 'ACTION:DISPLAY', 'DESCRIPTION:Pengingat', 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n')
  const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }))
  const a = document.createElement('a')
  a.href = url; a.download = `${ev.title.slice(0, 40).replace(/[^\w\-]+/g, '_') || 'acara'}.ics`
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// ── CalendarWidget ─────────────────────────────────────────────────────
interface Props { sectionId: string; isExpanded?: boolean }

export default memo(function CalendarWidget({ sectionId, isExpanded }: Props) {
  const now = new Date()
  const { profile } = useAuthStore()
  const [viewYear,     setViewYear]     = useState(now.getFullYear())
  const [viewMonth,    setViewMonth]    = useState(now.getMonth())
  const [selectedDate, setSelectedDate] = useState<string | null>(today())
  const [showAddForm,  setShowAddForm]  = useState(false)
  const [newKind,      setNewKind]      = useState<CalendarKind>('todo')
  const [newTitle,     setNewTitle]     = useState('')
  const [newTime,      setNewTime]      = useState('')
  const [newColor,     setNewColor]     = useState<typeof COLOR_OPTS[number]>('accent')
  const notifSent = useRef<Set<string>>(new Set())

  // ── Load events ─────────────────────────────────────────────────────
  const rawDesc = useStore(s => {
    const sec = s.personalSections.find(p => p.id === sectionId)
    return sec?.items[0]?.desc ?? '[]'
  })
  const [events, setEvents] = useState<CalendarEvent[]>(() => {
    try { return JSON.parse(rawDesc) } catch { return [] }
  })
  useEffect(() => { try { setEvents(JSON.parse(rawDesc)) } catch {} }, [rawDesc])

  // ── Persist ─────────────────────────────────────────────────────────
  const saveEvents = useCallback((next: CalendarEvent[]) => {
    setEvents(next)
    const store = useStore.getState()
    const sec   = store.personalSections.find(p => p.id === sectionId)
    if (!sec) return
    const item0  = sec.items[0] ?? { id: `cal-${sectionId}`, title: '', url: '', icon: '', tags: [], newTab: false, iconUrl: '', useFavicon: false }
    const items  = [{ ...item0, desc: JSON.stringify(next) }, ...sec.items.slice(1)]
    const active = next.filter(e => !(kindOf(e) === 'todo' && e.done)).length
    store.updatePersonalSection(sectionId, { items, subtitle: active === 0 ? '' : `${active} agenda` })
    store.syncPersonalToDb()
  }, [sectionId])

  // ── Entries grouped by date ─────────────────────────────────────────
  const eventsByDate = useMemo(() => {
    const m = new Map<string, CalendarEvent[]>()
    for (const e of events) {
      const arr = m.get(e.date) ?? []; arr.push(e); m.set(e.date, arr)
    }
    for (const arr of m.values()) arr.sort((a, b) => (a.time ?? '99:99').localeCompare(b.time ?? '99:99'))
    return m
  }, [events])

  // ── Notifications (events + to-dos due within 30 min) ───────────────
  useEffect(() => {
    const tick = () => {
      const td = today()
      events.filter(e => e.date === td && e.time && !e.done && !notifSent.current.has(e.id)).forEach(e => {
        const [hh, mm] = e.time!.split(':').map(Number)
        const due = new Date(); due.setHours(hh, mm, 0, 0)
        const diff = due.getTime() - Date.now()
        if (diff > 0 && diff <= 30 * 60_000) {
          notifSent.current.add(e.id)
          if (Notification.permission === 'granted')
            new Notification(kindOf(e) === 'todo' ? '✅ Agenda Segera' : '📅 Acara Segera', { body: e.title, icon: '/icon-192.png' })
        }
      })
    }
    tick()
    const t = setInterval(tick, 30_000)
    return () => clearInterval(t)
  }, [events])

  // ── Nav ─────────────────────────────────────────────────────────────
  const prevMonth = () => { if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) } else setViewMonth(m => m - 1) }
  const nextMonth = () => { if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) } else setViewMonth(m => m + 1) }
  const goToday = () => { setViewYear(now.getFullYear()); setViewMonth(now.getMonth()); setSelectedDate(today()) }

  // ── Add / delete / toggle ───────────────────────────────────────────
  const addEvent = () => {
    if (!newTitle.trim() || !selectedDate) return
    const ev: CalendarEvent = {
      id: crypto.randomUUID(), date: selectedDate, title: newTitle.trim(),
      time: newKind === 'todo' ? (newTime || undefined) : undefined,
      color: newColor, kind: newKind, done: false, createdAt: Date.now(),
    }
    saveEvents([...events, ev])
    setNewTitle(''); setNewTime(''); setNewColor('accent'); setShowAddForm(false)
    if (Notification.permission === 'default') Notification.requestPermission()
  }
  const deleteEvent = (id: string) => saveEvents(events.filter(e => e.id !== id))
  const toggleDone = (ev: CalendarEvent) => {
    const done = !ev.done
    saveEvents(events.map(e => e.id === ev.id ? { ...e, done, doneAt: done ? Date.now() : undefined } : e))
    if (done && profile?.id) {
      // Keep the existing "Riwayat Task" history working.
      void saveTodoHistory(profile.id, [{
        id: ev.id, text: ev.title, done: true, createdAt: ev.createdAt, doneAt: Date.now(),
        dueTime: ev.time, date: ev.date,
      }], isOverdue(ev) ? 'overdue' : 'done').catch(() => {})
    }
  }

  const requestNotif = () => { if (Notification.permission === 'default') Notification.requestPermission() }

  // ── Derived ──────────────────────────────────────────────────────────
  const cells = buildGrid(viewYear, viewMonth)
  const isTodayStr = today()
  const selectedEvs = selectedDate ? (eventsByDate.get(selectedDate) ?? []) : []
  const cellSize = isExpanded ? 40 : 30
  const notifOff = typeof Notification !== 'undefined' && Notification.permission === 'default'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '8px 10px', gap: 6 }}>
      {/* Chalk filter def (one per widget) */}
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
        <defs>
          <filter id="calChalk">
            <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="7" result="n" />
            <feDisplacementMap in="SourceGraphic" in2="n" scale="1.7" />
          </filter>
        </defs>
      </svg>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        <button onClick={prevMonth} style={navBtn} aria-label="Bulan sebelumnya">‹</button>
        <div style={{ flex: 1, textAlign: 'center', minWidth: 0, fontSize: 12.5, fontWeight: 800, color: 'var(--silver)', fontFamily: 'var(--font)', letterSpacing: '-0.2px' }}>
          {MONTH_NAMES[viewMonth]} {viewYear}
        </div>
        <button onClick={nextMonth} style={navBtn} aria-label="Bulan berikutnya">›</button>
        <button onClick={goToday} style={{
          fontSize: 10, fontWeight: 700, color: 'var(--accent)',
          background: 'color-mix(in srgb, var(--accent) 10%, transparent)',
          border: '1px solid color-mix(in srgb, var(--accent) 25%, transparent)',
          borderRadius: 6, padding: '3px 8px', cursor: 'pointer', flexShrink: 0, fontFamily: 'var(--font)',
        }}>Hari ini</button>
      </div>

      {/* Day header row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1, flexShrink: 0 }}>
        {DAY_NAMES.map((d, i) => (
          <div key={d} style={{ textAlign: 'center', fontSize: 9, fontWeight: 700, color: i === 0 ? 'var(--red)' : 'var(--silver4)', fontFamily: 'var(--mono)', padding: '2px 0' }}>{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, flexShrink: 0 }}>
        {cells.map((cell, i) => {
          const isTd  = cell.date === isTodayStr
          const isSel = cell.date === selectedDate
          const has   = (eventsByDate.get(cell.date)?.length ?? 0) > 0
          return (
            <button
              key={i}
              onClick={() => { setSelectedDate(cell.date); setShowAddForm(false) }}
              style={{
                position: 'relative', height: cellSize, borderRadius: 8,
                border: isSel ? '1px solid var(--border2)' : '1px solid transparent',
                background: isSel ? 'var(--bg4)' : 'transparent',
                cursor: 'pointer', padding: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              {has && (
                <svg className="cal-chalk" viewBox="0 0 40 36" preserveAspectRatio="none"
                  style={{ position: 'absolute', inset: -1, width: 'calc(100% + 2px)', height: 'calc(100% + 2px)', pointerEvents: 'none', overflow: 'visible' }}>
                  <path d="M29 7 C 38 9 38 27 21 30 C 5 33 2 12 17 7 C 24 4.5 31 6 32.5 12"
                    fill="none" stroke={CHALK_RED} strokeWidth="2" strokeLinecap="round"
                    strokeDasharray="300" filter="url(#calChalk)" opacity="0.9" />
                </svg>
              )}
              <span style={{
                fontSize: 11, fontWeight: isTd ? 800 : cell.curr ? 600 : 400,
                color: isTd ? 'var(--accent)' : cell.curr ? 'var(--silver)' : 'var(--silver4)',
                lineHeight: 1, zIndex: 1,
              }}>{Number(cell.date.split('-')[2])}</span>
            </button>
          )
        })}
      </div>

      {/* Day detail */}
      {selectedDate && (
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 10, fontWeight: 700, color: 'var(--silver3)', fontFamily: 'var(--mono)', letterSpacing: '0.5px', flexShrink: 0 }}>
            <span>{formatDisplayDate(selectedDate)}</span>
            <button onClick={() => { setShowAddForm(v => !v); setNewKind('todo'); setNewTitle(''); setNewTime(''); setNewColor('accent') }}
              style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font)', padding: 0 }}>
              {showAddForm ? 'Batal' : '+ Tambah'}
            </button>
          </div>

          {/* Add form */}
          {showAddForm && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 8, background: 'var(--bg4)', borderRadius: 8, border: '1px solid var(--border2)', flexShrink: 0, animation: 'slideDown 150ms ease' }}>
              {/* Kind toggle */}
              <div style={{ display: 'flex', gap: 4, background: 'var(--bg)', borderRadius: 7, padding: 3 }}>
                {([['todo', '✅ Acara / To-do'], ['note', '📝 Catatan']] as const).map(([k, lbl]) => (
                  <button key={k} onClick={() => setNewKind(k)} style={{
                    flex: 1, height: 26, borderRadius: 5, border: 'none', cursor: 'pointer',
                    fontSize: 10.5, fontWeight: 700, fontFamily: 'var(--font)',
                    background: newKind === k ? 'var(--accent)' : 'transparent',
                    color: newKind === k ? 'white' : 'var(--silver3)',
                  }}>{lbl}</button>
                ))}
              </div>
              <input autoFocus value={newTitle} onChange={e => setNewTitle(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addEvent() }}
                placeholder={newKind === 'todo' ? 'Judul acara / tugas...' : 'Catatan / aktivitas hari ini...'}
                style={{ height: 32, padding: '0 10px', background: 'var(--bg)', border: '1px solid var(--border2)', borderRadius: 6, fontSize: 12, color: 'var(--silver)', fontFamily: 'var(--font)', outline: 'none', width: '100%', boxSizing: 'border-box' }}
                onFocus={e => e.target.style.borderColor = 'var(--accent)'} onBlur={e => e.target.style.borderColor = 'var(--border2)'} />
              {newKind === 'todo' && (
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input type="time" value={newTime} onChange={e => setNewTime(e.target.value)}
                    style={{ height: 28, padding: '0 8px', flex: 1, background: 'var(--bg)', border: '1px solid var(--border2)', borderRadius: 6, fontSize: 11, color: 'var(--silver)', fontFamily: 'var(--font)', outline: 'none', boxSizing: 'border-box' }} />
                  {COLOR_OPTS.map(c => (
                    <button key={c} onClick={() => setNewColor(c)} aria-label={`Warna ${c}`}
                      style={{ width: 16, height: 16, borderRadius: '50%', background: COLOR_MAP[c], border: newColor === c ? '2px solid var(--silver)' : '2px solid transparent', cursor: 'pointer', flexShrink: 0, padding: 0 }} />
                  ))}
                </div>
              )}
              <button onClick={addEvent} disabled={!newTitle.trim()}
                style={{ height: 28, background: newTitle.trim() ? 'var(--accent)' : 'var(--border2)', border: 'none', borderRadius: 6, color: 'white', fontSize: 11, fontWeight: 700, cursor: newTitle.trim() ? 'pointer' : 'not-allowed', fontFamily: 'var(--font)' }}>
                {newKind === 'todo' ? 'Tambah acara' : 'Tambah catatan'}
              </button>
            </div>
          )}

          {notifOff && selectedEvs.length > 0 && (
            <button onClick={requestNotif} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, height: 26, flexShrink: 0, background: 'var(--accent-light)', border: '1px solid var(--accent-soft)', borderRadius: 7, color: 'var(--accent)', fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--mono)' }}>🔔 Aktifkan pengingat di perangkat ini</button>
          )}

          {/* Entry rows */}
          <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
            {selectedEvs.length === 0 && !showAddForm && (
              <div style={{ fontSize: 11, color: 'var(--silver4)', fontFamily: 'var(--font)', padding: '10px 0', textAlign: 'center' }}>Tidak ada agenda</div>
            )}
            {selectedEvs.map((ev, idx) => {
              const kind = kindOf(ev)
              const over = isOverdue(ev) || isDueOver(ev), soon = isDueSoon(ev)
              return (
                <div key={ev.id} className="cal-row" style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 8,
                  background: over ? 'color-mix(in srgb, var(--red) 6%, var(--bg4))' : 'var(--bg4)',
                  border: '1px solid var(--border)', animationDelay: `${idx * 40}ms`,
                }}>
                  {kind === 'todo' ? (
                    <button onClick={() => toggleDone(ev)} aria-label={ev.done ? 'Batalkan' : 'Tandai selesai'} style={{
                      width: 17, height: 17, flexShrink: 0, borderRadius: 5,
                      border: `1.5px solid ${ev.done ? 'var(--accent)' : over ? 'var(--red)' : 'var(--border2)'}`,
                      background: ev.done ? 'var(--accent)' : 'none', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 10, padding: 0,
                    }}>{ev.done ? '✓' : ''}</button>
                  ) : (
                    <span style={{ width: 7, height: 7, flexShrink: 0, borderRadius: 2, background: COLOR_MAP[ev.color ?? 'accent'] }} />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 11.5, fontWeight: 600,
                      color: ev.done ? 'var(--silver4)' : over ? 'var(--red)' : 'var(--silver)',
                      textDecoration: ev.done ? 'line-through' : 'none',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>{ev.title}</div>
                    <div style={{ fontSize: 9.5, color: 'var(--silver4)', fontFamily: 'var(--mono)', display: 'flex', alignItems: 'center', gap: 5, marginTop: 1 }}>
                      {ev.time && <span style={{ color: over ? 'var(--red)' : soon ? '#F59E0B' : 'var(--silver4)' }}>🕐 {ev.time}{over ? ' ⚠️' : soon ? ' !' : ''}</span>}
                      {kind === 'note' && <span style={{ color: 'var(--silver4)' }}>catatan</span>}
                    </div>
                  </div>
                  {kind === 'todo' && (
                    <>
                      <a href={gcalUrl(ev)} target="_blank" rel="noopener noreferrer" title="Tambah ke Google Calendar"
                        style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, borderRadius: 6, color: 'var(--silver3)', textDecoration: 'none' }}
                        onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent)')} onMouseLeave={e => (e.currentTarget.style.color = 'var(--silver3)')}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="12" y1="14" x2="12" y2="18"/><line x1="10" y1="16" x2="14" y2="16"/></svg>
                      </a>
                      <button onClick={() => downloadIcs(ev)} title="Unduh .ics"
                        style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, borderRadius: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--silver3)' }}
                        onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent)')} onMouseLeave={e => (e.currentTarget.style.color = 'var(--silver3)')}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                      </button>
                    </>
                  )}
                  <button onClick={() => deleteEvent(ev.id)} aria-label="Hapus"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--silver4)', padding: 2, fontSize: 14, lineHeight: 1, flexShrink: 0 }}>×</button>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
})

function formatDisplayDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' })
}

const navBtn: React.CSSProperties = {
  width: 24, height: 24, borderRadius: 6, border: '1px solid var(--border2)',
  background: 'var(--bg4)', cursor: 'pointer', color: 'var(--silver)',
  fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, padding: 0,
}
