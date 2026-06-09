import { useState, useEffect } from 'react'
import { useStore } from '../store/dashboardStore'

export function useNetworkStatus() {
  const [isOnline,   setIsOnline]   = useState(navigator.onLine)
  const [wasOffline, setWasOffline] = useState(false)

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
      setWasOffline(prev => {
        if (prev) {
          // Sync pending data after coming back online
          setTimeout(() => {
            const store = useStore.getState()
            if (store.isDirty) store.syncPersonalToDb()
          }, 500)
        }
        return false
      })
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
  }, [])

  return { isOnline, wasOffline }
}
