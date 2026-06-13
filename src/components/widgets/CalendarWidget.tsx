import { memo, useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useStore } from '../../store/dashboardStore'
import { hijriDayMonth, weton, dateFromYmd } from '../../utils/dates'
import { holidayOn } from '../../utils/holidays'
import type { CalendarEvent, CalendarKind } from '../../types'

// ── Constants ─────────────────────────────────────────────────────────
const MONTH_NAMES = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember']
const DAY_NAMES   = ['Min','Sen','Sel','Rab','Kam','Jum','Sab']
const RED         = '#E2483D'

function pad(n: number) { return String(n).padStart(2, '0') }
function today() { return new Date().toISOString().split('T')[0] }
// Legacy 'todo'/undefined entries render as 'event'.
const kindOf = (e: CalendarEvent): CalendarKind => (e.kind === 'note' ? 'note' : 'event')

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

// ── Google Calendar template URL + .ics export ─────────────────────────
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
  const [viewYear,     setViewYear]     = useState(now.getFullYear())
  const [viewMonth,    setViewMonth]    = useState(now.getMonth())
  const [selectedDate, setSelectedDate] = useState<string>(today())
  const [showAddForm,  setShowAddForm]  = useState(false)
  const [newKind,      setNewKind]      = useState<CalendarKind>('event')
  const [newTitle,     setNewTitle]     = useState('')
  const [newTime,      setNewTime]      = useState('')
  const [discardConfirm, setDiscardConfirm] = useState(false)
  const [editId,       setEditId]       = useState<string | null>(null)
  const notifSent = useRef<Set<string>>(new Set())
  const addTimeRef = useRef<HTMLInputElement>(null)
  const lastTap    = useRef<{ date: string; t: number }>({ date: '', t: 0 })

  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768)
  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', h)
    return () => window.removeEventListener('resize', h)
  }, [])

  // ── Load + persist events ───────────────────────────────────────────
  const rawDesc = useStore(s => {
    const sec = s.personalSections.find(p => p.id === sectionId)
    return sec?.items[0]?.desc ?? '[]'
  })
  const [events, setEvents] = useState<CalendarEvent[]>(() => {
    try { return JSON.parse(rawDesc) } catch { return [] }
  })
  useEffect(() => { try { setEvents(JSON.parse(rawDesc)) } catch {} }, [rawDesc])

  const saveEvents = useCallback((next: CalendarEvent[]) => {
    setEvents(next)
    const store = useStore.getState()
    const sec   = store.personalSections.find(p => p.id === sectionId)
    if (!sec) return
    const item0  = sec.items[0] ?? { id: `cal-${sectionId}`, title: '', url: '', icon: '', tags: [], newTab: false, iconUrl: '', useFavicon: false }
    const items  = [{ ...item0, desc: JSON.stringify(next) }, ...sec.items.slice(1)]
    store.updatePersonalSection(sectionId, { items, subtitle: next.length === 0 ? '' : `${next.length} agenda` })
    store.syncPersonalToDb()
  }, [sectionId])

  const eventsByDate = useMemo(() => {
    const m = new Map<string, CalendarEvent[]>()
    for (const e of events) { const arr = m.get(e.date) ?? []; arr.push(e); m.set(e.date, arr) }
    for (const arr of m.values()) arr.sort((a, b) => (a.time ?? '99:99').localeCompare(b.time ?? '99:99'))
    return m
  }, [events])

  // ── Notifications: events with a time due within 30 min ─────────────
  useEffect(() => {
    const tick = () => {
      const td = today()
      events.filter(e => kindOf(e) === 'event' && e.date === td && e.time && !notifSent.current.has(e.id)).forEach(e => {
        const [hh, mm] = e.time!.split(':').map(Number)
        const due = new Date(); due.setHours(hh, mm, 0, 0)
        const diff = due.getTime() - Date.now()
        if (diff > 0 && diff <= 30 * 60_000) {
          notifSent.current.add(e.id)
          if (Notification.permission === 'granted')
            new Notification('📅 Acara Segera', { body: e.title, icon: '/icon-192.png' })
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

  // ── Add form helpers ────────────────────────────────────────────────
  const openAdd = (date?: string) => {
    if (date) setSelectedDate(date)
    setNewKind('event'); setNewTitle(''); setNewTime(''); setDiscardConfirm(false); setEditId(null)
    setShowAddForm(true)
  }
  const closeAdd = () => {
    // Confirm before discarding typed text.
    if ((newTitle.trim() || newTime) && !discardConfirm) { setDiscardConfirm(true); return }
    setShowAddForm(false); setDiscardConfirm(false); setNewTitle(''); setNewTime('')
  }
  const addEvent = () => {
    if (!newTitle.trim()) return
    const ev: CalendarEvent = {
      id: crypto.randomUUID(), date: selectedDate, title: newTitle.trim(),
      time: newKind === 'event' ? (newTime || undefined) : undefined,
      kind: newKind, createdAt: Date.now(),
    }
    saveEvents([...events, ev])
    setNewTitle(''); setNewTime(''); setShowAddForm(false); setDiscardConfirm(false)
    if (Notification.permission === 'default') Notification.requestPermission()
  }
  const deleteEvent = (id: string) => { saveEvents(events.filter(e => e.id !== id)); setEditId(null) }
  const saveEdit = (id: string, patch: Partial<CalendarEvent>) => {
    saveEvents(events.map(e => e.id === id ? { ...e, ...patch } : e)); setEditId(null)
  }

  const requestNotif = () => { if (Notification.permission === 'default') Notification.requestPermission() }

  // ── Date cell tap (single = select, double on mobile = add) ─────────
  const onCellTap = (date: string) => {
    setSelectedDate(date); setShowAddForm(false)
    if (isMobile) {
      const n = Date.now()
      if (lastTap.current.date === date && n - lastTap.current.t < 350) {
        lastTap.current = { date: '', t: 0 }
        openAdd(date)
        return
      }
      lastTap.current = { date, t: n }
    }
  }

  // ── Derived ──────────────────────────────────────────────────────────
  const cells = buildGrid(viewYear, viewMonth)
  const isTodayStr = today()
  const selectedEvs = eventsByDate.get(selectedDate) ?? []
  const cellSize = isExpanded ? 46 : 36
  const notifOff = typeof Notification !== 'undefined' && Notification.permission === 'default'
  const selDate = dateFromYmd(selectedDate)
  const selHoliday = holidayOn(selectedDate)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '8px 10px', gap: 6 }}>
      {/* Chalk filter def */}
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
        <defs>
          <filter id="calChalk">
            <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="7" result="n" />
            <feDisplacementMap in="SourceGraphic" in2="n" scale="1.7" />
          </filter>
        </defs>
      </svg>

      {/* Header — bold month/year, nav on the right */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, padding: '0 2px' }}>
        <div style={{ flex: 1, minWidth: 0, fontSize: 16, fontWeight: 800, color: 'var(--silver)', fontFamily: 'var(--font)', letterSpacing: '-0.4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {MONTH_NAMES[viewMonth]} <span style={{ color: 'var(--silver4)', fontWeight: 700 }}>{viewYear}</span>
        </div>
        <button onClick={goToday} title="Hari ini" style={{
          width: 9, height: 9, borderRadius: '50%', padding: 0, flexShrink: 0,
          background: 'var(--accent)', border: 'none', cursor: 'pointer',
          boxShadow: '0 0 0 3px color-mix(in srgb, var(--accent) 18%, transparent)',
        }} />
        <button onClick={prevMonth} style={navBtn} aria-label="Bulan sebelumnya">‹</button>
        <button onClick={nextMonth} style={navBtn} aria-label="Bulan berikutnya">›</button>
      </div>

      {/* Day header row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, flexShrink: 0 }}>
        {DAY_NAMES.map((d, i) => (
          <div key={d} style={{ textAlign: 'center', fontSize: 9, fontWeight: 800, color: i === 0 ? RED : 'var(--silver4)', fontFamily: 'var(--mono)', letterSpacing: '0.5px', padding: '1px 0 3px' }}>{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3, flexShrink: 0 }}>
        {cells.map((cell, i) => {
          const isTd   = cell.date === isTodayStr
          const isSel  = cell.date === selectedDate
          const has    = (eventsByDate.get(cell.date)?.length ?? 0) > 0
          const holi   = holidayOn(cell.date)
          const isSun  = i % 7 === 0
          const redDay = (!!holi || isSun) && cell.curr
          const pill   = cellSize - 10
          return (
            <button
              key={i}
              onClick={() => onCellTap(cell.date)}
              onDoubleClick={() => { if (!isMobile) openAdd(cell.date) }}
              title={holi ?? undefined}
              style={{
                position: 'relative', height: cellSize, borderRadius: 12,
                border: isSel && !isTd ? '1.5px solid var(--accent)' : '1.5px solid transparent',
                background: 'transparent', cursor: 'pointer', padding: 0,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
                transition: 'border-color 140ms',
              }}
            >
              {has && (
                <svg className="cal-chalk" viewBox="0 0 40 36" preserveAspectRatio="none"
                  style={{ position: 'absolute', inset: -1, width: 'calc(100% + 2px)', height: 'calc(100% + 2px)', pointerEvents: 'none', overflow: 'visible', zIndex: 0 }}>
                  <path d="M29 7 C 38 9 38 27 21 30 C 5 33 2 12 17 7 C 24 4.5 31 6 32.5 12"
                    fill="none" stroke={RED} strokeWidth="2" strokeLinecap="round"
                    strokeDasharray="300" filter="url(#calChalk)" opacity="0.9" />
                </svg>
              )}
              <span style={{
                width: pill, height: pill, borderRadius: '50%', zIndex: 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: isTd ? 'var(--accent)' : 'transparent',
                boxShadow: isTd ? '0 3px 10px color-mix(in srgb, var(--accent) 45%, transparent)' : 'none',
                fontSize: 12.5, lineHeight: 1,
                fontWeight: isTd ? 800 : cell.curr ? 600 : 400,
                color: isTd ? '#fff' : redDay ? RED : cell.curr ? 'var(--silver)' : 'var(--silver4)',
              }}>{Number(cell.date.split('-')[2])}</span>
              {holi && cell.curr && !isTd && <span style={{ position: 'absolute', bottom: 3, width: 4, height: 4, borderRadius: '50%', background: RED, zIndex: 1 }} />}
            </button>
          )
        })}
      </div>

      {/* Day detail — agenda panel */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
        {/* Date + add */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, gap: 8 }}>
          <div style={{ fontSize: 12.5, fontWeight: 800, color: selHoliday ? RED : 'var(--silver)', fontFamily: 'var(--font)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>
            {formatDisplayDate(selectedDate)}
          </div>
          <button onClick={() => (showAddForm ? closeAdd() : openAdd())}
            style={{
              display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0,
              fontSize: 10.5, fontWeight: 700, color: showAddForm ? 'var(--silver3)' : 'white',
              background: showAddForm ? 'var(--bg4)' : RED, border: showAddForm ? '1px solid var(--border2)' : 'none',
              borderRadius: 7, padding: '4px 10px', cursor: 'pointer', fontFamily: 'var(--font)', whiteSpace: 'nowrap',
            }}>
            {showAddForm ? 'Batal' : '＋ Tambah'}
          </button>
        </div>
        {selHoliday && (
          <div style={{ fontSize: 9.5, color: RED, fontWeight: 700, fontFamily: 'var(--mono)', flexShrink: 0, lineHeight: 1.3 }}>🔴 {selHoliday}</div>
        )}

        {/* Discard confirm */}
        {discardConfirm && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', background: 'var(--bg4)', border: '1px solid var(--border2)', borderRadius: 7, flexShrink: 0 }}>
            <span style={{ fontSize: 11, color: 'var(--silver2)', flex: 1 }}>Buang masukan?</span>
            <button onClick={() => { setShowAddForm(false); setDiscardConfirm(false); setNewTitle(''); setNewTime('') }} style={{ height: 22, padding: '0 8px', background: 'var(--red)', border: 'none', borderRadius: 5, color: 'white', fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font)' }}>Ya</button>
            <button onClick={() => setDiscardConfirm(false)} style={{ height: 22, padding: '0 8px', background: 'none', border: '1px solid var(--border2)', borderRadius: 5, color: 'var(--silver3)', fontSize: 10, cursor: 'pointer', fontFamily: 'var(--font)' }}>Tidak</button>
          </div>
        )}

        {/* Add form */}
        {showAddForm && !discardConfirm && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 8, background: 'var(--bg4)', borderRadius: 8, border: '1px solid var(--border2)', flexShrink: 0, animation: 'slideDown 150ms ease' }}>
            {/* Penanda: Event / Catatan */}
            <div style={{ display: 'flex', gap: 4, background: 'var(--bg)', borderRadius: 7, padding: 3 }}>
              {([['event', '🔴 Event'], ['note', '📝 Catatan']] as const).map(([k, lbl]) => (
                <button key={k} onClick={() => setNewKind(k)} style={{
                  flex: 1, height: 26, borderRadius: 5, border: 'none', cursor: 'pointer',
                  fontSize: 10.5, fontWeight: 700, fontFamily: 'var(--font)',
                  background: newKind === k ? RED : 'transparent',
                  color: newKind === k ? 'white' : 'var(--silver3)',
                }}>{lbl}</button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input autoFocus value={newTitle} onChange={e => setNewTitle(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addEvent() }}
                placeholder={newKind === 'event' ? 'Judul event...' : 'Catatan / aktivitas...'}
                style={{ flex: 1, height: 32, padding: '0 10px', background: 'var(--bg)', border: '1px solid var(--border2)', borderRadius: 6, fontSize: 12, color: 'var(--silver)', fontFamily: 'var(--font)', outline: 'none', boxSizing: 'border-box' }} />
              {/* Clock icon → time picker (events only) */}
              {newKind === 'event' && (
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <button onClick={() => addTimeRef.current?.showPicker?.()} title="Pilih jam"
                    style={{ width: 32, height: 32, borderRadius: 6, border: `1px solid ${newTime ? RED : 'var(--border2)'}`, background: newTime ? 'color-mix(in srgb, ' + RED + ' 12%, transparent)' : 'var(--bg)', color: newTime ? RED : 'var(--silver3)', cursor: 'pointer', fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🕐</button>
                  <input ref={addTimeRef} type="time" value={newTime} onChange={e => setNewTime(e.target.value)}
                    style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: 0, height: 0, top: 0, left: 0 }} tabIndex={-1} />
                </div>
              )}
            </div>
            {newKind === 'event' && newTime && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, alignSelf: 'flex-start', fontSize: 10, fontFamily: 'var(--mono)', color: RED, background: 'color-mix(in srgb, ' + RED + ' 12%, transparent)', borderRadius: 5, padding: '2px 7px' }}>
                🕐 {newTime}
                <button onClick={() => setNewTime('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: RED, fontSize: 11, padding: 0, lineHeight: 1 }}>×</button>
              </span>
            )}
            <button onClick={addEvent} disabled={!newTitle.trim()}
              style={{ height: 28, background: newTitle.trim() ? RED : 'var(--border2)', border: 'none', borderRadius: 6, color: 'white', fontSize: 11, fontWeight: 700, cursor: newTitle.trim() ? 'pointer' : 'not-allowed', fontFamily: 'var(--font)' }}>
              {newKind === 'event' ? 'Tambah event' : 'Tambah catatan'}
            </button>
          </div>
        )}

        {notifOff && selectedEvs.length > 0 && (
          <button onClick={requestNotif} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, height: 26, flexShrink: 0, background: 'color-mix(in srgb, ' + RED + ' 10%, transparent)', border: '1px solid color-mix(in srgb, ' + RED + ' 30%, transparent)', borderRadius: 7, color: RED, fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--mono)' }}>🔔 Aktifkan pengingat</button>
        )}

        {/* Entry rows */}
        <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
          {selectedEvs.length === 0 && !showAddForm && (
            <div style={{ fontSize: 11, color: 'var(--silver4)', fontFamily: 'var(--font)', padding: '10px 0', textAlign: 'center' }}>
              Tidak ada agenda{isMobile ? ' · ketuk dua kali tanggal' : ''}
            </div>
          )}
          {selectedEvs.map((ev, idx) => {
            if (editId === ev.id) return (
              <EntryEditor key={ev.id} ev={ev} onCancel={() => setEditId(null)} onSave={p => saveEdit(ev.id, p)} onDelete={() => deleteEvent(ev.id)} />
            )
            const isEvent = kindOf(ev) === 'event'
            return (
              <div key={ev.id} className="cal-row" style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 8,
                background: 'var(--bg4)', border: '1px solid var(--border)', animationDelay: `${idx * 40}ms`,
              }}>
                <span style={{ width: 7, height: 7, flexShrink: 0, borderRadius: isEvent ? '50%' : 2, background: RED, opacity: isEvent ? 1 : 0.5 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--silver)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ev.title}</div>
                  <div style={{ fontSize: 9.5, color: 'var(--silver4)', fontFamily: 'var(--mono)', display: 'flex', alignItems: 'center', gap: 5, marginTop: 1 }}>
                    {ev.time && <span>🕐 {ev.time}</span>}
                    {!isEvent && <span>catatan</span>}
                  </div>
                </div>
                {isEvent && (
                  <>
                    <a href={gcalUrl(ev)} target="_blank" rel="noopener noreferrer" title="Tambah ke Google Calendar"
                      style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, borderRadius: 6, color: 'var(--silver3)', textDecoration: 'none' }}
                      onMouseEnter={e => (e.currentTarget.style.color = RED)} onMouseLeave={e => (e.currentTarget.style.color = 'var(--silver3)')}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    </a>
                    <button onClick={() => downloadIcs(ev)} title="Unduh .ics"
                      style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, borderRadius: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--silver3)' }}
                      onMouseEnter={e => (e.currentTarget.style.color = RED)} onMouseLeave={e => (e.currentTarget.style.color = 'var(--silver3)')}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    </button>
                  </>
                )}
                {/* Edit (replaces the old trash) */}
                <button onClick={() => setEditId(ev.id)} title="Edit"
                  style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, borderRadius: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--silver3)' }}
                  onMouseEnter={e => (e.currentTarget.style.color = RED)} onMouseLeave={e => (e.currentTarget.style.color = 'var(--silver3)')}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </button>
              </div>
            )
          })}
        </div>

        {/* Keterangan — bottom-left: Hijri · Weton (always shown, quiet) */}
        <div style={{ flexShrink: 0, fontSize: 9.5, color: 'var(--silver4)', fontFamily: 'var(--mono)', paddingTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          ☪ {hijriDayMonth(selDate)} · ꦮ {weton(selDate)}
        </div>
      </div>
    </div>
  )
})

// Inline editor for an existing entry (title, time for events, Delete + Save).
function EntryEditor({ ev, onSave, onDelete, onCancel }: { ev: CalendarEvent; onSave: (p: Partial<CalendarEvent>) => void; onDelete: () => void; onCancel: () => void }) {
  const isEvent = ev.kind !== 'note'
  const [title, setTitle] = useState(ev.title)
  const [time,  setTime]  = useState(ev.time ?? '')
  const timeRef = useRef<HTMLInputElement>(null)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 8, background: 'var(--bg4)', border: '1px solid color-mix(in srgb, ' + RED + ' 35%, transparent)', borderRadius: 8 }}>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <input value={title} onChange={e => setTitle(e.target.value)} autoFocus placeholder="Judul"
          style={{ flex: 1, height: 30, padding: '0 10px', background: 'var(--bg)', border: '1px solid var(--border2)', borderRadius: 6, fontSize: 12, color: 'var(--silver)', fontFamily: 'var(--font)', outline: 'none', boxSizing: 'border-box' }} />
        {isEvent && (
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <button onClick={() => timeRef.current?.showPicker?.()} title="Pilih jam"
              style={{ width: 30, height: 30, borderRadius: 6, border: `1px solid ${time ? RED : 'var(--border2)'}`, background: time ? 'color-mix(in srgb, ' + RED + ' 12%, transparent)' : 'var(--bg)', color: time ? RED : 'var(--silver3)', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🕐</button>
            <input ref={timeRef} type="time" value={time} onChange={e => setTime(e.target.value)} style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: 0, height: 0, top: 0, left: 0 }} tabIndex={-1} />
          </div>
        )}
      </div>
      {isEvent && time && <span style={{ alignSelf: 'flex-start', fontSize: 10, fontFamily: 'var(--mono)', color: RED }}>🕐 {time}</span>}
      <div style={{ display: 'flex', gap: 6 }}>
        <button onClick={onDelete} title="Hapus" style={{ height: 30, padding: '0 12px', background: 'none', border: '1px solid color-mix(in srgb, ' + RED + ' 40%, transparent)', borderRadius: 6, color: RED, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)' }}>Hapus</button>
        <button onClick={onCancel} style={{ flex: 1, height: 30, background: 'none', border: '1px solid var(--border2)', borderRadius: 6, color: 'var(--silver3)', fontSize: 11, cursor: 'pointer', fontFamily: 'var(--font)' }}>Batal</button>
        <button onClick={() => onSave({ title: title.trim() || ev.title, time: isEvent ? (time || undefined) : undefined })}
          style={{ flex: 1, height: 30, background: RED, border: 'none', borderRadius: 6, color: 'white', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font)' }}>Simpan</button>
      </div>
    </div>
  )
}

function formatDisplayDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

const navBtn: React.CSSProperties = {
  width: 24, height: 24, borderRadius: 6, border: '1px solid var(--border2)',
  background: 'var(--bg4)', cursor: 'pointer', color: 'var(--silver)',
  fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, padding: 0,
}
