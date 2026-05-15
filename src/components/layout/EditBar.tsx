import { useRef } from 'react'
import { useStore } from '../../store/dashboardStore'
import { validateImportConfig } from '../../utils/security'

interface Props { onOpenPageInfo: () => void }

export default function EditBar({ onOpenPageInfo }: Props) {
  const {
    editMode, setConfig, resetConfig, resetLayout, config, toast,
    undo, redo, canUndo, canRedo,
    isDirty, isSyncing, syncStatus, syncToDb,
  } = useStore()
  const fileRef = useRef<HTMLInputElement>(null)

  if (!editMode) return null

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      try {
        const data = JSON.parse(ev.target?.result as string)
        const err = validateImportConfig(data)
        if (err) { toast(err, 'error'); return }
        if (!confirm('Import akan mengganti config saat ini. Lanjutkan?')) return
        setConfig(data)
        toast('Config berhasil diimport.', 'success')
      } catch { toast('File JSON tidak valid atau rusak.', 'error') }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `jateamhub-config-${new Date().toISOString().slice(0,10)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
    toast('Config diekspor.', 'success')
  }

  const handleResetLayout = () => {
    if (!confirm('Reset posisi semua section ke layout default?')) return
    resetLayout(); toast('Layout direset.', 'success')
  }

  const handleResetConfig = () => {
    if (!confirm('Reset config ke default?\n\nSemua section, item, dan pengaturan akan hilang.\nTindakan ini tidak bisa dibatalkan.')) return
    resetConfig(); toast('Config direset ke default.', 'success')
  }

  const btnStyle = (disabled: boolean) => ({
    background: 'var(--bg3)',
    border: `1px solid ${disabled ? 'var(--border)' : 'var(--border2)'}`,
    borderRadius: 'var(--radius-sm)',
    color: disabled ? 'var(--silver3)' : 'var(--silver2)',
    padding: '7px 12px', fontSize: 12, fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.45 : 1, transition: 'all .15s',
    display: 'flex', alignItems: 'center', gap: 5,
    fontFamily: 'var(--font)',
  } as React.CSSProperties)

  // Sync status indicator
  const syncIndicator = () => {
    if (isSyncing || syncStatus === 'saving') return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#FFD93D', fontFamily: 'var(--mono)' }}>
        <span className="login-spinner" style={{ width: 10, height: 10, borderWidth: 1.5, borderTopColor: '#FFD93D', borderColor: 'rgba(255,217,61,0.3)' }} />
        Menyimpan...
      </div>
    )
    if (syncStatus === 'error' || isDirty) return (
      <button
        onClick={() => syncToDb()}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          fontSize: 11, color: 'var(--red)', fontFamily: 'var(--mono)',
          background: 'rgba(224,85,85,0.1)', border: '1px solid rgba(224,85,85,0.3)',
          borderRadius: 'var(--radius-sm)', padding: '4px 10px', cursor: 'pointer',
          fontWeight: 700, transition: 'all .15s',
          animation: 'pulseMint 2s infinite',
        }}
        title="Ada perubahan belum tersimpan — klik untuk simpan"
      >
        ⚠ Belum tersimpan — Klik Simpan
      </button>
    )
    if (syncStatus === 'saved') return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--mint)', fontFamily: 'var(--mono)' }}>
        ✓ Tersimpan
      </div>
    )
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--silver3)', fontFamily: 'var(--mono)' }}>
        <span style={{ color: 'var(--mint)', fontSize: 10 }}>●</span>
        Auto-saved
      </div>
    )
  }

  return (
    <div className="edit-bar">
      <span className="edit-bar-label">Edit</span>

      <button style={btnStyle(!canUndo)} disabled={!canUndo} onClick={undo} title="Undo"
        onMouseEnter={e => { if (canUndo) (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--mint)' }}
        onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.borderColor = canUndo ? 'var(--border2)' : 'var(--border)'}>
        ↩ Undo
      </button>
      <button style={btnStyle(!canRedo)} disabled={!canRedo} onClick={redo} title="Redo"
        onMouseEnter={e => { if (canRedo) (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--mint)' }}
        onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.borderColor = canRedo ? 'var(--border2)' : 'var(--border)'}>
        ↪ Redo
      </button>

      <div style={{ width: 1, height: 20, background: 'var(--border2)', margin: '0 4px', flexShrink: 0 }} />

      <button className="eb-btn" onClick={() => fileRef.current?.click()}>📥 Import</button>
      <button className="eb-btn" onClick={handleExport}>📤 Export</button>
      <button className="eb-btn" onClick={onOpenPageInfo}>📄 Page Info</button>
      <button className="eb-btn" onClick={handleResetLayout}>⊞ Reset Layout</button>

      {/* Sync status */}
      <div style={{ marginLeft: 4 }}>{syncIndicator()}</div>

      <div className="eb-spacer" />
      <button className="eb-btn danger" onClick={handleResetConfig}>🔄 Reset Config</button>
      <input ref={fileRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleImport} />
    </div>
  )
}
