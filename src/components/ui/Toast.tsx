import { useStore } from '../../store/dashboardStore'

// Pakai semantic color vars — ikut tema aktif
const TOAST_STYLES = {
  success: {
    background: 'var(--bg3)',
    border: '1px solid var(--color-success)',
    iconColor: 'var(--color-success)',
    icon: '✓',
  },
  error: {
    background: 'var(--bg3)',
    border: '1px solid var(--color-error)',
    iconColor: 'var(--color-error)',
    icon: '✕',
  },
  warn: {
    background: 'var(--bg3)',
    border: '1px solid var(--color-warning)',
    iconColor: 'var(--color-warning)',
    icon: '⚠',
  },
  info: {
    background: 'var(--bg3)',
    border: '1px solid var(--color-info)',
    iconColor: 'var(--color-info)',
    icon: 'ℹ',
  },
}

export default function ToastContainer() {
  const { toasts, removeToast } = useStore()

  return (
    <div style={{
      position: 'fixed',
      top: 72,
      right: 16,
      zIndex: 500, /* --z-toast */
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      pointerEvents: 'none',
      maxWidth: 360,
    }}>
      {toasts.slice(-4).map(t => {
        const s = TOAST_STYLES[t.type as keyof typeof TOAST_STYLES] ?? TOAST_STYLES.info
        return (
          <div
            key={t.id}
            onClick={() => removeToast(t.id)}
            style={{
              display: 'flex', alignItems: 'center',
              gap: 8, padding: '10px 14px',
              borderRadius: 'var(--radius)',
              fontSize: 13, fontWeight: 500,
              fontFamily: 'var(--font)',
              pointerEvents: 'auto', cursor: 'pointer',
              boxShadow: 'var(--shadow)',
              backdropFilter: 'blur(12px)',
              animation: 'slideInRight 200ms var(--ease)',
              ...s,
            }}
          >
            <span style={{ fontSize: 13, flexShrink: 0, fontWeight: 700, color: s.iconColor }}>
              {s.icon}
            </span>
            <span style={{ flex: 1, color: 'var(--silver)', lineHeight: 1.4 }}>{t.msg}</span>
            <span style={{ opacity: 0.3, fontSize: 11, flexShrink: 0 }}>✕</span>
          </div>
        )
      })}
    </div>
  )
}
