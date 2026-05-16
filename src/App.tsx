import { useState, useEffect } from 'react'
import { useAuthStore } from './store/authStore'
import { useStore, applyThemeToDOM } from './store/dashboardStore'
import LoginPage from './components/layout/LoginPage'
import Header from './components/layout/Header'
import OptionsPanel from './components/layout/OptionsPanel'
import EditBar from './components/layout/EditBar'
import GridLayout from './components/layout/GridLayout'
import ProfilePage from './components/layout/ProfilePage'
import PanduanFAB from './components/layout/PanduanFAB'
import CoffeeModal from './components/ui/CoffeeModal'
import SectionModal from './components/section/SectionModal'
import ToastContainer from './components/ui/Toast'

import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'

export default function App() {
  const { profile, initialized, init } = useAuthStore()
  const {
    editMode, loadRemoteConfig, toast, setCurrentUserId,
    isDirty, isSyncing, globalTheme,
  } = useStore()

  const [optionsOpen,    setOptionsOpen]    = useState(false)
  const [profileOpen,    setProfileOpen]    = useState(false)
  const [addSectionOpen, setAddSectionOpen] = useState(false)
  const [coffeeOpen,     setCoffeeOpen]     = useState(false)

  useEffect(() => { init() }, [])

  // Warn saat ada perubahan belum tersimpan
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirty || isSyncing) {
        e.preventDefault()
        e.returnValue = 'Ada perubahan yang belum tersimpan. Yakin mau meninggalkan halaman?'
        return e.returnValue
      }
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isDirty, isSyncing])

  // Load config + apply theme saat login
  useEffect(() => {
    if (profile) {
      setCurrentUserId(profile.id)
      loadRemoteConfig(profile.id, profile.role, profile.unit_id)
      useAuthStore.getState().setToastFn(toast)

      // Coffee popup — sekali per session untuk user & admin_unit
      const sessionKey = `coffee-shown-${profile.id}`
      if (!sessionStorage.getItem(sessionKey) && (profile.role === 'user' || profile.role === 'guest')) {
        sessionStorage.setItem(sessionKey, '1')
        setTimeout(() => setCoffeeOpen(true), 1500)
      }
    }
  }, [profile?.id])

  // Apply theme ke DOM
  useEffect(() => {
    applyThemeToDOM(globalTheme)
  }, [globalTheme])

  if (!initialized) return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: '100dvh', background: '#0A0A0A',
      color: '#00FFC2', fontSize: 14, fontFamily: 'Space Grotesk, sans-serif', gap: 10,
    }}>
      <span style={{ animation: 'loginSpin 1s linear infinite', display: 'inline-block' }}>⟳</span>
      Memuat...
    </div>
  )

  if (!profile) return <LoginPage />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh' }}>
      <Header
        onToggleOptions={() => setOptionsOpen(v => !v)}
        optionsOpen={optionsOpen}
        onOpenAdvanced={() => setProfileOpen(true)}
      />

      <OptionsPanel open={optionsOpen} onClose={() => setOptionsOpen(false)} />

      <main className={`main${editMode ? ' edit-active' : ''}`} style={{ flex: 1 }}>
        <GridLayout />
      </main>

      {editMode && <EditBar onAddSection={() => setAddSectionOpen(true)} />}

      {/* Modals */}
      {profileOpen    && <ProfilePage onClose={() => setProfileOpen(false)} />}
      {coffeeOpen     && <CoffeeModal onClose={() => setCoffeeOpen(false)} />}
      {addSectionOpen && <SectionModal open={addSectionOpen} section={null} onClose={() => setAddSectionOpen(false)} />}

      {/* FAB */}
      <PanduanFAB />

      <ToastContainer />
    </div>
  )
}
