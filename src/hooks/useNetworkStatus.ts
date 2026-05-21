// ─────────────────────────────────────────────────────────────
// useNetworkStatus — deteksi online/offline
// Data aman di localStorage saat offline, sync saat kembali online
// ─────────────────────────────────────────────────────────────
import { useState, useEffect } from 'react'
import { useStore } from '../store/dashboardStore'

export function useNetworkStatus() {
  const [isOnline,   setIsOnline]   = useState(navigator.onLine)
  const [wasOffline, setWasOffline] = useState(false)
  const { syncPersonalToDb, isDirty } = useStore()

  useEffect(() => {
    const handleOnline = async () => {
      setIsOnline(true)
      if (wasOffline) {
        setWasOffline(false)
        // Sync data yang pending saat offline
        if (isDirty) {
          setTimeout(() => syncPersonalToDb(), 500)
        }
      }
    }
    const handleOffline = () => {
      setIsOnline(false)
      setWasOffline(true)
    }

    window.addEventListener('online',  handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online',  handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [wasOffline, isDirty])

  return { isOnline, wasOffline }
}
