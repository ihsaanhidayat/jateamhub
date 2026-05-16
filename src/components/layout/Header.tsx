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

  const isEditable   = canEdit(session as any)
  const showOptions  = canSeeOptionsPanel(session as any)
  const isAdminLevel = session?.role === 'admin' || session?.role === 'superadmin'

  // Only beranda in nav
  const pages = (config.pages ?? [{ id: 'beranda', label: 'BERANDA' }]).filter(p => p.id === 'beranda')

  useEffect(() => {
    const validPageIds = (config.pages ?? []).map(p => p.id)
    const safePage = sanitizePage(currentPage, validPageIds)
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

  const activePreview = PREVIEW_OPTS.find(o => o.value === previewUnit)

  return (
    <>
      <header className="header">
        {/* Brand */}
        <div className="header-brand">
          {config.meta.logoUrl ? (
            <div style={{ background: '#fff', borderRadius: 6, padding: 2, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <img src={config.meta.logoUrl} alt="Logo" style={{ width: 30, height: 30, objectFit: 'contain', borderRadius: 4 }}
                onError={e => { (e.target as HTMLImageElement).parentElement!.style.display = 'none' }} />
            </div>
          ) : (
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <rect width="28" height="28" rx="6" fill="rgba(0,255,194,0.1)" stroke="rgba(0,255,194,0.3)" strokeWidth="1"/>
              <path d="M8 14h12M14 8v12" stroke="var(--mint)" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          )}
          <div>
            <h1 className="header-title">{config.meta.title || 'JateamHub'}</h1>
          </div>
        </div>

        {/* Nav */}
        <nav className="header-nav">
          {pages.map(page => (
            <button key={page.id} className={`nav-link${currentPage === page.id ? ' active' : ''}`}
              onClick={() => setCurrentPage(page.id)}>
              {page.label}
            </button>
          ))}
        </nav>

        {/* Right controls */}
        <div className="header-right">
          {/* Search */}
          <div className="search-wrap">
            <input className="search-input" placeholder="Filter..." value={searchQuery} onChange={e => setSearch(e.target.value)} />
            <span className="search-icon">⌕</span>
          </div>

          {/* Edit mode */}
          {isEditable && (
            <button className={`icon-btn${editMode ? ' active' : ''}`} onClick={toggleEditMode} title="Edit Mode">✏️</button>
          )}

          {/* Preview unit dropdown — hanya admin/superadmin */}
          {isAdminLevel && (
            <div className="preview-dropdown" ref={previewRef}>
              <button
                className={`preview-btn${previewUnit !== null ? ' active' : ''}`}
                onClick={() => setPreviewOpen(v => !v)}
              >
                <span>{previewUnit !== null ? (PREVIEW_OPTS.find(o => o.value === previewUnit)?.label ?? 'Preview') : '👁 View'}</span>
                <span style={{ opacity: .5, fontSize: 9 }}>▾</span>
              </button>
              {previewOpen && (
                <div className="preview-menu">
                  {PREVIEW_OPTS.map(opt => (
                    <button
                      key={String(opt.value)}
                      className={previewUnit === opt.value ? 'active' : ''}
                      onClick={() => { setPreviewUnit(opt.value); setPreviewOpen(false) }}
                    >{opt.label}</button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Options */}
          {showOptions && (
            <button id="options-btn" className={`icon-btn${optionsOpen ? ' active' : ''}`} onClick={onToggleOptions} title="Options">⚙️</button>
          )}

          {/* Profile */}
          <button className="profile-btn" onClick={onOpenProfile} title="Profil saya">
            {session?.avatar_url ? (
              <img src={session.avatar_url} alt="avatar" />
            ) : session?.avatar_emoji ? (
              <span style={{ fontSize: 18 }}>{session.avatar_emoji}</span>
            ) : (
              <span style={{ fontSize: 16 }}>👤</span>
            )}
          </button>
        </div>
      </header>

      {/* Preview banner */}
      {previewUnit !== null && (
        <div style={{
          background: 'rgba(199,125,255,0.1)', borderBottom: '1px solid rgba(199,125,255,0.3)',
          padding: '5px 20px', display: 'flex', alignItems: 'center', gap: 10,
          fontSize: 11, color: '#C77DFF',
        }}>
          <span style={{ fontWeight: 700 }}>👁 Preview:</span>
          <span>{previewUnit !== null ? (previewUnit ? previewUnit.toUpperCase() : 'User Umum') : 'Admin'}</span>
          <button onClick={() => setPreviewUnit(null)} style={{
            marginLeft: 'auto', background: 'none', border: '1px solid rgba(199,125,255,0.4)',
            borderRadius: 4, color: '#C77DFF', padding: '2px 8px', fontSize: 10,
            cursor: 'pointer', fontWeight: 600,
          }}>✕ Keluar</button>
        </div>
      )}
    </>
  )
}
