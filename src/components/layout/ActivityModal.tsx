import { useStore } from '../../store/dashboardStore'

function rel(ms: number): string {
  const d = Date.now() - ms
  if (d < 60_000) return 'baru saja'
  if (d < 3_600_000) return `${Math.floor(d / 60_000)} menit lalu`
  if (d < 86_400_000) return `${Math.floor(d / 3_600_000)} jam lalu`
  if (d < 7 * 86_400_000) return `${Math.floor(d / 86_400_000)} hari lalu`
  return new Date(ms).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

// Recent-edits feed (replaces the old "Riwayat Task"). Uses Section.updatedAt.
export default function ActivityModal({ onClose }: { onClose: () => void }) {
  const sections = useStore(s => s.personalSections)
  const items = sections.filter(s => s.updatedAt).sort((a, b) => (b.updatedAt! - a.updatedAt!))

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose() }} style={{
      position: 'fixed', inset: 0, zIndex: 9000, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, animation: 'fadeIn 0.15s ease',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 16,
        width: '100%', maxWidth: 440, maxHeight: '80vh', display: 'flex', flexDirection: 'column',
        boxShadow: 'var(--shadow-lg)', animation: 'scaleIn 180ms var(--ease)', overflow: 'hidden',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
          <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--silver)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            Aktivitas
          </span>
          <button onClick={onClose} aria-label="Tutup" style={{ width: 28, height: 28, borderRadius: 8, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--silver3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div style={{ overflowY: 'auto', padding: '6px 8px 12px' }}>
          {items.length === 0 && (
            <div style={{ padding: 28, textAlign: 'center', color: 'var(--silver4)', fontSize: 13 }}>Belum ada aktivitas. Edit sebuah section untuk melihatnya di sini.</div>
          )}
          {items.map(s => (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '9px 11px', borderRadius: 10 }}>
              <span style={{ fontSize: 19, flexShrink: 0 }}>{s.icon || '📁'}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--silver)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.title}</div>
                <div style={{ fontSize: 11, color: 'var(--silver4)', fontFamily: 'var(--mono)' }}>diubah {rel(s.updatedAt!)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
