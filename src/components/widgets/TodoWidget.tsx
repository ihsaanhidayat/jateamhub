import { useState, useEffect, useRef, useCallback } from 'react'
import { useStore } from '../../store/dashboardStore'
import { useAuthStore } from '../../store/authStore'
import { saveTodoHistory } from '../../utils/supabaseClient'
import type { TodoItem } from '../../types'

interface Props { sectionId: string }

const TODAY     = () => new Date().toISOString().split('T')[0]
const fmtTime   = (ms: number) => new Date(ms).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
const fmtDate   = (d: string) => {
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
  const diff = due.getTime() - Date.now()
  return diff > 0 && diff < 30 * 60 * 1000
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

// Shared state store untuk TodoWidget — agar input dan list bisa share state
// meski render terpisah
const todoStates = new Map<string, {
  items: TodoItem[]; setItems: (i: TodoItem[]) => void;
  saving: boolean; setSaving: (v: boolean) => void;
}>()

function useTodoState(sectionId: string) {
  const { personalSections, updateItem, addItem, syncPersonalToDb } = useStore()
  const section  = personalSections.find(s => s.id === sectionId)
  const noteItem = section?.items?.[0]

  const parseItems = (): TodoItem[] => {
    try { const d = noteItem?.desc; return d ? JSON.parse(d) : [] } catch { return [] }
  }

  const [items,  setItemsState]  = useState<TodoItem[]>(parseItems)
  const [saving, setSavingState] = useState(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout>|null>(null)

  const setItems = useCallback((next: TodoItem[]) => {
    setItemsState(next)
    // Update subtitle realtime
    const overdueCount = next.filter(i => isOverdue(i)).length
    const pendingCount = next.filter(i => !i.done).length
    const subtitle = overdueCount > 0
      ? `⚠️ ${overdueCount} terlambat · ${pendingCount} pending`
      : `${pendingCount} tugas pending`
    useStore.getState().updatePersonalSection(sectionId, { subtitle })
  }, [sectionId])

  const persistItems = useCallback(async (next: TodoItem[]) => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    setSavingState(true)
    setItems(next)
    saveTimer.current = setTimeout(async () => {
      const s = useStore.getState().personalSections.find(s => s.id === sectionId)
      if (!s) { setSavingState(false); return }
      const json = JSON.stringify(next)
      if (s.items.length > 0) {
        updateItem(sectionId, s.items[0].id, { ...s.items[0], desc: json, title: 'todo-data' })
      } else {
        addItem(sectionId, { title: 'todo-data', url: '#', icon: '', desc: json, tags: [], newTab: false, useFavicon: false } as any)
      }
      await syncPersonalToDb()
      setSavingState(false)
    }, 400)
  }, [sectionId, setItems, updateItem, addItem, syncPersonalToDb])

  // Sync dari DB
  useEffect(() => {
    const s = useStore.getState().personalSections.find(s => s.id === sectionId)
    try { const d = s?.items?.[0]?.desc; if (d) setItemsState(JSON.parse(d)) } catch {}
  }, [sectionId])

  return { items, saving, persistItems }
}

// ── Main list component ───────────────────────────────────────
export default function TodoWidget({ sectionId }: Props) {
  const { items, saving, persistItems } = useTodoState(sectionId)
  const { profile } = useAuthStore()
  const [confirmId, setConfirmId] = useState<string|null>(null)
  const [editId,    setEditId]    = useState<string|null>(null)
  const [editText,  setEditText]  = useState('')
  const editRef     = useRef<HTMLInputElement>(null)
  const confirmTimer = useRef<ReturnType<typeof setTimeout>|null>(null)
  const notifSent   = useRef(new Set<string>())
  const [notifAsked, setNotifAsked] = useState(false)

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
          if (Notification.permission === 'granted') {
            new Notification('⏰ Tugas Lewat Waktu!', { body: item.text, icon: '/icon-192.png' })
          }
        }
      })
    }, 30000)
    return () => clearInterval(t)
  }, [items])

  const toggleTask = async (id: string) => {
    const item = items.find(i => i.id === id)
    if (!item || !profile?.id) return
    await saveTodoHistory(profile.id, [{ ...item, done: true, doneAt: Date.now() }], 'done')
    persistItems(items.filter(i => i.id !== id))
  }

  const startEdit = (item: TodoItem) => {
    setEditId(item.id); setEditText(item.text); setConfirmId(null)
    setTimeout(() => editRef.current?.focus(), 50)
  }

  const saveEdit = () => {
    if (!editId || !editText.trim()) { setEditId(null); return }
    persistItems(items.map(i => i.id === editId ? { ...i, text: editText.trim() } : i))
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
    const overdue   = isOverdue(item)
    const dueOver   = isDueOver(item)
    const dueSoon   = isDueSoon(item)
    const isConfirm = confirmId === item.id
    const isEditing = editId === item.id

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
            border: `1.5px solid ${overdue ? 'var(--red)' : dueOver ? '#F59E0B' : 'var(--border2)'}`,
            background: 'none', cursor: 'pointer',
          }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            {isEditing ? (
              <input ref={editRef} value={editText} spellCheck={false}
                onChange={e => setEditText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditId(null) }}
                onBlur={saveEdit}
                style={{ ...iSt, width: '100%' }} />
            ) : (
              <div style={{
                fontSize: 13, lineHeight: 1.4, cursor: 'text',
                color: overdue ? 'var(--red)' : 'var(--silver)', fontWeight: overdue ? 600 : 400,
              }} onDoubleClick={() => startEdit(item)}>{item.text}</div>
            )}
            <div style={{ fontSize: 10, color: 'var(--silver4)', marginTop: 2, fontFamily: 'var(--mono)', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {overdue && <span style={{ color: 'var(--red)', fontWeight: 700 }}>📅 {fmtDate(item.date)}</span>}
              <span>🕐 {fmtTime(item.createdAt)}</span>
              {item.dueTime && (
                <span style={{ color: dueOver ? 'var(--red)' : dueSoon ? '#F59E0B' : 'var(--silver4)' }}>
                  ⏰ {item.dueTime}{dueOver ? ' lewat!' : dueSoon ? ' segera!' : ''}
                </span>
              )}
            </div>
          </div>
          {!isEditing && (
            <button onClick={() => startEdit(item)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--silver4)', fontSize: 11, padding: '2px 3px', flexShrink: 0 }}
              onMouseEnter={e => (e.currentTarget.style.color='var(--accent)')}
              onMouseLeave={e => (e.currentTarget.style.color='var(--silver4)')}>✏️</button>
          )}
          <button onClick={() => askDelete(item.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--silver4)', fontSize: 11, padding: '2px 3px', flexShrink: 0 }}
            onMouseEnter={e => (e.currentTarget.style.color='var(--red)')}
            onMouseLeave={e => (e.currentTarget.style.color='var(--silver4)')}>✕</button>
        </div>
        {isConfirm && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px', background: 'var(--red-bg)', borderBottom: '1px solid var(--border)' }}>
            <span style={{ fontSize: 11, color: 'var(--red)', flex: 1 }}>Hapus tugas ini?</span>
            <button onClick={() => setConfirmId(null)} style={{ height: 22, padding: '0 8px', background: 'none', border: '1px solid var(--border2)', borderRadius: 5, color: 'var(--silver3)', fontSize: 11, cursor: 'pointer', fontFamily: 'var(--font)' }}>Batal</button>
            <button onClick={() => { persistItems(items.filter(i => i.id !== item.id)); setConfirmId(null) }} style={{ height: 22, padding: '0 8px', background: 'var(--red)', border: 'none', borderRadius: 5, color: 'white', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font)' }}>Hapus</button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div>
      {overdueItems.length === 0 && todayPending.length === 0 && (
        <div style={{ padding: '16px 12px', textAlign: 'center', color: 'var(--silver4)', fontSize: 12, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
          <span>Tidak ada tugas hari ini</span>
          {!notifAsked && 'Notification' in window && Notification.permission === 'default' && (
            <button onClick={requestNotif} style={{ height: 24, padding: '0 10px', background: 'var(--accent-light)', border: '1px solid var(--accent-soft)', borderRadius: 6, color: 'var(--accent)', fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--mono)' }}>🔔 Aktifkan notifikasi</button>
          )}
        </div>
      )}
      {overdueItems.length > 0 && <Separator label={`Terlambat (${overdueItems.length})`} color="var(--red)" />}
      {overdueItems.map(renderItem)}
      {todayPending.length > 0 && overdueItems.length > 0 && <Separator label="Hari ini" color="var(--accent)" />}
      {todayPending.map(renderItem)}
    </div>
  )
}

// ── Input area — dirender sebagai widgetFooter di luar section-body ──
export function TodoInputFooter({ sectionId }: { sectionId: string }) {
  const { persistItems } = useTodoState(sectionId)
  const { items } = useTodoState(sectionId)
  const [newText,    setNewText]    = useState('')
  const [newDueTime, setNewDueTime] = useState('')
  const [showDue,    setShowDue]    = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const addTask = () => {
    if (!newText.trim()) return
    const task: TodoItem = {
      id: crypto.randomUUID(), text: newText.trim(),
      done: false, createdAt: Date.now(),
      date: TODAY(), dueTime: newDueTime || undefined,
    }
    persistItems([...items, task])
    setNewText(''); setNewDueTime(''); setShowDue(false)
    inputRef.current?.focus()
  }

  const iSt: React.CSSProperties = {
    height: 32, padding: '0 10px',
    background: 'var(--bg4)', border: '1px solid var(--border2)',
    borderRadius: 7, fontSize: 12, color: 'var(--silver)',
    fontFamily: 'var(--font)', outline: 'none',
  }

  return (
    <div style={{ padding: '8px 10px', borderTop: '1px solid var(--border)', background: 'var(--card-bg)' }}>
      <div style={{ display: 'flex', gap: 6 }}>
        <input ref={inputRef} value={newText} spellCheck={false}
          onChange={e => setNewText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') addTask() }}
          placeholder="Tambah tugas... (Enter)"
          style={{ ...iSt, flex: 1 }} />
        <button onClick={() => setShowDue(v => !v)} style={{ ...iSt, width: 32, padding: 0, flexShrink: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', background: showDue ? 'var(--accent-light)' : 'var(--bg4)', color: showDue ? 'var(--accent)' : 'var(--silver4)', fontSize: 14 }}>⏰</button>
        <button onClick={addTask} disabled={!newText.trim()} style={{ ...iSt, width: 32, padding: 0, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: newText.trim() ? 'var(--accent)' : 'var(--bg4)', color: newText.trim() ? 'white' : 'var(--silver4)', cursor: newText.trim() ? 'pointer' : 'default', fontSize: 16 }}>+</button>
      </div>
      {showDue && <input type="time" value={newDueTime} onChange={e => setNewDueTime(e.target.value)} style={{ ...iSt, width: '100%', marginTop: 6 }} />}
    </div>
  )
}
