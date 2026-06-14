import { useEffect, useState } from 'react'
import { supabase, getActiveAnnouncements, type Announcement } from '../../utils/supabaseClient'
import { useT } from '../../utils/i18n'

const DISMISS_KEY = 'jateamhub-dismissed-announcements'

const readDismissed = (): string[] => {
  try { return JSON.parse(localStorage.getItem(DISMISS_KEY) ?? '[]') } catch { return [] }
}

export default function AnnouncementBanner() {
  const t = useT()
  const [items, setItems]         = useState<Announcement[]>([])
  const [dismissed, setDismissed] = useState<string[]>(readDismissed)

  useEffect(() => {
    let alive = true
    getActiveAnnouncements().then(a => { if (alive) setItems(a) })
    // Live: new announcements appear immediately (RLS filters to targeted ones).
    const ch = supabase.channel('announcements-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, () => {
        getActiveAnnouncements().then(a => { if (alive) setItems(a) })
      })
      .subscribe()
    return () => { alive = false; ch.unsubscribe() }
  }, [])

  const dismiss = (id: string) => {
    const next = [...new Set([...dismissed, id])]
    setDismissed(next)
    try { localStorage.setItem(DISMISS_KEY, JSON.stringify(next)) } catch { /* ignore */ }
  }

  const visible = items.filter(a => !dismissed.includes(a.id))
  if (!visible.length) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '10px 16px 0' }}>
      {visible.map(a => (
        <div key={a.id} style={{
          display: 'flex', alignItems: 'flex-start', gap: 12,
          padding: '12px 14px', borderRadius: 12,
          background: 'color-mix(in srgb, var(--accent) 12%, var(--bg2))',
          border: '1px solid color-mix(in srgb, var(--accent) 40%, transparent)',
          boxShadow: '0 2px 10px rgba(0,0,0,.05)', animation: 'fadeUp 200ms ease',
        }}>
          <span style={{ flexShrink: 0, fontSize: 18, lineHeight: 1.3 }}>📢</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--silver)', marginBottom: 2 }}>{a.title}</div>
            <div style={{ fontSize: 12.5, color: 'var(--silver2, var(--silver))', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{a.body}</div>
          </div>
          <button
            onClick={() => dismiss(a.id)}
            title={t('close')}
            style={{ flexShrink: 0, width: 26, height: 26, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--silver3)', fontSize: 18, lineHeight: 1, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >×</button>
        </div>
      ))}
    </div>
  )
}
