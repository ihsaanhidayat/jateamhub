import { useEffect } from 'react'
import { useStore } from '../../store/dashboardStore'
import { getAccessiblePages, canEdit } from '../../utils/roles'
import { sanitizePage } from '../../utils/security'
import { USER_PAGES } from '../../types'

interface Props {
  onToggleOptions: () => void
  optionsOpen: boolean
  onOpenConfig: () => void
}

export default function Header({ onToggleOptions, optionsOpen, onOpenConfig }: Props) {
  const {
    session, config, editMode, toggleEditMode,
    searchQuery, setSearch, currentPage, setCurrentPage,
    previewUnit, setPreviewUnit,
  } = useStore()

  const isEditable = canEdit(session)
  const subtitle   = (config.meta.subtitle || 'Selamat datang').replace('{username}', session?.username || '')

  // Navbar: admin lihat semua, user hanya USER_PAGES
  const accessiblePageIds = getAccessiblePages(session)
  const visiblePages = (config.pages ?? []).filter(p => accessiblePageIds.includes(p.id))

  // Auto-redirect kalau currentPage tidak accessible
  useEffect(() => {
    const validPageIds = (config.pages ?? []).map(p => p.id)
    const safePage = sanitizePage(currentPage, validPageIds)
    if (!accessiblePageIds.includes(currentPage) || safePage !== currentPage) {
      setCurrentPage('beranda')
    }
  }, [session?.role, session?.unitId, currentPage, config.pages])

  return (
    <>
      <header className="header">
        {/* Brand */}
        <div className="header-brand">
          {config.meta.logoUrl ? (
            <div style={{
              background: '#ffffff',
              borderRadius: 6,
              padding: '2px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 36, height: 36,
              flexShrink: 0,
              boxShadow: '0 0 0 1px rgba(255,255,255,0.15)',
            }}>
              <img
                src={config.meta.logoUrl}
                alt="Logo"
                style={{ width: 30, height: 30, objectFit: 'contain', borderRadius: 4 }}
                onError={e => { (e.target as HTMLImageElement).parentElement!.style.display = 'none' }}
              />
            </div>
          ) : (
            <div className="header-logo-placeholder" title="Klik untuk atur logo" onClick={onOpenConfig} style={{ cursor: 'pointer' }}>
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                <rect width="28" height="28" rx="6" fill="rgba(0,255,194,0.1)" stroke="rgba(0,255,194,0.3)" strokeWidth="1"/>
                <path d="M8 14h12M14 8v12" stroke="var(--mint)" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
            </div>
          )}
          <div>
            <h1 className="header-title">JateamHub</h1>
            <div className="header-sub">{subtitle}</div>
          </div>
        </div>

        {/* Nav */}
        <nav className="header-nav">
          {visiblePages.map(page => (
            <button
              key={page.id}
              className={`nav-link${currentPage === page.id ? ' active' : ''}`}
              onClick={() => setCurrentPage(page.id)}
            >
              {page.label}
            </button>
          ))}
        </nav>

        {/* Right */}
        <div className="header-right">
          <div className="search-wrap">
            <input className="search-input" placeholder="Filter halaman ini..." value={searchQuery} onChange={e => setSearch(e.target.value)} />
            <span className="search-icon">⌕</span>
          </div>
          {isEditable && (
            <button className={`icon-btn${editMode ? ' active' : ''}`} onClick={toggleEditMode} title="Edit Mode">✏️</button>
          )}
          <button id="options-btn" className={`icon-btn${optionsOpen ? ' active' : ''}`} onClick={onToggleOptions} title="Options">⚙️</button>
        </div>
      </header>

      {/* Preview banner */}
      {previewUnit !== null && (
        <div style={{
          background: 'rgba(199,125,255,0.12)', borderBottom: '1px solid rgba(199,125,255,0.3)',
          padding: '6px 20px', display: 'flex', alignItems: 'center', gap: 10,
          fontSize: 12, color: '#C77DFF',
        }}>
          <span style={{ fontWeight: 700 }}>👁 Preview Mode:</span>
          <span>Melihat sebagai User {previewUnit ? previewUnit.toUpperCase() : 'Umum'}</span>
          <button
            onClick={() => setPreviewUnit(null)}
            style={{
              marginLeft: 'auto', background: 'none', border: '1px solid rgba(199,125,255,0.4)',
              borderRadius: 4, color: '#C77DFF', padding: '2px 10px', fontSize: 11,
              cursor: 'pointer', fontWeight: 600,
            }}
          >
            ✕ Keluar Preview
          </button>
        </div>
      )}
    </>
  )
}
