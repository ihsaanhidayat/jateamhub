// ─────────────────────────────────────────────────────────────
// APP.TSX — Root component, routing auth, inisialisasi app
// ─────────────────────────────────────────────────────────────
import { useState, useEffect } from 'react'
import { useAuthStore } from './store/authStore'
import { useStore, applyThemeToDOM } from './store/dashboardStore'
import LoginPage from './components/layout/LoginPage'
import RegisterPage from './components/layout/RegisterPage'
import SuperadminDashboard from './components/layout/SuperadminDashboard'
import Header from './components/layout/Header'
import OptionsPanel from './components/layout/OptionsPanel'
import EditBar from './components/layout/EditBar'
import GridLayout from './components/layout/GridLayout'
import ProfilePage from './components/layout/ProfilePage'
import PanduanFAB from './components/layout/PanduanFAB'
import CoffeeModal from './components/ui/CoffeeModal'
import SectionModal from './components/section/SectionModal'
import AddSectionModal from './components/layout/AddSectionModal'
import ToastContainer from './components/ui/Toast'

import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'

export default function App() {
  // Ambil state auth dan store yang diperlukan
  const { profile, initialized, init } = useAuthStore()
  const {
    editMode, initUser, toast, setCurrentUserId,
    isDirty, isSyncing, globalTheme,
  } = useStore()

  // State UI lokal
  const [optionsOpen, setOptionsOpen] = useState(false)
  const [showRegister, setShowRegister] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [addSectionOpen, setAddSectionOpen] = useState(false)
  const [coffeeOpen, setCoffeeOpen] = useState(false)

  // Inisialisasi auth saat app pertama kali dibuka
  useEffect(() => { init() }, [])

  // Peringatkan user saat mau meninggalkan halaman dengan perubahan belum tersimpan
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

  // Jalankan saat user berhasil login — load semua data user
  useEffect(() => {
    if (profile) {
      setCurrentUserId(profile.id)
      // Init store dengan data user: section pribadi + shared sections + preferences
      initUser(
        profile.id,
        profile.role,
        (profile as any).region_scope ?? 'global',
        (profile as any).unit_scope ?? 'general',
      )
      // Inject fungsi toast ke authStore agar bisa tampilkan notifikasi
      useAuthStore.getState().setToastFn(toast)

      // Tampilkan coffee modal sekali per session — semua role kecuali admin global
      const sessionKey = `coffee-shown-${profile.id}`
      const _isAdminGlobal = profile.role === 'admin' &&
        (profile as any).region_scope === 'global' &&
        ((profile as any).unit_scope === 'general' || !(profile as any).unit_scope)
      if (!sessionStorage.getItem(sessionKey) && !_isAdminGlobal) {
        sessionStorage.setItem(sessionKey, '1')
        setTimeout(() => setCoffeeOpen(true), 1500)
      }
    }
  }, [profile?.id])

  // Terapkan theme ke DOM setiap kali theme berubah
  useEffect(() => { applyThemeToDOM(globalTheme) }, [globalTheme])

  // Edit mode — tambah class ke body untuk CSS indicator
  useEffect(() => {
    if (editMode) {
      document.body.classList.add('edit-mode-active')
    } else {
      document.body.classList.remove('edit-mode-active')
    }
    return () => document.body.classList.remove('edit-mode-active')
  }, [editMode])

  // Tampilkan loading spinner saat init auth belum selesai
  if (!initialized) return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: '100dvh', background: '#0A0A0A',
      color: 'var(--accent)', fontSize: 14, fontFamily: 'Space Grotesk, sans-serif', gap: 10,
    }}>
      <span style={{ animation: 'loginSpin 1s linear infinite', display: 'inline-block' }}>⟳</span>
      Memuat...
    </div>
  )

  // Tampilkan halaman register jika diminta
  if (!profile && showRegister) return <RegisterPage onBack={() => setShowRegister(false)} />

  // Tampilkan halaman login jika belum login
  if (!profile) return <LoginPage onRegister={() => setShowRegister(true)} />

  // Superadmin: tampilkan dashboard khusus
  if (profile.role === 'superadmin') return (
    <>
      <SuperadminDashboard />
      <ToastContainer />
    </>
  )

  // Dashboard utama untuk semua role selain superadmin
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh' }}>
      {/* Header dengan semua kontrol navigasi */}
      <Header
        onToggleOptions={() => setOptionsOpen(v => !v)}
        optionsOpen={optionsOpen}
        onOpenAdvanced={() => setProfileOpen(true)}
        onAddSection={() => setAddSectionOpen(true)}
      />

      {/* Options panel — tersedia untuk semua user */}
      <OptionsPanel open={optionsOpen} onClose={() => setOptionsOpen(false)} />

      {/* Konten utama — grid layout */}
      <main className={`main${editMode ? ' edit-active' : ''}`} style={{ flex: 1 }}>
        <GridLayout onAddSection={() => setAddSectionOpen(true)} />
      </main>

      {/* Edit bar — muncul saat edit mode aktif */}
      {editMode && <EditBar onAddSection={() => setAddSectionOpen(true)} />}

      {/* Edit mode topbar — slim bar di bawah header saat edit aktif */}
      {editMode && (
        <div style={{
          height: 36, flexShrink: 0,
          background: 'var(--mint-bg2)',
          borderBottom: '1px solid var(--accent)',
          display: 'flex', alignItems: 'center',
          padding: '0 var(--sp-5)', gap: 'var(--sp-3)',
          animation: 'slideInUp 200ms var(--ease)',
        }}>
          <span style={{
            width: 7, height: 7, borderRadius: '50%',
            background: 'var(--accent)', flexShrink: 0,
            animation: 'editPulse 2s ease-in-out infinite',
          }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', fontFamily: 'var(--mono)', letterSpacing: '0.8px' }}>
            EDIT MODE
          </span>
          <span style={{ fontSize: 11, color: 'var(--silver3)', flex: 1 }}>
            Klik section untuk mulai edit
          </span>
          <button
            onClick={() => useStore.getState().toggleEditMode()}
            style={{
              height: 24, padding: '0 10px',
              background: 'none', border: '1px solid var(--border2)',
              borderRadius: 'var(--radius-sm)', color: 'var(--silver3)',
              fontSize: 10, fontWeight: 700, cursor: 'pointer',
              fontFamily: 'var(--font)', letterSpacing: '0.5px',
            }}>
            ✕ SELESAI
          </button>
        </div>
      )}

      {/* Modal tambah section/widget — muncul saat klik ＋ di header */}
      <AddSectionModal
        open={addSectionOpen}
        onClose={() => setAddSectionOpen(false)}
      />

      {/* Modal profile advanced (users + settings) */}
      {profileOpen && <ProfilePage onClose={() => setProfileOpen(false)} />}

      {/* Popup coffee — sekali per session untuk user/guest */}
      {coffeeOpen && <CoffeeModal onClose={() => setCoffeeOpen(false)} />}

      {/* FAB panduan — floating button kanan bawah */}
      <PanduanFAB />

      {/* Toast notifikasi — kanan atas */}
      <ToastContainer />
    </div>
  )
}
