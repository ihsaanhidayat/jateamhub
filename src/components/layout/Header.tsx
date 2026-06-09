import { useState, useRef, useEffect } from 'react'
import { useStore, applyThemeToDOM } from '../../store/dashboardStore'
import { useAuthStore } from '../../store/authStore'
import { canEdit, canSeeOptions, getDisplayBadge, isAdmin, isAdminGlobal } from '../../utils/roles'
import { sanitizePage } from '../../utils/security'
import { uploadAvatar, updateProfile } from '../../utils/supabaseClient'
import AvatarCropModal from '../ui/AvatarCropModal'

interface Props {
  onToggleOptions:  () => void
  optionsOpen:      boolean
  onOpenTaskList?:  () => void
  onOpenAdvanced:  () => void
  onAddSection:    () => void
  onImportLinks:   () => void
}

export default function Header({ onToggleOptions, optionsOpen, onOpenAdvanced, onAddSection, onImportLinks, onOpenTaskList }: Props) {
  const editMode    = useStore(s => s.editMode)
  const searchQuery = useStore(s => s.searchQuery)
  const { profile: session } = useAuthStore()

  const [profileDropdown, setProfileDropdown] = useState(false)
  const [cropDataUrl,     setCropDataUrl]     = useState<string | null>(null)
  const profileRef = useRef<HTMLDivElement>(null)
  const hideSearch   = useStore(s => (s as any).notesLockActive ?? false)
  const [searchOpen, setSearchOpen] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)
  const searchContainerRef = useRef<HTMLDivElement>(null)

  // Keyboard shortcuts + search close
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      // Escape — close search
      if (e.key === 'Escape') { setSearchOpen(false); useStore.getState().setSearch('') }
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen(v => {
          if (!v) setTimeout(() => searchRef.current?.focus(), 280)
          else useStore.getState().setSearch('')
          return !v
        })
      }
      // Ctrl+E / Cmd+E — toggle edit mode
      if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
        e.preventDefault()
        useStore.getState().toggleEditMode()
      }
    }
    const clickOutside = (e: MouseEvent) => {
      if (searchOpen && searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setSearchOpen(false); useStore.getState().setSearch('')
      }
    }
    window.addEventListener('keydown', h)
    document.addEventListener('mousedown', clickOutside)
    return () => { window.removeEventListener('keydown', h); document.removeEventListener('mousedown', clickOutside) }
  }, [searchOpen])

  // Realtime clock di header
  const [clockNow, setClockNow] = useState(new Date())
  useEffect(() => {
    const t = setInterval(() => setClockNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])
  const clockStr = clockNow.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) +
    '  ·  ' + clockNow.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

  // Theme toggle — derive dari appearance store agar reaktif setelah initUser
  const DARK_THEMES = ['midnight', 'slate', 'obsidian', 'dark-mint', 'dark-soft', 'enterprise',
    'aurora-dark', 'sand-dark', 'slate-dark', 'pearl-dark', 'ivory-dark', 'sage-dark', 'dark']
  const appearanceTheme = useStore(s => s.appearance.theme as string)
  const [isDark, setIsDarkState] = useState(() =>
    DARK_THEMES.includes(document.documentElement.getAttribute('data-theme') ?? '')
  )

  useEffect(() => {
    setIsDarkState(DARK_THEMES.includes(appearanceTheme))
  }, [appearanceTheme])

  const setIsDark = (dark: boolean) => {
    const theme = dark ? 'midnight' : 'parchment'
    applyThemeToDOM(theme)
    setIsDarkState(dark)
    useStore.getState().setAppearance({ theme }) // persists to localStorage + DB
    const color = dark ? '#0A0D1A' : '#F7F3EE'
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', color)
  }

  // Sync saat tab lain mengubah tema
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'jateamhub-appearance') {
        try {
          const app = JSON.parse(e.newValue ?? '{}')
          if (app.theme) setIsDarkState(DARK_THEMES.includes(app.theme))
        } catch {}
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const isEditable   = canEdit(session as any)
  const showOptions  = canSeeOptions(session as any)
  const isAdminLevel = isAdmin(session as any)
  const badge        = getDisplayBadge(session as any)
  const emoji        = (session as any)?.avatar_emoji ?? (session as any)?.emoji ?? ''





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

  return (
    <>
      <header className="header" role="banner">
        {/* LEFT — Brand */}
        <div className="header-left">
          <div className="header-brand">

            <div>
              <h1 className="header-title">JateamHub</h1>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1, marginTop: 2 }}>
                <span className="header-sub">
                  Selamat datang, {session?.username ?? ''}{emoji ? ` ${emoji}` : ''}
                </span>
                <span style={{ fontSize: 10, color: 'var(--silver4)', fontFamily: 'var(--mono)' }}>
                  {clockStr}
                </span>
              </div>
            </div>
          </div>


        </div>

        {/* RIGHT */}
        <div className="header-right">

          {/* Desktop buttons */}
          {!editMode ? (
            <>
              {!hideSearch && (
                <div ref={searchContainerRef} className="search-animated desktop-only" style={{ display: 'flex', alignItems: 'center' }}>
                  <div style={{
                    display: 'flex', alignItems: 'center',
                    width: searchOpen ? 210 : 34, height: 34,
                    background: searchOpen ? 'var(--bg4)' : 'none',
                    border: searchOpen ? '1px solid var(--border2)' : '1px solid transparent',
                    borderRadius: 8, overflow: 'hidden',
                    transition: 'width 280ms cubic-bezier(0.16,1,0.3,1), background 200ms, border-color 200ms',
                    flexShrink: 0,
                  }}>
                    <button onClick={() => {
                      setSearchOpen(v => !v)
                      if (!searchOpen) setTimeout(() => searchRef.current?.focus(), 280)
                      else { useStore.getState().setSearch('') }
                    }} style={{
                      width: 34, height: 34, flexShrink: 0,
                      background: 'none', border: 'none', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: searchOpen ? 'var(--accent)' : 'var(--silver3)', fontSize: 15,
                      transition: 'color 150ms',
                    }}>🔍</button>
                    <input
                      ref={searchRef}
                      value={searchQuery}
                      onChange={e => useStore.getState().setSearch(e.target.value)}
                      placeholder="Cari link..."
                      autoComplete="off"
                      spellCheck={false}
                      tabIndex={searchOpen ? 0 : -1}
                      readOnly={!searchOpen}
                      style={{
                        flex: 1, height: '100%', background: 'none',
                        border: 'none', outline: 'none',
                        fontSize: 13, color: 'var(--silver)',
                        fontFamily: 'var(--font)',
                        opacity: searchOpen ? 1 : 0,
                        pointerEvents: searchOpen ? 'auto' : 'none',
                        transition: 'opacity 200ms',
                        paddingRight: 10,
                      }}
                    />
                    {searchOpen && searchQuery && (
                      <button onClick={() => useStore.getState().setSearch('')} style={{
                        width: 20, height: 20, flexShrink: 0, marginRight: 6,
                        background: 'var(--border2)', border: 'none', borderRadius: '50%',
                        cursor: 'pointer', color: 'var(--silver3)', fontSize: 10,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>✕</button>
                    )}
                  </div>
                </div>
              )}
              <button className="icon-btn desktop-only" onClick={onImportLinks}
                title="Import / Export Links" aria-label="Import / Export Links"
                style={{ fontSize: 15 }}>📥</button>
              <button className="icon-btn desktop-only" onClick={() => useStore.getState().toggleEditMode()} title="Edit Mode" aria-label="Edit Mode">✏️</button>
            </>
          ) : (
            <>
              <button className="icon-btn desktop-only" onClick={onAddSection}
                style={{ fontWeight: 700, fontSize: 16 }} title="Tambah Section" aria-label="Tambah Section">＋</button>
              <button className="icon-btn desktop-only" onClick={onImportLinks}
                title="Import / Export Links" aria-label="Import / Export Links"
                style={{ fontSize: 15 }}>📥</button>
              <button
                className="icon-btn desktop-only active"
                onClick={e => {
                  e.stopPropagation()
                  if (optionsOpen) onToggleOptions()
                  useStore.getState().toggleEditMode()
                }}
                title="Selesai Edit" aria-label="Selesai Edit"
                style={{ fontSize: 11, fontWeight: 700, padding: '0 12px', width: 'auto' }}>
                ✓ Selesai
              </button>
            </>
          )}

          {/* ── MOBILE: search ── */}
          <div className="mobile-only">
            {!editMode && !hideSearch && (
              <button onClick={() => { setSearchOpen(v => !v); if (!searchOpen) setTimeout(() => searchRef.current?.focus(), 100) }}
                style={{ width: 34, height: 34, background: searchOpen ? 'var(--accent-light)' : 'none', border: '1px solid transparent', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: searchOpen ? 'var(--accent)' : 'var(--silver3)', fontSize: 15 }}>
                🔍
              </button>
            )}
            {editMode && (
              <button className="icon-btn active"
                onClick={e => { e.stopPropagation(); if (optionsOpen) onToggleOptions(); useStore.getState().toggleEditMode() }}
                style={{ fontSize: 11, fontWeight: 700, padding: '0 10px', width: 'auto' }}
                title="Selesai Edit" aria-label="Selesai Edit">✓ Selesai</button>
            )}
          </div>

          {/* Theme Toggle — ☀️/🌙 */}
          <button
            className="theme-toggle"
            onClick={() => setIsDark(!isDark)}
            title={isDark ? 'Switch ke Parchment (Light)' : 'Switch ke Midnight (Dark)'}
            aria-label="Toggle tema"
          >
            {isDark ? '🌙' : '☀️'}
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
                {onOpenTaskList && (
                  <button className="preview-dropdown-item"
                    onClick={() => { onOpenTaskList(); setProfileDropdown(false) }}>
                    📋 Riwayat Task
                  </button>
                )}
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

      {/* Mobile search slide-down */}
      {searchOpen && (
        <div className="mobile-only" style={{
          position: 'sticky', top: 68, zIndex: 99,
          padding: '8px 16px', background: 'var(--bg2)',
          borderBottom: '1px solid var(--border)',
          animation: 'slideDown 200ms ease',
        }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 14, color: 'var(--silver4)' }}>🔍</span>
            <input
              ref={searchRef}
              value={searchQuery}
              onChange={e => useStore.getState().setSearch(e.target.value)}
              placeholder="Cari link..."
              autoComplete="off" spellCheck={false}
              autoFocus
              style={{
                flex: 1, height: 36, padding: '0 12px',
                background: 'var(--bg4)', border: '1px solid var(--border2)',
                borderRadius: 8, fontSize: 14, color: 'var(--silver)',
                fontFamily: 'var(--font)', outline: 'none',
              }}
            />
            <button onClick={() => { setSearchOpen(false); useStore.getState().setSearch('') }} style={{
              width: 36, height: 36, borderRadius: 8, background: 'var(--bg4)',
              border: '1px solid var(--border2)', cursor: 'pointer',
              color: 'var(--silver3)', fontSize: 12,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>✕</button>
          </div>
        </div>
      )}

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
