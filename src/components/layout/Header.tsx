import { useState, useRef, useEffect } from 'react'
import { useStore } from '../../store/dashboardStore'
import { useAuthStore } from '../../store/authStore'
import { canEdit, canSeeOptionsPanel } from '../../utils/roles'
import { sanitizePage } from '../../utils/security'

interface Props {
  onToggleOptions: () => void
  optionsOpen: boolean
  onOpenProfile: () => void
}

export default function Header({ onToggleOptions, optionsOpen, onOpenProfile }: Props) {
  const {
    config, editMode, toggleEditMode,
    searchQuery, setSearch, currentPage, setCurrentPage,
    previewUnit, setPreviewUnit,
  } = useStore()
  const { profile: session } = useAuthStore()
  const [previewOpen, setPreviewOpen] = useState(false)
  const previewRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const isEditable   = canEdit(session as any)
  const showOptions  = canSeeOptionsPanel(session as any)
  const isAdminLevel = session?.role === 'admin' || session?.role === 'superadmin'

  const emoji    = (session as any)?.avatar_emoji ?? ''
  const subtitle = (config.meta.subtitle || 'Selamat datang, {username}')
    .replace('{username}', session?.username ?? '')

  const pages = [{ id: 'beranda', label: 'BERANDA' }]

  useEffect(() => {
    const safePage = sanitizePage(currentPage, ['beranda'])
    if (safePage !== currentPage) setCurrentPage('beranda')
  }, [session?.role, currentPage])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (previewRef.current && !previewRef.current.contains(e.target as Node)) {
        setPreviewOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const PREVIEW_OPTS = [
    { value: null,    label: '👁 Admin View' },
    { value: '',      label: 'User Umum' },
    { value: 'pro',   label: 'PRO' },
    { value: 'cro',   label: 'CRO' },
    { value: 'klaim', label: 'Klaim' },
  ]

  const handleAvatarClick = () => fileRef.current?.click()

  const handleAvatarFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !session) return
    e.target.value = ''
    // Dynamic import untuk avoid circular
    const { uploadAvatar } = await import('../../utils/supabaseClient')
    const { updateProfile } = await import('../../utils/supabaseClient')
    const canvas = document.createElement('canvas')
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = async () => {
      URL.revokeObjectURL(url)
      const max = 400
      const ratio = Math.min(max / img.width, max / img.height, 1)
      canvas.width  = Math.floor(img.width  * ratio)
      canvas.height = Math.floor(img.height * ratio)
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
      canvas.toBlob(async blob => {
        if (!blob) return
        const avatarUrl = await uploadAvatar(session.id, blob)
        if (avatarUrl) {
          await updateProfile(session.id, { avatar_url: avatarUrl })
          window.location.reload()
        }
      }, 'image/webp', 0.85)
    }
    img.src = url
  }

  return (
    <>
      <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarFile} />

      <header className="header">
        {/* Brand + Nav kiri */}
        <div className="header-left">
          <div className="header-brand">
            {config.meta.logoUrl ? (
              <div style={{ background: '#fff', borderRadius: 6, padding: 2, width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <img src={config.meta.logoUrl} alt="Logo" style={{ width: 34, height: 34, objectFit: 'contain', borderRadius: 4 }}
                  onError={e => { (e.target as HTMLImageElement).parentElement!.style.display = 'none' }} />
              </div>
            ) : (
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                <rect width="32" height="32" rx="8" fill="rgba(0,255,194,0.1)" stroke="rgba(0,255,194,0.3)" strokeWidth="1.2"/>
                <path d="M9 16h14M16 9v14" stroke="var(--mint)" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            )}
            <div>
              <h1 className="header-title">{config.meta.title || 'JateamHub'}</h1>
              <div className="header-sub">{subtitle}{emoji ? ` ${emoji}` : ''}</div>
            </div>
          </div>

          <nav className="header-nav">
            {pages.map(page => (
              <button key={page.id} className={`nav-link${currentPage === page.id ? ' active' : ''}`}
                onClick={() => setCurrentPage(page.id)}>
                {page.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Right controls — urutan: Edit > Options > Profile (kiri ke kanan) */}
        <div className="header-right">
          {/* Edit mode */}
          {isEditable && (
            <button className={`icon-btn${editMode ? ' active' : ''}`} onClick={toggleEditMode} title="Edit Mode">✏️</button>
          )}

          {/* Preview unit */}
          {isAdminLevel && (
            <div className="preview-dropdown" ref={previewRef}>
              <button className={`preview-btn${previewUnit !== null ? ' active' : ''}`} onClick={() => setPreviewOpen(v => !v)}>
                <span>{previewUnit !== null ? (PREVIEW_OPTS.find(o => o.value === previewUnit)?.label ?? 'Preview') : '👁 View'}</span>
                <span style={{ opacity: .5, fontSize: 9 }}>▾</span>
              </button>
              {previewOpen && (
                <div className="preview-menu">
                  {PREVIEW_OPTS.map(opt => (
                    <button key={String(opt.value)} className={previewUnit === opt.value ? 'active' : ''}
                      onClick={() => { setPreviewUnit(opt.value); setPreviewOpen(false) }}>{opt.label}</button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Options */}
          {showOptions && (
            <button id="options-btn" className={`icon-btn${optionsOpen ? ' active' : ''}`} onClick={onToggleOptions} title="Options">⚙️</button>
          )}

          {/* Profile avatar — klik untuk ganti foto */}
          <button className="profile-btn" onClick={onOpenProfile} title="Profil saya"
            onContextMenu={e => { e.preventDefault(); handleAvatarClick() }}>
            {(session as any)?.avatar_url ? (
              <img src={(session as any).avatar_url} alt="avatar" />
            ) : emoji ? (
              <span style={{ fontSize: 18 }}>{emoji}</span>
            ) : (
              <span style={{ fontSize: 16 }}>👤</span>
            )}
          </button>
        </div>
      </header>

      {/* Search bar — sticky di bawah header */}
      <div className="search-bar">
        <div className="search-wrap">
          <input className="search-input" placeholder="Filter halaman ini..." value={searchQuery} onChange={e => setSearch(e.target.value)} />
          <span className="search-icon">⌕</span>
        </div>
        {previewUnit !== null && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: '#C77DFF', marginLeft: 'auto' }}>
            <span style={{ fontWeight: 700 }}>👁 Preview: {previewUnit ? previewUnit.toUpperCase() : 'User Umum'}</span>
            <button onClick={() => setPreviewUnit(null)} style={{
              background: 'none', border: '1px solid rgba(199,125,255,0.4)',
              borderRadius: 4, color: '#C77DFF', padding: '2px 8px', fontSize: 10,
              cursor: 'pointer', fontWeight: 600,
            }}>✕ Keluar</button>
          </div>
        )}
      </div>
    </>
  )
}
