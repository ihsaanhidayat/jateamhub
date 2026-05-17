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
      background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(6px)',
      padding: 'var(--sp-4)',
      animation: 'fadeIn 150ms var(--ease)',
    }} onClick={onCancel}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--bg3)',
          border: `1px solid ${danger ? 'rgba(239,68,68,0.25)' : 'var(--border2)'}`,
          borderRadius: 'var(--radius-xl)',
          padding: 'var(--sp-6)',
          width: '100%', maxWidth: 380,
          boxShadow: '0 16px 48px rgba(0,0,0,0.12)',
          animation: 'scaleIn 200ms var(--ease)',
        }}
      >
        {title && (
          <div style={{
            fontSize: 15, fontWeight: 700,
            color: danger ? 'var(--red)' : 'var(--accent)',
            marginBottom: 'var(--sp-2)',
            display: 'flex', alignItems: 'center', gap: 'var(--sp-2)',
          }}>
            {danger ? '⚠️' : 'ℹ️'} {title}
          </div>
        )}
        <p style={{
          fontSize: 'var(--text-sm)', color: 'var(--silver2)',
          lineHeight: 1.65, margin: 0,
        }}>
          {message}
        </p>
        <div style={{ display: 'flex', gap: 'var(--sp-2)', marginTop: 'var(--sp-5)', justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            style={{
              height: 40, padding: '0 var(--sp-4)',
              fontSize: 'var(--text-sm)', fontWeight: 600,
              background: 'transparent', border: '1px solid var(--border2)',
              borderRadius: 'var(--radius-sm)', color: 'var(--silver3)',
              cursor: 'pointer', fontFamily: 'var(--font)',
              transition: 'all 150ms var(--ease)',
            }}
          >{cancelLabel}</button>
          <button
            onClick={onConfirm}
            style={{
              height: 40, padding: '0 var(--sp-4)',
              fontSize: 'var(--text-sm)', fontWeight: 700,
              background: danger ? 'rgba(239,68,68,0.1)' : 'var(--mint-bg2)',
              border: `1px solid ${danger ? 'var(--red)' : 'var(--accent)'}`,
              borderRadius: 'var(--radius-sm)',
              color: danger ? 'var(--red)' : 'var(--accent)',
              cursor: 'pointer', fontFamily: 'var(--font)',
              transition: 'all 150ms var(--ease)',
            }}
          >{confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}
