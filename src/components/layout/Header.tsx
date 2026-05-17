import { useState, useRef, useEffect } from 'react'
import { useStore } from '../../store/dashboardStore'
import { useAuthStore } from '../../store/authStore'
import { canEdit, canSeeOptions, getDisplayBadge, isAdmin, isAdminGlobal } from '../../utils/roles'
import { sanitizePage } from '../../utils/security'
import { uploadAvatar, updateProfile } from '../../utils/supabaseClient'

interface Props {
  onToggleOptions: () => void
  optionsOpen: boolean
  onOpenAdvanced: () => void
}

export default function Header({ onToggleOptions, optionsOpen, onOpenAdvanced }: Props) {
  const {
    editMode, toggleEditMode,
    searchQuery, setSearch,
    previewFilter, setPreviewFilter,
  } = useStore()
  const { profile: session } = useAuthStore()

  const [profileDropdown, setProfileDropdown] = useState(false)
  const [previewOpen,     setPreviewOpen]     = useState(false)
  const [hamburgerOpen,   setHamburgerOpen]   = useState(false)
  const hamburgerRef = useRef<HTMLDivElement>(null)
  const profileRef = useRef<HTMLDivElement>(null)
  const previewRef = useRef<HTMLDivElement>(null)
  const fileRef    = useRef<HTMLInputElement>(null)

  const isEditable   = canEdit(session as any)
  const showOptions  = canSeeOptions(session as any)
  const isAdminLevel = isAdmin(session as any)
  const badge        = getDisplayBadge(session as any)
  const emoji        = (session as any)?.avatar_emoji ?? (session as any)?.emoji ?? ''





  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (profileRef.current    && !profileRef.current.contains(e.target as Node))    setProfileDropdown(false)
      if (previewRef.current    && !previewRef.current.contains(e.target as Node))    setPreviewOpen(false)
      if (hamburgerRef.current  && !hamburgerRef.current.contains(e.target as Node))  setHamburgerOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !session) return
    e.target.value = ''

    // Pakai FileReader → data URL (aman untuk CSP, tidak pakai blob URL)
    const reader = new FileReader()
    reader.onload = async (ev) => {
      const dataUrl = ev.target?.result as string
      if (!dataUrl) return
      const img = new Image()
      img.onload = async () => {
        const canvas = document.createElement('canvas')
        const max   = 400
        const ratio = Math.min(max / img.width, max / img.height, 1)
        canvas.width  = Math.floor(img.width  * ratio)
        canvas.height = Math.floor(img.height * ratio)
        canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
        canvas.toBlob(async blob => {
          if (!blob) { useStore.getState().toast('Gagal memproses foto.', 'error'); return }
          const avatarUrl = await uploadAvatar(session.id, blob)
          if (avatarUrl) {
            await updateProfile(session.id, { avatar_url: avatarUrl })
            useStore.getState().toast('Foto profil berhasil diperbarui! 🎉', 'success')
            setTimeout(() => window.location.reload(), 1000)
          } else {
            useStore.getState().toast('Gagal upload foto. Coba lagi.', 'error')
          }
        }, 'image/webp', 0.85)
      }
      img.src = dataUrl  // data URL, bukan blob URL — aman untuk CSP
    }
    reader.readAsDataURL(file)
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

            <div>
              <h1 className="header-title" style={{ fontSize: 22, fontWeight: 800 }}>JateamHub</h1>
              <div className="header-sub">Selamat datang, {session?.username ?? ''}{emoji ? ` ${emoji}` : ''}</div>
            </div>
          </div>


        </div>

        {/* RIGHT — view mode > filter > edit > options > profile */}
        <div className="header-right">

          {/* View mode preview — hanya admin, filter: role + region + unit */}
          {isAdminLevel && (
            <div className="preview-dropdown" ref={previewRef}>
              <button
                className={`preview-btn${(previewFilter.role || previewFilter.region || previewFilter.unit) ? ' active' : ''}`}
                onClick={() => setPreviewOpen(v => !v)}
                title="Preview tampilan user lain"
              >
                <span style={{ fontSize: 13 }}>👁</span>
                <span style={{ fontSize: 11 }}>View</span>
                <span style={{ opacity: .5, fontSize: 9 }}>▾</span>
              </button>
              {previewOpen && (
                <div className="preview-menu" style={{ minWidth: 220, padding: '10px 12px' }}>
                  <div style={{ fontSize: 10, color: 'var(--silver3)', marginBottom: 8, fontFamily: 'var(--mono)', letterSpacing: '1px' }}>PREVIEW SEBAGAI</div>
                  {/* Filter Role */}
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 10, color: 'var(--silver3)', marginBottom: 4 }}>Role</div>
                    <select
                      value={previewFilter.role}
                      onChange={e => setPreviewFilter({ ...previewFilter, role: e.target.value })}
                      style={{ width: '100%', background: 'var(--bg4)', border: '1px solid var(--border2)', borderRadius: 4, padding: '5px 8px', color: 'var(--silver)', fontSize: 12 }}>
                      <option value="">Semua Role</option>
                      <option value="admin">Admin</option>
                      <option value="user">User</option>
                      <option value="guest">Guest</option>
                    </select>
                  </div>
                  {/* Filter Wilayah */}
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 10, color: 'var(--silver3)', marginBottom: 4 }}>Wilayah</div>
                    <select
                      value={previewFilter.region}
                      onChange={e => setPreviewFilter({ ...previewFilter, region: e.target.value })}
                      style={{ width: '100%', background: 'var(--bg4)', border: '1px solid var(--border2)', borderRadius: 4, padding: '5px 8px', color: 'var(--silver)', fontSize: 12 }}>
                      <option value="">Semua Wilayah</option>
                      <option value="global">Global</option>
                      <option value="sby">Surabaya</option>
                      <option value="mks">Makassar</option>
                      <option value="jkt">Jakarta</option>
                      <option value="dps">Denpasar</option>
                      <option value="mdn">Medan</option>
                      <option value="pkb">Pekanbaru</option>
                      <option value="plb">Palembang</option>
                      <option value="btk">Botabek</option>
                      <option value="bdg">Bandung</option>
                      <option value="smg">Semarang</option>
                      <option value="bpn">Balikpapan</option>
                    </select>
                  </div>
                  {/* Filter Unit */}
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 10, color: 'var(--silver3)', marginBottom: 4 }}>Unit</div>
                    <select
                      value={previewFilter.unit}
                      onChange={e => setPreviewFilter({ ...previewFilter, unit: e.target.value })}
                      style={{ width: '100%', background: 'var(--bg4)', border: '1px solid var(--border2)', borderRadius: 4, padding: '5px 8px', color: 'var(--silver)', fontSize: 12 }}>
                      <option value="">Semua Unit</option>
                      <option value="general">General</option>
                      <option value="pro">PRO</option>
                      <option value="cro">CRO</option>
                      <option value="klaim">Klaim</option>
                      <option value="ae">AE</option>
                    </select>
                  </div>
                  {/* Tombol reset dan terapkan filter */}
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => { setPreviewFilter({ role: '', region: '', unit: '' }); setPreviewOpen(false) }}
                      style={{ flex: 1, padding: '6px', background: 'var(--bg4)', border: '1px solid var(--border2)', borderRadius: 4, color: 'var(--silver3)', fontSize: 11, cursor: 'pointer', fontFamily: 'var(--font)' }}>
                      Reset
                    </button>
                    <button onClick={() => setPreviewOpen(false)}
                      style={{ flex: 1, padding: '6px', background: 'var(--mint-bg)', border: '1px solid var(--mint)', borderRadius: 4, color: 'var(--mint)', fontSize: 11, cursor: 'pointer', fontFamily: 'var(--font)', fontWeight: 700 }}>
                      Terapkan
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Filter */}
          <div className="search-wrap desktop-only" style={{ marginRight: 10 }}>
            <input className="search-input" placeholder="Filter..." value={searchQuery} onChange={e => setSearch(e.target.value)} />
            <span className="search-icon">⌕</span>
          </div>

          {/* Edit mode */}
          <button className={`icon-btn desktop-only${editMode ? ' active' : ''}`} onClick={toggleEditMode} title="Edit Mode"
            style={{ marginLeft: 5 }}>✏️</button>

          {/* Options */}
          <button id="options-btn" className={`icon-btn desktop-only${optionsOpen ? ' active' : ''}`} onClick={onToggleOptions} title="Options"
            style={{ marginLeft: 10 }}>⚙️</button>

          {/* ── MOBILE ONLY — Hamburger menu ── */}
          <div className="mobile-only" ref={hamburgerRef} style={{ position: 'relative' }}>
            <button
              className={`icon-btn${hamburgerOpen ? ' active' : ''}`}
              onClick={() => setHamburgerOpen(v => !v)}
              title="Menu"
              style={{ fontSize: 18, fontWeight: 700 }}
            >☰</button>
            {hamburgerOpen && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 8px)', right: 0,
                background: 'rgba(12,12,12,0.98)',
                border: '1px solid rgba(0,255,194,0.15)',
                borderRadius: 10, minWidth: 220,
                boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                zIndex: 500, overflow: 'hidden',
                animation: 'scaleIn 0.15s ease',
              }}>
                {/* Filter search */}
                <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ position: 'relative' }}>
                    <input
                      className="search-input"
                      placeholder="Filter..."
                      value={searchQuery}
                      onChange={e => setSearch(e.target.value)}
                      style={{ width: '100%' }}
                    />
                    <span className="search-icon">⌕</span>
                  </div>
                </div>
                {/* Edit mode */}
                <button onClick={() => { toggleEditMode(); setHamburgerOpen(false) }} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  width: '100%', padding: '12px 16px', background: editMode ? 'var(--mint-bg)' : 'none',
                  border: 'none', borderBottom: '1px solid var(--border)',
                  color: editMode ? 'var(--mint)' : 'var(--silver2)', fontSize: 13,
                  cursor: 'pointer', fontFamily: 'var(--font)', textAlign: 'left',
                }}>
                  <span>✏️</span> Edit Mode {editMode ? '(Aktif)' : ''}
                </button>
                {/* Options */}
                <button onClick={() => { onToggleOptions(); setHamburgerOpen(false) }} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  width: '100%', padding: '12px 16px', background: optionsOpen ? 'var(--mint-bg)' : 'none',
                  border: 'none', borderBottom: '1px solid var(--border)',
                  color: 'var(--silver2)', fontSize: 13,
                  cursor: 'pointer', fontFamily: 'var(--font)', textAlign: 'left',
                }}>
                  <span>⚙️</span> Options
                </button>
                {/* View mode — hanya admin */}
                {isAdminLevel && (
                  <button onClick={() => { setHamburgerOpen(false); setPreviewOpen(v => !v) }} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    width: '100%', padding: '12px 16px', background: 'none',
                    border: 'none', color: 'var(--silver2)', fontSize: 13,
                    cursor: 'pointer', fontFamily: 'var(--font)', textAlign: 'left',
                  }}>
                    <span>👁</span> View Mode
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Profile dropdown — lebih besar dari tombol lain */}
          <div className="preview-dropdown" ref={profileRef} style={{ marginLeft: 16 }}>
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
                {(session?.role === 'admin' || session?.role === 'superadmin') && (
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

      {/* Preview banner — tampil jika ada filter aktif */}
      {(previewFilter.role || previewFilter.region || previewFilter.unit) && (
        <div style={{
          background: 'rgba(199,125,255,0.08)', borderBottom: '1px solid rgba(199,125,255,0.2)',
          padding: '5px 20px', display: 'flex', alignItems: 'center', gap: 10, fontSize: 11, color: '#C77DFF',
        }}>
          <span style={{ fontWeight: 700 }}>
            👁 Preview: {[previewFilter.role, previewFilter.region, previewFilter.unit].filter(Boolean).map(s => s!.toUpperCase()).join(' · ') || 'Semua'}
          </span>
          <button onClick={() => setPreviewFilter({ role: '', region: '', unit: '' })} style={{
            marginLeft: 'auto', background: 'none', border: '1px solid rgba(199,125,255,0.3)',
            borderRadius: 4, color: '#C77DFF', padding: '2px 8px', fontSize: 10, cursor: 'pointer', fontWeight: 600,
          }}>✕ Reset</button>
        </div>
      )}
    </>
  )
}
