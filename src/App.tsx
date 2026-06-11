import { useState, useEffect, useRef, lazy, Suspense } from 'react'
import { IconX } from './components/ui/icons'
import { useAuthStore } from './store/authStore'
import { useStore, applyThemeToDOM } from './store/dashboardStore'
import { useChatStore } from './store/chatStore'
import { supabase } from './utils/supabaseClient'
import LoginPage    from './components/layout/LoginPage'
import RegisterPage from './components/layout/RegisterPage'
import Header       from './components/layout/Header'
import GridLayout   from './components/layout/GridLayout'
import OfflineBar   from './components/ui/OfflineBar'
import ToastContainer from './components/ui/Toast'
// Lazy load komponen berat
const SuperadminDashboard = lazy(() => import('./components/layout/SuperadminDashboard'))
const ProfilePage         = lazy(() => import('./components/layout/ProfilePage'))
const CoffeeModal         = lazy(() => import('./components/ui/CoffeeModal'))
const AddSectionModal          = lazy(() => import('./components/layout/AddSectionModal'))
const ImportLinksModal         = lazy(() => import('./components/ui/ImportLinksModal'))
const ForceChangePasswordModal = lazy(() => import('./components/ui/ForceChangePasswordModal'))
const InstallPrompt             = lazy(() => import('./components/ui/InstallPrompt'))
const TodoReminderModal         = lazy(() => import('./components/ui/TodoReminderModal'))
const IdleSessionGuard          = lazy(() => import('./components/ui/IdleSessionGuard'))
const NotificationBanner        = lazy(() => import('./components/ui/NotificationBanner'))
const TaskListPage              = lazy(() => import('./pages/TaskListPage'))
const ChatPage                  = lazy(() => import('./pages/ChatPage'))
import DashboardSkeleton from './components/ui/DashboardSkeleton'
const OnboardingOverlay        = lazy(() => import('./components/ui/OnboardingOverlay'))
const ItemModal                = lazy(() => import('./components/item/ItemModal'))
const SectionEditModal         = lazy(() => import('./components/layout/SectionEditModal'))
const GoogleOnboardingPage     = lazy(() => import('./components/layout/GoogleOnboardingPage'))

import './styles/global.css'

export default function App() {
  const { profile, initialized, init, pendingGoogleUser } = useAuthStore()
  const editMode     = useStore(s => s.editMode)
  const globalTheme  = useStore(s => s.globalTheme)
  const isDirty      = useStore(s => s.isDirty)
  const isSyncing    = useStore(s => s.isSyncing)
  const isDataInitialized = useStore(s => s.isDataInitialized)
  const { toggleEditMode, initUser, toast, setCurrentUserId } = useStore()
  const [showRegister,   setShowRegister]   = useState(false)
  const [profileOpen,    setProfileOpen]    = useState(false)
  const [addSectionOpen, setAddSectionOpen] = useState(false)
  const [importLinksOpen, setImportLinksOpen] = useState(false)
  const [coffeeOpen,     setCoffeeOpen]     = useState(false)
  // Hash-based routing — persist across refresh
  const [taskListOpen, setTaskListOpen] = useState(() => window.location.hash === '#tasks')
  const [chatOpen,     setChatOpen]     = useState(() => window.location.hash === '#chat')

  const openTaskList  = () => { window.location.hash = 'tasks'; setTaskListOpen(true) }
  const closeTaskList = () => { window.location.hash = ''; setTaskListOpen(false) }
  const openChat      = () => { window.location.hash = 'chat'; setChatOpen(true) }
  const closeChat     = () => { window.location.hash = ''; setChatOpen(false) }

  // Listen to browser back/forward
  useEffect(() => {
    const handleHash = () => {
      setTaskListOpen(window.location.hash === '#tasks')
      setChatOpen(window.location.hash === '#chat')
    }
    window.addEventListener('hashchange', handleHash)
    return () => window.removeEventListener('hashchange', handleHash)
  }, [])

  // Edit state dari store
  const editingSection    = useStore(s => s.editingSection)
  const editingItem       = useStore(s => s.editingItem)
  const addingItemSectionId = useStore(s => s.addingItemSectionId)
  const [showOnboarding, setShowOnboarding] = useState(false)

  // Onboarding — tampilkan untuk user baru (dashboard kosong + belum pernah lihat)
  const personalSections = useStore(s => s.personalSections)

  // Apply tema dari localStorage SEKETIKA — mencegah flash of wrong theme sebelum initUser selesai
  const themeApplied = useRef(false)
  if (!themeApplied.current) {
    themeApplied.current = true
    try {
      const saved = localStorage.getItem('jateamhub-appearance')
      if (saved) {
        const app = JSON.parse(saved)
        if (app.theme) applyThemeToDOM(app.theme as string)
      }
    } catch { /* ignore */ }
  }

  // Force sync saat app background/close (mobile)
  useEffect(() => {
    const handleHide = () => {
      const store = useStore.getState()
      if (store.isDirty && !store.isSyncing) {
        store.syncPersonalToDb()
      }
    }
    const onHide = () => { if (document.visibilityState === 'hidden') handleHide() }
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('pagehide', handleHide)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('pagehide', handleHide)
    }
  }, [])

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
          const { error: refreshErr } = await supabase.auth.refreshSession()
          if (refreshErr) {
            useAuthStore.getState().logout()
            return
          }
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

  // Load chat state when user logs in
  useEffect(() => {
    if (profile) {
      useChatStore.getState().loadEnabled().then(() => {
        const chatEnabled = useChatStore.getState().enabled
        if (chatEnabled) {
          useChatStore.getState().subscribeAll(profile.id)
        }
      })
    }
  }, [profile?.id])

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

      // Safety: jika 12 detik isDataInitialized masih false, paksa true
      // (guard jika initUser hang karena jaringan sangat lambat)
      const safetyInit = setTimeout(() => {
        if (!useStore.getState().isDataInitialized) {
          useStore.setState({ isDataInitialized: true })
        }
      }, 12000)

      // Onboarding untuk user baru
      const onboardingKey = `jateamhub-onboarded-${profile.id}`
      if (!localStorage.getItem(onboardingKey)) {
        // Tampilkan setelah data load selesai
        setTimeout(() => setShowOnboarding(true), 1200)
      }
      // Coffee modal — dinonaktifkan sementara
      // const sessionKey = `coffee-shown-${profile.id}`
      // if (!sessionStorage.getItem(sessionKey)) { ... }
      return () => clearTimeout(safetyInit)
    }
  }, [profile?.id])

  // Reset dashboardStore saat logout (via state OR event broadcast)
  useEffect(() => {
    if (!profile) {
      const store = useStore.getState()
      store.setCurrentUserId('')
      useStore.setState({
        isSyncing: false, isDirty: false, syncStatus: 'idle',
        isDataInitialized: false, personalSections: [], sharedSections: [],
        currentUserId: '', currentUserRole: '', currentRegion: 'global', currentUnit: 'general',
      })
    }
  }, [profile])

  // Listen logout broadcast — pastikan reset full
  useEffect(() => {
    const onLogout = () => {
      useStore.setState({
        isSyncing: false, isDirty: false, syncStatus: 'idle',
        isDataInitialized: false, personalSections: [], sharedSections: [],
        currentUserId: '', currentUserRole: '', currentRegion: 'global', currentUnit: 'general',
      })
    }
    window.addEventListener('jateamhub-logout', onLogout)
    return () => window.removeEventListener('jateamhub-logout', onLogout)
  }, [])

  // JWT expired saat background (refresh token mati) → paksa logout
  useEffect(() => {
    const onExpired = () => useAuthStore.getState().logout()
    window.addEventListener('jateamhub-session-expired', onExpired)
    return () => window.removeEventListener('jateamhub-session-expired', onExpired)
  }, [])

  // Sync theme ke DOM
  // tema ditangani oleh Header theme toggle

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
        animation: 'spin 0.8s linear infinite',
      }} />
      <span style={{ fontSize: 13, color: 'var(--silver3)' }}>Memuat...</span>
    </div>
  )

  if (!profile && pendingGoogleUser) return (
    <Suspense fallback={null}><GoogleOnboardingPage /></Suspense>
  )
  if (!profile && showRegister) return <RegisterPage onBack={() => setShowRegister(false)} />
  if (!profile) return <LoginPage onRegister={() => setShowRegister(true)} />

  // Force password change jika admin sudah reset password user
  if ((profile as any).force_password_change) return (
    <Suspense fallback={null}>
      <ForceChangePasswordModal />
      <ToastContainer />
    </Suspense>
  )

  if (profile.role === 'superadmin') return (
    <Suspense fallback={null}>
      <SuperadminDashboard /><ToastContainer />
    </Suspense>
  )

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', minHeight: '100dvh',
      position: 'relative',
      boxShadow: editMode
        ? `inset 0 0 0 2px var(--accent), inset 0 0 0 4px var(--mint-bg2)`
        : 'none',
      transition: 'box-shadow 200ms var(--ease)',
    }}>
      <Header
        onToggleOptions={() => setProfileOpen(true)}
        optionsOpen={false}
        onOpenAdvanced={() => setProfileOpen(true)}
        onAddSection={() => setAddSectionOpen(true)}
        onImportLinks={() => setImportLinksOpen(true)}
        onOpenTaskList={openTaskList}
        onOpenChat={openChat}
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
              display: 'flex', alignItems: 'center', gap: 4,
            }}><IconX size={9} /> Selesai</button>
        </div>
      )}

      <Suspense fallback={null}>
      </Suspense>

      <OfflineBar />

      <main className={`main${editMode ? ' edit-active' : ''}`} style={{ flex: 1 }} role="main">
        {!isDataInitialized && profile && <DashboardSkeleton />}
        <GridLayout onAddSection={() => setAddSectionOpen(true)} />
      </main>

      <Suspense fallback={null}>
        <AddSectionModal open={addSectionOpen} onClose={() => setAddSectionOpen(false)} />
        <ImportLinksModal open={importLinksOpen} onClose={() => setImportLinksOpen(false)} />
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
        {/* Item Modal — tambah/edit link */}
        {(editingItem || addingItemSectionId) && (
          <ItemModal
            open={true}
            sectionId={editingItem?.sectionId ?? addingItemSectionId ?? ''}
            item={editingItem?.item ?? null}
            onClose={() => {
              useStore.getState().setEditingItem(null)
              useStore.getState().setAddingItem(null)
            }}
          />
        )}
        {/* Section Edit Modal */}
        {editingSection && (
          <SectionEditModal
            open={true}
            section={editingSection}
            onClose={() => useStore.getState().setEditingSection(null)}
          />
        )}
      </Suspense>
      {taskListOpen && (
        <Suspense fallback={null}>
          <TaskListPage onClose={closeTaskList} />
        </Suspense>
      )}
      {chatOpen && (
        <Suspense fallback={null}>
          <ChatPage onClose={closeChat} />
        </Suspense>
      )}
      <Suspense fallback={null}>
        <TodoReminderModal />
        <IdleSessionGuard />
        <InstallPrompt />
        {profile && <NotificationBanner userId={profile.id} />}
      </Suspense>
      <ToastContainer />
    </div>
  )
}
