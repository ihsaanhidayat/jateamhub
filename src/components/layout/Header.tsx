import { useState, useRef, useEffect } from 'react'
import { useStore } from '../../store/dashboardStore'
import { useAuthStore } from '../../store/authStore'
import { canEdit, canSeeOptions, getDisplayBadge, isAdmin, isAdminGlobal } from '../../utils/roles'
import { sanitizePage } from '../../utils/security'
import { uploadAvatar, updateProfile } from '../../utils/supabaseClient'
import AvatarCropModal from '../ui/AvatarCropModal'

interface Props {
  onToggleOptions: () => void
  optionsOpen: boolean
  onOpenAdvanced: () => void
  onAddSection: () => void
  onImportLinks: () => void
}

export default function Header({ onToggleOptions, optionsOpen, onOpenAdvanced, onAddSection, onImportLinks }: Props) {
  const {
    editMode, toggleEditMode,
    searchQuery, setSearch,
  } = useStore()
  const { profile: session } = useAuthStore()

  const [profileDropdown, setProfileDropdown] = useState(false)
  const [cropDataUrl, setCropDataUrl] = useState<string | null>(null)
  const profileRef = useRef<HTMLDivElement>(null)

  // Theme toggle — Pearl (light) / Slate (dark)
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('jateamhub-theme')
    if (saved) return saved === 'slate'
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', isDark ? 'slate' : 'pearl')
    localStorage.setItem('jateamhub-theme', isDark ? 'slate' : 'pearl')
  }, [isDark])

  const isEditable = canEdit(session as any)
  const showOptions = canSeeOptions(session as any)
  const isAdminLevel = isAdmin(session as any)
  const badge = getDisplayBadge(session as any)
  const emoji = (session as any)?.avatar_emoji ?? (session as any)?.emoji ?? ''





  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileDropdown(false)
    }
    document.addEventListener('mousedown', handler)

    // Listener untuk crop modal yang dipanggil dari ProfilePage
    const avatarHandler = (e: Event) => {
      const dataUrl = (e as CustomEvent).detail as string
      if (dataUrl) setCropDataUrl(dataUrl)
    }
    window.addEventListener('avatar-upload', avatarHandler)

    return () => {
      document.removeEventListener('mousedown', handler)
      window.removeEventListener('avatar-upload', avatarHandler)
    }
  }, [])

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !session) return
    e.target.value = ''
    // Baca sebagai data URL → tampilkan crop modal
    const reader = new FileReader()
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string
      if (dataUrl) setCropDataUrl(dataUrl)
    }
    reader.readAsDataURL(file)
  }

  const handleCropConfirm = async (blob: Blob) => {
    if (!session) return
    setCropDataUrl(null)
    const avatarUrl = await uploadAvatar(session.id, blob)
    if (avatarUrl) {
      await updateProfile(session.id, { avatar_url: avatarUrl })
      // Update state authStore langsung tanpa reload halaman
      useAuthStore.setState(s => ({
        profile: s.profile ? { ...s.profile, avatar_url: avatarUrl } : s.profile
      }))
      useStore.getState().toast('Foto profil berhasil diperbarui! 🎉', 'success')
    } else {
      useStore.getState().toast('Gagal upload foto. Coba lagi.', 'error')
    }
  }

  const PREVIEW_OPTS = [
    { value: null, label: 'Admin View' },
    { value: '', label: 'User Umum' },
    { value: 'pro', label: 'PRO' },
    { value: 'cro', label: 'CRO' },
    { value: 'klaim', label: 'Klaim' },
    { value: 'ae', label: 'AE' },
  ]


  return (
    <>
      <header className="header" role="banner">
        {/* LEFT — Brand */}
        <div className="header-left">
          <div className="header-brand">

            <div>
              <h1 className="header-title" style={{ fontSize: 22, fontWeight: 800 }}>JateamHub</h1>
              <div className="header-sub">Selamat datang, {session?.username ?? ''}{emoji ? ` ${emoji}` : ''}</div>
            </div>
          </div>


        </div>

        {/* RIGHT */}
        <div className="header-right">

          {/* Desktop buttons */}
          {!editMode ? (
            <>
              <div className="search-wrap desktop-only">
                <input className="search-input" placeholder="Filter..." value={searchQuery} onChange={e => setSearch(e.target.value)} />
                <span className="search-icon">⌕</span>
              </div>
              <button className="icon-btn desktop-only" onClick={toggleEditMode} title="Edit Mode" aria-label="Edit Mode">✏️</button>
            </>
          ) : (
            <>
              <button className="icon-btn desktop-only" onClick={onAddSection}
                style={{ fontWeight: 700, fontSize: 16 }} title="Tambah Section" aria-label="Tambah Section">＋</button>
              <button className="icon-btn desktop-only" onClick={onImportLinks}
                style={{ fontWeight: 600, fontSize: 13 }} title="Import Link" aria-label="Import Link">📥</button>
              <button
                className="icon-btn desktop-only active"
                onClick={e => {
                  e.stopPropagation()
                  // Tutup options jika terbuka sebelum exit edit mode
                  if (optionsOpen) onToggleOptions()
                  toggleEditMode()
                }}
                title="Selesai Edit" aria-label="Selesai Edit"
                style={{ fontSize: 11, fontWeight: 700, padding: '0 12px', width: 'auto' }}>
                ✓ Selesai
              </button>
            </>
          )}

          {/* ── MOBILE: hanya search ── */}
          <div className="mobile-only">
            {!editMode && (
              <div className="search-wrap" style={{ marginRight: 4 }}>
                <input className="search-input" placeholder="Cari..." value={searchQuery}
                  onChange={e => setSearch(e.target.value)} style={{ width: 90 }} />
                <span className="search-icon">⌕</span>
              </div>
            )}
            {editMode && (
              <button className="icon-btn active"
                onClick={e => { e.stopPropagation(); if (optionsOpen) onToggleOptions(); toggleEditMode() }}
                style={{ fontSize: 11, fontWeight: 700, padding: '0 10px', width: 'auto' }}
                title="Selesai Edit" aria-label="Selesai Edit">✓ Selesai</button>
            )}
          </div>

          {/* Theme Toggle — ☀️/🌙 */}
          <button
            className="theme-toggle"
            onClick={() => setIsDark(v => !v)}
            title={isDark ? 'Switch ke Pearl (Light)' : 'Switch ke Slate (Dark)'}
            aria-label="Toggle tema"
          >
            {isDark ? '☀️' : '🌙'}
          </button>

          {/* Profile dropdown — lebih besar dari tombol lain */}
          <div className="preview-dropdown" ref={profileRef} style={{ marginLeft: 4 }}>
            <button className="profile-btn" onClick={() => setProfileDropdown(v => !v)} title="Profil"
              style={{ width: 46, height: 46, borderRadius: '50%' }}>
              {(session as any)?.avatar_url ? (
                <img src={(session as any).avatar_url} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : emoji ? (
                <span style={{ fontSize: 18 }}>{emoji}</span>
              ) : (
                <span style={{ fontSize: 18, color: 'var(--silver3)' }}>👤</span>
              )}
            </button>

            {profileDropdown && (
              <div className="preview-dropdown-menu">
                {/* User info */}
                <div style={{ padding: '12px 16px 10px', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--silver)' }}>{session?.username}</div>
                  {badge && (
                    <span style={{
                      fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: 99,
                      background: badge.color, color: '#0A0A0A',
                      textTransform: 'uppercase', fontFamily: 'var(--mono)',
                      display: 'inline-block', marginTop: 4, letterSpacing: '0.5px',
                    }}>{badge.label}</span>
                  )}
                </div>
                <button className="preview-dropdown-item"
                  onClick={() => { onOpenAdvanced(); setProfileDropdown(false) }}>
                  👤 Lihat Profil Saya
                </button>
                <div className="preview-dropdown-divider" />
                <button className="preview-dropdown-item danger"
                  onClick={() => useAuthStore.getState().logout()}>
                  ⏻ Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Crop modal — muncul setelah user pilih foto */}
      {cropDataUrl && (
        <AvatarCropModal
          imageDataUrl={cropDataUrl}
          onConfirm={handleCropConfirm}
          onCancel={() => setCropDataUrl(null)}
        />
      )}
    </>
  )
}
