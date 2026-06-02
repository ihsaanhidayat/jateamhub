import { useState, useEffect, useRef } from 'react'
import { useStore } from '../../store/dashboardStore'
import { useAuthStore } from '../../store/authStore'
import type { TodoItem } from '../../types'

const TODAY = () => new Date().toISOString().split('T')[0]
const fmtTime = (ms: number) => new Date(ms).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })

function getPendingTasks(sections: any[]): TodoItem[] {
  const todoSection = sections.find((s: any) => s.widgetType === 'todo')
  if (!todoSection) return []
  try {
    const all: TodoItem[] = JSON.parse(todoSection.items?.[0]?.desc ?? '[]')
    return all.filter(i => !i.done)
  } catch { return [] }
}

export default function TodoReminderModal() {
  const [show, setShow] = useState(false)
  const [items, setItems] = useState<TodoItem[]>([])
  const personalSections = useStore(s => s.personalSections)
  const isDataInitialized = useStore(s => s.isDataInitialized)
  const { profile } = useAuthStore()
  const shownOnLogin = useRef(false)

  // Tampilkan saat login (setelah data load)
  useEffect(() => {
    if (!isDataInitialized || !profile || shownOnLogin.current) return
    shownOnLogin.current = true
    const timer = setTimeout(() => {
      const pending = getPendingTasks(useStore.getState().personalSections)
      if (pending.length > 0) {
        setItems(pending)
        setShow(true)
      }
    }, 2500)
    return () => clearTimeout(timer)
  }, [isDataInitialized, profile])

  // Tampilkan tiap 1 jam
  useEffect(() => {
    if (!profile) return
    const interval = setInterval(() => {
      const pending = getPendingTasks(useStore.getState().personalSections)
      if (pending.length > 0) {
        setItems(pending)
        setShow(true)
      }
    }, 60 * 60 * 1000)
    return () => clearInterval(interval)
  }, [profile])

  if (!show || items.length === 0) return null

  const today = TODAY()
  const overdue = items.filter(i => i.date < today)
  const todayItems = items.filter(i => i.date >= today)
  const now = new Date()
  const greeting = now.getHours() < 12 ? 'Selamat Pagi' : now.getHours() < 17 ? 'Selamat Siang' : 'Selamat Malam'
  const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      animation: 'fadeIn 300ms ease', padding: 20,
    }} onClick={() => setShow(false)}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--card-bg)', borderRadius: 16,
        width: '100%', maxWidth: 360,
        boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
        overflow: 'hidden',
        animation: 'slideUp 350ms cubic-bezier(0.16,1,0.3,1)',
      }}>
        {/* Header gradient */}
        <div style={{
          padding: '24px 24px 18px',
          background: 'linear-gradient(135deg, var(--accent), color-mix(in srgb, var(--accent) 70%, #7C3AED))',
          color: 'white', textAlign: 'center',
        }}>
          <div style={{ fontSize: 11, opacity: 0.8, fontFamily: 'var(--mono)', marginBottom: 6 }}>
            {greeting} · {timeStr}
          </div>
          <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-0.3px' }}>
            {overdue.length > 0
              ? `⚠️ ${items.length} Tugas Menunggu`
              : `📋 ${items.length} Tugas Hari Ini`}
          </div>
        </div>

        {/* Task list */}
        <div style={{ padding: '10px 14px', maxHeight: 220, overflowY: 'auto', scrollbarWidth: 'none' }}>
          {overdue.length > 0 && (
            <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--red)', fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: '0.8px', padding: '6px 4px 4px' }}>
              Terlambat
            </div>
          )}
          {overdue.map(item => (
            <div key={item.id} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '7px 10px', marginBottom: 3, borderRadius: 8,
              background: 'color-mix(in srgb, var(--red) 6%, transparent)',
              border: '1px solid color-mix(in srgb, var(--red) 12%, transparent)',
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--red)', flexShrink: 0 }} />
              <span style={{ flex: 1, fontSize: 13, color: 'var(--red)', fontWeight: 500 }}>{item.text}</span>
            </div>
          ))}

          {todayItems.length > 0 && overdue.length > 0 && (
            <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--accent)', fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: '0.8px', padding: '8px 4px 4px' }}>
              Hari ini
            </div>
          )}
          {todayItems.map(item => (
            <div key={item.id} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '7px 10px', marginBottom: 3, borderRadius: 8,
              background: 'var(--bg4)', border: '1px solid var(--border)',
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', border: '1.5px solid var(--border2)', flexShrink: 0 }} />
              <span style={{ flex: 1, fontSize: 13, color: 'var(--silver)', fontWeight: 500 }}>{item.text}</span>
              {item.dueTime && (
                <span style={{ fontSize: 10, color: 'var(--silver4)', fontFamily: 'var(--mono)' }}>
                  {item.dueTime}
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ padding: '10px 14px 14px' }}>
          <button onClick={() => setShow(false)} style={{
            width: '100%', height: 40, background: 'var(--accent)',
            border: 'none', borderRadius: 10,
            color: 'white', fontSize: 13, fontWeight: 700,
            cursor: 'pointer', fontFamily: 'var(--font)',
          }}>Siap, Kerjakan! 💪</button>
        </div>
      </div>
    </div>
  )
}
