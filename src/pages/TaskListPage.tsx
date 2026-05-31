// ─────────────────────────────────────────────────────────────
// TASK LIST PAGE — Riwayat semua todo yang sudah selesai/overdue
// ─────────────────────────────────────────────────────────────
import { useState, useEffect } from 'react'
import { useAuthStore } from '../store/authStore'
import { useStore } from '../store/dashboardStore'
import { getTodoHistory, supabase } from '../utils/supabaseClient'
import type { TodoHistory, TodoItem } from '../types'

interface Props { onClose: () => void }

type Filter = 'all' | 'done' | 'overdue' | 'week' | 'month'

const fmtDateTime = (iso: string) => {
  const d = new Date(iso)
  return d.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' }) +
    ' ' + d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
}
const fmtDate = (d: string) => {
  const [y, m, day] = d.split('-').map(Number)
  return new Date(y, m-1, day).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function TaskListPage({ onClose }: Props) {
  const { profile } = useAuthStore()
  const [history,    setHistory]    = useState<TodoHistory[]>([])
  const [loading,    setLoading]    = useState(true)
  const [filter,     setFilter]     = useState<Filter>('all')
  const [search,     setSearch]     = useState('')
  const [undoing,    setUndoing]    = useState<string|null>(null)
  const personalSections = useStore(s => s.personalSections)

  const TODAY = new Date().toISOString().split('T')[0]

  const loadHistory = () => {
    if (!profile?.id) return
    getTodoHistory(profile.id).then(data => {
      setHistory(data as TodoHistory[])
      setLoading(false)
    })
  }

  useEffect(() => { loadHistory() }, [profile?.id])

  const handleUndo = async (h: TodoHistory) => {
    if (!profile?.id) return
    setUndoing(h.id)
    // Hapus dari history
    await supabase.from('todo_history').delete().eq('id', h.id)
    // Kembalikan ke widget todo
    const store = useStore.getState()
    const todoSection = store.personalSections.find((s: any) => s.widgetType === 'todo')
    if (todoSection) {
      const existingItems: TodoItem[] = (() => {
        try { return JSON.parse(todoSection.items?.[0]?.desc ?? '[]') } catch { return [] }
      })()
      const restored: TodoItem = {
        id: crypto.randomUUID(),
        text: h.task_text, done: false,
        createdAt: new Date(h.created_at).getTime(),
        date: h.date, dueTime: h.due_date ?? undefined,
      }
      const next = [...existingItems, restored]
      // Update subtitle
      const pendingCount = next.filter((i: TodoItem) => !i.done).length
      store.updatePersonalSection(todoSection.id, { subtitle: `${0}/${next.length} selesai` })
      const json = JSON.stringify(next)
      if (todoSection.items.length > 0) {
        store.updateItem(todoSection.id, todoSection.items[0].id, { ...todoSection.items[0], desc: json, title: 'todo-data' })
      } else {
        store.addItem(todoSection.id, { title: 'todo-data', url: '#', icon: '', desc: json, tags: [], newTab: false, useFavicon: false } as any)
      }
      await store.syncPersonalToDb()
    }
    setUndoing(null)
    loadHistory()
  }

  const filtered = history.filter(h => {
    if (filter === 'done'    && h.status !== 'done')    return false
    if (filter === 'overdue' && h.status !== 'overdue') return false
    if (filter === 'week') {
      const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7)
      if (new Date(h.created_at) < weekAgo) return false
    }
    if (filter === 'month') {
      const monthAgo = new Date(); monthAgo.setMonth(monthAgo.getMonth() - 1)
      if (new Date(h.created_at) < monthAgo) return false
    }
    if (search && !h.task_text.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const filterBtns: { key: Filter; label: string }[] = [
    { key: 'all',     label: 'Semua' },
    { key: 'done',    label: '✅ Selesai' },
    { key: 'overdue', label: '⚠️ Terlambat' },
    { key: 'week',    label: 'Minggu ini' },
    { key: 'month',   label: 'Bulan ini' },
  ]

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'var(--bg)', fontFamily: 'var(--font)',
      display: 'flex', flexDirection: 'column',
      animation: 'fadeIn 200ms ease',
    }}>
      {/* Header */}
      <div style={{
        height: 56, background: 'var(--bg2)', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', padding: '0 20px', gap: 12,
        position: 'sticky', top: 0, zIndex: 10, flexShrink: 0,
      }}>
        <button onClick={onClose} style={{
          width: 34, height: 34, borderRadius: 8, background: 'var(--bg4)',
          border: '1px solid var(--border2)', cursor: 'pointer', color: 'var(--silver2)',
          fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>←</button>
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--silver)', letterSpacing: -0.3 }}>
            📋 Riwayat Task
          </div>
          <div style={{ fontSize: 11, color: 'var(--silver3)' }}>{history.length} task total</div>
        </div>
        <div style={{ marginLeft: 'auto' }}>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Cari task..." spellCheck={false}
            style={{
              height: 32, padding: '0 12px', background: 'var(--bg4)',
              border: '1px solid var(--border2)', borderRadius: 8,
              fontSize: 12, color: 'var(--silver)', fontFamily: 'var(--font)', outline: 'none',
              width: 180,
            }} />
        </div>
      </div>

      {/* Filter bar */}
      <div style={{
        display: 'flex', gap: 6, padding: '10px 20px',
        background: 'var(--bg2)', borderBottom: '1px solid var(--border)',
        overflowX: 'auto', flexShrink: 0,
      }}>
        {filterBtns.map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)} style={{
            height: 30, padding: '0 12px', borderRadius: 99, whiteSpace: 'nowrap',
            background: filter === f.key ? 'var(--accent)' : 'var(--bg4)',
            border: `1px solid ${filter === f.key ? 'var(--accent)' : 'var(--border2)'}`,
            color: filter === f.key ? 'white' : 'var(--silver2)',
            fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)',
            transition: 'all 150ms',
          }}>{f.label}</button>
        ))}
      </div>

      {/* Table */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 20px' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--silver3)' }}>Memuat...</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--silver3)' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📭</div>
            <div style={{ fontSize: 13 }}>Tidak ada riwayat task</div>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 12 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border)' }}>
                {['No', 'Task', 'Due Date', 'Dibuat', 'Selesai', 'Status', ''].map(h => (
                  <th key={h} style={{
                    padding: '8px 12px', textAlign: 'left', fontSize: 10,
                    fontWeight: 700, color: 'var(--silver3)', fontFamily: 'var(--mono)',
                    textTransform: 'uppercase', letterSpacing: '0.8px',
                    whiteSpace: 'nowrap',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((h, i) => (
                <tr key={h.id} style={{
                  borderBottom: '1px solid var(--border)',
                  background: i % 2 === 0 ? 'transparent' : 'color-mix(in srgb, var(--bg4) 40%, transparent)',
                  transition: 'background 120ms',
                }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent-light)')}
                  onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? 'transparent' : 'color-mix(in srgb, var(--bg4) 40%, transparent)')}
                >
                  <td style={{ padding: '10px 12px', fontSize: 11, color: 'var(--silver4)', fontFamily: 'var(--mono)', width: 40 }}>{i + 1}</td>
                  <td style={{ padding: '10px 12px', fontSize: 13, color: 'var(--silver)', fontWeight: 500, maxWidth: 300 }}>
                    <div>{h.task_text}</div>
                    <div style={{ fontSize: 10, color: 'var(--silver4)', marginTop: 2 }}>
                      {fmtDate(h.date)}
                    </div>
                  </td>
                  <td style={{ padding: '10px 12px', fontSize: 12, color: 'var(--silver3)', whiteSpace: 'nowrap' }}>
                    {h.due_date ? fmtDate(h.due_date) : <span style={{ color: 'var(--silver4)' }}>—</span>}
                  </td>
                  <td style={{ padding: '10px 12px', fontSize: 11, color: 'var(--silver3)', fontFamily: 'var(--mono)', whiteSpace: 'nowrap' }}>
                    {fmtDateTime(h.created_at)}
                  </td>
                  <td style={{ padding: '10px 12px', fontSize: 11, color: 'var(--silver3)', fontFamily: 'var(--mono)', whiteSpace: 'nowrap' }}>
                    {h.done_at ? fmtDateTime(h.done_at) : <span style={{ color: 'var(--silver4)' }}>—</span>}
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99,
                      fontFamily: 'var(--mono)', textTransform: 'uppercase',
                      background: h.status === 'done' ? 'var(--accent-light)' : 'var(--red-bg)',
                      color: h.status === 'done' ? 'var(--accent)' : 'var(--red)',
                    }}>
                      {h.status === 'done' ? '✅ Selesai' : '⚠️ Terlambat'}
                    </span>
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    {h.date === TODAY && (
                      <button
                        onClick={() => handleUndo(h)}
                        disabled={undoing === h.id}
                        style={{
                          height: 26, padding: '0 10px', background: 'var(--bg4)',
                          border: '1px solid var(--border2)', borderRadius: 6,
                          color: 'var(--silver2)', fontSize: 11, cursor: 'pointer',
                          fontFamily: 'var(--font)', opacity: undoing === h.id ? 0.5 : 1,
                          whiteSpace: 'nowrap',
                        }}
                      >{undoing === h.id ? '...' : '↩ Batalkan'}</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
