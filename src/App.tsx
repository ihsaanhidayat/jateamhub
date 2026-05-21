import { useState, useEffect, useRef, lazy, Suspense } from 'react'
import { useAuthStore } from './store/authStore'
import { useStore, applyThemeToDOM } from './store/dashboardStore'
import { supabase } from './utils/supabaseClient'
import LoginPage    from './components/layout/LoginPage'
import RegisterPage from './components/layout/RegisterPage'
import Header       from './components/layout/Header'
import GridLayout   from './components/layout/GridLayout'
import OfflineBar   from './components/ui/OfflineBar'
import ToastContainer from './components/ui/Toast'

// Lazy load komponen berat
const SuperadminDashboard = lazy(() => import('./components/layout/SuperadminDashboard'))
const OptionsPanel        = lazy(() => import('./components/layout/OptionsPanel'))
const ProfilePage         = lazy(() => import('./components/layout/ProfilePage'))
const PanduanFAB          = lazy(() => import('./components/layout/PanduanFAB'))
const CoffeeModal         = lazy(() => import('./components/ui/CoffeeModal'))
const AddSectionModal     = lazy(() => import('./components/layout/AddSectionModal'))
const OnboardingOverlay   = lazy(() => import('./components/ui/OnboardingOverlay'))

import './styles/global.css'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'

export default function App() {
  const { profile, initialized, init } = useAuthStore()
  const editMode     = useStore(s => s.editMode)
  const globalTheme  = useStore(s => s.globalTheme)
  const isDirty      = useStore(s => s.isDirty)
  const isSyncing    = useStore(s => s.isSyncing)
  const { toggleEditMode, initUser, toast, setCurrentUserId, syncPersonalToDb } = useStore()

  const [optionsOpen,    setOptionsOpen]    = useState(false)
  const [showRegister,   setShowRegister]   = useState(false)
  const [profileOpen,    setProfileOpen]    = useState(false)
  const [addSectionOpen, setAddSectionOpen] = useState(false)
  const [coffeeOpen,     setCoffeeOpen]     = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(false)

  // Onboarding — tampilkan untuk user baru (dashboard kosong + belum pernah lihat)
  const personalSections = useStore(s => s.personalSections)

  // Apply tema dari localStorage SEKETIKA sebelum apapun dirender
  // Ini mencegah flash of wrong theme
  const themeApplied = useRef(false)
  if (!themeApplied.current) {
    themeApplied.current = true
    try {
      const saved = localStorage.getItem('jateamhub-appearance')
      if (saved) {
        const app = JSON.parse(saved)
        if (app?.themeBase) applyThemeToDOM(app.themeBase === 'obsidian' ? 'obsidian' : 'ivory-light')
      }
    } catch { /* ignore */ }
  }

  // Init auth
  useEffect(() => { init() }, [])

  // Safety: jika 6 detik masih loading, paksa ke login
  useEffect(() => {
    const t = setTimeout(() => {
      if (!useAuthStore.getState().initialized) {
        useAuthStore.setState({ initialized: true, loading: false, profile: null })
      }
    }, 6000)
    return () => clearTimeout(t)
  }, [])

  // ── Idle timeout 30 menit — auto logout ────────────────────
  useEffect(() => {
    if (!profile) return

    const IDLE_MS = 30 * 60 * 1000 // 30 menit
    let timer: ReturnType<typeof setTimeout>

    const resetTimer = () => {
      clearTimeout(timer)
      timer = setTimeout(() => {
        // Simpan data dulu sebelum logout
        const state = useStore.getState()
        if (state.personalSections.length > 0) {
          try { localStorage.setItem('jateamhub-personal', JSON.stringify(state.personalSections)) } catch {}
        }
        if (state.editMode) state.toggleEditMode()
        toast('Sesi berakhir karena tidak aktif 30 menit.', 'warn')
        setTimeout(() => useAuthStore.getState().logout(), 1500)
      }, IDLE_MS)
    }

    // Reset timer setiap ada aktivitas user
    const events = ['mousedown', 'keydown', 'touchstart', 'scroll']
    events.forEach(e => document.addEventListener(e, resetTimer, { passive: true }))
    resetTimer() // mulai timer

    return () => {
      clearTimeout(timer)
      events.forEach(e => document.removeEventListener(e, resetTimer))
    }
  }, [profile?.id])

  // ── Page Visibility API — simpan saat hidden, refresh saat visible ──
  useEffect(() => {
    const handle = async () => {
      const state = useStore.getState()

      if (document.visibilityState === 'hidden') {
        // Simpan ke localStorage (selalu berhasil, synchronous)
        if (state.personalSections.length > 0) {
          try { localStorage.setItem('jateamhub-personal', JSON.stringify(state.personalSections)) } catch {}
        }
        if (state.editMode) state.toggleEditMode()
        return
      }

      // ── Visible — app kembali dibuka ──
      if (!state.currentUserId) return

      try {
        // 1. Cek session masih valid
        const { data: { session }, error } = await supabase.auth.getSession()
        if (error || !session) {
          useAuthStore.getState().logout()
          return
        }

        // 2. Refresh session jika hampir expired
        const expiresAt = session.expires_at ?? 0
        const now = Math.floor(Date.now() / 1000)
        if (expiresAt - now < 300) {
          await supabase.auth.refreshSession()
        }

        // 3. SELALU sync ke DB saat kembali — data di localStorage lebih baru
        if (state.personalSections.length > 0) {
          await state.syncPersonalToDbNow()
        }

        // 4. Reload shared sections
        if (state.loadSharedSections) {
          await state.loadSharedSections()
        }
      } catch {}
    }
    document.addEventListener('visibilitychange', handle)
    return () => document.removeEventListener('visibilitychange', handle)
  }, [])

  // Warn before unload + simpan localStorage
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      // Selalu simpan ke localStorage saat close
      const state = useStore.getState()
      if (state.personalSections.length > 0) {
        try {
          localStorage.setItem('jateamhub-personal', JSON.stringify(state.personalSections))
        } catch { /* ignore */ }
      }
      if (state.isDirty || state.isSyncing) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [])

  // Saat user login → init data
  useEffect(() => {
    if (profile) {
      setCurrentUserId(profile.id)
      initUser(
        profile.id,
        profile.role,
        (profile as any).region_scope ?? 'global',
        (profile as any).unit_scope   ?? 'general',
      )
      useAuthStore.getState().setToastFn(toast)

      // Onboarding untuk user baru
      const onboardingKey = `jateamhub-onboarded-${profile.id}`
      if (!localStorage.getItem(onboardingKey)) {
        // Tampilkan setelah data load selesai
        setTimeout(() => setShowOnboarding(true), 1200)
      }
      // Coffee modal — dinonaktifkan sementara
      // const sessionKey = `coffee-shown-${profile.id}`
      // if (!sessionStorage.getItem(sessionKey)) { ... }
    }
  }, [profile?.id])

  // Reset dashboardStore saat logout
  useEffect(() => {
    if (!profile) {
      const store = useStore.getState()
      // Reset semua state dashboard
      store.setCurrentUserId('')
      // Clear sync timer
      if (store.isSyncing) {
        useStore.setState({ isSyncing: false, isDirty: false, syncStatus: 'idle', isDataInitialized: false, personalSections: [], sharedSections: [] })
      } else {
        useStore.setState({ isDataInitialized: false, personalSections: [], sharedSections: [] })
      }
    }
  }, [profile])

  // Sync theme ke DOM
  useEffect(() => { if (globalTheme) applyThemeToDOM(globalTheme) }, [globalTheme])

  // Edit mode body class
  useEffect(() => {
    if (editMode) document.body.classList.add('edit-mode-active')
    else           document.body.classList.remove('edit-mode-active')
    return () => document.body.classList.remove('edit-mode-active')
  }, [editMode])

  // Loading screen
  if (!initialized) return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      minHeight: '100dvh', background: 'var(--bg)',
      gap: 16, fontFamily: 'var(--font)',
    }}>
      <div style={{
        width: 32, height: 32, border: '3px solid var(--border2)',
        borderTopColor: 'var(--accent)', borderRadius: '50%',
        animation: 'loginSpin 0.8s linear infinite',
      }} />
      <span style={{ fontSize: 13, color: 'var(--silver3)' }}>Memuat...</span>
    </div>
  )

  if (!profile && showRegister) return <RegisterPage onBack={() => setShowRegister(false)} />
  if (!profile) return <LoginPage onRegister={() => setShowRegister(true)} />

  if (profile.role === 'superadmin') return (
    <Suspense fallback={null}>
      <SuperadminDashboard /><ToastContainer />
    </Suspense>
  )

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', minHeight: '100dvh',
      position: 'relative',
      // Poin 3: border jelas saat edit mode
      boxShadow: editMode
        ? `inset 0 0 0 2px var(--accent), inset 0 0 0 4px var(--mint-bg2)`
        : 'none',
      transition: 'box-shadow 200ms var(--ease)',
    }}>
      <Header
        onToggleOptions={() => setOptionsOpen((v: boolean) => !v)}
        optionsOpen={optionsOpen}
        onOpenAdvanced={() => setProfileOpen(true)}
        onAddSection={() => setAddSectionOpen(true)}
      />

      {/* Edit mode topbar — slim, di bawah header */}
      {editMode && (
        <div style={{
          height: 36, flexShrink: 0,
          background: 'var(--mint-bg2)',
          borderBottom: '1px solid var(--accent)',
          display: 'flex', alignItems: 'center',
          padding: '0 var(--sp-5)', gap: 'var(--sp-3)',
          animation: 'slideInUp 200ms var(--ease)',
          zIndex: 90,
        }}>
          <span style={{
            width: 6, height: 6, borderRadius: '50%',
            background: 'var(--accent)', flexShrink: 0,
            animation: 'editPulse 2s ease-in-out infinite',
          }} />
          <span style={{
            fontSize: 10, fontWeight: 700, color: 'var(--accent)',
            fontFamily: 'var(--mono)', letterSpacing: '1px',
          }}>EDIT MODE</span>
          <span style={{ fontSize: 11, color: 'var(--silver3)', flex: 1 }}>
            Klik section untuk mulai edit
          </span>
          <button
            aria-label="Selesai edit" onClick={() => useStore.getState().toggleEditMode()}
            style={{
              height: 24, padding: '0 10px',
              background: 'none', border: '1px solid var(--border2)',
              borderRadius: 'var(--radius-sm)', color: 'var(--silver3)',
              fontSize: 10, fontWeight: 700, cursor: 'pointer',
              fontFamily: 'var(--font)',
            }}>✕ Selesai</button>
        </div>
      )}

      <Suspense fallback={null}>
        <OptionsPanel open={optionsOpen} onClose={() => setOptionsOpen(false)} />
      </Suspense>

      <OfflineBar />

      <main className={`main${editMode ? ' edit-active' : ''}`} style={{ flex: 1 }} role="main">
        <GridLayout onAddSection={() => setAddSectionOpen(true)} />
      </main>

      <Suspense fallback={null}>
        <AddSectionModal open={addSectionOpen} onClose={() => setAddSectionOpen(false)} />
        {profileOpen  && <ProfilePage onClose={() => setProfileOpen(false)} />}
        {coffeeOpen   && <CoffeeModal onClose={() => setCoffeeOpen(false)} />}
        {showOnboarding && (
          <OnboardingOverlay
            onDismiss={() => {
              setShowOnboarding(false)
              if (profile) localStorage.setItem(`jateamhub-onboarded-${profile.id}`, '1')
            }}
            onStartEdit={() => {
              useStore.getState().toggleEditMode()
              setAddSectionOpen(true)
            }}
          />
        )}
        <PanduanFAB />
      </Suspense>
      <ToastContainer />
    </div>
  )
}
