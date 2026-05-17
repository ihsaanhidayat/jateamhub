// ─────────────────────────────────────────────────────────────
// ADD SECTION MODAL — pilihan Section atau Widget
// ─────────────────────────────────────────────────────────────
import { useStore } from '../../store/dashboardStore'
import type { Section, WidgetType } from '../../types'

interface Props {
  open:    boolean
  onClose: () => void
}

export default function AddSectionModal({ open, onClose }: Props) {
  const { personalSections, addPersonalSectionAuto } = useStore()

  // Cek apakah sudah ada widget jam (hanya boleh 1)
  const hasClockWidget = personalSections.some(
    s => s.type === 'widget' && s.widgetType === 'clock'
  )

  const addWidget = (widgetType: WidgetType) => {
    const { addPersonalSection } = useStore.getState()
    const current = useStore.getState().personalSections
    const maxY    = current.reduce((m, s) => Math.max(m, s.layout.y + s.layout.h), 0)
    const lastRow = current.filter(s => s.layout.y + s.layout.h >= maxY)
    const maxX    = lastRow.reduce((m, s) => Math.max(m, s.layout.x + s.layout.w), 0)
    const sameRow = maxX + 3 <= 12

    const config: Record<WidgetType, { title: string; icon: string; w: number; h: number }> = {
      clock: { title: 'Jam',   icon: '🕐', w: 3, h: 3 },
      notes: { title: 'Notes', icon: '📝', w: 4, h: 5 },
    }
    const c = config[widgetType]

    addPersonalSection({
      title:      c.title,
      icon:       c.icon,
      subtitle:   '',
      items:      [],
      layout:     { x: sameRow ? maxX : 0, y: sameRow ? Math.max(0, maxY - c.h) : maxY, w: c.w, h: c.h },
      visibility: 'all',
      targetUnits: [],
      pageId:     'beranda',
      type:       'widget',
      widgetType,
    })
    onClose()
  }

  if (!open) return null

  const cardBase: React.CSSProperties = {
    flex: 1, padding: '20px 16px', borderRadius: 12,
    border: '1px solid var(--border2)', background: 'var(--bg2)',
    cursor: 'pointer', transition: 'all 0.18s',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
    textAlign: 'center',
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9000,
      background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20, animation: 'fadeIn 0.15s ease',
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--bg3)', border: '1px solid var(--border2)',
        borderRadius: 16, padding: 24, width: '100%', maxWidth: 480,
        boxShadow: 'var(--shadow-lg)', animation: 'scaleIn 0.18s ease',
      }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--silver)', marginBottom: 6 }}>
          Tambah Konten
        </div>
        <div style={{ fontSize: 12, color: 'var(--silver3)', marginBottom: 20 }}>
          Pilih jenis konten yang ingin ditambahkan ke dashboard
        </div>

        {/* Row 1: Section atau Widget */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
          {/* Section */}
          <div style={cardBase}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)'; (e.currentTarget as HTMLElement).style.background = 'var(--mint-bg)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border2)'; (e.currentTarget as HTMLElement).style.background = 'var(--bg2)' }}
            onClick={() => { addPersonalSectionAuto(); onClose() }}>
            <span style={{ fontSize: 36 }}>📁</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--silver)', marginBottom: 4 }}>Section</div>
              <div style={{ fontSize: 11, color: 'var(--silver3)', lineHeight: 1.5 }}>
                Kumpulkan link dan shortcut dalam satu folder
              </div>
            </div>
          </div>

          {/* Widget */}
          <div style={cardBase}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)'; (e.currentTarget as HTMLElement).style.background = 'var(--mint-bg)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border2)'; (e.currentTarget as HTMLElement).style.background = 'var(--bg2)' }}>
            <span style={{ fontSize: 36 }}>🧩</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--silver)', marginBottom: 4 }}>Widget</div>
              <div style={{ fontSize: 11, color: 'var(--silver3)', lineHeight: 1.5 }}>
                Tambahkan fitur interaktif ke dashboard
              </div>
            </div>
            {/* Sub-pilihan widget */}
            <div style={{ display: 'flex', gap: 8, width: '100%', marginTop: 4 }}>
              {/* Jam */}
              <button
                disabled={hasClockWidget}
                onClick={e => { e.stopPropagation(); if (!hasClockWidget) addWidget('clock') }}
                style={{
                  flex: 1, padding: '8px 6px', borderRadius: 8,
                  background: hasClockWidget ? 'var(--bg4)' : 'var(--mint-bg)',
                  border: `1px solid ${hasClockWidget ? 'var(--border)' : 'var(--accent)'}`,
                  color: hasClockWidget ? 'var(--silver3)' : 'var(--accent)',
                  fontSize: 11, fontWeight: 700, cursor: hasClockWidget ? 'not-allowed' : 'pointer',
                  fontFamily: 'var(--font)',
                }}>
                🕐 Jam{hasClockWidget ? ' (aktif)' : ''}
              </button>
              {/* Notes */}
              <button
                onClick={e => { e.stopPropagation(); addWidget('notes') }}
                style={{
                  flex: 1, padding: '8px 6px', borderRadius: 8,
                  background: 'var(--mint-bg)', border: '1px solid var(--accent)',
                  color: 'var(--accent)', fontSize: 11, fontWeight: 700,
                  cursor: 'pointer', fontFamily: 'var(--font)',
                }}>
                📝 Notes
              </button>
            </div>
          </div>
        </div>

        <button onClick={onClose} style={{
          width: '100%', padding: '10px', marginTop: 4,
          background: 'none', border: '1px solid var(--border)',
          borderRadius: 8, color: 'var(--silver3)', fontSize: 12,
          cursor: 'pointer', fontFamily: 'var(--font)',
        }}>Batal</button>
      </div>
    </div>
  )
}
