import { useState, useEffect, useRef, memo, useMemo } from 'react'
import { useStore } from '../../store/dashboardStore'
import { useAuthStore } from '../../store/authStore'
import { saveTodoHistory } from '../../utils/supabaseClient'
import type { TodoItem } from '../../types'

const TODAY   = () => new Date().toISOString().split('T')[0]
const fmtTime = (ms: number) => new Date(ms).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
const fmtDate = (d: string) => {
  const [y,m,day] = d.split('-').map(Number)
  return new Date(y,m-1,day).toLocaleDateString('id-ID', { weekday:'short', day:'numeric', month:'short' })
}
const isOverdue = (i: TodoItem) => !i.done && i.date < TODAY()
const isDueOver = (i: TodoItem) => {
  if (!i.dueTime || i.done || i.date !== TODAY()) return false
  const [h,m] = i.dueTime.split(':').map(Number)
  const due = new Date(); due.setHours(h,m,0,0); return due.getTime() < Date.now()
}
const isDueSoon = (i: TodoItem) => {
  if (!i.dueTime || i.done || i.date !== TODAY()) return false
  const [h,m] = i.dueTime.split(':').map(Number)
  const due = new Date(); due.setHours(h,m,0,0)
  const d = due.getTime() - Date.now()
  return d > 0 && d < 30 * 60 * 1000
}

async function saveTodoItems(sectionId: string, next: TodoItem[]) {
  const store = useStore.getState()
  const s = store.personalSections.find(s => s.id === sectionId)
  if (!s) return
  const overdueCount = next.filter(i => isOverdue(i)).length
  const todayCount   = next.filter(i => !i.done && !isOverdue(i)).length
  const totalActive  = next.filter(i => !i.done).length
  const subtitle = overdueCount > 0 && todayCount > 0
    ? `⚠️ ${overdueCount} terlambat · ${todayCount} hari ini`
    : overdueCount > 0
    ? `⚠️ ${overdueCount} terlambat`
    : totalActive > 0
    ? `${totalActive} tugas`
    : 'Tidak ada tugas ✓'
  store.updatePersonalSection(sectionId, { subtitle })
  const json = JSON.stringify(next)
  if (s.items.length > 0) {
    store.updateItem(sectionId, s.items[0].id, { ...s.items[0], desc: json, title: 'todo-data' })
  } else {
    store.addItem(sectionId, { title: 'todo-data', url: '#', icon: '', desc: json, tags: [], newTab: false, useFavicon: false } as any)
  }
  await store.syncPersonalToDb()
}

function Separator({ label, color }: { label: string; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 10px', background: 'var(--bg4)' }}>
      <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
      <span style={{ fontSize: 9, fontWeight: 700, color, fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: '0.8px', whiteSpace: 'nowrap' }}>{label}</span>
      <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
    </div>
  )
}

function TodoWidgetImpl({ sectionId }: { sectionId: string }) {
  const { profile } = useAuthStore()
  const rawDesc = useStore(s => {
    const sec = s.personalSections.find(x => x.id === sectionId)
    return sec?.items?.[0]?.desc ?? ''
  })
  const items: TodoItem[] = (() => { try { return rawDesc ? JSON.parse(rawDesc) : [] } catch { return [] } })()

  const [confirmId,  setConfirmId]  = useState<string|null>(null)
  const [editId,     setEditId]     = useState<string|null>(null)
  const [editText,   setEditText]   = useState('')
  const [notifAsked, setNotifAsked] = useState(false)
  const editRef      = useRef<HTMLInputElement>(null)
  const confirmTimer = useRef<ReturnType<typeof setTimeout>|null>(null)
  const notifSent    = useRef(new Set<string>())

  useEffect(() => {
    if (localStorage.getItem('todo-notif-asked')) setNotifAsked(true)
  }, [])

  useEffect(() => {
    if (!items.length) return
    const t = setInterval(() => {
      items.forEach(item => {
        if (!item.dueTime || item.done || notifSent.current.has(item.id)) return
        if (isDueOver(item)) {
          notifSent.current.add(item.id)
          if (Notification.permission === 'granted')
            new Notification('⏰ Tugas Lewat Waktu!', { body: item.text, icon: '/icon-192.png' })
        }
      })
    }, 30000)
    return () => clearInterval(t)
  }, [items])

  const [checkingIds, setCheckingIds] = useState<Set<string>>(new Set())
  const undoTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  // Cleanup pending timers saat unmount
  useEffect(() => () => {
    undoTimers.current.forEach(t => clearTimeout(t))
    undoTimers.current.clear()
  }, [])

  const toggleTask = (id: string) => {
    const item = items.find(i => i.id === id)
    const pid = profile?.id
    if (!item || !pid) return
    if (checkingIds.has(id)) return
    setCheckingIds(prev => new Set([...prev, id]))
    const timer = setTimeout(async () => {
      try {
        const overdue = isOverdue(item)
        await saveTodoHistory(pid, [{ ...item, done: true, doneAt: Date.now() }], overdue ? 'overdue' : 'done')
        await saveTodoItems(sectionId, items.filter(i => i.id !== id))
      } catch (e) {
        console.error('Toggle task failed:', e)
      } finally {
        setCheckingIds(prev => { const s = new Set(prev); s.delete(id); return s })
        undoTimers.current.delete(id)
      }
    }, 1000)
    undoTimers.current.set(id, timer)
  }

  const undoTask = (id: string) => {
    const timer = undoTimers.current.get(id)
    if (timer) { clearTimeout(timer); undoTimers.current.delete(id) }
    setCheckingIds(prev => { const s = new Set(prev); s.delete(id); return s })
  }

  const startEdit = (item: TodoItem) => {
    setEditId(item.id); setEditText(item.text); setConfirmId(null)
    setTimeout(() => editRef.current?.focus(), 50)
  }

  const saveEdit = async () => {
    if (!editId || !editText.trim()) { setEditId(null); return }
    await saveTodoItems(sectionId, items.map(i => i.id === editId ? { ...i, text: editText.trim() } : i))
    setEditId(null)
  }

  const askDelete = (id: string) => {
    setConfirmId(id); setEditId(null)
    if (confirmTimer.current) clearTimeout(confirmTimer.current)
    confirmTimer.current = setTimeout(() => setConfirmId(null), 5000)
  }

  const requestNotif = async () => {
    if ('Notification' in window) await Notification.requestPermission()
    setNotifAsked(true); localStorage.setItem('todo-notif-asked', '1')
  }

  const overdueItems = items.filter(i => isOverdue(i)).sort((a,b) => a.createdAt - b.createdAt)
  const todayPending = items.filter(i => !i.done && !isOverdue(i)).sort((a,b) => a.createdAt - b.createdAt)

  const iSt: React.CSSProperties = {
    height: 28, padding: '0 10px',
    background: 'var(--bg4)', border: '1px solid var(--border2)',
    borderRadius: 6, fontSize: 12, color: 'var(--silver)',
    fontFamily: 'var(--font)', outline: 'none',
  }

  const renderItem = (item: TodoItem) => {
    const overdue = isOverdue(item), dueOver = isDueOver(item), dueSoon = isDueSoon(item)
    const isConfirm = confirmId === item.id, isEditing = editId === item.id
    return (
      <div key={item.id}>
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: 8, padding: '7px 10px',
          borderBottom: '1px solid var(--border)',
          background: overdue ? 'color-mix(in srgb, var(--red) 5%, transparent)'
            : dueOver || dueSoon ? 'color-mix(in srgb, #F59E0B 4%, transparent)' : 'transparent',
        }}>
          <button onClick={() => toggleTask(item.id)} style={{
            width: 16, height: 16, borderRadius: 3, flexShrink: 0, marginTop: 3,
            border: `1.5px solid ${checkingIds.has(item.id) ? 'var(--accent)' : overdue ? 'var(--red)' : dueOver ? '#F59E0B' : 'var(--border2)'}`,
            background: checkingIds.has(item.id) ? 'var(--accent)' : 'none',
            cursor: checkingIds.has(item.id) ? 'default' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', fontSize: 9, transition: 'all 200ms',
          }}>{checkingIds.has(item.id) ? '✓' : ''}</button>
          <div style={{ flex: 1, minWidth: 0 }}>
            {isEditing ? (
              <input ref={editRef} value={editText} spellCheck={false}
                onChange={e => setEditText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditId(null) }}
                onBlur={saveEdit} style={{ ...iSt, width: '100%' }} />
            ) : (
              <div style={{
                fontSize: 13, lineHeight: 1.5, cursor: 'text',
                color: checkingIds.has(item.id) ? 'var(--silver4)' : overdue ? 'var(--red)' : 'var(--silver)',
                fontWeight: overdue ? 600 : 400,
                textDecoration: checkingIds.has(item.id) ? 'line-through' : 'none',
                wordBreak: 'break-word', whiteSpace: 'normal',
                transition: 'all 300ms',
              }} onDoubleClick={() => startEdit(item)}>{item.text}</div>
            )}
            {(item.dueTime || item.date !== TODAY()) && (
              <div style={{ fontSize: 10, color: 'var(--silver4)', marginTop: 2, fontFamily: 'var(--mono)', display: 'flex', gap: 6 }}>
                {item.date !== TODAY() && <span style={{ color: overdue ? 'var(--red)' : 'var(--silver4)' }}>📅 {fmtDate(item.date)}</span>}
                {item.dueTime && <span style={{ color: dueOver ? 'var(--red)' : dueSoon ? '#F59E0B' : 'var(--silver4)' }}>
                  🕐 {item.dueTime}{dueOver ? ' ⚠️' : dueSoon ? ' !' : ''}
                </span>}
              </div>
            )}
          </div>
          {!isEditing && !checkingIds.has(item.id) && (
            <>
              <button onClick={() => startEdit(item)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--silver4)', fontSize: 11, padding: '2px 3px', flexShrink: 0 }}
                onMouseEnter={e=>(e.currentTarget.style.color='var(--accent)')} onMouseLeave={e=>(e.currentTarget.style.color='var(--silver4)')}>✏️</button>
              <button onClick={() => askDelete(item.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--silver4)', fontSize: 11, padding: '2px 3px', flexShrink: 0 }}
                onMouseEnter={e=>(e.currentTarget.style.color='var(--red)')} onMouseLeave={e=>(e.currentTarget.style.color='var(--silver4)')}>✕</button>
            </>
          )}
        </div>
        {isConfirm && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px 5px 34px', background: 'color-mix(in srgb, var(--red) 6%, var(--bg4))', borderBottom: '1px solid var(--border)' }}>
            <span style={{ fontSize: 11, color: 'var(--red)', flex: 1 }}>Hapus tugas ini?</span>
            <button onClick={() => setConfirmId(null)} style={{ height: 20, padding: '0 7px', background: 'none', border: '1px solid var(--border2)', borderRadius: 4, color: 'var(--silver3)', fontSize: 10, cursor: 'pointer', fontFamily: 'var(--font)' }}>Tidak</button>
            <button onClick={async () => { await saveTodoItems(sectionId, items.filter(i => i.id !== item.id)); setConfirmId(null) }}
              style={{ height: 20, padding: '0 7px', background: 'var(--red)', border: 'none', borderRadius: 4, color: 'white', fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font)' }}>Hapus</button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div>
      {overdueItems.length === 0 && todayPending.length === 0 && (
        <div style={{ padding: '16px 12px', textAlign: 'center', color: 'var(--silver4)', fontSize: 12, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
          <span>Tidak ada tugas hari ini ✓</span>
          {!notifAsked && 'Notification' in window && Notification.permission === 'default' && (
            <button onClick={requestNotif} style={{ height: 24, padding: '0 10px', background: 'var(--accent-light)', border: '1px solid var(--accent-soft)', borderRadius: 6, color: 'var(--accent)', fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--mono)' }}>🔔 Aktifkan notifikasi</button>
          )}
        </div>
      )}
      {overdueItems.map(renderItem)}
      {todayPending.length > 0 && overdueItems.length > 0 && <Separator label="Hari ini" color="var(--accent)" />}
      {todayPending.map(renderItem)}
    </div>
  )
}

const TodoWidget = memo(TodoWidgetImpl)
export default TodoWidget

// Input footer
export const TodoInputFooter = memo(function TodoInputFooter({ sectionId }: { sectionId: string }) {
  const rawDesc = useStore(s => {
    const sec = s.personalSections.find(x => x.id === sectionId)
    return sec?.items?.[0]?.desc ?? ''
  })
  const items: TodoItem[] = (() => { try { return rawDesc ? JSON.parse(rawDesc) : [] } catch { return [] } })()


  const [newText,    setNewText]    = useState('')
  const [newDueDate, setNewDueDate] = useState('')
  const [newDueTime, setNewDueTime] = useState('')
  const [showDate,   setShowDate]   = useState(false)
  const [showTime,   setShowTime]   = useState(false)
  const [escConfirm, setEscConfirm] = useState(false)
  const taRef  = useRef<HTMLTextAreaElement>(null)
  const escRef = useRef<ReturnType<typeof setTimeout>|null>(null)

  const addTask = async () => {
    if (!newText.trim()) return
    const task: TodoItem = {
      id: crypto.randomUUID(), text: newText.trim(), done: false,
      createdAt: Date.now(),
      date: newDueDate || TODAY(),
      dueTime: newDueTime || undefined,
    }
    await saveTodoItems(sectionId, [...items, task])
    reset()
  }

  const reset = () => {
    setNewText(''); setNewDueDate(''); setNewDueTime('')
    setShowDate(false); setShowTime(false); setEscConfirm(false)
    if (taRef.current) { taRef.current.style.height = '32px' }
  }

  const handleEsc = () => {
    if (!newText.trim() && !newDueDate && !newDueTime) return
    setEscConfirm(true)
    if (escRef.current) clearTimeout(escRef.current)
    escRef.current = setTimeout(() => setEscConfirm(false), 4000)
  }

  const autoGrow = (el: HTMLTextAreaElement) => {
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 80) + 'px'
    const isWide = el.scrollHeight > 38 || el.value.length > 30
  }

  const iBtnSt: React.CSSProperties = {
    width: 32, height: 32, flexShrink: 0, borderRadius: 7,
    border: '1px solid var(--border2)', background: 'var(--bg4)',
    cursor: 'pointer', display: 'flex', alignItems: 'center',
    justifyContent: 'center', fontSize: 15, transition: 'all 150ms',
  }

  // Format time input — validate HH:MM 24h
  const handleTimeChange = (val: string) => {
    // Allow typing: filter non-numeric except ':'
    const clean = val.replace(/[^0-9:]/g, '').slice(0, 5)
    // Auto-insert colon after 2 digits
    let formatted = clean
    if (clean.length === 2 && !clean.includes(':') && newDueTime.length < 2) {
      formatted = clean + ':'
    }
    setNewDueTime(formatted)
  }

  const timeValid = /^([01]\d|2[0-3]):([0-5]\d)$/.test(newDueTime)

  return (
    <div style={{ padding: '8px 10px', borderTop: '1px solid var(--border)', background: 'var(--card-bg)' }}>
      {/* Esc confirm dropdown */}
      {escConfirm && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', marginBottom: 6,
          background: 'var(--bg4)', border: '1px solid var(--border2)', borderRadius: 8,
          animation: 'slideDown 150ms ease',
        }}>
          <span style={{ fontSize: 12, color: 'var(--silver2)', flex: 1 }}>Batalkan input?</span>
          <button onClick={reset} style={{ height: 24, padding: '0 10px', background: 'var(--red)', border: 'none', borderRadius: 5, color: 'white', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font)' }}>Ya</button>
          <button onClick={() => { setEscConfirm(false); taRef.current?.focus() }} style={{ height: 24, padding: '0 10px', background: 'none', border: '1px solid var(--border2)', borderRadius: 5, color: 'var(--silver3)', fontSize: 11, cursor: 'pointer', fontFamily: 'var(--font)' }}>Tidak</button>
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }}>
        {/* Auto-expand textarea */}
        <textarea
          ref={taRef} value={newText} spellCheck={false} rows={1}
          onChange={e => { setNewText(e.target.value); autoGrow(e.target) }}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addTask() }
            if (e.key === 'Escape') { e.preventDefault(); handleEsc() }
          }}
          placeholder="Tambah tugas... (Enter)"
          style={{
            flex: 1, padding: '7px 10px', background: 'var(--bg4)',
            border: '1px solid var(--border2)', borderRadius: 7,
            fontSize: 12, color: 'var(--silver)', fontFamily: 'var(--font)',
            outline: 'none', resize: 'none', overflow: 'hidden',
            minHeight: 32, lineHeight: '18px',
          }}
        />

        {/* 📅 Calendar */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <button onClick={() => { setShowDate(v => !v); setShowTime(false) }}
            style={{ ...iBtnSt, color: newDueDate ? 'var(--accent)' : 'var(--silver4)', background: newDueDate ? 'var(--accent-light)' : 'var(--bg4)', border: `1px solid ${newDueDate ? 'var(--accent-soft)' : 'var(--border2)'}` }}
            title="Pilih tanggal">📅</button>
          {showDate && (
            <div style={{ position: 'absolute', bottom: 36, right: 0, zIndex: 30, background: 'var(--card-bg)', border: '1px solid var(--border2)', borderRadius: 8, padding: '10px 12px', boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}>
              <div style={{ fontSize: 9, color: 'var(--silver4)', fontFamily: 'var(--mono)', textTransform: 'uppercase', marginBottom: 6 }}>Tanggal</div>
              <input type="date" value={newDueDate} min={TODAY()}
                onChange={e => { setNewDueDate(e.target.value); setShowDate(false) }}
                onKeyDown={e => e.key === 'Escape' && setShowDate(false)}
                style={{ height: 32, padding: '0 8px', background: 'var(--bg4)', border: '1px solid var(--border2)', borderRadius: 6, fontSize: 12, color: 'var(--silver)', fontFamily: 'var(--font)', outline: 'none' }} />
              {newDueDate && <button onClick={() => { setNewDueDate(''); setShowDate(false) }} style={{ marginLeft: 6, background: 'none', border: 'none', color: 'var(--silver4)', cursor: 'pointer', fontSize: 11 }}>✕</button>}
            </div>
          )}
        </div>

        {/* 🕐 Clock — manual HH:MM 24h */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <button onClick={() => { setShowTime(v => !v); setShowDate(false) }}
            style={{ ...iBtnSt, color: timeValid ? 'var(--accent)' : 'var(--silver4)', background: timeValid ? 'var(--accent-light)' : 'var(--bg4)', border: `1px solid ${timeValid ? 'var(--accent-soft)' : 'var(--border2)'}` }}
            title="Pilih jam">🕐</button>
          {showTime && (
            <div style={{ position: 'absolute', bottom: 36, right: 0, zIndex: 30, background: 'var(--card-bg)', border: '1px solid var(--border2)', borderRadius: 8, padding: '10px 12px', boxShadow: '0 4px 20px rgba(0,0,0,0.15)', width: 140 }}>
              <div style={{ fontSize: 9, color: 'var(--silver4)', fontFamily: 'var(--mono)', textTransform: 'uppercase', marginBottom: 6 }}>Jam (HH:MM, 24h)</div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input
                  value={newDueTime}
                  onChange={e => handleTimeChange(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') setShowTime(false)
                    if (e.key === 'Escape') { setNewDueTime(''); setShowTime(false) }
                  }}
                  placeholder="14:30"
                  maxLength={5}
                  autoFocus
                  style={{ flex: 1, height: 32, padding: '0 8px', background: 'var(--bg4)', border: `1px solid ${timeValid || !newDueTime ? 'var(--border2)' : 'var(--red)'}`, borderRadius: 6, fontSize: 14, color: 'var(--silver)', fontFamily: 'var(--mono)', outline: 'none', letterSpacing: 1 }} />
                {newDueTime && <button onClick={() => { setNewDueTime(''); setShowTime(false) }} style={{ background: 'none', border: 'none', color: 'var(--silver4)', cursor: 'pointer', fontSize: 12 }}>✕</button>}
              </div>
              {newDueTime && !timeValid && <div style={{ fontSize: 10, color: 'var(--red)', marginTop: 4 }}>Format: HH:MM</div>}
            </div>
          )}
        </div>

        {/* + Add */}
        <button onClick={addTask} disabled={!newText.trim()} style={{
          ...iBtnSt, fontSize: 18, border: 'none',
          background: newText.trim() ? 'var(--accent)' : 'var(--bg4)',
          color: newText.trim() ? 'white' : 'var(--silver4)',
          cursor: newText.trim() ? 'pointer' : 'default',
        }}>+</button>
      </div>

      {/* Due preview — hanya jika ada nilai */}
      {(newDueDate || timeValid) && (
        <div style={{ fontSize: 10, color: 'var(--accent)', fontFamily: 'var(--mono)', marginTop: 5, display: 'flex', gap: 8 }}>
          {newDueDate && <span>📅 {newDueDate}</span>}
          {timeValid && <span>🕐 {newDueTime}</span>}
        </div>
      )}
    </div>
  )
})
