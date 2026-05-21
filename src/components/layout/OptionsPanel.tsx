import { useRef, useEffect } from 'react'
import { useStore } from '../../store/dashboardStore'
import { applyThemeToDOM } from '../../store/dashboardStore'
import { THEMES } from '../../types'
import type { ItemDisplayMode, IconSize } from '../../types'

interface Props { open: boolean; onClose: () => void }

// Poin 11: hanya list dan folderGrid
const ITEM_VIEWS: { key: ItemDisplayMode; label: string; icon: string }[] = [
  { key: 'list',       label: 'List',   icon: '☰' },
  { key: 'folderGrid', label: 'Grid',   icon: '⊞' },
]

const FOLDER_COLS = [
  { cols: 3, label: '3×' }, { cols: 4, label: '4×' },
  { cols: 5, label: '5×' }, { cols: 6, label: '6×' },
]

export default function OptionsPanel({ open, onClose }: Props) {
  const {
    appearance, setAppearance,
  } = useStore()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const mouseHandler = (e: MouseEvent) => {
      if (open && ref.current && !ref.current.contains(e.target as Node)) {
        const btn = document.getElementById('options-btn')
        if (!btn?.contains(e.target as Node)) onClose()
      }
    }
    const keyHandler = (e: KeyboardEvent) => {
      if (open && e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', mouseHandler)
    document.addEventListener('keydown',   keyHandler)
    return () => {
      document.removeEventListener('mousedown', mouseHandler)
      document.removeEventListener('keydown',   keyHandler)
    }
  }, [open, onClose])

  if (!open) return null

  const isFolderGrid = appearance.itemDisplayMode === 'folderGrid'

  return (
    <div className="options-panel" ref={ref}>
      <div className="options-header">
        <h3>Tampilan</h3>
        <button className="close-btn" onClick={onClose}>×</button>
      </div>

      <div className="options-body">

        {/* Tema */}
        <div className="options-label">Tema</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
          {THEMES.map(t => {
            const isActive = (appearance.themeBase ?? 'ivory') === t.id
            return (
              <button key={t.id} onClick={() => {
                const themeId = t.standalone ? 'obsidian' : 'ivory-light'
                setAppearance({ themeBase: t.id as any, theme: themeId as any, isDarkMode: false })
                applyThemeToDOM(themeId)
              }} style={{
                flex: 1, padding: '12px 10px',
                borderRadius: 'var(--radius-sm)',
                background: isActive ? 'var(--mint-bg2)' : 'var(--bg2)',
                border: `1.5px solid ${isActive ? 'var(--accent)' : 'var(--border)'}`,
                cursor: 'pointer', transition: 'all 150ms var(--ease)',
                display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8,
                textAlign: 'left',
              }}>
                <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                  <div style={{
                    width: 24, height: 16, borderRadius: 4,
                    background: t.standalone ? '#0C0C0C' : '#FAFAF8',
                    border: '1px solid var(--border2)',
                  }} />
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: t.accent }} />
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: isActive ? 'var(--accent)' : 'var(--silver)' }}>
                    {t.name}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--silver3)', marginTop: 2 }}>{t.description}</div>
                </div>
                {isActive && <span style={{ fontSize: 10, color: 'var(--accent)', fontWeight: 700 }}>✓ Aktif</span>}
              </button>
            )
          })}
        </div>

        <div className="options-divider" />

        {/* Item View — poin 11: hanya list dan grid */}
        <div className="options-label">Tampilan Item</div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
          {ITEM_VIEWS.map(v => {
            const active = appearance.itemDisplayMode === v.key
            return (
              <button key={v.key} onClick={() => setAppearance({ itemDisplayMode: v.key })} style={{
                flex: 1, height: 40, fontSize: 12, fontWeight: 700,
                background: active ? 'var(--mint-bg2)' : 'var(--bg2)',
                border: `1.5px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                borderRadius: 'var(--radius-sm)',
                color: active ? 'var(--accent)' : 'var(--silver2)',
                cursor: 'pointer', fontFamily: 'var(--font)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}>
                <span style={{ fontSize: 16 }}>{v.icon}</span>{v.label}
              </button>
            )
          })}
        </div>

        {/* Grid columns — hanya saat folderGrid */}
        {isFolderGrid && (
          <>
            <div className="options-label" style={{ marginTop: 12 }}>Jumlah Kolom</div>
            <div style={{ display: 'flex', gap: 4 }}>
              {FOLDER_COLS.map(({ cols, label }) => {
                const active = appearance.folderGridCols === cols
                return (
                  <button key={cols} onClick={() => setAppearance({ folderGridCols: cols })} style={{
                    flex: 1, height: 36, fontSize: 12, fontWeight: 700,
                    background: active ? 'var(--mint-bg2)' : 'var(--bg2)',
                    border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                    borderRadius: 'var(--radius-sm)',
                    color: active ? 'var(--accent)' : 'var(--silver3)',
                    cursor: 'pointer', fontFamily: 'var(--mono)',
                  }}>{label}</button>
                )
              })}
            </div>
          </>
        )}

        <div className="options-divider" />

        {/* Icon size */}
        <div className="options-label">Ukuran Icon</div>
        <div style={{ padding: '4px 2px' }}>
          <input type="range" min={0} max={3}
            value={['small','medium','large','xl'].indexOf(appearance.iconSize)}
            onChange={e => {
              const sizes: IconSize[] = ['small','medium','large','xl']
              setAppearance({ iconSize: sizes[Number(e.target.value)] })
            }}
            style={{ width: '100%', accentColor: 'var(--accent)', cursor: 'pointer' }} />
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            fontSize: 10, color: 'var(--silver3)', fontFamily: 'var(--mono)', marginTop: 4,
          }}>
            <span>Kecil</span><span>Sedang</span><span>Besar</span><span>XL</span>
          </div>
        </div>

      </div>
    </div>
  )
}
