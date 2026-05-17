import { useStore } from '../../store/dashboardStore'

const TOAST_STYLES = {
  success: {
    background: 'var(--bg3)',
    border: '1px solid var(--accent)',
    color: 'var(--accent)',
    icon: '✓',
  },
  error: {
    background: 'var(--bg3)',
    border: '1px solid var(--red)',
    color: 'var(--red)',
    icon: '✕',
  },
  warn: {
    background: 'var(--bg3)',
    border: '1px solid #F59E0B',
    color: '#F59E0B',
    icon: '⚠',
  },
}

export default function ToastContainer() {
  const { toasts, removeToast } = useStore()

  return (
    <div style={{
      position: 'fixed',
      top: 72,
      right: 'var(--sp-4, 16px)',
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--sp-2, 8px)',
      pointerEvents: 'none',
    }}>
      {toasts.slice(-3).map(t => {
        const s = TOAST_STYLES[t.type as keyof typeof TOAST_STYLES] ?? TOAST_STYLES.success
        return (
          <div
            key={t.id}
            onClick={() => removeToast(t.id)}
            style={{
              display: 'flex', alignItems: 'center',
              gap: 'var(--sp-2, 8px)',
              padding: '10px 14px',
              borderRadius: 'var(--radius, 12px)',
              fontSize: 'var(--text-sm, 13px)',
              fontWeight: 500,
              fontFamily: 'var(--font)',
              pointerEvents: 'auto',
              cursor: 'pointer',
              minWidth: 220, maxWidth: 340,
              boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
              backdropFilter: 'blur(12px)',
              animation: 'slideInRight 200ms var(--ease, cubic-bezier(0.22,1,0.36,1))',
              ...s,
            }}
          >
            <span style={{ fontSize: 14, flexShrink: 0, fontWeight: 700 }}>{s.icon}</span>
            <span style={{ flex: 1, color: 'var(--silver)' }}>{t.msg}</span>
            <span style={{ opacity: 0.4, fontSize: 11, flexShrink: 0 }}>✕</span>
          </div>
        )
      })}
    </div>
  )
}
