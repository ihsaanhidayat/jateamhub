import { useState, useEffect, useRef } from 'react'
import { useAuthStore } from '../../store/authStore'
import { useStore } from '../../store/dashboardStore'
import { can, canResetPassword, canSelfPassword, canUseEmojiAvatar, UNIT_OPTIONS, ROLE_LABELS, ROLE_BADGE_COLOR, UNIT_LABELS, UNIT_BADGE_COLOR } from '../../utils/roles'
import { updateProfile, uploadAvatar } from '../../utils/supabaseClient'
import type { Role, UnitId } from '../../types'
import type { Profile } from '../../utils/supabaseClient'

interface Props { onClose: () => void }

const EMOJI_PRESETS = ['','🌸','🔥','⭐','🎯','💎','🚀','🌊','🦁','🐯','🌺','🎨','💡','🍀','🎭','🏆','🦋','🌙','☀️','🍉']

export default function ProfilePage({ onClose }: Props) {
  const { profile, logout, users, loadUsers, addUser, updateUser, removeUser } = useAuthStore()
  const { toast, config } = useStore()

  const isSuperAdmin = profile?.role === 'superadmin'
  const isAdmin      = profile?.role === 'admin' || isSuperAdmin
  const canEmoji     = canUseEmojiAvatar(profile as any)
  const canPwd       = canSelfPassword(profile as any)
  const canManageAll = isAdmin

  const [tab, setTab] = useState<'profile' | 'users' | 'settings'>('profile')
  const [saving, setSaving] = useState(false)

  // Profile fields
  const [avatarEmoji, setAvatarEmoji] = useState(profile?.avatar_emoji ?? '')
  const [avatarPreview, setAvatarPreview] = useState(profile?.avatar_url ?? '')
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [newPass, setNewPass]   = useState('')
  const [newPass2, setNewPass2] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  // User management
  const [editTarget, setEditTarget] = useState<Profile | null>(null)
  const [editRole,   setEditRole]   = useState<Role>('user')
  const [editUnit,   setEditUnit]   = useState<UnitId>('')
  const [editPass,   setEditPass]   = useState('')
  const [editEmoji,  setEditEmoji]  = useState('')
  const [addMode,    setAddMode]    = useState(false)
  const [newUser,    setNewUser]    = useState('')
  const [newUPass,   setNewUPass]   = useState('')
  const [newRole,    setNewRole]    = useState<Role>('user')
  const [newUnit,    setNewUnit]    = useState<UnitId>('')
  const [err, setErr] = useState('')

  // AppConfig (superadmin)
  const [siteTitle,   setSiteTitle]   = useState(config.meta.title ?? '')
  const [siteSubtitle,setSiteSubtitle]= useState(config.meta.subtitle ?? '')
  const [coffeeUrl,   setCoffeeUrl]   = useState(config.meta.coffeeUrl ?? '')
  const [logoUrl,     setLogoUrl]     = useState(config.meta.logoUrl ?? '')

  useEffect(() => {
    if (isAdmin || profile?.role === 'admin_unit') loadUsers()
  }, [])

  const getBadge = (u: Profile) => {
    if (u.role !== 'user' && u.role !== 'admin_unit') return { label: ROLE_LABELS[u.role as Role], color: ROLE_BADGE_COLOR[u.role as Role] }
    if (u.unit_id) return { label: UNIT_LABELS[u.unit_id] ?? u.unit_id.toUpperCase(), color: UNIT_BADGE_COLOR[u.unit_id] ?? '#888' }
    return { label: 'User', color: '#888' }
  }

  const myBadge = getBadge(profile! as any)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarFile(file)
    const url = URL.createObjectURL(file)
    setAvatarPreview(url)
  }

  const handleSaveProfile = async () => {
    if (newPass && newPass.length < 6)  { toast('Password min 6 karakter.', 'error'); return }
    if (newPass && newPass !== newPass2) { toast('Password tidak cocok.', 'error'); return }
    setSaving(true)
    try {
      // Upload foto
      let avatarUrl = profile?.avatar_url ?? ''
      if (avatarFile && profile) {
        const blob = await compressImage(avatarFile)
        const url  = await uploadAvatar(profile.id, blob)
        if (url) { avatarUrl = url; setAvatarPreview(url) }
      }
      // Update profile
      if (profile) {
        const updates: Partial<Profile> = { avatar_url: avatarUrl }
        if (canEmoji) updates.avatar_emoji = avatarEmoji
        await updateProfile(profile.id, updates)
      }
      // Update password
      if (newPass && canPwd && profile) {
        await updateUser(profile.id, profile.role as Role, profile.unit_id, newPass)
      }
      toast('Profil diperbarui.', 'success')
      setNewPass(''); setNewPass2(''); setAvatarFile(null)
    } catch {
      toast('Gagal menyimpan profil.', 'error')
    }
    setSaving(false)
  }

  const handleSaveSettings = () => {
    const { setConfig } = useStore.getState()
    const cfg = structuredClone(useStore.getState().config)
    cfg.meta.title    = siteTitle
    cfg.meta.subtitle = siteSubtitle
    cfg.meta.coffeeUrl= coffeeUrl
    cfg.meta.logoUrl  = logoUrl
    setConfig(cfg)
    toast('Settings disimpan.', 'success')
  }

  const openEdit = (u: Profile) => {
    setEditTarget(u); setEditRole(u.role as Role)
    setEditUnit(u.unit_id); setEditPass(''); setEditEmoji(u.avatar_emoji ?? ''); setErr('')
  }

  const handleSaveUser = async () => {
    if (!editTarget) return
    setErr('')
    const error = await updateUser(editTarget.id, editRole, editRole === 'user' ? editUnit : '', editPass || undefined, editEmoji)
    if (error) { setErr(error); return }
    toast('User diperbarui.', 'success'); setEditTarget(null); loadUsers()
  }

  const handleAddUser = async () => {
    setErr('')
    const error = await addUser(newUser.trim(), newUPass, newRole, newRole === 'user' ? newUnit : '')
    if (error) { setErr(error); return }
    toast(`"${newUser}" ditambahkan.`, 'success')
    setNewUser(''); setNewUPass(''); setNewRole('user'); setNewUnit(''); setAddMode(false); loadUsers()
  }

  const TABS = [
    { id: 'profile', label: '👤 Profil' },
    ...(canManageAll || profile?.role === 'admin_unit' ? [{ id: 'users', label: '👥 Users' }] : []),
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
        borderRadius: 12, width: '100%', maxWidth: 560, maxHeight: '92vh',
        overflow: 'hidden', display: 'flex', flexDirection: 'column',
        boxShadow: '0 24px 60px rgba(0,0,0,0.6), 0 0 40px rgba(0,255,194,0.06)',
        animation: 'scaleIn 0.2s ease',
      }}>
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 14, background: 'rgba(0,255,194,0.02)', flexShrink: 0 }}>
          {/* Avatar preview */}
          <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'rgba(0,255,194,0.1)', border: '2px solid rgba(0,255,194,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0, boxShadow: '0 0 12px rgba(0,255,194,0.15)', cursor: 'pointer' }}
            onClick={() => fileRef.current?.click()}>
            {avatarPreview ? (
              <img src={avatarPreview} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : avatarEmoji ? (
              <span style={{ fontSize: 26 }}>{avatarEmoji}</span>
            ) : (
              <span style={{ fontSize: 22 }}>👤</span>
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--mint)', letterSpacing: '-0.3px' }}>{profile?.username}</div>
            <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 8px', borderRadius: 10, background: myBadge.color, color: '#0A0A0A', letterSpacing: '1px', textTransform: 'uppercase', fontFamily: 'var(--mono)', boxShadow: `0 0 8px ${myBadge.color}55` }}>{myBadge.label}</span>
            <div style={{ fontSize: 10, color: 'var(--silver3)', marginTop: 4 }}>Klik foto untuk ganti</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--silver3)', fontSize: 22, cursor: 'pointer', padding: 4, lineHeight: 1 }}>×</button>
        </div>

        {/* Tabs */}
        {TABS.length > 1 && (
          <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id as any)} style={{
                flex: 1, padding: '11px', fontSize: 11, fontWeight: 600,
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
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>

          {/* ── PROFILE TAB ── */}
          {tab === 'profile' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileChange} />

              {/* Upload foto */}
              <div>
                <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--silver3)', textTransform: 'uppercase', letterSpacing: '1px', display: 'block', marginBottom: 8, fontFamily: 'var(--mono)' }}>Foto Profil</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 64, height: 64, borderRadius: '50%', border: '2px dashed var(--border2)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', cursor: 'pointer', background: 'var(--bg3)' }}
                    onClick={() => fileRef.current?.click()}>
                    {avatarPreview ? <img src={avatarPreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: 24 }}>📷</span>}
                  </div>
                  <div>
                    <button onClick={() => fileRef.current?.click()} style={{ padding: '7px 14px', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 6, color: 'var(--silver2)', fontSize: 12, cursor: 'pointer', marginBottom: 4, display: 'block', fontFamily: 'var(--font)' }}>
                      Pilih Foto
                    </button>
                    <div style={{ fontSize: 10, color: 'var(--silver3)' }}>JPG/PNG, max 5MB. Akan dikompres otomatis.</div>
                  </div>
                </div>
              </div>

              {/* Emoji avatar — hanya superadmin & admin */}
              {canEmoji && (
                <div>
                  <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--silver3)', textTransform: 'uppercase', letterSpacing: '1px', display: 'block', marginBottom: 8, fontFamily: 'var(--mono)' }}>Avatar Emoji</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 8 }}>
                    {EMOJI_PRESETS.map(e => (
                      <div key={e} onClick={() => setAvatarEmoji(e)} style={{
                        width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: e ? 16 : 10, cursor: 'pointer', borderRadius: 6,
                        border: `1px solid ${avatarEmoji === e ? 'var(--mint)' : 'var(--border2)'}`,
                        background: avatarEmoji === e ? 'var(--mint-bg2)' : 'var(--bg3)', transition: 'all .15s',
                        color: e ? 'inherit' : 'var(--silver3)',
                      }}>{e || '✕'}</div>
                    ))}
                  </div>
                </div>
              )}

              {/* Password — hanya superadmin & admin */}
              {canPwd && (
                <div>
                  <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--silver3)', textTransform: 'uppercase', letterSpacing: '1px', display: 'block', marginBottom: 8, fontFamily: 'var(--mono)' }}>Ganti Password</label>
                  <input type="password" value={newPass} onChange={e => setNewPass(e.target.value)} placeholder="Password baru (min. 6 karakter)"
                    style={{ width: '100%', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 6, padding: '9px 12px', color: 'var(--silver)', fontSize: 13, fontFamily: 'var(--font)', boxSizing: 'border-box', marginBottom: 8 }} />
                  <input type="password" value={newPass2} onChange={e => setNewPass2(e.target.value)} placeholder="Konfirmasi password baru"
                    style={{ width: '100%', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 6, padding: '9px 12px', color: 'var(--silver)', fontSize: 13, fontFamily: 'var(--font)', boxSizing: 'border-box' }} />
                </div>
              )}

              <button onClick={handleSaveProfile} disabled={saving} style={{
                padding: '10px', background: 'var(--mint-bg)', border: '1px solid var(--mint)',
                borderRadius: 8, color: 'var(--mint)', fontSize: 13, fontWeight: 700,
                cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'var(--font)',
              }}>{saving ? 'Menyimpan...' : '💾 Simpan Perubahan'}</button>

              {/* Sign out */}
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 16 }}>
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {/* Add / Edit form */}
              {(addMode || editTarget) && (
                <div style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, padding: 16, marginBottom: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--mint)', marginBottom: 12 }}>
                    {addMode ? 'Tambah User Baru' : `Edit: ${editTarget?.username}`}
                  </div>

                  {addMode && (
                    <>
                      {[
                        { label: 'Username', val: newUser, set: setNewUser, ph: 'username' },
                        { label: 'Password', val: newUPass, set: setNewUPass, ph: 'min. 6 karakter', type: 'password' },
                      ].map(f => (
                        <div key={f.label} style={{ marginBottom: 10 }}>
                          <label style={{ fontSize: 10, color: 'var(--silver3)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '1px', fontFamily: 'var(--mono)' }}>{f.label}</label>
                          <input type={(f as any).type ?? 'text'} value={f.val} onChange={e => f.set(e.target.value)} placeholder={f.ph}
                            style={{ width: '100%', background: 'var(--bg4)', border: '1px solid var(--border2)', borderRadius: 6, padding: '8px 10px', color: 'var(--silver)', fontSize: 13, fontFamily: 'var(--font)', boxSizing: 'border-box' }} />
                        </div>
                      ))}
                    </>
                  )}

                  <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: 10, color: 'var(--silver3)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '1px', fontFamily: 'var(--mono)' }}>Role</label>
                      <select
                        value={addMode ? newRole : editRole}
                        onChange={e => addMode ? setNewRole(e.target.value as Role) : setEditRole(e.target.value as Role)}
                        disabled={!addMode && (editTarget?.role === 'superadmin' || editTarget?.id === profile?.id)}
                        style={{ width: '100%', background: 'var(--bg4)', border: '1px solid var(--border2)', borderRadius: 6, padding: '8px 10px', color: 'var(--silver)', fontSize: 13 }}>
                        <option value="user">User</option>
                        {isSuperAdmin && <option value="admin">Admin</option>}
                        {isSuperAdmin && <option value="admin_unit">Admin Unit</option>}
                        {!addMode && editTarget?.role === 'superadmin' && <option value="superadmin">Super Admin</option>}
                      </select>
                    </div>
                    {(addMode ? newRole : editRole) === 'user' || (addMode ? newRole : editRole) === 'admin_unit' ? (
                      <div style={{ flex: 1 }}>
                        <label style={{ fontSize: 10, color: 'var(--silver3)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '1px', fontFamily: 'var(--mono)' }}>Unit</label>
                        <select
                          value={addMode ? newUnit : editUnit}
                          onChange={e => addMode ? setNewUnit(e.target.value as UnitId) : setEditUnit(e.target.value as UnitId)}
                          style={{ width: '100%', background: 'var(--bg4)', border: '1px solid var(--border2)', borderRadius: 6, padding: '8px 10px', color: 'var(--silver)', fontSize: 13 }}>
                          {UNIT_OPTIONS.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
                        </select>
                      </div>
                    ) : null}
                  </div>

                  {!addMode && canResetPassword(profile as any) && (
                    <div style={{ marginBottom: 10 }}>
                      <label style={{ fontSize: 10, color: 'var(--silver3)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '1px', fontFamily: 'var(--mono)' }}>Password Baru</label>
                      <input type="password" value={editPass} onChange={e => setEditPass(e.target.value)} placeholder="Kosong = tidak berubah"
                        style={{ width: '100%', background: 'var(--bg4)', border: '1px solid var(--border2)', borderRadius: 6, padding: '8px 10px', color: 'var(--silver)', fontSize: 13, fontFamily: 'var(--font)', boxSizing: 'border-box' }} />
                    </div>
                  )}

                  {err && <div style={{ color: 'var(--red)', fontSize: 12, marginBottom: 8 }}>{err}</div>}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => { setAddMode(false); setEditTarget(null); setErr('') }} style={{ flex: 1, padding: '8px', background: 'var(--bg4)', border: '1px solid var(--border2)', borderRadius: 6, color: 'var(--silver3)', cursor: 'pointer', fontFamily: 'var(--font)', fontSize: 12 }}>Batal</button>
                    <button onClick={addMode ? handleAddUser : handleSaveUser} style={{ flex: 2, padding: '8px', background: 'var(--mint-bg)', border: '1px solid var(--mint)', borderRadius: 6, color: 'var(--mint)', cursor: 'pointer', fontFamily: 'var(--font)', fontSize: 12, fontWeight: 700 }}>Simpan</button>
                  </div>
                </div>
              )}

              {/* User list header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize: 11, color: 'var(--silver3)' }}>{users.length} user</span>
                <button onClick={() => { setAddMode(true); setEditTarget(null); setErr('') }} style={{
                  padding: '6px 12px', background: 'var(--mint-bg)', border: '1px solid rgba(0,255,194,0.3)',
                  borderRadius: 6, color: 'var(--mint)', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font)',
                }}>＋ Tambah</button>
              </div>

              {users.map(u => {
                const b = getBadge(u)
                const isMe = u.id === profile?.id
                const adminCant = profile?.role === 'admin' && (u.role === 'admin' || u.role === 'superadmin')
                return (
                  <div key={u.id} style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
                    background: 'var(--bg3)', border: `1px solid ${isMe ? 'rgba(0,255,194,0.2)' : 'var(--border)'}`,
                    borderRadius: 8,
                  }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', overflow: 'hidden', background: 'var(--bg4)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {u.avatar_url ? <img src={u.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: 16 }}>{u.avatar_emoji || '👤'}</span>}
                    </div>
                    <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 7px', borderRadius: 10, background: b.color, color: '#0A0A0A', textTransform: 'uppercase', fontFamily: 'var(--mono)', flexShrink: 0 }}>{b.label}</span>
                    <span style={{ flex: 1, fontSize: 13, color: isMe ? 'var(--mint)' : 'var(--silver)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {u.username}{isMe && <span style={{ fontSize: 10, color: 'var(--silver3)', marginLeft: 5 }}>(kamu)</span>}
                    </span>
                    {!adminCant && (
                      <button onClick={() => openEdit(u)}
                        style={{ background: 'var(--bg4)', border: '1px solid var(--border2)', borderRadius: 6, color: 'var(--silver3)', padding: '4px 10px', fontSize: 11, cursor: 'pointer' }}
                        onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--mint)')}
                        onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border2)')}>Edit</button>
                    )}
                    {u.role !== 'superadmin' && !isMe && !adminCant && (
                      <button onClick={async () => {
                        const err = await removeUser(u.id)
                        if (err) toast(err, 'error')
                        else toast(`"${u.username}" dihapus.`, 'success')
                      }} style={{ background: 'none', border: 'none', color: 'var(--silver3)', cursor: 'pointer', fontSize: 14, padding: '2px 4px' }}
                        onMouseEnter={e => (e.currentTarget.style.color = 'var(--red)')}
                        onMouseLeave={e => (e.currentTarget.style.color = 'var(--silver3)')}>🗑</button>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* ── SETTINGS TAB (superadmin) ── */}
          {tab === 'settings' && isSuperAdmin && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ fontSize: 11, color: 'var(--silver3)', marginBottom: 4 }}>Pengaturan global aplikasi</div>
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

// ── Image compressor ──────────────────────────
async function compressImage(file: File, maxSize = 400): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const canvas = document.createElement('canvas')
      const ratio  = Math.min(maxSize / img.width, maxSize / img.height, 1)
      canvas.width  = Math.floor(img.width  * ratio)
      canvas.height = Math.floor(img.height * ratio)
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      canvas.toBlob(blob => {
        if (blob) resolve(blob)
        else reject(new Error('Compress failed'))
      }, 'image/webp', 0.85)
    }
    img.onerror = reject
    img.src = url
  })
}
