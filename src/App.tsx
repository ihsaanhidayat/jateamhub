// ─────────────────────────────────────────────────────────────
// APP.TSX — Root component, routing auth, inisialisasi app
// ─────────────────────────────────────────────────────────────
import { useState, useEffect } from 'react'
import { useAuthStore } from './store/authStore'
import { useStore, applyThemeToDOM } from './store/dashboardStore'
import LoginPage    from './components/layout/LoginPage'
import Header       from './components/layout/Header'
import OptionsPanel from './components/layout/OptionsPanel'
import EditBar      from './components/layout/EditBar'
import GridLayout   from './components/layout/GridLayout'
import ProfilePage  from './components/layout/ProfilePage'
import PanduanFAB   from './components/layout/PanduanFAB'
import CoffeeModal  from './components/ui/CoffeeModal'
import SectionModal from './components/section/SectionModal'
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
  const [optionsOpen,    setOptionsOpen]    = useState(false)
  const [profileOpen,    setProfileOpen]    = useState(false)
  const [addSectionOpen, setAddSectionOpen] = useState(false)
  const [coffeeOpen,     setCoffeeOpen]     = useState(false)

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
        (profile as any).unit_scope   ?? 'general',
      )
      // Inject fungsi toast ke authStore agar bisa tampilkan notifikasi
      useAuthStore.getState().setToastFn(toast)

      // Tampilkan coffee modal sekali per session untuk user dan guest
      const sessionKey = `coffee-shown-${profile.id}`
      if (!sessionStorage.getItem(sessionKey) &&
          (profile.role === 'user' || profile.role === 'guest')) {
        sessionStorage.setItem(sessionKey, '1')
        setTimeout(() => setCoffeeOpen(true), 1500)
      }
    }
  }, [profile?.id])

  // Terapkan theme ke DOM setiap kali theme berubah
  useEffect(() => { applyThemeToDOM(globalTheme) }, [globalTheme])

  // Tampilkan loading spinner saat init auth belum selesai
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

  // Tampilkan halaman login jika belum login
  if (!profile) return <LoginPage />

  // Superadmin: langsung tampilkan halaman user management tanpa dashboard
  if (profile.role === 'superadmin') return (
    <>
      <ProfilePage onClose={() => {}} />
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
      />

      {/* Options panel — tersedia untuk semua user */}
      <OptionsPanel open={optionsOpen} onClose={() => setOptionsOpen(false)} />

      {/* Konten utama — grid layout */}
      <main className={`main${editMode ? ' edit-active' : ''}`} style={{ flex: 1 }}>
        <GridLayout onAddSection={() => setAddSectionOpen(true)} />
      </main>

      {/* Edit bar — muncul saat edit mode aktif */}
      {editMode && <EditBar onAddSection={() => setAddSectionOpen(true)} />}

      {/* Modal tambah section pribadi */}
      {addSectionOpen && (
        <SectionModal
          open={addSectionOpen}
          section={null}
          onClose={() => setAddSectionOpen(false)}
        />
      )}

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
