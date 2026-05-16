import { useState, useRef, useEffect } from 'react'
import { useStore } from '../../store/dashboardStore'
import { useAuthStore } from '../../store/authStore'
import { canEdit, canSeeOptions, getDisplayBadge, isSuperAdmin, isAdmin } from '../../utils/roles'
import { sanitizePage } from '../../utils/security'
import { uploadAvatar, updateProfile } from '../../utils/supabaseClient'

interface Props {
  onToggleOptions: () => void
  optionsOpen: boolean
  onOpenAdvanced: () => void
}

export default function Header({ onToggleOptions, optionsOpen, onOpenAdvanced }: Props) {
  const {
    config, editMode, toggleEditMode,
    searchQuery, setSearch, currentPage, setCurrentPage,
    previewUnit, setPreviewUnit,
  } = useStore()
  const { profile: session } = useAuthStore()

  const [profileDropdown, setProfileDropdown] = useState(false)
  const [previewOpen,     setPreviewOpen]     = useState(false)
  const profileRef = useRef<HTMLDivElement>(null)
  const previewRef = useRef<HTMLDivElement>(null)
  const fileRef    = useRef<HTMLInputElement>(null)

  const isEditable   = canEdit(session as any)
  const showOptions  = canSeeOptions(session as any)
  const isAdminLevel = isAdmin(session as any)
  const badge        = getDisplayBadge(session as any)
  const emoji        = (session as any)?.avatar_emoji ?? (session as any)?.emoji ?? ''

  const subtitle = (config.meta.subtitle || 'Selamat datang, {username}')
    .replace('{username}', session?.username ?? '')

  useEffect(() => {
    const safePage = sanitizePage(currentPage, ['beranda'])
    if (safePage !== currentPage) setCurrentPage('beranda')
  }, [session?.role, currentPage])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileDropdown(false)
      if (previewRef.current && !previewRef.current.contains(e.target as Node)) setPreviewOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !session) return
    e.target.value = ''
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

  const PREVIEW_OPTS = [
    { value: null,    label: 'Admin View' },
    { value: '',      label: 'User Umum'  },
    { value: 'pro',   label: 'PRO'        },
    { value: 'cro',   label: 'CRO'        },
    { value: 'klaim', label: 'Klaim'      },
    { value: 'ae',    label: 'AE'         },
  ]

  return (
    <>
      <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarUpload} />

      <header className="header">
        {/* LEFT — Brand */}
        <div className="header-left">
          <div className="header-brand">
            {config.meta.logoUrl ? (
              <div style={{ background: '#fff', borderRadius: 8, padding: 3, width: 42, height: 42, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <img src={config.meta.logoUrl} alt="Logo" style={{ width: 34, height: 34, objectFit: 'contain', borderRadius: 4 }}
                  onError={e => { (e.target as HTMLImageElement).parentElement!.style.display = 'none' }} />
              </div>
            ) : (
              <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(0,255,194,0.1)', border: '1.5px solid rgba(0,255,194,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 0 12px rgba(0,255,194,0.1)' }}>
                <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                  <path d="M5 11h12M11 5v12" stroke="var(--mint)" strokeWidth="2.2" strokeLinecap="round"/>
                </svg>
              </div>
            )}
            <div>
              <h1 className="header-title">{config.meta.title || 'JateamHub'}</h1>
              <div className="header-sub">{subtitle}</div>
            </div>
          </div>


        </div>

        {/* RIGHT — view mode > filter > edit > options > profile */}
        <div className="header-right">

          {/* View mode — hanya admin/superadmin, SEBELUM filter */}
          {isAdminLevel && (
            <div className="preview-dropdown" ref={previewRef}>
              <button className={`preview-btn${previewUnit !== null ? ' active' : ''}`} onClick={() => setPreviewOpen(v => !v)}>
                <span style={{ fontSize: 13 }}>👁</span>
                <span style={{ fontSize: 11 }}>{previewUnit !== null ? (PREVIEW_OPTS.find(o => o.value === previewUnit)?.label ?? 'Preview') : 'View'}</span>
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

          {/* Filter — semua role */}
          <div className="search-wrap">
            <input className="search-input" placeholder="Filter..." value={searchQuery} onChange={e => setSearch(e.target.value)} />
            <span className="search-icon">⌕</span>
          </div>

          {/* Edit mode — hanya admin/superadmin */}
          {isEditable && (
            <button className={`icon-btn${editMode ? ' active' : ''}`} onClick={toggleEditMode} title="Edit Mode">✏️</button>
          )}

          {/* Options — hanya admin/superadmin */}
          {showOptions && (
            <button id="options-btn" className={`icon-btn${optionsOpen ? ' active' : ''}`} onClick={onToggleOptions} title="Options">⚙️</button>
          )}

          {/* Profile dropdown */}
          <div className="preview-dropdown" ref={profileRef}>
            <button className="profile-btn" onClick={() => setProfileDropdown(v => !v)} title="Profil">
              {(session as any)?.avatar_url ? (
                <img src={(session as any).avatar_url} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : emoji ? (
                <span style={{ fontSize: 18 }}>{emoji}</span>
              ) : (
                <span style={{ fontSize: 18, color: 'var(--silver3)' }}>👤</span>
              )}
            </button>

            {profileDropdown && (
              <div className="preview-menu" style={{ right: 0, minWidth: 200, padding: '4px 0' }}>
                {/* User info */}
                <div style={{ padding: '10px 14px 8px', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--silver)' }}>{session?.username}</div>
                  <span style={{
                    fontSize: 9, fontWeight: 800, padding: '2px 7px', borderRadius: 10,
                    background: badge.color, color: '#0A0A0A',
                    textTransform: 'uppercase', fontFamily: 'var(--mono)',
                    display: 'inline-block', marginTop: 4,
                  }}>{badge.label}</span>
                </div>
                {/* Actions */}
                <button onClick={() => { fileRef.current?.click(); setProfileDropdown(false) }}
                  style={{ display: 'block', width: '100%', padding: '9px 14px', textAlign: 'left', background: 'none', border: 'none', color: 'var(--silver2)', fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font)' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--mint-bg)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
                  📷 Ganti Foto
                </button>
                {(canSeeOptions(session as any)) && (
                  <button onClick={() => { onOpenAdvanced(); setProfileDropdown(false) }}
                    style={{ display: 'block', width: '100%', padding: '9px 14px', textAlign: 'left', background: 'none', border: 'none', color: 'var(--silver2)', fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--mint-bg)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
                    ⚡ Advanced
                  </button>
                )}
                <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
                <button onClick={() => useAuthStore.getState().logout()}
                  style={{ display: 'block', width: '100%', padding: '9px 14px', textAlign: 'left', background: 'none', border: 'none', color: 'var(--red)', fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font)' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(224,85,85,0.08)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
                  ⏻ Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Preview banner */}
      {previewUnit !== null && (
        <div style={{
          background: 'rgba(199,125,255,0.08)', borderBottom: '1px solid rgba(199,125,255,0.2)',
          padding: '5px 20px', display: 'flex', alignItems: 'center', gap: 10, fontSize: 11, color: '#C77DFF',
        }}>
          <span style={{ fontWeight: 700 }}>👁 Preview: {previewUnit ? previewUnit.toUpperCase() : 'User Umum'}</span>
          <button onClick={() => setPreviewUnit(null)} style={{
            marginLeft: 'auto', background: 'none', border: '1px solid rgba(199,125,255,0.3)',
            borderRadius: 4, color: '#C77DFF', padding: '2px 8px', fontSize: 10, cursor: 'pointer', fontWeight: 600,
          }}>✕ Keluar</button>
        </div>
      )}
    </>
  )
}
