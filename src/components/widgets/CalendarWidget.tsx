import { memo, useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useStore } from '../../store/dashboardStore'
import { hijriDate, weton, dateFromYmd } from '../../utils/dates'
import { holidayOn } from '../../utils/holidays'
import { IconChevL, IconChevR, IconClock, IconPlus, IconEdit } from '../ui/icons'
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
  const cellSize = isExpanded ? 38 : 28
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

      {/* Header — compact month/year, nav on the right */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, padding: '0 2px' }}>
        <div style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 800, color: 'var(--silver)', fontFamily: 'var(--font)', letterSpacing: '-0.3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {MONTH_NAMES[viewMonth]} <span style={{ color: 'var(--silver4)', fontWeight: 700 }}>{viewYear}</span>
        </div>
        <button onClick={goToday} title="Hari ini" style={{
          width: 8, height: 8, borderRadius: '50%', padding: 0, flexShrink: 0, marginRight: 2,
          background: 'var(--accent)', border: 'none', cursor: 'pointer',
          boxShadow: '0 0 0 3px color-mix(in srgb, var(--accent) 18%, transparent)',
        }} />
        <button onClick={prevMonth} style={navBtn} aria-label="Bulan sebelumnya"><IconChevL size={13} /></button>
        <button onClick={nextMonth} style={navBtn} aria-label="Bulan berikutnya"><IconChevR size={13} /></button>
      </div>

      {/* Day header row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, flexShrink: 0 }}>
        {DAY_NAMES.map((d, i) => (
          <div key={d} style={{ textAlign: 'center', fontSize: 8.5, fontWeight: 800, color: i === 0 ? RED : 'var(--silver4)', fontFamily: 'var(--mono)', letterSpacing: '0.3px', padding: '0 0 2px' }}>{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, flexShrink: 0 }}>
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

      {/* Keterangan — exactly under the dates: Hijri · Weton (+ holiday) */}
      <div style={{ flexShrink: 0, fontSize: 9.5, color: 'var(--silver4)', fontFamily: 'var(--mono)', textAlign: 'left', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        ☪ {hijriDate(selDate)} · {weton(selDate)}
        {selHoliday && <span style={{ color: RED, fontWeight: 700 }}> · {selHoliday}</span>}
      </div>

      {/* Day detail — agenda panel */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 4, marginTop: 2, paddingTop: 7, borderTop: '1px solid var(--border)' }}>
        {/* Date (add via double-click / double-tap a date) */}
        <div style={{ fontSize: 12.5, fontWeight: 800, color: selHoliday ? RED : 'var(--silver)', fontFamily: 'var(--font)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0, flexShrink: 0 }}>
          {formatDisplayDate(selectedDate)}
        </div>

        {/* Discard confirm */}
        {discardConfirm && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', background: 'var(--bg4)', border: '1px solid var(--border2)', borderRadius: 7, flexShrink: 0 }}>
            <span style={{ fontSize: 11, color: 'var(--silver2)', flex: 1 }}>Buang masukan?</span>
            <button onClick={() => { setShowAddForm(false); setDiscardConfirm(false); setNewTitle(''); setNewTime('') }} style={{ height: 22, padding: '0 8px', background: 'var(--red)', border: 'none', borderRadius: 5, color: 'white', fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font)' }}>Ya</button>
            <button onClick={() => setDiscardConfirm(false)} style={{ height: 22, padding: '0 8px', background: 'none', border: '1px solid var(--border2)', borderRadius: 5, color: 'var(--silver3)', fontSize: 10, cursor: 'pointer', fontFamily: 'var(--font)' }}>Tidak</button>
          </div>
        )}

        {/* Add form — badges (penanda) above, inline input below */}
        {showAddForm && !discardConfirm && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, padding: 6, background: 'var(--bg4)', borderRadius: 8, border: '1px solid var(--border2)', flexShrink: 0, animation: 'slideDown 150ms ease' }}>
            {/* Penanda badges (not in the input row) */}
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              {([['event', 'Event'], ['note', 'Catatan']] as const).map(([k, lbl]) => {
                const on = newKind === k
                return (
                  <button key={k} onClick={() => setNewKind(k)} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4, height: 20, padding: '0 9px',
                    borderRadius: 99, cursor: 'pointer', fontSize: 9.5, fontWeight: 700, fontFamily: 'var(--mono)',
                    border: `1px solid ${on ? (k === 'event' ? RED : 'var(--accent)') : 'var(--border2)'}`,
                    background: on ? (k === 'event' ? 'color-mix(in srgb, ' + RED + ' 14%, transparent)' : 'var(--accent-light)') : 'transparent',
                    color: on ? (k === 'event' ? RED : 'var(--accent)') : 'var(--silver4)',
                  }}>
                    <span style={{ width: 6, height: 6, borderRadius: k === 'event' ? '50%' : 2, background: k === 'event' ? RED : 'var(--accent)', opacity: on ? 1 : 0.5 }} />{lbl}
                  </button>
                )
              })}
            </div>
            <div style={{ display: 'flex', gap: 5, alignItems: 'center', flexWrap: 'wrap' }}>
            <input autoFocus value={newTitle} onChange={e => setNewTitle(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addEvent() }}
              placeholder={newKind === 'event' ? 'Judul event…' : 'Catatan…'}
              style={{ flex: '1 1 90px', minWidth: 80, height: 28, padding: '0 9px', background: 'var(--bg)', border: '1px solid var(--border2)', borderRadius: 6, fontSize: 11.5, color: 'var(--silver)', fontFamily: 'var(--font)', outline: 'none', boxSizing: 'border-box' }} />
            {newKind === 'event' && (
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <button onClick={() => addTimeRef.current?.showPicker?.()} title="Pilih jam"
                  style={{ width: 28, height: 28, borderRadius: 6, border: `1px solid ${newTime ? RED : 'var(--border2)'}`, background: newTime ? 'color-mix(in srgb, ' + RED + ' 12%, transparent)' : 'var(--bg)', color: newTime ? RED : 'var(--silver3)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><IconClock size={14} /></button>
                <input ref={addTimeRef} type="time" value={newTime} onChange={e => setNewTime(e.target.value)}
                  style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: 0, height: 0, top: 0, left: 0 }} tabIndex={-1} />
              </div>
            )}
            {newKind === 'event' && newTime && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 9.5, fontFamily: 'var(--mono)', color: RED, background: 'color-mix(in srgb, ' + RED + ' 12%, transparent)', borderRadius: 5, padding: '2px 6px', flexShrink: 0 }}>
                {newTime}<button onClick={() => setNewTime('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: RED, fontSize: 11, padding: 0, lineHeight: 1 }}>×</button>
              </span>
            )}
            <button onClick={addEvent} disabled={!newTitle.trim()} title="Tambah"
              style={{ width: 28, height: 28, flexShrink: 0, borderRadius: 6, border: 'none', background: newTitle.trim() ? RED : 'var(--border2)', color: 'white', cursor: newTitle.trim() ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><IconPlus size={14} /></button>
            <button onClick={closeAdd} title="Tutup"
              style={{ width: 28, height: 28, flexShrink: 0, borderRadius: 6, border: '1px solid var(--border2)', background: 'none', color: 'var(--silver3)', cursor: 'pointer', fontSize: 15, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
            </div>
          </div>
        )}

        {notifOff && selectedEvs.length > 0 && (
          <button onClick={requestNotif} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, height: 26, flexShrink: 0, background: 'color-mix(in srgb, ' + RED + ' 10%, transparent)', border: '1px solid color-mix(in srgb, ' + RED + ' 30%, transparent)', borderRadius: 7, color: RED, fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--mono)' }}>🔔 Aktifkan pengingat</button>
        )}

        {/* Entry rows */}
        <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
          {selectedEvs.length === 0 && !selHoliday && !showAddForm && (
            <div style={{ fontSize: 11, color: 'var(--silver4)', fontFamily: 'var(--font)', padding: '10px 0', textAlign: 'center' }}>
              Tidak ada agenda · {isMobile ? 'ketuk' : 'klik'} dua kali tanggal untuk tambah
            </div>
          )}

          {/* Holiday — non-editable */}
          {selHoliday && (
            <div className="cal-row" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 8, background: 'color-mix(in srgb, ' + RED + ' 7%, var(--bg4))', border: '1px solid color-mix(in srgb, ' + RED + ' 25%, transparent)' }}>
              <Badge label="Libur" color={RED} />
              <div style={{ flex: 1, minWidth: 0, fontSize: 11.5, fontWeight: 600, color: RED, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{selHoliday}</div>
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
                <Badge label={isEvent ? 'Event' : 'Catatan'} color={isEvent ? RED : 'var(--accent)'} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--silver)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ev.title}</div>
                  {ev.time && <div style={{ fontSize: 9.5, color: 'var(--silver4)', fontFamily: 'var(--mono)', display: 'flex', alignItems: 'center', gap: 3, marginTop: 1 }}><IconClock size={10} /> {ev.time}</div>}
                </div>
                <button onClick={() => setEditId(ev.id)} title="Edit"
                  style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, borderRadius: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--silver3)' }}
                  onMouseEnter={e => (e.currentTarget.style.color = RED)} onMouseLeave={e => (e.currentTarget.style.color = 'var(--silver3)')}>
                  <IconEdit size={14} />
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
})

// Small kind/holiday badge.
function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span style={{
      flexShrink: 0, fontSize: 8, fontWeight: 800, fontFamily: 'var(--mono)',
      letterSpacing: '0.3px', textTransform: 'uppercase', padding: '2px 6px', borderRadius: 99,
      color, background: `color-mix(in srgb, ${color} 14%, transparent)`,
      border: `1px solid color-mix(in srgb, ${color} 30%, transparent)`,
    }}>{label}</span>
  )
}

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
              style={{ width: 30, height: 30, borderRadius: 6, border: `1px solid ${time ? RED : 'var(--border2)'}`, background: time ? 'color-mix(in srgb, ' + RED + ' 12%, transparent)' : 'var(--bg)', color: time ? RED : 'var(--silver3)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><IconClock size={14} /></button>
            <input ref={timeRef} type="time" value={time} onChange={e => setTime(e.target.value)} style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: 0, height: 0, top: 0, left: 0 }} tabIndex={-1} />
          </div>
        )}
      </div>
      {isEvent && time && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, alignSelf: 'flex-start', fontSize: 10, fontFamily: 'var(--mono)', color: RED }}><IconClock size={11} /> {time}</span>}
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
