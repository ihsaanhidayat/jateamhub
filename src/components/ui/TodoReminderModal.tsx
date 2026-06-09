import { useState, useEffect, useRef } from 'react'
import { useStore } from '../../store/dashboardStore'
import { useAuthStore } from '../../store/authStore'
import type { TodoItem } from '../../types'

const TODAY = () => new Date().toISOString().split('T')[0]
const fmtTime = (ms: number) => new Date(ms).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })

function getPendingTasks(sections: any[]): TodoItem[] {
  const s = sections.find((s: any) => s.widgetType === 'todo')
  if (!s) return []
  try {
    const raw = s.items?.[0]?.desc
    if (!raw) return []
    return (JSON.parse(raw) as TodoItem[]).filter(i => !i.done)
  } catch { return [] }
}

type ModalType = 'login' | 'hourly' | 'upcoming'

function sendBrowserNotif(title: string, body: string) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
  try {
    const n = new Notification(title, {
      body,
      icon:   '/icon-192.png',
      badge:  '/icon-192.png',
      tag:    'jateamhub-todo',
      silent: false,
    })
    n.onclick = () => { window.focus(); n.close() }
  } catch { /* SSR or unsupported */ }
}

export default function TodoReminderModal() {
  const [show,      setShow]      = useState(false)
  const [items,     setItems]     = useState<TodoItem[]>([])
  const [modalType, setModalType] = useState<ModalType>('login')
  const [upcoming,  setUpcoming]  = useState<TodoItem | null>(null)
  const isDataInitialized = useStore(s => s.isDataInitialized)
  const { profile } = useAuthStore()

  // Fix: pakai sessionStorage bukan useRef agar tidak reset saat remount
  const loginShownKey = `todo-reminder-shown-${profile?.id ?? 'u'}`

  // Muncul saat login
  useEffect(() => {
    if (!isDataInitialized || !profile) return
    if (sessionStorage.getItem(loginShownKey)) return
    sessionStorage.setItem(loginShownKey, '1')
    const timer = setTimeout(() => {
      const pending = getPendingTasks(useStore.getState().personalSections)
      if (pending.length > 0) {
        setItems(pending); setModalType('login'); setShow(true)
        sendBrowserNotif('📋 Todo Hari Ini', `${pending.length} task belum selesai`)
      }
    }, 3000)
    return () => clearTimeout(timer)
  }, [isDataInitialized, profile?.id])

  // Tiap 1 jam
  useEffect(() => {
    if (!profile) return
    const interval = setInterval(() => {
      const pending = getPendingTasks(useStore.getState().personalSections)
      if (pending.length > 0) {
        setItems(pending); setModalType('hourly'); setShow(true)
      }
    }, 60 * 60 * 1000)
    return () => clearInterval(interval)
  }, [profile?.id])

  // 30 menit sebelum due time
  useEffect(() => {
    if (!profile) return
    const check = setInterval(() => {
      const all = getPendingTasks(useStore.getState().personalSections)
      const now = Date.now()
      const soon = all.find(i => {
        if (!i.dueTime || i.date !== TODAY()) return false
        const [h, m] = i.dueTime.split(':').map(Number)
        const due = new Date(); due.setHours(h, m, 0, 0)
        const diff = due.getTime() - now
        return diff > 0 && diff <= 30 * 60 * 1000 && diff > 29 * 60 * 1000
      })
      if (soon && !show) {
        setUpcoming(soon); setModalType('upcoming'); setShow(true)
        sendBrowserNotif('⏰ Todo Segera', `30 menit lagi: ${soon.text}`)
      }
    }, 60 * 1000) // cek tiap menit
    return () => clearInterval(check)
  }, [profile?.id, show])

  if (!show) return null

  const today      = TODAY()
  const overdue    = items.filter(i => i.date < today)
  const todayItems = items.filter(i => i.date >= today)
  const now        = new Date()
  const greeting   = now.getHours() < 12 ? 'Selamat Pagi' : now.getHours() < 17 ? 'Selamat Siang' : 'Selamat Malam'

  const isUpcoming = modalType === 'upcoming' && upcoming

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9500,
      background: 'rgba(0,0,0,0.65)',
      backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24, animation: 'fadeIn 300ms var(--ease)',
    }}>
      <div style={{
        background: 'var(--bg3)',
        border: '1px solid var(--border2)',
        borderRadius: 20,
        width: '100%', maxWidth: isUpcoming ? 400 : 480,
        overflow: 'hidden',
        animation: 'scaleIn 300ms var(--ease)',
        boxShadow: '0 24px 80px rgba(0,0,0,0.35)',
      }}>
        {/* Accent bar */}
        <div style={{
          height: 5,
          background: isUpcoming
            ? 'linear-gradient(90deg, #F59E0B, #EF4444)'
            : overdue.length > 0
            ? 'linear-gradient(90deg, var(--red), #F59E0B)'
            : 'linear-gradient(90deg, var(--accent), #7C3AED)',
        }} />

        {/* Header */}
        <div style={{ padding: '24px 28px 18px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: 44, marginBottom: 10, lineHeight: 1 }}>
            {isUpcoming ? '⏰' : overdue.length > 0 ? '⚠️' : '📋'}
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--silver)', letterSpacing: '-0.5px', lineHeight: 1.2 }}>
            {isUpcoming
              ? `30 Menit Lagi!`
              : overdue.length > 0
              ? `${overdue.length} Tugas Terlambat`
              : `${items.length} Tugas Menunggu`}
          </div>
          <div style={{ fontSize: 13, color: 'var(--silver3)', marginTop: 6 }}>
            {isUpcoming
              ? `Segera selesaikan: ${upcoming!.text}`
              : `${greeting} — ${now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`}
          </div>
        </div>

        {/* Task list */}
        {!isUpcoming && (
          <div style={{ padding: '14px 18px', maxHeight: 260, overflowY: 'auto', scrollbarWidth: 'none' }}>
            {overdue.length > 0 && (
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--red)', fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: '0.8px', padding: '4px 2px 8px' }}>
                Terlambat
              </div>
            )}
            {overdue.map(item => (
              <div key={item.id} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 12px', marginBottom: 5, borderRadius: 10,
                background: 'color-mix(in srgb, var(--red) 8%, transparent)',
                border: '1px solid color-mix(in srgb, var(--red) 15%, transparent)',
              }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--red)', flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: 14, color: 'var(--red)', fontWeight: 600 }}>{item.text}</span>
              </div>
            ))}
            {todayItems.length > 0 && overdue.length > 0 && (
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent)', fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: '0.8px', padding: '10px 2px 8px' }}>
                Hari ini
              </div>
            )}
            {todayItems.map(item => (
              <div key={item.id} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 12px', marginBottom: 5, borderRadius: 10,
                background: 'var(--bg4)', border: '1px solid var(--border)',
              }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', border: '1.5px solid var(--border2)', flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: 14, color: 'var(--silver)', fontWeight: 500 }}>{item.text}</span>
                {item.dueTime && <span style={{ fontSize: 11, color: 'var(--silver4)', fontFamily: 'var(--mono)' }}>⏰ {item.dueTime}</span>}
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        <div style={{ padding: '14px 18px 20px', borderTop: '1px solid var(--border)' }}>
          <button onClick={() => setShow(false)} style={{
            width: '100%', height: 46,
            background: isUpcoming
              ? '#F59E0B'
              : overdue.length > 0 ? 'var(--red)' : 'var(--accent)',
            border: 'none', borderRadius: 12,
            color: 'white', fontSize: 15, fontWeight: 700,
            cursor: 'pointer', fontFamily: 'var(--font)',
            transition: 'opacity 150ms',
          }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
          >
            {isUpcoming ? 'Siap, Segera Dikerjakan! ⚡' : overdue.length > 0 ? 'Segera Kerjakan! 🔥' : 'Siap, Kerjakan! 💪'}
          </button>
        </div>
      </div>
    </div>
  )
}
