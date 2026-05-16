import { useRef } from 'react'
import { useStore } from '../../store/dashboardStore'
import { validateImportConfig } from '../../utils/security'

interface Props { onAddSection: () => void }

export default function EditBar({ onAddSection }: Props) {
  const {
    editMode, setConfig, resetConfig, resetLayout, config, toast,
    undo, redo, canUndo, canRedo,
    isDirty, isSyncing, syncStatus, syncGlobalToDb,
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
        setConfig(data); toast('Config berhasil diimport.', 'success')
      } catch { toast('File JSON tidak valid.', 'error') }
    }
    reader.readAsText(file); e.target.value = ''
  }

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `jateamhub-config-${new Date().toISOString().slice(0,10)}.json`
    a.click(); URL.revokeObjectURL(a.href)
    toast('Config diekspor.', 'success')
  }

  const btnStyle = (disabled: boolean) => ({
    background: 'var(--bg3)',
    border: `1px solid ${disabled ? 'var(--border)' : 'var(--border2)'}`,
    borderRadius: 'var(--radius-sm)',
    color: disabled ? 'var(--silver3)' : 'var(--silver2)',
    padding: '6px 11px', fontSize: 11, fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.45 : 1, transition: 'all .15s',
    display: 'flex', alignItems: 'center', gap: 5, fontFamily: 'var(--font)',
  } as React.CSSProperties)

  const syncIndicator = () => {
    if (isSyncing || syncStatus === 'saving') return (
      <div className="sync-saving">
        <span className="login-spinner" style={{ width: 10, height: 10, borderWidth: 1.5, borderTopColor: '#FFD93D', borderColor: 'rgba(255,217,61,0.3)' }} />
        Menyimpan...
      </div>
    )
    if (syncStatus === 'error' || isDirty) return (
      <button onClick={() => syncGlobalToDb()} className="sync-error" style={{ background: 'none', border: '1px solid rgba(224,85,85,0.3)', borderRadius: 'var(--radius-sm)', padding: '4px 10px', cursor: 'pointer' }}>
        ⚠ Belum tersimpan
      </button>
    )
    if (syncStatus === 'saved') return <div className="sync-saved">✓ Tersimpan</div>
    return <div style={{ fontSize: 11, color: 'var(--silver3)', fontFamily: 'var(--mono)' }}>● Auto-save</div>
  }

  return (
    <div className="edit-bar">
      <span className="edit-bar-label">Edit</span>
      <button style={btnStyle(!canUndo)} disabled={!canUndo} onClick={undo}
        onMouseEnter={e => { if (canUndo) (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--mint)' }}
        onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.borderColor = canUndo ? 'var(--border2)' : 'var(--border)'}>
        ↩ Undo
      </button>
      <button style={btnStyle(!canRedo)} disabled={!canRedo} onClick={redo}
        onMouseEnter={e => { if (canRedo) (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--mint)' }}
        onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.borderColor = canRedo ? 'var(--border2)' : 'var(--border)'}>
        ↪ Redo
      </button>
      <div style={{ width: 1, height: 20, background: 'var(--border2)', margin: '0 2px', flexShrink: 0 }} />
      <button className="eb-btn" onClick={onAddSection}
        style={{ background: 'var(--mint-bg)', border: '1px solid rgba(0,255,194,0.3)', color: 'var(--mint)', fontWeight: 700 }}>
        ＋ Section
      </button>
      <button className="eb-btn" onClick={() => fileRef.current?.click()}>📥 Import</button>
      <button className="eb-btn" onClick={handleExport}>📤 Export</button>
      <button className="eb-btn" onClick={() => { if (!confirm('Reset layout?')) return; resetLayout(); toast('Layout direset.', 'success') }}>⊞ Layout</button>
      <div style={{ marginLeft: 4 }}>{syncIndicator()}</div>
      <div className="eb-spacer" />
      <button className="eb-btn danger" onClick={() => { if (!confirm('Reset semua config?')) return; resetConfig(); toast('Config direset.', 'success') }}>🔄 Reset</button>
      <input ref={fileRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleImport} />
    </div>
  )
}
