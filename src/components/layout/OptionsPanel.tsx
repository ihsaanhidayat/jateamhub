import { useRef, useEffect } from 'react'
import { useStore } from '../../store/dashboardStore'
import { useAuthStore } from '../../store/authStore'
import { can, canSeeOptions } from '../../utils/roles'
import { applyThemeToDOM } from '../../store/dashboardStore'
import { THEMES } from '../../types'
import type { ThemeId } from '../../types'
import type { ItemDisplayMode, IconSize, LabelMode } from '../../types'

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
          border: `1px solid ${value === o.key ? 'var(--accent)' : 'var(--border2)'}`,
          borderRadius: 'var(--radius-sm)',
          color: value === o.key ? 'var(--accent)' : 'var(--silver3)',
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

  if (!open) return null  // Options tersedia untuk semua user yang login

  const isSuperAdmin   = session?.role === 'superadmin'
  const isFolderGrid   = appearance.itemDisplayMode === 'folderGrid'
  // Theme global hanya bisa diganti superadmin
  const canThemeGlobal = session?.role === 'superadmin'

  return (
    <div className="options-panel" ref={ref} style={{ maxHeight: 'calc(100vh - 60px)', overflowY: 'auto' }}>
      <div className="options-header">
        <h3>Options</h3>
        <button className="close-btn" onClick={onClose}>×</button>
      </div>
      <div className="options-body">

        {/* Tema — tersedia untuk semua user */}
        <div className="options-label">Tema</div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
          {THEMES.map(t => {
            const currentBase = (appearance.themeBase ?? 'aurora') as string
            const isActive    = currentBase === t.id
            const isDark      = appearance.isDarkMode ?? false
            return (
              <button key={t.id} onClick={() => {
                // Obsidian: standalone dark, jangan ubah isDarkMode state
                const newIsDark = t.standalone ? false : isDark  // reset toggle state
                const themeId   = t.standalone ? 'obsidian' : `${t.id}-${isDark ? 'dark' : 'light'}`
                setAppearance({
                  themeBase: t.id as any,
                  theme:     themeId as any,
                  isDarkMode: t.standalone ? false : isDark,  // Obsidian tidak pakai isDarkMode
                })
                applyThemeToDOM(themeId)
              }} title={t.name} style={{
                flex: 1, padding: '8px 4px',
                borderRadius: 'var(--radius-sm)',
                background: isActive ? 'var(--mint-bg2)' : 'var(--bg3)',
                border: `1.5px solid ${isActive ? 'var(--accent)' : 'var(--border2)'}`,
                cursor: 'pointer', transition: 'all .15s',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
              }}>
                {/* Swatch light | dark */}
                <div style={{ display: 'flex', borderRadius: 4, overflow: 'hidden', width: 34, height: 16, border: '1px solid rgba(0,0,0,0.08)' }}>
                  <div style={{ flex: 1, background: t.standalone ? '#1a1a1a' : t.bgLight }} />
                  <div style={{ flex: 1, background: t.bgDark }} />
                </div>
                <span style={{ fontSize: 9, fontWeight: 700, color: isActive ? 'var(--accent)' : 'var(--silver2)', letterSpacing: '.3px' }}>
                  {t.name}
                </span>
                {/* Font preview */}
                <span style={{ fontSize: 8, color: 'var(--silver3)', fontFamily: (t as any).font, opacity: 0.7 }}>Aa</span>
              </button>
            )
          })}
        </div>

        {/* Toggle dark mode — HANYA untuk Aurora/Sand/Slate, TIDAK untuk Obsidian */}
        {(appearance.themeBase ?? 'aurora') !== 'obsidian' && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', marginBottom: 10 }}>
            <span style={{ fontSize: 12, color: 'var(--silver2)', fontWeight: 500 }}>🌙 Dark Mode</span>
            <div onClick={() => {
              const base    = (appearance.themeBase ?? 'aurora') as string
              const isDark  = !(appearance.isDarkMode ?? false)
              const themeId = `${base}-${isDark ? 'dark' : 'light'}`
              setAppearance({ isDarkMode: isDark, theme: themeId as any })
              applyThemeToDOM(themeId)
            }} style={{
              width: 40, height: 22, borderRadius: 11, cursor: 'pointer',
              background: (appearance.isDarkMode ?? false) ? 'var(--accent)' : 'var(--border2)',
              position: 'relative', transition: 'background 0.25s', flexShrink: 0,
            }}>
              <div style={{
                width: 16, height: 16, borderRadius: '50%', background: 'white',
                position: 'absolute', top: 3,
                left: (appearance.isDarkMode ?? false) ? 21 : 3,
                transition: 'left 0.25s', boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
              }} />
            </div>
          </div>
        )}
        <div className="options-divider" />

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
                    border: `1px solid ${active ? 'var(--accent)' : 'var(--border2)'}`,
                    borderRadius: 'var(--radius-sm)',
                    color: active ? 'var(--accent)' : 'var(--silver3)',
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
            style={{ width: '100%', accentColor: 'var(--accent)', cursor: 'pointer' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--silver3)', fontFamily: 'var(--mono)', marginTop: 2 }}>
            <span>S</span><span>M</span><span>L</span><span>XL</span>
          </div>
        </div>

        <div className="options-sublabel" style={{ marginTop: 10 }}>Label</div>
        <ChipGroup options={LABEL_MODES} value={appearance.labelMode} onChange={v => setAppearance({ labelMode: v })} />

        <div style={{ marginTop: 10 }}>
          {[
            { label: 'Tampilkan deskripsi', val: displayOptions.showDesc, key: 'showDesc' as const, isDisplay: true },
            { label: 'Tampilkan tag',       val: displayOptions.showTags, key: 'showTags' as const, isDisplay: true },
          ].map(item => (
            <div key={item.key} className="toggle-row">
              <span className="toggle-label">{item.label}</span>
              <ToggleSwitch on={item.val}
                onClick={() => setDisplayOptions({ [item.key]: !item.val })} />
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
