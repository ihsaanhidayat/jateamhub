import { useRef, useEffect } from 'react'
import { useStore } from '../../store/dashboardStore'
import { useAuthStore } from '../../store/authStore'
import { canEdit, canCreateUser, getDisplayBadge } from '../../utils/roles'
import type { ItemDisplayMode, IconSize, LabelMode, SectionDensity } from '../../types'

interface Props {
  open: boolean
  onClose: () => void
  onOpenConfig: () => void
  onOpenUsers: () => void
}

const ITEM_VIEWS: { key: ItemDisplayMode; label: string; icon: string }[] = [
  { key: 'button',     label: 'Button',      icon: '▣' },
  { key: 'list',       label: 'List',        icon: '☰' },
  { key: 'iconText',   label: 'Icon+Text',   icon: '◫' },
  { key: 'iconOnly',   label: 'Icon Only',   icon: '◉' },
  { key: 'textOnly',   label: 'Text Only',   icon: '≡' },
  { key: 'folderGrid', label: 'Folder Grid', icon: '⊞' },
]
const ICON_SIZES: { key: IconSize; label: string }[] = [
  { key: 'small',  label: 'S'  },
  { key: 'medium', label: 'M'  },
  { key: 'large',  label: 'L'  },
  { key: 'xl',     label: 'XL' },
]
const LABEL_MODES: { key: LabelMode; label: string }[] = [
  { key: 'show',  label: 'Show'  },
  { key: 'hide',  label: 'Hide'  },
  { key: 'hover', label: 'Hover' },
]
const DENSITIES: { key: SectionDensity; label: string }[] = [
  { key: 'compact',     label: 'Compact'     },
  { key: 'comfortable', label: 'Comfortable' },
  { key: 'spacious',    label: 'Spacious'    },
]
const FOLDER_COLS: { cols: number; label: string }[] = [
  { cols: 1, label: '1×' },
  { cols: 2, label: '2×' },
  { cols: 3, label: '3×' },
  { cols: 4, label: '4×' },
  { cols: 5, label: '5×' },
]

function ToggleSwitch({ on, onClick }: { on: boolean; onClick: () => void }) {
  return <div className={`toggle-switch${on ? ' on' : ''}`} onClick={onClick} role="switch" aria-checked={on} />
}

function ChipGroup<T extends string>({ options, value, onChange }: {
  options: { key: T; label: string; icon?: string }[]
  value: T
  onChange: (v: T) => void
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
          display: 'flex', alignItems: 'center', gap: 4,
          fontFamily: 'var(--font)',
        }}>
          {o.icon && <span style={{ fontSize: 12 }}>{o.icon}</span>}
          {o.label}
        </button>
      ))}
    </div>
  )
}

export default function OptionsPanel({ open, onClose, onOpenConfig, onOpenUsers }: Props) {
  const {
    logout: _logout,
    editMode, toggleEditMode,
    presets, savePreset, applyPreset, deletePreset,
    displayOptions, setDisplayOptions,
    appearance, setAppearance,
    previewUnit, setPreviewUnit,
    toast,
  } = useStore()

  const { profile: session, logout: authLogout } = useAuthStore()
  const logout = authLogout
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

  if (!open) return null

  const isEditable   = canEdit(session as any)
  const canManageUsers = canCreateUser(session as any)
  const isFolderGrid = appearance.itemDisplayMode === 'folderGrid'

  return (
    <div className="options-panel" ref={ref} style={{ maxHeight: 'calc(100vh - 80px)', overflowY: 'auto' }}>
      <div className="options-header">
        <h3>Options</h3>
        <button className="close-btn" onClick={onClose}>×</button>
      </div>

      <div className="options-body">

        {/* Edit & Config — admin/superadmin only */}
        {isEditable && (
          <>
            <div className="options-label">Edit &amp; Config</div>
            <div className="opt-row" style={{ marginBottom: 6 }}>
              <button className={`opt-btn${editMode ? ' active' : ''}`} onClick={() => { toggleEditMode(); onClose() }}>
                ✏️ Edit Mode
              </button>
              <button className="opt-btn" onMouseDown={e => e.stopPropagation()} onClick={() => { onOpenConfig(); onClose() }}>
                ⚙️ Config
              </button>
            </div>
            {canManageUsers && (
              <div className="opt-row" style={{ marginBottom: 12 }}>
                <button className="opt-btn" onMouseDown={e => e.stopPropagation()} onClick={() => { onOpenUsers(); onClose() }}>
                  👥 Kelola Users
                </button>
              </div>
            )}
          </>
        )}

        {/* Appearance */}
        <div className="options-label" style={{ marginTop: isEditable ? 0 : 4 }}>Appearance</div>

        <div className="options-sublabel">Section Density</div>
        <ChipGroup options={DENSITIES} value={appearance.sectionDensity} onChange={v => setAppearance({ sectionDensity: v })} />

        <div className="options-sublabel" style={{ marginTop: 10 }}>Item View</div>
        <ChipGroup options={ITEM_VIEWS} value={appearance.itemDisplayMode} onChange={v => setAppearance({ itemDisplayMode: v })} />

        {/* Folder grid column count */}
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
                    cursor: 'pointer', transition: 'all .12s',
                    fontFamily: 'var(--mono)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                  }}>
                    <FolderGridIcon cols={cols} active={active} />
                    <span>{label}</span>
                  </button>
                )
              })}
            </div>
          </>
        )}

        <div className="options-sublabel" style={{ marginTop: 10 }}>Icon Size</div>
        <ChipGroup options={ICON_SIZES} value={appearance.iconSize} onChange={v => setAppearance({ iconSize: v })} />

        <div className="options-sublabel" style={{ marginTop: 10 }}>Label</div>
        <ChipGroup options={LABEL_MODES} value={appearance.labelMode} onChange={v => setAppearance({ labelMode: v })} />

        <div style={{ marginTop: 10 }}>
          <div className="toggle-row">
            <span className="toggle-label">Tooltip</span>
            <ToggleSwitch on={appearance.tooltipEnabled} onClick={() => setAppearance({ tooltipEnabled: !appearance.tooltipEnabled })} />
          </div>
          <div className="toggle-row">
            <span className="toggle-label">App Icons / Favicon</span>
            <ToggleSwitch on={appearance.faviconEnabled} onClick={() => setAppearance({ faviconEnabled: !appearance.faviconEnabled })} />
          </div>
          <div className="toggle-row">
            <span className="toggle-label">Tampilkan deskripsi</span>
            <ToggleSwitch on={displayOptions.showDesc} onClick={() => setDisplayOptions({ showDesc: !displayOptions.showDesc })} />
          </div>
          <div className="toggle-row">
            <span className="toggle-label">Tampilkan tag badge</span>
            <ToggleSwitch on={displayOptions.showTags} onClick={() => setDisplayOptions({ showTags: !displayOptions.showTags })} />
          </div>
        </div>

        {/* Presets */}
        <div className="options-label" style={{ marginTop: 12 }}>Presets</div>
        <div className="preset-list" style={{ marginBottom: 8 }}>
          {presets.length === 0
            ? <div className="preset-empty">Belum ada preset.</div>
            : presets.map(p => (
              <div key={p.id} className="preset-item">
                <span className="preset-name">{p.name}</span>
                <button className="preset-apply" onClick={() => { applyPreset(p.id); toast('Preset "' + p.name + '" diterapkan.', 'success') }}>Apply</button>
                <button className="preset-del" onClick={() => deletePreset(p.id)}>×</button>
              </div>
            ))
          }
        </div>
        <button className="btn-save-preset" style={{ marginBottom: 10 }}
          onClick={() => { const n = prompt('Nama preset:'); if (n?.trim()) { savePreset(n.trim()); toast('Preset disimpan.', 'success') } }}>
          💾 Save Preset
        </button>

        <div className="options-divider" />

        {/* User info + role badge */}
        {/* Preview unit selector — hanya untuk admin/superadmin */}
        {(session?.role === 'admin' || session?.role === 'superadmin') && (
          <div style={{ marginBottom: 12 }}>
            <div className="options-sublabel">Preview Tampilan Unit</div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {[
                { value: null,    label: 'Admin View' },
                { value: '',      label: 'User Umum'  },
                { value: 'pro',   label: 'PRO'        },
                { value: 'cro',   label: 'CRO'        },
                { value: 'klaim', label: 'Klaim'      },
              ].map(opt => {
                const active = previewUnit === opt.value
                return (
                  <button key={String(opt.value)} onClick={() => setPreviewUnit(opt.value)} style={{
                    padding: '4px 9px', fontSize: 11, fontWeight: 600,
                    background: active ? 'var(--mint-bg2)' : 'var(--bg3)',
                    border: `1px solid ${active ? 'var(--mint)' : 'var(--border2)'}`,
                    borderRadius: 'var(--radius-sm)',
                    color: active ? 'var(--mint)' : 'var(--silver3)',
                    cursor: 'pointer', fontFamily: 'var(--font)', transition: 'all .12s',
                  }}>
                    {opt.label}
                  </button>
                )
              })}
            </div>
          </div>
        )}
        <div className="user-row">
          <div className="user-info" style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span style={{ color: 'var(--silver2)', fontSize: 12 }}>
              Halo <strong style={{ color: 'var(--mint)' }}>{session?.username}</strong>
            </span>
            {(() => {
              const badge = getDisplayBadge(session as any)
              return (
                <span style={{
                  fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 2,
                  background: badge.color + '22', border: `1px solid ${badge.color}55`,
                  color: badge.color, textTransform: 'uppercase', fontFamily: 'var(--mono)',
                  alignSelf: 'flex-start', letterSpacing: '.5px',
                }}>
                  {badge.label}
                </span>
              )
            })()}
          </div>
          <button className="signout-btn" onClick={logout}>Sign Out →</button>
        </div>
      </div>
    </div>
  )
}

function FolderGridIcon({ cols, active }: { cols: number; active: boolean }) {
  const color = active ? 'var(--mint)' : 'var(--silver3)'
  const size = 28
  const gap = 2
  const cellSize = Math.floor((size - gap * (cols - 1)) / cols)
  const rows = cols <= 2 ? cols : 2
  const cells = Array.from({ length: Math.min(cols * rows, 9) })
  return (
    <svg width={size} height={rows === 1 ? cellSize : cellSize * 2 + gap}
      viewBox={`0 0 ${size} ${rows === 1 ? cellSize : cellSize * 2 + gap}`}>
      {cells.map((_, i) => {
        const col = i % cols
        const row = Math.floor(i / cols)
        return <rect key={i} x={col * (cellSize + gap)} y={row * (cellSize + gap)}
          width={cellSize} height={cellSize} rx={1} fill={color} opacity={0.7} />
      })}
    </svg>
  )
}
