import { useStore } from '../../store/dashboardStore'

export default function ToastContainer() {
  const { toasts, removeToast } = useStore()

  return (
    <div style={{
      position: 'fixed',
      top: 70,
      right: 16,
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      pointerEvents: 'none',
    }}>
      {toasts.slice(-3).map(t => (
        <div
          key={t.id}
          className="toast-item"
          onClick={() => removeToast(t.id)}
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 14px',
            borderRadius: 'var(--radius-sm)',
            fontSize: 13, fontWeight: 500,
            pointerEvents: 'auto',
            cursor: 'pointer',
            minWidth: 220, maxWidth: 340,
            boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
            ...(t.type === 'success' ? {
              background: 'rgba(0,20,15,0.95)',
              border: '1px solid rgba(0,255,194,0.35)',
              color: 'var(--mint)',
            } : t.type === 'error' ? {
              background: 'rgba(20,0,0,0.95)',
              border: '1px solid rgba(224,85,85,0.4)',
              color: '#ff8080',
            } : {
              background: 'rgba(20,15,0,0.95)',
              border: '1px solid rgba(240,165,0,0.4)',
              color: '#FFD93D',
            }),
          }}
        >
          <span style={{ fontSize: 15, flexShrink: 0 }}>
            {t.type === 'success' ? '✓' : t.type === 'error' ? '✕' : '⚠'}
          </span>
          <span style={{ flex: 1 }}>{t.msg}</span>
          <span style={{ opacity: .4, fontSize: 12, flexShrink: 0 }}>✕</span>
        </div>
      ))}
    </div>
  )
}
