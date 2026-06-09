// Indikator offline — muncul saat network putus
// Data tetap aman di localStorage, sync otomatis saat online kembali
import { useNetworkStatus } from '../../hooks/useNetworkStatus'
import { useStore } from '../../store/dashboardStore'

export default function OfflineBar() {
  const { isOnline, wasOffline } = useNetworkStatus()
  const isDirty    = useStore(s => s.isDirty)
  const isSyncing  = useStore(s => s.isSyncing)
  const syncStatus = useStore(s => s.syncStatus)

  // Offline
  if (!isOnline) return (
    <div style={{
      position: 'fixed', top: 56, left: 0, right: 0, zIndex: 90,
      background: '#92400E', color: '#FEF3C7',
      padding: '8px 20px',
      display: 'flex', alignItems: 'center', gap: 10,
      fontSize: 12, fontWeight: 600, fontFamily: 'var(--font)',
      animation: 'slideInUp 200ms var(--ease)',
    }}>
      <span>📡</span>
      <span>Tidak ada koneksi — data tersimpan di perangkat, akan sync otomatis saat online kembali</span>
    </div>
  )

  // Baru online kembali + masih dirty
  if (wasOffline && isDirty) return (
    <div style={{
      position: 'fixed', top: 56, left: 0, right: 0, zIndex: 90,
      background: 'var(--color-success)',
      color: 'white',
      padding: '8px 20px',
      display: 'flex', alignItems: 'center', gap: 10,
      fontSize: 12, fontWeight: 600, fontFamily: 'var(--font)',
      animation: 'slideInUp 200ms var(--ease)',
    }}>
      <span>{isSyncing ? '🔄' : '✓'}</span>
      <span>{isSyncing ? 'Menyinkronkan data...' : 'Online kembali — data berhasil disinkronkan'}</span>
    </div>
  )

  return null
}
