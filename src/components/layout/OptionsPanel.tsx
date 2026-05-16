import { useRef, useEffect } from 'react'
import { useStore } from '../../store/dashboardStore'
import { useAuthStore } from '../../store/authStore'
import { can, canSeeOptionsPanel } from '../../utils/roles'
import type { ItemDisplayMode, IconSize, LabelMode, ThemeId } from '../../types'
import { THEMES } from '../../types'

interface Props { open: boolean; onClose: () => void }

const ITEM_VIEWS: { key: ItemDisplayMode; label: string; icon: string }[] = [
  { key: 'button',     label: 'Button',      icon: '▣' },
  { key: 'list',       label: 'List',        icon: '☰' },
  { key: 'iconText',   label: 'Icon+Text',   icon: '◫' },
  { key: 'folderGrid', label: 'Folder Grid', icon: '⊞' },
]
const LABEL_MODES: { key: LabelMode; label: string }[] = [
  { key: 'show', label: 'Show' }, { key: 'hide', label: 'Hide' }, { key: 'hover', label: 'Hover' },
]
const FOLDER_COLS = [
  { cols: 2, label: '2×' }, { cols: 3, label: '3×' }, { cols: 4, label: '4×' }, { cols: 5, label: '5×' },
]

function ToggleSwitch({ on, onClick }: { on: boolean; onClick: () => void }) {
  return <div className={`toggle-switch${on ? ' on' : ''}`} onClick={onClick} role="switch" aria-checked={on} />
}

function ChipGroup<T extends string>({ options, value, onChange }: {
  options: { key: T; label: string; icon?: string }[]
  value: T; onChange: (v: T) => void
}) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
      {options.map(o => (
        <button key={o.key} onClick={() => onChange(o.key)} style={{
          padding: '4px 9px', fontSize: 11, fontWeight: 600,
          background: value === o.key ? 'var(--mint-bg2)' : 'var(--bg3)',
          border: `1px solid ${value === o.key ? 'var(--mint)' : 'var(--border2)'}`,
          borderRadius: 'var(--radius-sm)',
          color: value === o.key ? 'var(--mint)' : 'var(--silver3)',
          cursor: 'pointer', transition: 'all .12s',
          display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'var(--font)',
        }}>
          {o.icon && <span style={{ fontSize: 12 }}>{o.icon}</span>}{o.label}
        </button>
      ))}
    </div>
  )
}

export default function OptionsPanel({ open, onClose }: Props) {
  const {
    presets, savePreset, applyPreset, deletePreset,
    displayOptions, setDisplayOptions,
    appearance, setAppearance,
    setGlobalTheme, globalTheme,
    toast,
  } = useStore()
  const { profile: session } = useAuthStore()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (open && ref.current && !ref.current.contains(e.target as Node)) {
        const btn = document.getElementById('options-btn')
        if (!btn?.contains(e.target as Node)) onClose()
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open, onClose])

  if (!open || !canSeeOptionsPanel(session as any)) return null

  const isSuperAdmin   = session?.role === 'superadmin'
  const isFolderGrid   = appearance.itemDisplayMode === 'folderGrid'
  const canThemeGlobal = can(session as any, 'SYSTEM_THEME_GLOBAL')

  return (
    <div className="options-panel" ref={ref} style={{ maxHeight: 'calc(100vh - 60px)', overflowY: 'auto' }}>
      <div className="options-header">
        <h3>Options</h3>
        <button className="close-btn" onClick={onClose}>×</button>
      </div>
      <div className="options-body">

        {/* Theme — hanya superadmin */}
        {canThemeGlobal && (
          <>
            <div className="options-label">Theme Global</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
              {THEMES.map(t => (
                <button key={t.id} onClick={() => setGlobalTheme(t.id as ThemeId)} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 10px', borderRadius: 'var(--radius-sm)',
                  background: globalTheme === t.id ? 'var(--mint-bg)' : 'var(--bg3)',
                  border: `1px solid ${globalTheme === t.id ? 'var(--mint)' : 'var(--border2)'}`,
                  cursor: 'pointer', transition: 'all .15s', textAlign: 'left',
                }}>
                  <div style={{ width: 20, height: 20, borderRadius: 4, background: t.accent, flexShrink: 0, boxShadow: `0 0 6px ${t.accent}66` }} />
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: globalTheme === t.id ? 'var(--mint)' : 'var(--silver2)' }}>{t.name}</div>
                    <div style={{ fontSize: 10, color: 'var(--silver3)' }}>{t.description}</div>
                  </div>
                  {globalTheme === t.id && <span style={{ marginLeft: 'auto', color: 'var(--mint)', fontSize: 12 }}>✓</span>}
                </button>
              ))}
            </div>
            <div className="options-divider" />
          </>
        )}

        {/* Appearance */}
        <div className="options-label">Appearance</div>

        <div className="options-sublabel">Item View</div>
        <ChipGroup options={ITEM_VIEWS} value={appearance.itemDisplayMode} onChange={v => setAppearance({ itemDisplayMode: v })} />

        {isFolderGrid && (
          <>
            <div className="options-sublabel" style={{ marginTop: 10 }}>Grid Columns</div>
            <div style={{ display: 'flex', gap: 4 }}>
              {FOLDER_COLS.map(({ cols, label }) => {
                const active = appearance.folderGridCols === cols
                return (
                  <button key={cols} onClick={() => setAppearance({ folderGridCols: cols })} style={{
                    flex: 1, padding: '6px 4px', fontSize: 12, fontWeight: 700,
                    background: active ? 'var(--mint-bg2)' : 'var(--bg3)',
                    border: `1px solid ${active ? 'var(--mint)' : 'var(--border2)'}`,
                    borderRadius: 'var(--radius-sm)',
                    color: active ? 'var(--mint)' : 'var(--silver3)',
                    cursor: 'pointer', transition: 'all .12s', fontFamily: 'var(--mono)',
                  }}>{label}</button>
                )
              })}
            </div>
          </>
        )}

        <div className="options-sublabel" style={{ marginTop: 10 }}>Icon Size</div>
        <div style={{ padding: '4px 2px' }}>
          <input type="range" min={0} max={3}
            value={['small','medium','large','xl'].indexOf(appearance.iconSize)}
            onChange={e => {
              const sizes: IconSize[] = ['small','medium','large','xl']
              setAppearance({ iconSize: sizes[Number(e.target.value)] })
            }}
            style={{ width: '100%', accentColor: 'var(--mint)', cursor: 'pointer' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--silver3)', fontFamily: 'var(--mono)', marginTop: 2 }}>
            <span>S</span><span>M</span><span>L</span><span>XL</span>
          </div>
        </div>

        <div className="options-sublabel" style={{ marginTop: 10 }}>Label</div>
        <ChipGroup options={LABEL_MODES} value={appearance.labelMode} onChange={v => setAppearance({ labelMode: v })} />

        <div style={{ marginTop: 10 }}>
          {[
            { label: 'Tooltip',            val: appearance.tooltipEnabled,  key: 'tooltipEnabled'  as const },
            { label: 'App Icons / Favicon',val: appearance.faviconEnabled,  key: 'faviconEnabled'  as const },
            { label: 'Tampilkan deskripsi',val: displayOptions.showDesc,    key: 'showDesc'        as const, isDisplay: true },
            { label: 'Tampilkan tag',      val: displayOptions.showTags,    key: 'showTags'        as const, isDisplay: true },
          ].map(item => (
            <div key={item.key} className="toggle-row">
              <span className="toggle-label">{item.label}</span>
              <ToggleSwitch on={item.val}
                onClick={() => item.isDisplay
                  ? setDisplayOptions({ [item.key]: !item.val })
                  : setAppearance({ [item.key]: !item.val })} />
            </div>
          ))}
        </div>

        {/* Presets */}
        <div className="options-label" style={{ marginTop: 12 }}>Presets</div>
        <div className="preset-list" style={{ marginBottom: 8 }}>
          {presets.length === 0
            ? <div className="preset-empty">Belum ada preset.</div>
            : presets.map(p => (
              <div key={p.id} className="preset-item">
                <span className="preset-name">{p.name}</span>
                <button className="preset-apply" onClick={() => { applyPreset(p.id); toast('Preset diterapkan.', 'success') }}>Apply</button>
                <button className="preset-del" onClick={() => deletePreset(p.id)}>×</button>
              </div>
            ))}
        </div>
        <button className="btn-save-preset" style={{ marginBottom: 4 }}
          onClick={() => { const n = prompt('Nama preset:'); if (n?.trim()) { savePreset(n.trim()); toast('Preset disimpan.', 'success') } }}>
          💾 Save Preset
        </button>
      </div>
    </div>
  )
}
