import { useEffect } from 'react'

interface Props {
  open: boolean
  title?: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmDialog({
  open, title, message, confirmLabel = 'Ya, Lanjutkan',
  cancelLabel = 'Batal', danger = true, onConfirm, onCancel,
}: Props) {
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
      if (e.key === 'Enter') onConfirm()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onConfirm, onCancel])

  if (!open) return null

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
      padding: 20,
    }} onClick={onCancel}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'rgba(14,14,14,0.98)',
          border: `1px solid ${danger ? 'rgba(224,85,85,0.3)' : 'rgba(0,255,194,0.2)'}`,
          borderRadius: 10, padding: '24px 28px',
          width: '100%', maxWidth: 360,
          boxShadow: `0 20px 60px rgba(0,0,0,0.6), 0 0 0 1px ${danger ? 'rgba(224,85,85,0.08)' : 'rgba(0,255,194,0.04)'}`,
          animation: 'scaleIn 0.18s ease',
        }}
      >
        {title && (
          <div style={{
            fontSize: 14, fontWeight: 700, color: danger ? 'var(--red)' : 'var(--mint)',
            marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8,
          }}>
            {danger ? '⚠️' : 'ℹ️'} {title}
          </div>
        )}
        <p style={{ fontSize: 13, color: 'var(--silver2)', lineHeight: 1.6, margin: 0 }}>
          {message}
        </p>
        <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            style={{
              padding: '8px 16px', fontSize: 12, fontWeight: 600,
              background: 'var(--bg3)', border: '1px solid var(--border2)',
              borderRadius: 6, color: 'var(--silver3)', cursor: 'pointer',
              fontFamily: 'var(--font)', transition: 'all .15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--silver3)')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border2)')}
          >{cancelLabel}</button>
          <button
            onClick={onConfirm}
            style={{
              padding: '8px 16px', fontSize: 12, fontWeight: 700,
              background: danger ? 'rgba(224,85,85,0.12)' : 'var(--mint-bg2)',
              border: `1px solid ${danger ? 'var(--red)' : 'var(--mint)'}`,
              borderRadius: 6,
              color: danger ? 'var(--red)' : 'var(--mint)',
              cursor: 'pointer', fontFamily: 'var(--font)', transition: 'all .15s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = danger ? 'rgba(224,85,85,0.2)' : 'rgba(0,255,194,0.2)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = danger ? 'rgba(224,85,85,0.12)' : 'var(--mint-bg2)'
            }}
          >{confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}
