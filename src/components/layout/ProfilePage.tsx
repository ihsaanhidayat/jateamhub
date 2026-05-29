import { useState, useEffect } from 'react'
import { useAuthStore } from '../../store/authStore'
import { useStore } from '../../store/dashboardStore'
import { supabase } from '../../utils/supabaseClient'
import { REGION_LABELS, UNIT_LABELS, canManageUser, getDisplayBadge } from '../../utils/roles'
import type { Role } from '../../types'
import { REGIONS, UNITS } from '../../types'
import { updateProfile } from '../../utils/supabaseClient'
import type { Profile } from '../../utils/supabaseClient'
import { useUserManagement, EMOJI_PRESETS } from '../../hooks/useUserManagement'

// ── Detail Info — collapsible ─────────────────────────────────
function DetailInfo({ profile }: { profile: any }) {
  const [open, setOpen] = useState(false)
  const rows = [
    { label: 'Username', value: `@${profile?.username}` },
    { label: 'Wilayah', value: REGION_LABELS[profile?.region_scope] ?? profile?.region_scope ?? '—' },
    { label: 'Unit', value: UNIT_LABELS[profile?.unit_scope] ?? profile?.unit_scope ?? '—' },
    { label: 'Role', value: profile?.role ?? '—' },
  ]
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
      <button onClick={() => setOpen(v => !v)} style={{
        width: '100%', padding: '11px 14px', background: 'var(--bg4)',
        border: 'none', cursor: 'pointer', display: 'flex',
        alignItems: 'center', justifyContent: 'space-between',
        fontFamily: 'var(--font)',
      }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--silver2)' }}>Detail Akun</span>
        <span style={{ fontSize: 11, color: 'var(--silver4)', transition: 'transform 150ms', transform: open ? 'rotate(180deg)' : 'none', display: 'inline-block' }}>▾</span>
      </button>
      {open && (
        <div style={{ borderTop: '1px solid var(--border)' }}>
          {rows.map((r, i) => (
            <div key={r.label} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '9px 14px', background: i % 2 === 0 ? 'var(--bg4)' : 'var(--bg2)',
              fontSize: 13,
            }}>
              <span style={{ color: 'var(--silver3)', fontSize: 11, fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{r.label}</span>
              <span style={{ color: 'var(--silver)', fontWeight: 500 }}>{r.value}</span>
            </div>
          ))}
          <div style={{ padding: '8px 14px', background: 'var(--bg4)', borderTop: '1px solid var(--border)', fontSize: 11, color: 'var(--silver4)' }}>
            🔒 Username, wilayah, dan unit tidak dapat diubah. Hubungi Admin.
          </div>
        </div>
      )}
    </div>
  )
}

// ── Ganti Password Mandiri ────────────────────────────────────
function ChangePasswordSection({ profileId, username }: { profileId?: string, username?: string }) {
  const [open, setOpen] = useState(false)
  const [oldPw, setOldPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const handleChange = async () => {
    if (!oldPw) return setErr('Masukkan password lama.')
    if (!newPw || newPw.length < 6) return setErr('Password baru minimal 6 karakter.')
    if (newPw !== confirmPw) return setErr('Konfirmasi password tidak cocok.')
    if (oldPw === newPw) return setErr('Password baru harus berbeda dari password lama.')
    setLoading(true); setErr('')
    try {
      // Verifikasi password lama
      const email = `${username}@jateamhub.app`
      const { error: verifyErr } = await supabase.auth.signInWithPassword({ email, password: oldPw })
      if (verifyErr) { setErr('Password lama salah.'); setLoading(false); return }

      // Ganti password
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('https://qsvrqdnyjywjzxkqwszl.supabase.co/functions/v1/update-user-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ userId: profileId, newPassword: newPw, forceChange: false })
      })
      const data = await res.json()
      if (!res.ok || data.error) { setErr(data.error ?? 'Gagal ganti password.'); setLoading(false); return }
      setDone(true)
      setTimeout(() => { setOpen(false); setDone(false); setOldPw(''); setNewPw(''); setConfirmPw('') }, 2000)
    } catch { setErr('Koneksi gagal. Coba lagi.') }
    setLoading(false)
  }

  const inputSt: React.CSSProperties = {
    width: '100%', height: 40, background: 'var(--bg2)',
    border: '1px solid var(--border2)', borderRadius: 'var(--radius-sm)',
    padding: '0 14px', color: 'var(--silver)', fontSize: 13,
    fontFamily: 'var(--font)', outline: 'none', boxSizing: 'border-box',
  }

  return (
    <div>
      {!open ? (
        <button onClick={() => setOpen(true)} style={{
          width: '100%', padding: '10px 14px', background: 'none',
          border: '1px solid var(--border2)', borderRadius: 'var(--radius)',
          color: 'var(--silver3)', fontSize: 12, cursor: 'pointer',
          fontFamily: 'var(--font)', textAlign: 'left',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>🔑 Ganti Password</button>
      ) : (
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 'var(--radius)', padding: 'var(--sp-4)' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--silver)', marginBottom: 12 }}>🔑 Ganti Password</div>
          {done ? (
            <div style={{ textAlign: 'center', padding: '12px 0', color: 'var(--green, #16A34A)', fontSize: 13, fontWeight: 600 }}>✅ Password berhasil diganti!</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ position: 'relative' }}>
                <input type={showPw ? 'text' : 'password'} value={oldPw} onChange={e => { setOldPw(e.target.value); setErr('') }} placeholder="Password lama" style={{ ...inputSt, paddingRight: 40 }} />
                <button type="button" onClick={() => setShowPw(v => !v)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--silver3)', fontSize: 13 }}>{showPw ? '🙈' : '👁'}</button>
              </div>
              <input type={showPw ? 'text' : 'password'} value={newPw} onChange={e => { setNewPw(e.target.value); setErr('') }} placeholder="Password baru (min. 6 karakter)" style={inputSt} />
              <input type={showPw ? 'text' : 'password'} value={confirmPw} onChange={e => { setConfirmPw(e.target.value); setErr('') }} placeholder="Konfirmasi password baru" style={inputSt} />
              {err && <div style={{ color: 'var(--red)', fontSize: 12 }}>{err}</div>}
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => { setOpen(false); setOldPw(''); setNewPw(''); setConfirmPw(''); setErr('') }} style={{ flex: 1, height: 36, background: 'none', border: '1px solid var(--border2)', borderRadius: 'var(--radius-sm)', color: 'var(--silver3)', fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font)' }}>Batal</button>
                <button onClick={handleChange} disabled={loading} style={{ flex: 2, height: 36, background: 'var(--accent)', border: 'none', borderRadius: 'var(--radius-sm)', color: 'white', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font)', opacity: loading ? 0.6 : 1 }}>{loading ? 'Menyimpan...' : 'Simpan'}</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

interface Props { onClose: () => void }

export default function ProfilePage({ onClose }: Props) {
  const { profile } = useAuthStore()
  const { toast } = useStore()

  const um = useUserManagement()
  const { canManage, isSuperAdmin } = um

  const [showAvatarMenu, setShowAvatarMenu] = useState(false)
  const [showAvatarPreview, setShowAvatarPreview] = useState(false)

  // Tutup avatar menu saat klik di luar
  useEffect(() => {
    if (!showAvatarMenu) return
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('[data-avatar-area]')) setShowAvatarMenu(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showAvatarMenu])
  const [siteTitle, setSiteTitle] = useState('')
  const [siteSubtitle, setSiteSubtitle] = useState('')
  const [coffeeUrl, setCoffeeUrl] = useState('')
  const [logoUrl, setLogoUrl] = useState('')

  const handleSaveSettings = async () => {
    // Simpan settings ke dashboard_config di Supabase
    const { supabase } = await import('../../utils/supabaseClient')
    const CONFIG_ID = '00000000-0000-0000-0000-000000000001'
    const { data } = await supabase.from('dashboard_config').select('config').eq('id', CONFIG_ID).single()
    const cfg = (data?.config ?? {}) as Record<string, unknown>
    cfg.title = siteTitle
    cfg.subtitle = siteSubtitle
    cfg.coffeeUrl = coffeeUrl
    cfg.logoUrl = logoUrl
    await supabase.from('dashboard_config').update({ config: cfg }).eq('id', CONFIG_ID)
    toast('Settings disimpan.', 'success')
  }

  const TABS = [
    { id: 'profile', label: '👤 Profil Saya' },
    ...(canManage ? [{ id: 'users', label: `👥 User Management (${um.users.length})` }] : []),
    ...(isSuperAdmin ? [{ id: 'settings', label: '⚙️ Settings' }] : []),
  ] as const

  const [tabState, setTabState] = useState<'profile' | 'users' | 'settings'>('profile')

  // Edit nama lengkap
  const [editingName, setEditingName] = useState(false)
  const [nameValue, setNameValue] = useState(profile?.full_name || '')
  const [nameSaving, setNameSaving] = useState(false)

  const handleSaveName = async () => {
    if (!profile || !nameValue.trim()) return
    setNameSaving(true)
    try {
      const parts = nameValue.trim().split(' ').filter(Boolean)
      const initials = parts.length >= 2
        ? (parts[0][0] + parts[1][0]).toUpperCase()
        : nameValue.slice(0, 2).toUpperCase()
      await updateProfile(profile.id, { full_name: nameValue.trim(), initials } as any)
      useAuthStore.setState(s => ({
        profile: s.profile ? { ...s.profile, full_name: nameValue.trim() } : s.profile
      }))
      setEditingName(false)
      toast('Nama berhasil diperbarui.', 'success')
    } catch {
      toast('Gagal menyimpan nama. Coba lagi.', 'error')
    } finally {
      setNameSaving(false)
    }
  }

  const badge = profile ? getDisplayBadge(profile as any) : null

  const inputStyle: React.CSSProperties = {
    width: '100%', background: 'var(--bg3)', border: '1px solid var(--border2)',
    borderRadius: 'var(--radius-sm)', padding: '8px 10px', color: 'var(--silver)', fontSize: 12,
    fontFamily: 'var(--font)', boxSizing: 'border-box',
  }
  const selectStyle: React.CSSProperties = { ...inputStyle, appearance: 'auto' }
  const labelStyle: React.CSSProperties = {
    fontSize: 10, color: 'var(--silver3)', display: 'block', marginBottom: 4,
    textTransform: 'uppercase', letterSpacing: '1px', fontFamily: 'var(--mono)',
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9000 /* overlay */,
      background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--sp-4)',
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--bg3)', border: '1px solid var(--border2)',
        borderRadius: 'var(--radius-xl)', width: '100%', maxWidth: 680, maxHeight: '92vh',
        overflow: 'hidden', display: 'flex', flexDirection: 'column',
        boxShadow: '0 24px 60px rgba(0,0,0,0.15)',
        animation: 'scaleIn 200ms var(--ease)',
      }}>
        {/* Header */}
        <div style={{
          padding: 'var(--sp-4) var(--sp-5)',
          borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', flexShrink: 0,
        }}>
          <div style={{ flex: 1, fontSize: 14, fontWeight: 700, color: 'var(--silver)' }}>
            Akun — {profile?.username}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
            <button
              onClick={() => { useAuthStore.getState().logout(); onClose() }}
              style={{
                height: 36, padding: '0 var(--sp-3)',
                background: 'rgba(239,68,68,0.08)',
                border: '1px solid rgba(239,68,68,0.25)', borderRadius: 'var(--radius-sm)',
                color: 'var(--red)', fontSize: 12, fontWeight: 700,
                cursor: 'pointer', fontFamily: 'var(--font)',
              }}>⏻ Sign Out</button>
            <button onClick={onClose} className="close-btn">×</button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTabState(t.id as any)} style={{
              flex: 1, height: 44, fontSize: 11, fontWeight: 600,
              background: 'none',
              border: 'none', borderBottom: `2px solid ${tabState === t.id ? 'var(--accent)' : 'transparent'}`,
              color: tabState === t.id ? 'var(--accent)' : 'var(--silver3)',
              cursor: 'pointer', transition: 'all 150ms var(--ease)', fontFamily: 'var(--font)',
              textTransform: 'uppercase', letterSpacing: '.8px',
            }}>{t.label}</button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--sp-5)' }}>

          {/* ── PROFILE TAB ── */}
          {tabState === 'profile' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* ── Avatar + identitas utama ── */}
              <div data-avatar-area style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <div onClick={() => setShowAvatarMenu(v => !v)} style={{
                    width: 60, height: 60, borderRadius: '50%', cursor: 'pointer',
                    background: 'var(--accent-light)', border: '2px solid var(--border2)',
                    overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 20, color: 'var(--accent)', fontWeight: 700,
                    transition: 'border-color 150ms',
                  }}>
                    {profile?.avatar_url
                      ? <img src={profile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : (profile?.full_name?.split(' ').map((n: string) => n[0]).slice(0, 2).join('') ?? profile?.username?.slice(0, 2) ?? '?').toUpperCase()
                    }
                  </div>
                  {showAvatarMenu && (
                    <div style={{
                      position: 'absolute', top: 68, left: 0, zIndex: 100,
                      background: 'var(--bg2)', border: '1px solid var(--border2)',
                      borderRadius: 10, boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
                      minWidth: 140, overflow: 'hidden',
                    }}>
                      {profile?.avatar_url && (
                        <button onClick={() => { setShowAvatarMenu(false); setShowAvatarPreview(true) }}
                          style={{ width: '100%', padding: '10px 14px', background: 'none', border: 'none', borderBottom: '1px solid var(--border)', textAlign: 'left', fontSize: 12, color: 'var(--silver2)', cursor: 'pointer', fontFamily: 'var(--font)' }}>
                          👁 Lihat Foto
                        </button>
                      )}
                      <label htmlFor="profile-tab-avatar" style={{ display: 'block', padding: '10px 14px', fontSize: 12, color: 'var(--silver2)', cursor: 'pointer', fontFamily: 'var(--font)' }}>
                        ✏️ Ganti Foto
                        <input id="profile-tab-avatar" type="file" accept="image/*" style={{ display: 'none' }}
                          onChange={e => {
                            const file = e.target.files?.[0]; if (!file) return; e.target.value = ''
                            setShowAvatarMenu(false)
                            const reader = new FileReader()
                            reader.onload = ev => { const d = ev.target?.result as string; if (d) { window.dispatchEvent(new CustomEvent('avatar-upload', { detail: d })); onClose() } }
                            reader.readAsDataURL(file)
                          }} />
                      </label>
                    </div>
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--silver)' }}>
                      {profile?.full_name || profile?.username}
                    </span>
                    {badge && (
                      <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: 99, background: badge.color, color: '#0A0A0A', fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        {badge.label}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--silver3)', marginTop: 3 }}>@{profile?.username}</div>
                </div>
              </div>

              {/* ── Nama Lengkap — editable ── */}
              <div style={{ background: 'var(--bg4)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--silver4)', fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 8 }}>
                  Nama Lengkap
                </div>
                {editingName ? (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input value={nameValue} onChange={e => setNameValue(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') setEditingName(false) }}
                      autoFocus style={{ ...inputStyle, flex: 1 }} />
                    <button onClick={handleSaveName} disabled={nameSaving} style={{ height: 36, padding: '0 14px', background: 'var(--accent)', border: 'none', borderRadius: 8, color: 'white', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                      {nameSaving ? '...' : 'Simpan'}
                    </button>
                    <button onClick={() => setEditingName(false)} style={{ height: 36, padding: '0 10px', background: 'none', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--silver3)', cursor: 'pointer' }}>✕</button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 14, color: 'var(--silver)', fontWeight: 500 }}>
                      {profile?.full_name || <span style={{ color: 'var(--silver4)', fontStyle: 'italic' }}>Belum diisi</span>}
                    </span>
                    <button onClick={() => { setNameValue(profile?.full_name || ''); setEditingName(true) }}
                      style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: 12, cursor: 'pointer', fontWeight: 600, fontFamily: 'var(--font)' }}>
                      Edit
                    </button>
                  </div>
                )}
              </div>

              {/* ── Ganti Password — langsung terlihat ── */}
              <ChangePasswordSection profileId={profile?.id} username={profile?.username} />

              {/* ── Detail info — collapsible ── */}
              <DetailInfo profile={profile} />

              {/* Preview foto fullscreen */}
              {showAvatarPreview && profile?.avatar_url && (
                <div onClick={() => setShowAvatarPreview(false)} style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-out' }}>
                  <img src={profile.avatar_url} alt="Foto profil" style={{ maxWidth: '85vw', maxHeight: '85vh', borderRadius: 16 }} />
                  <button onClick={() => setShowAvatarPreview(false)} style={{ position: 'absolute', top: 20, right: 20, width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white', fontSize: 18, cursor: 'pointer' }}>✕</button>
                </div>
              )}
            </div>
          )}

          {/* ── USERS TAB ── */}
          {tabState === 'users' && canManage && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* Filters */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                <input value={um.search} onChange={e => { um.setSearch(e.target.value); um.setPage(0) }} placeholder="🔍 Cari username / nama..."
                  style={{ ...inputStyle, flex: 1, minWidth: 140 }} />
                <select value={um.filterRegion} onChange={e => { um.setFilterRegion(e.target.value); um.setPage(0) }} style={{ ...selectStyle, flex: 'none', width: 'auto' }}>
                  <option value="">Semua Wilayah</option>
                  {um.allowedRegions.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
                <select value={um.filterUnit} onChange={e => { um.setFilterUnit(e.target.value); um.setPage(0) }} style={{ ...selectStyle, flex: 'none', width: 'auto' }}>
                  <option value="">Semua Unit</option>
                  {(UNITS as readonly { label: string; value: string }[]).map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
                </select>
                <select value={um.filterRole} onChange={e => { um.setFilterRole(e.target.value); um.setPage(0) }} style={{ ...selectStyle, flex: 'none', width: 'auto' }}>
                  <option value="">Semua Role</option>
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                  {isSuperAdmin && <option value="superadmin">Superadmin</option>}
                </select>
                <button onClick={() => { um.openAdd() }} style={{
                  padding: '7px 14px', background: 'var(--accent-light)', border: '1px solid var(--accent-glow)',
                  borderRadius: 6, color: 'var(--accent)', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font)', whiteSpace: 'nowrap',
                }}>＋ Tambah</button>
              </div>

              <div style={{ fontSize: 11, color: 'var(--silver3)' }}>
                {um.filteredUsers.length} dari {um.users.length} user
                {um.totalPages > 1 && ` · Hal. ${um.page + 1}/${um.totalPages}`}
              </div>

              {/* Add / Edit form */}
              {(um.addMode || um.editTarget) && (
                <div style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, padding: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)', marginBottom: 14 }}>
                    {um.addMode ? '＋ Tambah User Baru' : `✏️ Edit: ${um.editTarget?.username}${um.editEmoji ? ' ' + um.editEmoji : ''}`}
                  </div>

                  {um.addMode && (
                    <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                      <div style={{ flex: 1 }}>
                        <label style={labelStyle}>Username</label>
                        <input value={um.newUser} onChange={e => um.setNewUser(e.target.value)} placeholder="username" style={inputStyle} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={labelStyle}>Password</label>
                        <input type="password" value={um.newUPass} onChange={e => um.setNewUPass(e.target.value)} placeholder="min. 6 karakter" style={inputStyle} />
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 100 }}>
                      <label style={labelStyle}>Role</label>
                      <select value={um.addMode ? um.newRole : um.editRole}
                        onChange={e => um.addMode ? um.setNewRole(e.target.value as Role) : um.setEditRole(e.target.value as Role)}
                        disabled={!um.addMode && (um.editTarget?.role === 'superadmin' || um.editTarget?.id === profile?.id)}
                        style={selectStyle}>
                        {um.allowedRoles.map(r => <option key={r} value={r}>{r}</option>)}
                        {!um.addMode && um.editTarget?.role === 'superadmin' && <option value="superadmin">superadmin</option>}
                      </select>
                    </div>
                    <div style={{ flex: 1, minWidth: 100 }}>
                      <label style={labelStyle}>Wilayah</label>
                      <select value={um.addMode ? um.newRegion : um.editRegion}
                        onChange={e => um.addMode ? um.setNewRegion(e.target.value) : um.setEditRegion(e.target.value)}
                        style={selectStyle}>
                        {um.allowedRegions.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                      </select>
                    </div>
                    <div style={{ flex: 1, minWidth: 100 }}>
                      <label style={labelStyle}>Unit</label>
                      <select value={um.addMode ? um.newUnitScope : um.editUnitScope}
                        onChange={e => { if (um.addMode) { um.setNewUnitScope(e.target.value); um.setNewUnitId(e.target.value) } else { um.setEditUnitScope(e.target.value); um.setEditUnit(e.target.value) } }}
                        style={selectStyle}>
                        {um.allowedUnits.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* Reset password — hanya saat edit */}
                  {!um.addMode && profile?.role === 'admin' || profile?.role === 'superadmin' && (
                    <div style={{ marginBottom: 10 }}>
                      <label style={labelStyle}>Reset Password (kosong = tidak berubah)</label>
                      <input type="password" value={um.editPass} onChange={e => um.setEditPass(e.target.value)} placeholder="Password baru min. 6 karakter" style={inputStyle} />
                    </div>
                  )}

                  {/* Email — untuk OTP reset password */}
                  <div style={{ marginBottom: 10 }}>
                    <label style={labelStyle}>Email {um.addMode ? '*' : '(untuk reset password)'}</label>
                    <input
                      type="email"
                      value={um.addMode ? um.newEmail : um.editEmail}
                      onChange={e => um.addMode ? um.setNewEmail(e.target.value) : um.setEditEmail(e.target.value)}
                      placeholder="user@email.com"
                      style={inputStyle}
                    />
                  </div>

                  {/* Emoji — admin ke atas saja */}
                  {!um.addMode && (profile?.role === 'superadmin' || profile?.role === 'admin') && (
                    <div style={{ marginBottom: 10 }}>
                      <label style={labelStyle}>Emoji (tampil di samping nama)</label>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
                        {EMOJI_PRESETS.map(e => (
                          <div key={e} onClick={() => um.setEditEmoji(e)} style={{
                            width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: e ? 14 : 9, cursor: 'pointer', borderRadius: 5,
                            border: `1px solid ${um.editEmoji === e ? 'var(--accent)' : 'var(--border2)'}`,
                            background: um.editEmoji === e ? 'var(--accent-soft)' : 'var(--bg4)',
                            transition: 'all .12s', color: e ? 'inherit' : 'var(--silver3)',
                          }}>{e || '✕'}</div>
                        ))}
                      </div>
                    </div>
                  )}

                  {um.err && <div style={{ color: 'var(--red)', fontSize: 12, marginBottom: 8 }}>{um.err}</div>}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => { um.setAddMode(false); um.setErr('') }}
                      style={{ flex: 1, padding: '8px', background: 'var(--bg4)', border: '1px solid var(--border2)', borderRadius: 6, color: 'var(--silver3)', cursor: 'pointer', fontFamily: 'var(--font)', fontSize: 12 }}>Batal</button>
                    <button onClick={um.addMode ? um.handleAddUser : um.handleSaveUser} disabled={um.saving}
                      style={{ flex: 2, padding: '8px', background: 'var(--accent-light)', border: '1px solid var(--accent)', borderRadius: 6, color: 'var(--accent)', cursor: 'pointer', fontFamily: 'var(--font)', fontSize: 12, fontWeight: 700 }}>
                      {um.saving ? 'Menyimpan...' : 'Simpan'}
                    </button>
                  </div>
                </div>
              )}

              {/* User list */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {um.pagedUsers.map(u => {
                  const b = um.getBadge(u)
                  const isMe = u.id === profile?.id
                  // Pastikan field scope tersedia untuk permission check
                  const currentUser = { ...profile, region_scope: (profile as any).region_scope ?? 'global', unit_scope: (profile as any).unit_scope ?? 'general' }
                  const targetUser = { ...u, region_scope: u.region_scope ?? 'global', unit_scope: u.unit_scope ?? 'general' }
                  const canEdit_ = canManageUser(currentUser as any, targetUser as any)
                  const region = REGION_LABELS[u.region_scope ?? 'global'] ?? u.region_scope
                  const unit = UNIT_LABELS[u.unit_scope ?? 'general'] ?? u.unit_scope
                  const emoji_ = u.emoji || u.avatar_emoji || ''

                  return (
                    <div key={u.id} style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
                      background: 'var(--bg3)', border: `1px solid ${isMe ? 'var(--accent-glow)' : 'var(--border)'}`,
                      borderRadius: 8,
                    }}>
                      {/* Avatar */}
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--bg4)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                        {u.avatar_url ? <img src={u.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: 16 }}>👤</span>}
                      </div>

                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: isMe ? 'var(--accent)' : 'var(--silver)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {u.username}{emoji_ ? ` ${emoji_}` : ''}{isMe && <span style={{ fontSize: 10, color: 'var(--silver3)', marginLeft: 5 }}>(kamu)</span>}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 8, fontWeight: 800, padding: '1px 6px', borderRadius: 8, background: b.color, color: '#0A0A0A', textTransform: 'uppercase', fontFamily: 'var(--mono)' }}>{b.label}</span>
                          {region && region !== 'Global' && <span style={{ fontSize: 10, color: 'var(--silver3)', fontFamily: 'var(--mono)' }}>{region}</span>}
                          {unit && unit !== 'General' && <span style={{ fontSize: 10, color: 'var(--silver3)', fontFamily: 'var(--mono)' }}>· {unit}</span>}
                        </div>
                      </div>

                      {/* Actions */}
                      {canEdit_ && (
                        <button onClick={() => um.openEdit(u)}
                          style={{ background: 'var(--bg4)', border: '1px solid var(--border2)', borderRadius: 5, color: 'var(--silver3)', padding: '4px 9px', fontSize: 11, cursor: 'pointer' }}
                          onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
                          onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border2)')}>Edit</button>
                      )}
                      {canEdit_ && u.role !== 'superadmin' && !isMe && (
                        <button onClick={async () => {
                          um.handleDeleteUser(u.id, u.username)
                        }} style={{ background: 'none', border: 'none', color: 'var(--silver3)', cursor: 'pointer', fontSize: 14, padding: '2px 4px' }}
                          onMouseEnter={e => (e.currentTarget.style.color = 'var(--red)')}
                          onMouseLeave={e => (e.currentTarget.style.color = 'var(--silver3)')}>🗑</button>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Pagination */}
              {um.totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: 5, marginTop: 8 }}>
                  <button onClick={() => um.setPage(p => Math.max(0, p - 1))} disabled={um.page === 0}
                    style={{ padding: '5px 12px', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 5, color: um.page === 0 ? 'var(--silver3)' : 'var(--silver)', cursor: um.page === 0 ? 'not-allowed' : 'pointer', fontSize: 12 }}>← Prev</button>
                  {Array.from({ length: Math.min(um.totalPages, 7) }, (_, i) => {
                    const p = um.totalPages <= 7 ? i : Math.max(0, Math.min(um.page - 3, um.totalPages - 7)) + i
                    return <button key={p} onClick={() => um.setPage(p)} style={{ padding: '5px 10px', background: p === um.page ? 'var(--accent-soft)' : 'var(--bg3)', border: `1px solid ${p === um.page ? 'var(--accent)' : 'var(--border2)'}`, borderRadius: 5, color: p === um.page ? 'var(--accent)' : 'var(--silver)', cursor: 'pointer', fontSize: 12 }}>{p + 1}</button>
                  })}
                  <button onClick={() => um.setPage(p => Math.min(um.totalPages - 1, p + 1))} disabled={um.page >= um.totalPages - 1}
                    style={{ padding: '5px 12px', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 5, color: um.page >= um.totalPages - 1 ? 'var(--silver3)' : 'var(--silver)', cursor: um.page >= um.totalPages - 1 ? 'not-allowed' : 'pointer', fontSize: 12 }}>Next →</button>
                </div>
              )}
            </div>
          )}

          {/* ── TAMPILAN TAB ── */}
          {/* ── SETTINGS TAB ── */}
          {tabState === 'settings' && isSuperAdmin && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ fontSize: 11, color: 'var(--silver3)', marginBottom: 4 }}>Pengaturan global — hanya superadmin</div>
              {[
                { label: 'Site Title', val: siteTitle, set: setSiteTitle, ph: 'JateamHub' },
                { label: 'Subtitle / Greeting', val: siteSubtitle, set: setSiteSubtitle, ph: 'Selamat datang, {username}' },
                { label: 'Logo URL', val: logoUrl, set: setLogoUrl, ph: 'https://...' },
                { label: 'Coffee / Donasi URL', val: coffeeUrl, set: setCoffeeUrl, ph: 'https://trakteer.id/...' },
              ].map(f => (
                <div key={f.label}>
                  <label style={{ ...labelStyle, fontWeight: 700 }}>{f.label}</label>
                  <input value={f.val} onChange={e => f.set(e.target.value)} placeholder={f.ph} style={inputStyle} />
                </div>
              ))}
              <button onClick={handleSaveSettings} style={{
                padding: '10px', background: 'var(--accent-light)', border: '1px solid var(--accent)',
                borderRadius: 8, color: 'var(--accent)', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font)',
              }}>💾 Simpan Settings</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
