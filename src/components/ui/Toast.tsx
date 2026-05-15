import { useStore } from '../../store/dashboardStore'

export default function ToastContainer() {
  const { toasts } = useStore()

  return (
    <div className="toast-container">
      {toasts.map(t => (
        <div key={t.id} className={`toast ${t.type}`}>
          {t.type === 'success' ? '✓' : t.type === 'error' ? '✕' : '⚠'} {t.msg}
        </div>
      ))}
    </div>
  )
}
