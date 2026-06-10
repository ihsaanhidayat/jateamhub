import { memo, useState, useEffect, useRef, useCallback } from 'react'
import { useStore } from '../../store/dashboardStore'
import type { CalendarEvent } from '../../types'

// ── Constants ─────────────────────────────────────────────────────────
const MONTH_NAMES = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember']
const DAY_NAMES   = ['Min','Sen','Sel','Rab','Kam','Jum','Sab']
const COLOR_MAP   = { accent: 'var(--accent)', red: 'var(--red)', green: '#16A34A', yellow: '#D97706' }
const COLOR_OPTS  = ['accent','red','green','yellow'] as const

function today() { return new Date().toISOString().split('T')[0] }

function buildGrid(year: number, month: number) {
  const daysInMonth  = new Date(year, month + 1, 0).getDate()
  const firstWeekday = new Date(year, month, 1).getDay()
  const daysInPrev   = new Date(year, month, 0).getDate()
  const cells: { date: string; curr: boolean }[] = []
  for (let i = firstWeekday - 1; i >= 0; i--) {
    const d = daysInPrev - i
    cells.push({ date: `${year}-${String(month === 0 ? 12 : month).padStart(2,'0')}-${String(d).padStart(2,'0')}`, curr: false })
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ date: `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`, curr: true })
  }
  while (cells.length < 42) {
    const d = cells.length - firstWeekday - daysInMonth + 1
    const nm = month + 2 > 12 ? 1 : month + 2
    const ny = month + 2 > 12 ? year + 1 : year
    cells.push({ date: `${ny}-${String(nm).padStart(2,'0')}-${String(d).padStart(2,'0')}`, curr: false })
  }
  return cells
}

// ── CalendarWidget ─────────────────────────────────────────────────────
interface Props { sectionId: string; isExpanded?: boolean }

export default memo(function CalendarWidget({ sectionId, isExpanded }: Props) {
  const now = new Date()
  const [viewYear,     setViewYear]     = useState(now.getFullYear())
  const [viewMonth,    setViewMonth]    = useState(now.getMonth())
  const [selectedDate, setSelectedDate] = useState<string | null>(today())
  const [showAddForm,  setShowAddForm]  = useState(false)
  const [newTitle,     setNewTitle]     = useState('')
  const [newTime,      setNewTime]      = useState('')
  const [newColor,     setNewColor]     = useState<typeof COLOR_OPTS[number]>('accent')
  const notifSent = useRef<Set<string>>(new Set())

  // ── Load events from store ──────────────────────────────────────────
  const rawDesc = useStore(s => {
    const sec = s.personalSections.find(p => p.id === sectionId)
    return sec?.items[0]?.desc ?? '[]'
  })

  const [events, setEvents] = useState<CalendarEvent[]>(() => {
    try { return JSON.parse(rawDesc) } catch { return [] }
  })

  useEffect(() => {
    try { setEvents(JSON.parse(rawDesc)) } catch {}
  }, [rawDesc])

  // ── Persist events ──────────────────────────────────────────────────
  const saveEvents = useCallback((next: CalendarEvent[]) => {
    setEvents(next)
    const store = useStore.getState()
    const sec   = store.personalSections.find(p => p.id === sectionId)
    if (!sec) return
    const item0  = sec.items[0] ?? { id: `cal-${sectionId}`, title: '', url: '', icon: '', tags: [], newTab: false, iconUrl: '', useFavicon: false }
    const items  = [{ ...item0, desc: JSON.stringify(next) }, ...sec.items.slice(1)]
    const count  = next.length
    store.updatePersonalSection(sectionId, {
      items,
      subtitle: count === 0 ? '' : `${count} acara`,
    })
    store.syncPersonalToDb()
  }, [sectionId])

  // ── Notifications ───────────────────────────────────────────────────
  useEffect(() => {
    const tick = () => {
      const td = today()
      events.filter(e => e.date === td && e.time && !notifSent.current.has(e.id)).forEach(e => {
        const [hh, mm] = (e.time!).split(':').map(Number)
        const due = new Date(); due.setHours(hh, mm, 0, 0)
        const diff = due.getTime() - Date.now()
        if (diff > 0 && diff <= 30 * 60 * 1000) {
          notifSent.current.add(e.id)
          if (Notification.permission === 'granted')
            new Notification('Acara Segera', { body: e.title, icon: '/icon-192.png' })
        }
      })
    }
    tick()
    const t = setInterval(tick, 30_000)
    return () => clearInterval(t)
  }, [events])

  // ── Nav ─────────────────────────────────────────────────────────────
  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) }
    else setViewMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) }
    else setViewMonth(m => m + 1)
  }
  const goToday = () => { setViewYear(now.getFullYear()); setViewMonth(now.getMonth()); setSelectedDate(today()) }

  // ── Add event ────────────────────────────────────────────────────────
  const addEvent = () => {
    if (!newTitle.trim() || !selectedDate) return
    const ev: CalendarEvent = {
      id: crypto.randomUUID(),
      date: selectedDate,
      title: newTitle.trim(),
      time: newTime || undefined,
      color: newColor,
      createdAt: Date.now(),
    }
    saveEvents([...events, ev])
    setNewTitle(''); setNewTime(''); setNewColor('accent'); setShowAddForm(false)
  }

  const deleteEvent = (id: string) => saveEvents(events.filter(e => e.id !== id))

  // ── Grid ─────────────────────────────────────────────────────────────
  const cells       = buildGrid(viewYear, viewMonth)
  const isToday     = today()
  const eventsForDate = (date: string) => events.filter(e => e.date === date)
  const selectedEvs = selectedDate ? eventsForDate(selectedDate) : []

  const dotColors = (date: string) => {
    const evs = eventsForDate(date)
    return evs.slice(0, 3).map(e => COLOR_MAP[e.color ?? 'accent'])
  }

  // ── Notify permission ────────────────────────────────────────────────
  const requestNotif = () => {
    if (Notification.permission === 'default') Notification.requestPermission()
  }

  const cellSize = isExpanded ? 38 : 28

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '8px 10px', gap: 6 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        <button onClick={prevMonth} style={navBtn}>‹</button>
        <div style={{ flex: 1, textAlign: 'center', fontSize: 12, fontWeight: 700, color: 'var(--silver)', fontFamily: 'var(--font)' }}>
          {MONTH_NAMES[viewMonth]} {viewYear}
        </div>
        <button onClick={nextMonth} style={navBtn}>›</button>
        <button onClick={goToday} style={{
          fontSize: 10, fontWeight: 600, color: 'var(--accent)',
          background: 'color-mix(in srgb, var(--accent) 10%, transparent)',
          border: '1px solid color-mix(in srgb, var(--accent) 25%, transparent)',
          borderRadius: 6, padding: '2px 7px', cursor: 'pointer', flexShrink: 0,
          fontFamily: 'var(--font)',
        }}>Hari ini</button>
      </div>

      {/* Day header row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1, flexShrink: 0 }}>
        {DAY_NAMES.map(d => (
          <div key={d} style={{ textAlign: 'center', fontSize: 9, fontWeight: 700, color: 'var(--silver4)', fontFamily: 'var(--mono)', padding: '2px 0' }}>
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, flexShrink: 0 }}>
        {cells.map((cell, i) => {
          const isTd   = cell.date === isToday
          const isSel  = cell.date === selectedDate
          const dots   = dotColors(cell.date)
          return (
            <button
              key={i}
              onClick={() => { setSelectedDate(cell.date); setShowAddForm(false) }}
              style={{
                height: cellSize, borderRadius: 6,
                border: isTd ? '1.5px solid var(--accent)' : isSel ? '1px solid var(--border2)' : '1px solid transparent',
                background: isSel ? 'var(--bg4)' : 'transparent',
                cursor: 'pointer', padding: 0,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
              }}
            >
              <span style={{
                fontSize: 10, fontWeight: isTd ? 800 : cell.curr ? 500 : 400,
                color: isTd ? 'var(--accent)' : cell.curr ? 'var(--silver)' : 'var(--silver4)',
                lineHeight: 1,
              }}>{Number(cell.date.split('-')[2])}</span>
              {dots.length > 0 && (
                <div style={{ display: 'flex', gap: 2 }}>
                  {dots.map((c, di) => (
                    <span key={di} style={{ width: 4, height: 4, borderRadius: '50%', background: c, flexShrink: 0 }} />
                  ))}
                </div>
              )}
            </button>
          )
        })}
      </div>

      {/* Event list */}
      {selectedDate && (
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            fontSize: 10, fontWeight: 700, color: 'var(--silver3)',
            fontFamily: 'var(--mono)', letterSpacing: '0.5px', flexShrink: 0,
          }}>
            <span>{formatDisplayDate(selectedDate)}</span>
            <button
              onClick={() => { setShowAddForm(v => !v); setNewTitle(''); setNewTime(''); setNewColor('accent') }}
              style={{
                fontSize: 10, fontWeight: 600, color: 'var(--accent)',
                background: 'none', border: 'none', cursor: 'pointer',
                fontFamily: 'var(--font)', padding: 0,
              }}
            >
              {showAddForm ? 'Batal' : '+ Tambah'}
            </button>
          </div>

          {/* Add form */}
          {showAddForm && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '8px', background: 'var(--bg4)', borderRadius: 8, border: '1px solid var(--border2)', flexShrink: 0 }}>
              <input
                autoFocus
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addEvent() }}
                placeholder="Judul acara..."
                style={{
                  height: 32, padding: '0 10px',
                  background: 'var(--bg)', border: '1px solid var(--border2)',
                  borderRadius: 6, fontSize: 12, color: 'var(--silver)',
                  fontFamily: 'var(--font)', outline: 'none', width: '100%', boxSizing: 'border-box',
                }}
                onFocus={e => e.target.style.borderColor = 'var(--accent)'}
                onBlur={e => e.target.style.borderColor = 'var(--border2)'}
              />
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input
                  type="time"
                  value={newTime}
                  onChange={e => setNewTime(e.target.value)}
                  style={{
                    height: 28, padding: '0 8px', flex: 1,
                    background: 'var(--bg)', border: '1px solid var(--border2)',
                    borderRadius: 6, fontSize: 11, color: 'var(--silver)',
                    fontFamily: 'var(--font)', outline: 'none', boxSizing: 'border-box',
                  }}
                />
                {/* Color picker */}
                {COLOR_OPTS.map(c => (
                  <button
                    key={c}
                    onClick={() => setNewColor(c)}
                    style={{
                      width: 16, height: 16, borderRadius: '50%',
                      background: COLOR_MAP[c],
                      border: newColor === c ? '2px solid var(--silver)' : '2px solid transparent',
                      cursor: 'pointer', flexShrink: 0, padding: 0,
                    }}
                  />
                ))}
              </div>
              <button
                onClick={addEvent}
                disabled={!newTitle.trim()}
                style={{
                  height: 28, background: newTitle.trim() ? 'var(--accent)' : 'var(--border2)',
                  border: 'none', borderRadius: 6, color: 'white',
                  fontSize: 11, fontWeight: 700, cursor: newTitle.trim() ? 'pointer' : 'not-allowed',
                  fontFamily: 'var(--font)',
                }}
              >Tambah</button>
            </div>
          )}

          {/* Event rows */}
          <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }} onClick={requestNotif}>
            {selectedEvs.length === 0 && !showAddForm && (
              <div style={{ fontSize: 11, color: 'var(--silver4)', fontFamily: 'var(--font)', padding: '6px 0', textAlign: 'center' }}>
                Tidak ada acara
              </div>
            )}
            {selectedEvs.map(ev => (
              <div key={ev.id} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '5px 8px', borderRadius: 7,
                background: 'var(--bg4)', border: '1px solid var(--border)',
              }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: COLOR_MAP[ev.color ?? 'accent'], flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--silver)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ev.title}</div>
                  {ev.time && <div style={{ fontSize: 10, color: 'var(--silver4)', fontFamily: 'var(--mono)' }}>{ev.time}</div>}
                </div>
                <button
                  onClick={() => deleteEvent(ev.id)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--silver4)', padding: 2, fontSize: 13, lineHeight: 1, flexShrink: 0 }}
                  aria-label="Hapus acara"
                >×</button>
              </div>
            ))}
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
  fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
  flexShrink: 0, padding: 0,
}
