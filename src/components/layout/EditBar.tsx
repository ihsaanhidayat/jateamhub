import { useRef } from 'react'
import { useStore } from '../../store/dashboardStore'
// security import dihapus — user tidak butuh import/reset config

interface Props { onAddSection?: () => void }

export default function EditBar({ onAddSection }: Props) {
  const {
    editMode, toast,
    undo, redo, canUndo, canRedo,
    isDirty, isSyncing, syncStatus, syncPersonalToDb,
    personalSections,
  } = useStore()


  if (!editMode) return null

  // Export section pribadi user sebagai JSON backup
  const handleExportPersonal = () => {
    const blob = new Blob([JSON.stringify(personalSections, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `my-sections-${new Date().toISOString().slice(0,10)}.json`
    a.click(); URL.revokeObjectURL(a.href)
    toast('Section diekspor.', 'success')
  }

  const btnStyle = (disabled: boolean) => ({
    height: 36,
    background: 'var(--glass)',
    border: `1px solid ${disabled ? 'var(--border)' : 'var(--border2)'}`,
    borderRadius: 'var(--radius-sm)',
    color: disabled ? 'var(--silver3)' : 'var(--silver2)',
    padding: '0 12px', fontSize: 'var(--text-xs)', fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.4 : 1,
    transition: 'all 150ms var(--ease)',
    display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'var(--font)',
  } as React.CSSProperties)

  const syncIndicator = () => {
    if (isSyncing || syncStatus === 'saving') return (
      <div className="sync-saving">
        <span className="login-spinner" style={{ width: 10, height: 10, borderWidth: 1.5, borderTopColor: '#FFD93D', borderColor: 'rgba(255,217,61,0.3)' }} />
        Menyimpan...
      </div>
    )
    if (syncStatus === 'error' || isDirty) return (
      <button onClick={() => syncPersonalToDb()} className="sync-error" style={{ background: 'none', border: '1px solid rgba(224,85,85,0.3)', borderRadius: 'var(--radius-sm)', padding: '4px 10px', cursor: 'pointer' }}>
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
        onMouseEnter={e => { if (canUndo) (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--accent)' }}
        onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.borderColor = canUndo ? 'var(--border2)' : 'var(--border)'}>
        ↩ Undo
      </button>
      <button style={btnStyle(!canRedo)} disabled={!canRedo} onClick={redo}
        onMouseEnter={e => { if (canRedo) (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--accent)' }}
        onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.borderColor = canRedo ? 'var(--border2)' : 'var(--border)'}>
        ↪ Redo
      </button>
      <div style={{ width: 1, height: 20, background: 'var(--border2)', margin: '0 2px', flexShrink: 0 }} />

      <button className="eb-btn" onClick={handleExportPersonal}>📤 Export</button>
      <div style={{ marginLeft: 4 }}>{syncIndicator()}</div>
      <div className="eb-spacer" />
    </div>
  )
}
