import { useState, useEffect } from 'react'
import { useAuthStore } from '../../store/authStore'
import { useStore } from '../../store/dashboardStore'
import { can, canResetPassword, canUseEmojiAvatar, UNIT_OPTIONS, ROLE_LABELS, ROLE_BADGE_COLOR, UNIT_LABELS, UNIT_BADGE_COLOR } from '../../utils/roles'
import { updateProfile, updateUserPassword } from '../../utils/supabaseClient'
import type { Role, UnitId } from '../../types'
import type { Profile } from '../../utils/supabaseClient'

interface Props { onClose: () => void }

const EMOJI_PRESETS = ['','🌸','🔥','⭐','🎯','💎','🚀','🌊','🦁','🐯','🌺','🎨','💡','🍀','🎭','🏆','🦋','🌙','☀️','🍉']

const BRANCH_OPTIONS = [
  { value: '',    label: 'Tidak ada (global)' },
  { value: 'sby', label: 'Surabaya (SBY)' },
  { value: 'dps', label: 'Denpasar (DPS)' },
  { value: 'mks', label: 'Makassar (MKS)' },
]

export default function ProfilePage({ onClose }: Props) {
  const { profile, logout, users, loadUsers, addUser, updateUser, removeUser } = useAuthStore()
  const { toast, config, setConfig } = useStore()

  const isSuperAdmin = profile?.role === 'superadmin'
  const isAdmin      = profile?.role === 'admin' || isSuperAdmin
  const canEmoji     = canUseEmojiAvatar(profile as any)
  const canPwd       = canResetPassword(profile as any)

  const [tab, setTab] = useState<'profile' | 'users' | 'settings'>('profile')
  const [saving, setSaving] = useState(false)
  const [showResetPwd, setShowResetPwd] = useState(false)
  const [newPass,  setNewPass]  = useState('')
  const [newPass2, setNewPass2] = useState('')

  // User management
  const [search,     setSearch]     = useState('')
  const [filterUnit, setFilterUnit] = useState('')
  const [filterRole, setFilterRole] = useState('')
  const [page,       setPage]       = useState(0)
  const [editTarget, setEditTarget] = useState<Profile | null>(null)
  const [editRole,   setEditRole]   = useState<Role>('user')
  const [editUnit,   setEditUnit]   = useState<UnitId>('')
  const [editBranch, setEditBranch] = useState('')
  const [editPass,   setEditPass]   = useState('')
  const [editEmoji,  setEditEmoji]  = useState('')
  const [addMode,    setAddMode]    = useState(false)
  const [newUser,    setNewUser]    = useState('')
  const [newUPass,   setNewUPass]   = useState('')
  const [newRole,    setNewRole]    = useState<Role>('user')
  const [newUnit,    setNewUnit]    = useState<UnitId>('')
  const [newBranch,  setNewBranch]  = useState('')
  const [err, setErr] = useState('')

  // Settings
  const [siteTitle,    setSiteTitle]    = useState(config.meta.title ?? '')
  const [siteSubtitle, setSiteSubtitle] = useState(config.meta.subtitle ?? '')
  const [coffeeUrl,    setCoffeeUrl]    = useState(config.meta.coffeeUrl ?? '')
  const [logoUrl,      setLogoUrl]      = useState(config.meta.logoUrl ?? '')

  const PER_PAGE = 50

  useEffect(() => {
    if (isAdmin || profile?.role === 'admin_unit') loadUsers()
  }, [])

  const getBadge = (u: Profile) => {
    if (u.role === 'superadmin') return { label: 'Super Admin', color: ROLE_BADGE_COLOR.superadmin }
    if (u.role === 'admin')      return { label: 'Admin',       color: ROLE_BADGE_COLOR.admin }
    if (u.unit_id) return { label: UNIT_LABELS[u.unit_id] ?? u.unit_id.toUpperCase(), color: UNIT_BADGE_COLOR[u.unit_id] ?? '#888' }
    return { label: 'User', color: '#888' }
  }

  const myBadge = getBadge(profile! as any)

  // Filter users
  const filteredUsers = users.filter(u => {
    const matchSearch = !search || u.username.toLowerCase().includes(search.toLowerCase())
    const matchUnit   = !filterUnit || u.unit_id === filterUnit
    const matchRole   = !filterRole || u.role === filterRole
    return matchSearch && matchUnit && matchRole
  })
  const pagedUsers = filteredUsers.slice(page * PER_PAGE, (page + 1) * PER_PAGE)
  const totalPages = Math.ceil(filteredUsers.length / PER_PAGE)

  const handleSaveProfile = async () => {
    if (showResetPwd) {
      if (newPass.length < 6)  { toast('Password min 6 karakter.', 'error'); return }
      if (newPass !== newPass2) { toast('Password tidak cocok.', 'error'); return }
      setSaving(true)
      if (profile) {
        const { error } = await updateUserPassword(profile.id, newPass) as any
        if (error) { toast('Gagal reset password.', 'error'); setSaving(false); return }
      }
      toast('Password berhasil diubah.', 'success')
      setNewPass(''); setNewPass2(''); setShowResetPwd(false)
      setSaving(false)
    }
  }

  const openEdit = (u: Profile) => {
    setEditTarget(u); setEditRole(u.role as Role)
    setEditUnit(u.unit_id); setEditBranch(u.branch_id ?? '')
    setEditPass(''); setEditEmoji(u.avatar_emoji ?? ''); setErr('')
  }

  const handleSaveUser = async () => {
    if (!editTarget) return
    setErr(''); setSaving(true)
    const error = await updateUser(editTarget.id, editRole, editRole === 'user' || editRole === 'admin_unit' ? editUnit : '', editPass || undefined, editEmoji)
    if (!error && editBranch !== undefined) {
      await updateProfile(editTarget.id, { branch_id: editBranch })
    }
    setSaving(false)
    if (error) { setErr(error); return }
    toast('User diperbarui.', 'success'); setEditTarget(null); loadUsers()
  }

  const handleAddUser = async () => {
    setErr(''); setSaving(true)
    const error = await addUser(newUser.trim(), newUPass, newRole, newRole === 'user' || newRole === 'admin_unit' ? newUnit : '')
    if (!error && newBranch) {
      const newU = users.find(u => u.username === newUser.trim())
      if (newU) await updateProfile(newU.id, { branch_id: newBranch })
    }
    setSaving(false)
    if (error) { setErr(error); return }
    toast(`"${newUser}" ditambahkan.`, 'success')
    setNewUser(''); setNewUPass(''); setNewRole('user'); setNewUnit(''); setNewBranch(''); setAddMode(false); loadUsers()
  }

  const handleSaveSettings = () => {
    const cfg = structuredClone(useStore.getState().config)
    cfg.meta.title    = siteTitle
    cfg.meta.subtitle = siteSubtitle
    cfg.meta.coffeeUrl= coffeeUrl
    cfg.meta.logoUrl  = logoUrl
    setConfig(cfg)
    toast('Settings disimpan.', 'success')
  }

  const TABS = [
    { id: 'profile',  label: '👤 Profil' },
    ...(isAdmin || profile?.role === 'admin_unit' ? [{ id: 'users', label: `👥 Users (${users.length})` }] : []),
    ...(isSuperAdmin ? [{ id: 'settings', label: '⚙️ Settings' }] : []),
  ] as const

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 500,
      background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'rgba(12,12,12,0.98)', border: '1px solid rgba(0,255,194,0.15)',
        borderRadius: 12, width: '100%', maxWidth: 600, maxHeight: '92vh',
        overflow: 'hidden', display: 'flex', flexDirection: 'column',
        boxShadow: '0 24px 60px rgba(0,0,0,0.6)',
        animation: 'scaleIn 0.2s ease',
      }}>
        {/* Header */}
        <div style={{ padding: '18px 22px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 14, background: 'rgba(0,255,194,0.02)', flexShrink: 0 }}>
          <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(0,255,194,0.1)', border: '2px solid rgba(0,255,194,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
            {(profile as any)?.avatar_url ? (
              <img src={(profile as any).avatar_url} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (profile as any)?.avatar_emoji ? (
              <span style={{ fontSize: 24 }}>{(profile as any).avatar_emoji}</span>
            ) : <span style={{ fontSize: 20 }}>👤</span>}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, color: 'var(--silver3)', marginBottom: 2 }}>Halo,</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--mint)' }}>{profile?.username}</div>
            <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 8px', borderRadius: 10, background: myBadge.color, color: '#0A0A0A', letterSpacing: '1px', textTransform: 'uppercase', fontFamily: 'var(--mono)', boxShadow: `0 0 8px ${myBadge.color}55` }}>{myBadge.label}</span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--silver3)', fontSize: 22, cursor: 'pointer', padding: 4 }}>×</button>
        </div>

        {/* Tabs */}
        {TABS.length > 1 && (
          <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id as any)} style={{
                flex: 1, padding: '10px', fontSize: 11, fontWeight: 600,
                background: tab === t.id ? 'rgba(0,255,194,0.06)' : 'none',
                border: 'none', borderBottom: `2px solid ${tab === t.id ? 'var(--mint)' : 'transparent'}`,
                color: tab === t.id ? 'var(--mint)' : 'var(--silver3)',
                cursor: 'pointer', transition: 'all .15s', fontFamily: 'var(--font)',
                textTransform: 'uppercase', letterSpacing: '.8px',
              }}>{t.label}</button>
            ))}
          </div>
        )}

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 22px' }}>

          {/* ── PROFILE TAB ── */}
          {tab === 'profile' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ fontSize: 12, color: 'var(--silver3)', lineHeight: 1.6, padding: '12px 16px', background: 'var(--bg3)', borderRadius: 8 }}>
                Untuk mengganti foto profil, klik avatar di pojok kanan atas header.
              </div>

              {/* Reset password link */}
              {!showResetPwd ? (
                <button onClick={() => setShowResetPwd(true)} style={{
                  background: 'none', border: 'none', color: 'var(--mint)',
                  fontSize: 13, cursor: 'pointer', textDecoration: 'underline',
                  textAlign: 'left', padding: 0, fontFamily: 'var(--font)',
                }}>🔑 Ganti Password</button>
              ) : (
                <div style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, padding: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--silver)', marginBottom: 12 }}>Ganti Password</div>
                  <input type="password" value={newPass} onChange={e => setNewPass(e.target.value)} placeholder="Password baru (min. 6 karakter)"
                    style={{ width: '100%', background: 'var(--bg4)', border: '1px solid var(--border2)', borderRadius: 6, padding: '9px 12px', color: 'var(--silver)', fontSize: 13, fontFamily: 'var(--font)', boxSizing: 'border-box', marginBottom: 8 }} />
                  <input type="password" value={newPass2} onChange={e => setNewPass2(e.target.value)} placeholder="Konfirmasi password baru"
                    style={{ width: '100%', background: 'var(--bg4)', border: '1px solid var(--border2)', borderRadius: 6, padding: '9px 12px', color: 'var(--silver)', fontSize: 13, fontFamily: 'var(--font)', boxSizing: 'border-box', marginBottom: 12 }} />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => { setShowResetPwd(false); setNewPass(''); setNewPass2('') }} style={{ flex: 1, padding: '8px', background: 'var(--bg4)', border: '1px solid var(--border2)', borderRadius: 6, color: 'var(--silver3)', cursor: 'pointer', fontFamily: 'var(--font)', fontSize: 12 }}>Batal</button>
                    <button onClick={handleSaveProfile} disabled={saving} style={{ flex: 2, padding: '8px', background: 'var(--mint-bg)', border: '1px solid var(--mint)', borderRadius: 6, color: 'var(--mint)', cursor: 'pointer', fontFamily: 'var(--font)', fontSize: 12, fontWeight: 700 }}>Simpan Password</button>
                  </div>
                </div>
              )}

              {/* Sign out */}
              <div style={{ marginTop: 8, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                <button onClick={() => { logout(); onClose() }} style={{
                  width: '100%', padding: '10px', background: 'rgba(224,85,85,0.08)',
                  border: '1px solid rgba(224,85,85,0.3)', borderRadius: 8,
                  color: 'var(--red)', fontSize: 13, fontWeight: 700,
                  cursor: 'pointer', fontFamily: 'var(--font)',
                }}>⏻ Sign Out</button>
              </div>
            </div>
          )}

          {/* ── USERS TAB ── */}
          {tab === 'users' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* Toolbar */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <input value={search} onChange={e => { setSearch(e.target.value); setPage(0) }} placeholder="🔍 Cari username..."
                  style={{ flex: 1, minWidth: 140, background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 6, padding: '7px 10px', color: 'var(--silver)', fontSize: 12, fontFamily: 'var(--font)' }} />
                <select value={filterUnit} onChange={e => { setFilterUnit(e.target.value); setPage(0) }}
                  style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 6, padding: '7px 8px', color: 'var(--silver)', fontSize: 12 }}>
                  <option value="">Semua Unit</option>
                  {UNIT_OPTIONS.filter(u => u.value).map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
                </select>
                <select value={filterRole} onChange={e => { setFilterRole(e.target.value); setPage(0) }}
                  style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 6, padding: '7px 8px', color: 'var(--silver)', fontSize: 12 }}>
                  <option value="">Semua Role</option>
                  <option value="user">User</option>
                  <option value="admin_unit">Admin Unit</option>
                  {isAdmin && <option value="admin">Admin</option>}
                </select>
                <button onClick={() => { setAddMode(true); setEditTarget(null); setErr('') }} style={{
                  padding: '7px 14px', background: 'var(--mint-bg)', border: '1px solid rgba(0,255,194,0.3)',
                  borderRadius: 6, color: 'var(--mint)', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font)', whiteSpace: 'nowrap',
                }}>＋ Tambah</button>
              </div>

              {/* Stats */}
              <div style={{ fontSize: 11, color: 'var(--silver3)' }}>
                {filteredUsers.length} dari {users.length} user
                {totalPages > 1 && ` · Halaman ${page + 1}/${totalPages}`}
              </div>

              {/* Add / Edit form */}
              {(addMode || editTarget) && (
                <div style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, padding: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--mint)', marginBottom: 12 }}>
                    {addMode ? 'Tambah User Baru' : `Edit: ${editTarget?.username}`}
                  </div>
                  {addMode && (
                    <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                      <div style={{ flex: 1 }}>
                        <label style={{ fontSize: 10, color: 'var(--silver3)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '1px', fontFamily: 'var(--mono)' }}>Username</label>
                        <input value={newUser} onChange={e => setNewUser(e.target.value)} placeholder="username"
                          style={{ width: '100%', background: 'var(--bg4)', border: '1px solid var(--border2)', borderRadius: 6, padding: '8px 10px', color: 'var(--silver)', fontSize: 13, fontFamily: 'var(--font)', boxSizing: 'border-box' }} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={{ fontSize: 10, color: 'var(--silver3)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '1px', fontFamily: 'var(--mono)' }}>Password</label>
                        <input type="password" value={newUPass} onChange={e => setNewUPass(e.target.value)} placeholder="min. 6 karakter"
                          style={{ width: '100%', background: 'var(--bg4)', border: '1px solid var(--border2)', borderRadius: 6, padding: '8px 10px', color: 'var(--silver)', fontSize: 13, fontFamily: 'var(--font)', boxSizing: 'border-box' }} />
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 100 }}>
                      <label style={{ fontSize: 10, color: 'var(--silver3)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '1px', fontFamily: 'var(--mono)' }}>Role</label>
                      <select value={addMode ? newRole : editRole}
                        onChange={e => addMode ? setNewRole(e.target.value as Role) : setEditRole(e.target.value as Role)}
                        disabled={!addMode && (editTarget?.role === 'superadmin' || editTarget?.id === profile?.id)}
                        style={{ width: '100%', background: 'var(--bg4)', border: '1px solid var(--border2)', borderRadius: 6, padding: '8px 10px', color: 'var(--silver)', fontSize: 12 }}>
                        <option value="user">User</option>
                        <option value="admin_unit">Admin Unit</option>
                        {isSuperAdmin && <option value="admin">Admin</option>}
                        {!addMode && editTarget?.role === 'superadmin' && <option value="superadmin">Super Admin</option>}
                      </select>
                    </div>
                    <div style={{ flex: 1, minWidth: 100 }}>
                      <label style={{ fontSize: 10, color: 'var(--silver3)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '1px', fontFamily: 'var(--mono)' }}>Unit</label>
                      <select value={addMode ? newUnit : editUnit}
                        onChange={e => addMode ? setNewUnit(e.target.value as UnitId) : setEditUnit(e.target.value as UnitId)}
                        style={{ width: '100%', background: 'var(--bg4)', border: '1px solid var(--border2)', borderRadius: 6, padding: '8px 10px', color: 'var(--silver)', fontSize: 12 }}>
                        {UNIT_OPTIONS.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
                      </select>
                    </div>
                    <div style={{ flex: 1, minWidth: 100 }}>
                      <label style={{ fontSize: 10, color: 'var(--silver3)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '1px', fontFamily: 'var(--mono)' }}>Cabang</label>
                      <select value={addMode ? newBranch : editBranch}
                        onChange={e => addMode ? setNewBranch(e.target.value) : setEditBranch(e.target.value)}
                        style={{ width: '100%', background: 'var(--bg4)', border: '1px solid var(--border2)', borderRadius: 6, padding: '8px 10px', color: 'var(--silver)', fontSize: 12 }}>
                        {BRANCH_OPTIONS.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
                      </select>
                    </div>
                  </div>

                  {!addMode && canResetPassword(profile as any) && (
                    <div style={{ marginBottom: 10 }}>
                      <label style={{ fontSize: 10, color: 'var(--silver3)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '1px', fontFamily: 'var(--mono)' }}>Reset Password</label>
                      <input type="password" value={editPass} onChange={e => setEditPass(e.target.value)} placeholder="Kosong = tidak berubah"
                        style={{ width: '100%', background: 'var(--bg4)', border: '1px solid var(--border2)', borderRadius: 6, padding: '8px 10px', color: 'var(--silver)', fontSize: 13, fontFamily: 'var(--font)', boxSizing: 'border-box' }} />
                    </div>
                  )}

                  {canUseEmojiAvatar(profile as any) && !addMode && (
                    <div style={{ marginBottom: 10 }}>
                      <label style={{ fontSize: 10, color: 'var(--silver3)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '1px', fontFamily: 'var(--mono)' }}>Avatar Emoji</label>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
                        {EMOJI_PRESETS.map(e => (
                          <div key={e} onClick={() => setEditEmoji(e)} style={{
                            width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: e ? 15 : 9, cursor: 'pointer', borderRadius: 5,
                            border: `1px solid ${editEmoji === e ? 'var(--mint)' : 'var(--border2)'}`,
                            background: editEmoji === e ? 'var(--mint-bg2)' : 'var(--bg4)',
                            transition: 'all .12s', color: e ? 'inherit' : 'var(--silver3)',
                          }}>{e || '✕'}</div>
                        ))}
                      </div>
                    </div>
                  )}

                  {err && <div style={{ color: 'var(--red)', fontSize: 12, marginBottom: 8 }}>{err}</div>}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => { setAddMode(false); setEditTarget(null); setErr('') }} style={{ flex: 1, padding: '8px', background: 'var(--bg4)', border: '1px solid var(--border2)', borderRadius: 6, color: 'var(--silver3)', cursor: 'pointer', fontFamily: 'var(--font)', fontSize: 12 }}>Batal</button>
                    <button onClick={addMode ? handleAddUser : handleSaveUser} disabled={saving} style={{ flex: 2, padding: '8px', background: 'var(--mint-bg)', border: '1px solid var(--mint)', borderRadius: 6, color: 'var(--mint)', cursor: 'pointer', fontFamily: 'var(--font)', fontSize: 12, fontWeight: 700 }}>{saving ? 'Menyimpan...' : 'Simpan'}</button>
                  </div>
                </div>
              )}

              {/* User list */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {pagedUsers.map(u => {
                  const b = getBadge(u)
                  const isMe = u.id === profile?.id
                  const adminCant = profile?.role === 'admin' && (u.role === 'admin' || u.role === 'superadmin')
                  return (
                    <div key={u.id} style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
                      background: 'var(--bg3)', border: `1px solid ${isMe ? 'rgba(0,255,194,0.2)' : 'var(--border)'}`,
                      borderRadius: 8, transition: 'border-color .15s',
                    }}>
                      <div style={{ width: 30, height: 30, borderRadius: '50%', overflow: 'hidden', background: 'var(--bg4)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {u.avatar_url ? <img src={u.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: 14 }}>{u.avatar_emoji || '👤'}</span>}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 13, color: isMe ? 'var(--mint)' : 'var(--silver)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.username}</span>
                          {isMe && <span style={{ fontSize: 9, color: 'var(--silver3)' }}>(kamu)</span>}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
                          <span style={{ fontSize: 8, fontWeight: 800, padding: '1px 6px', borderRadius: 8, background: b.color, color: '#0A0A0A', textTransform: 'uppercase', fontFamily: 'var(--mono)' }}>{b.label}</span>
                          {u.branch_id && <span style={{ fontSize: 9, color: 'var(--silver3)', fontFamily: 'var(--mono)' }}>{u.branch_id.toUpperCase()}</span>}
                        </div>
                      </div>
                      {!adminCant && (
                        <button onClick={() => openEdit(u)} style={{ background: 'var(--bg4)', border: '1px solid var(--border2)', borderRadius: 5, color: 'var(--silver3)', padding: '4px 9px', fontSize: 11, cursor: 'pointer' }}
                          onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--mint)')}
                          onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border2)')}>Edit</button>
                      )}
                      {u.role !== 'superadmin' && !isMe && !adminCant && (
                        <button onClick={async () => {
                          const err = await removeUser(u.id)
                          if (err) toast(err, 'error')
                          else { toast(`"${u.username}" dihapus.`, 'success'); loadUsers() }
                        }} style={{ background: 'none', border: 'none', color: 'var(--silver3)', cursor: 'pointer', fontSize: 14, padding: '2px 4px' }}
                          onMouseEnter={e => (e.currentTarget.style.color = 'var(--red)')}
                          onMouseLeave={e => (e.currentTarget.style.color = 'var(--silver3)')}>🗑</button>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 8 }}>
                  <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                    style={{ padding: '5px 12px', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 5, color: page === 0 ? 'var(--silver3)' : 'var(--silver)', cursor: page === 0 ? 'not-allowed' : 'pointer', fontSize: 12 }}>← Prev</button>
                  {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                    const p = totalPages <= 7 ? i : Math.max(0, Math.min(page - 3, totalPages - 7)) + i
                    return (
                      <button key={p} onClick={() => setPage(p)} style={{ padding: '5px 10px', background: p === page ? 'var(--mint-bg2)' : 'var(--bg3)', border: `1px solid ${p === page ? 'var(--mint)' : 'var(--border2)'}`, borderRadius: 5, color: p === page ? 'var(--mint)' : 'var(--silver)', cursor: 'pointer', fontSize: 12 }}>{p + 1}</button>
                    )
                  })}
                  <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
                    style={{ padding: '5px 12px', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 5, color: page >= totalPages - 1 ? 'var(--silver3)' : 'var(--silver)', cursor: page >= totalPages - 1 ? 'not-allowed' : 'pointer', fontSize: 12 }}>Next →</button>
                </div>
              )}
            </div>
          )}

          {/* ── SETTINGS TAB (superadmin) ── */}
          {tab === 'settings' && isSuperAdmin && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ fontSize: 11, color: 'var(--silver3)' }}>Pengaturan global aplikasi — hanya superadmin</div>
              {[
                { label: 'Site Title', val: siteTitle, set: setSiteTitle, ph: 'JateamHub' },
                { label: 'Subtitle / Greeting', val: siteSubtitle, set: setSiteSubtitle, ph: 'Selamat datang, {username}' },
                { label: 'Logo URL', val: logoUrl, set: setLogoUrl, ph: 'https://...' },
                { label: 'Coffee / Donasi URL', val: coffeeUrl, set: setCoffeeUrl, ph: 'https://trakteer.id/...' },
              ].map(f => (
                <div key={f.label}>
                  <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--silver3)', textTransform: 'uppercase', letterSpacing: '1px', display: 'block', marginBottom: 6, fontFamily: 'var(--mono)' }}>{f.label}</label>
                  <input value={f.val} onChange={e => f.set(e.target.value)} placeholder={f.ph}
                    style={{ width: '100%', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 6, padding: '9px 12px', color: 'var(--silver)', fontSize: 13, fontFamily: 'var(--font)', boxSizing: 'border-box' }} />
                </div>
              ))}
              <button onClick={handleSaveSettings} style={{
                padding: '10px', background: 'var(--mint-bg)', border: '1px solid var(--mint)',
                borderRadius: 8, color: 'var(--mint)', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font)',
              }}>💾 Simpan Settings</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
