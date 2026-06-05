import { useState, useEffect, useMemo } from 'react'
import { useAuthStore } from '../store/authStore'
import { useStore } from '../store/dashboardStore'
import { getTodoHistory, supabase } from '../utils/supabaseClient'
import type { TodoHistory, TodoItem } from '../types'

interface Props { onClose: () => void }
type Filter = 'all' | 'done' | 'overdue'

const fmtDate = (d: string) => {
  const [y, m, day] = d.split('-').map(Number)
  return new Date(y, m - 1, day).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}
const fmtDuration = (createdAt: string, doneAt?: string | null) => {
  if (!doneAt) return null
  const ms = new Date(doneAt).getTime() - new Date(createdAt).getTime()
  if (ms < 0) return null
  const h = Math.floor(ms / 3600000)
  if (h === 0) return '< 1 jam'
  return `${h} jam`
}
const isLate = (h: TodoHistory) => {
  if (!h.done_at || !h.due_date) return false
  return new Date(h.done_at) > new Date(h.due_date + (h.due_date.includes('T') ? '' : 'T23:59:59'))
}

export default function TaskListPage({ onClose }: Props) {
  const { profile } = useAuthStore()
  const [history,  setHistory]  = useState<TodoHistory[]>([])
  const [loading,  setLoading]  = useState(true)
  const [filter,   setFilter]   = useState<Filter>('all')
  const [search,   setSearch]   = useState('')
  const [searchDebounced, setSearchDebounced] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search), 200)
    return () => clearTimeout(t)
  }, [search])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [deleting, setDeleting] = useState(false)
  const [undoing,  setUndoing]  = useState(false)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo,   setDateTo]   = useState('')
  const [page,     setPage]     = useState(1)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const PAGE_SIZE = 10

  const loadHistory = () => {
    if (!profile?.id) return
    getTodoHistory(profile.id).then(data => {
      setHistory(data as TodoHistory[])
      setLoading(false)
    })
  }

  useEffect(() => { loadHistory() }, [profile?.id])
  useEffect(() => { setPage(1); setSelected(new Set()); setConfirmDelete(false) }, [filter, searchDebounced, dateFrom, dateTo])
  useEffect(() => { setConfirmDelete(false) }, [selected])

  const filtered = useMemo(() => history.filter(h => {
    if (filter === 'done'    && h.status !== 'done')    return false
    if (filter === 'overdue' && h.status !== 'overdue') return false
    if (dateFrom && h.date < dateFrom) return false
    if (dateTo   && h.date > dateTo)   return false
    if (searchDebounced && !h.task_text.toLowerCase().includes(searchDebounced.toLowerCase())) return false
    return true
  }), [history, filter, searchDebounced, dateFrom, dateTo])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const toggleSelect = (id: string) => setSelected(prev => {
    const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s
  })
  const toggleAll = () => {
    if (selected.size === paginated.length) setSelected(new Set())
    else setSelected(new Set(paginated.map(h => h.id)))
  }

  const deleteSelected = async () => {
    setDeleting(true)
    await supabase.from('todo_history').delete().in('id', Array.from(selected))
    setSelected(new Set()); setDeleting(false); setConfirmDelete(false)
    loadHistory()
  }

  const restoreSelected = async () => {
    if (!profile?.id || !selected.size) return
    setUndoing(true)
    const toRestore = history.filter(h => selected.has(h.id))
    await supabase.from('todo_history').delete().in('id', toRestore.map(h => h.id))
    const store = useStore.getState()
    const todoSection = store.personalSections.find((s: any) => s.widgetType === 'todo')
    if (todoSection) {
      const existing: TodoItem[] = (() => { try { return JSON.parse(todoSection.items?.[0]?.desc ?? '[]') } catch { return [] } })()
      const restored: TodoItem[] = toRestore.map(h => ({
        id: crypto.randomUUID(), text: h.task_text, done: false,
        createdAt: Date.now(), date: h.date, dueTime: h.due_date ?? undefined,
      }))
      const next = [...existing, ...restored]
      const json = JSON.stringify(next)
      if (todoSection.items.length > 0) {
        store.updateItem(todoSection.id, todoSection.items[0].id, { ...todoSection.items[0], desc: json, title: 'todo-data' })
      } else {
        store.addItem(todoSection.id, { title: 'todo-data', url: '#', icon: '', desc: json, tags: [], newTab: false, useFavicon: false } as any)
      }
      await store.syncPersonalToDb()
    }
    setSelected(new Set()); setUndoing(false); loadHistory()
  }

  const exportCsv = () => {
    const rows = [['No','Task','Tanggal','Selesai','Durasi','Status']]
    filtered.forEach((h, i) => {
      rows.push([
        String(i+1), h.task_text, fmtDate(h.date),
        h.done_at ? new Date(h.done_at).toLocaleString('id-ID') : '-',
        fmtDuration(h.created_at, h.done_at) ?? '-',
        h.status === 'done' ? 'Selesai' : 'Terlambat',
      ])
    })
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `riwayat-tugas-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 500, background: 'var(--bg)',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{
        height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 24px', borderBottom: '1px solid var(--border)',
        background: 'var(--bg2)', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--silver3)', fontSize: 18, display: 'flex', alignItems: 'center' }}>←</button>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--silver)' }}>Riwayat Tugas</div>
            <div style={{ fontSize: 11, color: 'var(--silver4)' }}>{filtered.length} tugas</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={exportCsv} style={{ height: 32, padding: '0 12px', background: 'var(--bg4)', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--silver3)', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)' }}>📥 Export</button>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari..." spellCheck={false}
            style={{ height: 32, padding: '0 10px', background: 'var(--bg4)', border: '1px solid var(--border2)', borderRadius: 8, fontSize: 12, color: 'var(--silver)', fontFamily: 'var(--font)', outline: 'none', width: 140 }} />
        </div>
      </div>

      {/* Filter bar */}
      <div style={{ padding: '10px 24px', borderBottom: '1px solid var(--border)', background: 'var(--bg2)', display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', flexShrink: 0 }}>
        {(['all','done','overdue'] as Filter[]).map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            height: 28, padding: '0 12px', borderRadius: 20, border: 'none',
            background: filter === f ? 'var(--accent)' : 'var(--bg4)',
            color: filter === f ? 'white' : 'var(--silver3)',
            fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)',
          }}>{f === 'all' ? 'Semua' : f === 'done' ? '✅ Selesai' : '⚠️ Terlambat'}</button>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 4 }}>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            style={{ height: 28, padding: '0 8px', background: 'var(--bg4)', border: '1px solid var(--border2)', borderRadius: 7, fontSize: 11, color: 'var(--silver)', fontFamily: 'var(--font)', outline: 'none' }} />
          <span style={{ fontSize: 11, color: 'var(--silver4)' }}>—</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            style={{ height: 28, padding: '0 8px', background: 'var(--bg4)', border: '1px solid var(--border2)', borderRadius: 7, fontSize: 11, color: 'var(--silver)', fontFamily: 'var(--font)', outline: 'none' }} />
          {(dateFrom || dateTo) && (
            <button onClick={() => { setDateFrom(''); setDateTo('') }} style={{ height: 28, width: 28, background: 'none', border: '1px solid var(--border2)', borderRadius: 7, color: 'var(--silver4)', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
          )}
        </div>
      </div>

      {/* Selection toolbar */}
      {selected.size > 0 && (
        <div style={{ padding: '8px 24px', background: 'var(--accent-light)', borderBottom: '1px solid var(--accent-soft)', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <span style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600, flex: 1 }}>{selected.size} dipilih</span>
          <button onClick={restoreSelected} disabled={undoing} style={{ height: 28, padding: '0 12px', background: 'var(--accent)', border: 'none', borderRadius: 7, color: 'white', fontSize: 11, fontWeight: 700, cursor: 'pointer', opacity: undoing ? 0.6 : 1 }}>
            {undoing ? '...' : '↩ Kembalikan'}
          </button>
          {confirmDelete ? (
            <>
              <span style={{ fontSize: 11, color: 'var(--red)' }}>Yakin hapus?</span>
              <button onClick={deleteSelected} disabled={deleting} style={{ height: 28, padding: '0 10px', background: 'var(--red)', border: 'none', borderRadius: 7, color: 'white', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Ya</button>
              <button onClick={() => setConfirmDelete(false)} style={{ height: 28, padding: '0 10px', background: 'none', border: '1px solid var(--border2)', borderRadius: 7, color: 'var(--silver3)', fontSize: 11, cursor: 'pointer' }}>Tidak</button>
            </>
          ) : (
            <button onClick={() => setConfirmDelete(true)} style={{ height: 28, padding: '0 12px', background: 'var(--red)', border: 'none', borderRadius: 7, color: 'white', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>🗑 Hapus</button>
          )}
          <button onClick={() => setSelected(new Set())} style={{ height: 28, width: 28, background: 'none', border: '1px solid var(--border2)', borderRadius: 7, color: 'var(--silver3)', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>
      )}

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', color: 'var(--silver4)', fontSize: 13, padding: 40 }}>Memuat...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📭</div>
            <div style={{ fontSize: 13, color: 'var(--silver4)' }}>Tidak ada riwayat tugas</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {/* Select all row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 12px', marginBottom: 2 }}>
              <input type="checkbox" checked={selected.size === paginated.length && paginated.length > 0} onChange={toggleAll} style={{ cursor: 'pointer' }} />
              <span style={{ fontSize: 10, color: 'var(--silver4)', fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Pilih semua halaman ini</span>
            </div>
            {paginated.map((h, i) => {
              const late = isLate(h)
              const dur = fmtDuration(h.created_at, h.done_at)
              const overdue = h.status === 'overdue'
              return (
                <div key={h.id} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 14px',
                  background: selected.has(h.id) ? 'var(--accent-light)' : 'var(--card-bg)',
                  border: `1px solid ${selected.has(h.id) ? 'var(--accent-soft)' : 'var(--border)'}`,
                  borderRadius: 10, cursor: 'pointer', transition: 'all 150ms',
                }} onClick={() => toggleSelect(h.id)}>
                  <input type="checkbox" checked={selected.has(h.id)} onChange={() => toggleSelect(h.id)}
                    onClick={e => e.stopPropagation()} style={{ cursor: 'pointer', marginTop: 2, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 13, color: overdue ? 'var(--red)' : 'var(--silver)', fontWeight: 500, flex: 1, wordBreak: 'break-word' }}>{h.task_text}</span>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 99, flexShrink: 0,
                        background: overdue ? 'color-mix(in srgb, var(--red) 12%, transparent)' : 'color-mix(in srgb, var(--accent) 12%, transparent)',
                        color: overdue ? 'var(--red)' : 'var(--accent)',
                      }}>{overdue ? '⚠️ Terlambat' : '✅ Selesai'}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 12, marginTop: 5, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 10, color: 'var(--silver4)', fontFamily: 'var(--mono)' }}>📅 {fmtDate(h.date)}</span>
                      {h.done_at && (
                        <span style={{ fontSize: 10, color: 'var(--silver4)', fontFamily: 'var(--mono)' }}>
                          ✓ {new Date(h.done_at).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                      {dur && (
                        <span style={{ fontSize: 10, fontFamily: 'var(--mono)', color: late ? 'var(--red)' : 'var(--silver3)', fontWeight: late ? 700 : 400 }}>
                          ⏱ {dur}{late ? ' (lewat)' : ''}
                        </span>
                      )}
                    </div>
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--silver4)', fontFamily: 'var(--mono)', flexShrink: 0, marginTop: 2 }}>#{(page-1)*PAGE_SIZE + i + 1}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '12px 24px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
          <button onClick={() => setPage(1)} disabled={page === 1} style={{ height: 30, padding: '0 10px', borderRadius: 7, border: '1px solid var(--border2)', background: 'none', cursor: page === 1 ? 'default' : 'pointer', color: page === 1 ? 'var(--silver4)' : 'var(--silver2)', fontSize: 12 }}>«</button>
          <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page === 1} style={{ height: 30, padding: '0 10px', borderRadius: 7, border: '1px solid var(--border2)', background: 'none', cursor: page === 1 ? 'default' : 'pointer', color: page === 1 ? 'var(--silver4)' : 'var(--silver2)', fontSize: 12 }}>‹</button>
          {Array.from({ length: totalPages }, (_, i) => i+1)
            .filter(p => p === 1 || p === totalPages || Math.abs(p-page) <= 1)
            .reduce((acc: (number|string)[], p, idx, arr) => {
              if (idx > 0 && (arr[idx-1] as number) < p-1) acc.push('...')
              acc.push(p); return acc
            }, [])
            .map((p, idx) => typeof p === 'string'
              ? <span key={idx} style={{ fontSize: 12, color: 'var(--silver4)', padding: '0 2px' }}>…</span>
              : <button key={p} onClick={() => setPage(p as number)} style={{ height: 30, minWidth: 30, padding: '0 8px', borderRadius: 7, border: page === p ? '1px solid var(--accent)' : '1px solid var(--border2)', background: page === p ? 'var(--accent)' : 'none', color: page === p ? 'white' : 'var(--silver2)', cursor: 'pointer', fontSize: 12, fontWeight: page === p ? 700 : 400 }}>{p}</button>
            )}
          <button onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page === totalPages} style={{ height: 30, padding: '0 10px', borderRadius: 7, border: '1px solid var(--border2)', background: 'none', cursor: page === totalPages ? 'default' : 'pointer', color: page === totalPages ? 'var(--silver4)' : 'var(--silver2)', fontSize: 12 }}>›</button>
          <button onClick={() => setPage(totalPages)} disabled={page === totalPages} style={{ height: 30, padding: '0 10px', borderRadius: 7, border: '1px solid var(--border2)', background: 'none', cursor: page === totalPages ? 'default' : 'pointer', color: page === totalPages ? 'var(--silver4)' : 'var(--silver2)', fontSize: 12 }}>»</button>
          <span style={{ fontSize: 11, color: 'var(--silver4)', marginLeft: 4 }}>{(page-1)*PAGE_SIZE + 1}–{Math.min(page*PAGE_SIZE, filtered.length)} / {filtered.length}</span>
        </div>
      )}
    </div>
  )
}
