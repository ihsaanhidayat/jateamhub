import { useState, useEffect } from 'react'
import { useAuthStore } from '../../store/authStore'
import { useStore } from '../../store/dashboardStore'
import { canManageUser, canAssignRole, getAllowedRegions, getAllowedUnits, getAllowedRoles, getDisplayBadge, REGION_LABELS, UNIT_LABELS } from '../../utils/roles'
import { REGIONS, UNITS } from '../../types'
import { updateProfile } from '../../utils/supabaseClient'
import type { Role } from '../../types'
import type { Profile } from '../../utils/supabaseClient'

interface Props { onClose: () => void }

const EMOJI_PRESETS = ['','🌸','🔥','⭐','🎯','💎','🚀','🌊','🦁','🐯','🌺','🎨','💡','🍀','🎭','🏆','🦋','🌙','☀️','🍉']

export default function ProfilePage({ onClose }: Props) {
  const { profile, users, loadUsers, addUser, updateUser, removeUser } = useAuthStore()
  const { toast } = useStore()

  const isSuperAdmin = profile?.role === 'superadmin'
  const isAdminLevel = profile?.role === 'admin' || isSuperAdmin
  const canManage    = isAdminLevel

  // tab state di-handle oleh tabState di bawah

  // Users state
  const [search,      setSearch]      = useState('')
  const [filterRegion,setFilterRegion]= useState('')
  const [filterUnit,  setFilterUnit]  = useState('')
  const [filterRole,  setFilterRole]  = useState('')
  const [page,        setPage]        = useState(0)
  const [editTarget,  setEditTarget]  = useState<Profile | null>(null)
  const [editRole,    setEditRole]    = useState<Role>('user')
  const [editUnit,    setEditUnit]    = useState('')
  const [editRegion,  setEditRegion]  = useState('global')
  const [editUnitScope,setEditUnitScope]=useState('general')
  const [editPass,    setEditPass]    = useState('')
  const [editEmoji,   setEditEmoji]   = useState('')
  const [addMode,     setAddMode]     = useState(false)
  const [newUser,     setNewUser]     = useState('')
  const [newUPass,    setNewUPass]    = useState('')
  const [newRole,     setNewRole]     = useState<Role>('user')
  const [newRegion,   setNewRegion]   = useState('global')
  const [newUnitScope,setNewUnitScope]= useState('general')
  const [newUnitId,   setNewUnitId]   = useState('')
  const [err, setErr] = useState('')
  const [saving, setSaving] = useState(false)

  // Settings state
  const [siteTitle,    setSiteTitle]    = useState('')
  const [siteSubtitle, setSiteSubtitle] = useState('')
  const [coffeeUrl,    setCoffeeUrl]    = useState('')
  const [logoUrl,      setLogoUrl]      = useState('')

  const PER_PAGE = 50

  useEffect(() => { if (canManage) loadUsers() }, [])

  const allowedRegions = getAllowedRegions(profile as any)
  const allowedUnits   = getAllowedUnits(profile as any)
  const allowedRoles   = getAllowedRoles(profile as any)

  const filteredUsers = users.filter(u => {
    const matchSearch = !search || u.username.toLowerCase().includes(search.toLowerCase()) ||
      (u.full_name ?? '').toLowerCase().includes(search.toLowerCase())
    const matchRegion = !filterRegion || (u.region_scope ?? 'global') === filterRegion
    const matchUnit   = !filterUnit   || (u.unit_scope ?? 'general') === filterUnit
    const matchRole   = !filterRole   || u.role === filterRole
    return matchSearch && matchRegion && matchUnit && matchRole
  })
  const pagedUsers = filteredUsers.slice(page * PER_PAGE, (page + 1) * PER_PAGE)
  const totalPages = Math.ceil(filteredUsers.length / PER_PAGE)

  const getBadge = (u: Profile) => getDisplayBadge(u as any)

  const openEdit = (u: Profile) => {
    setEditTarget(u); setEditRole(u.role as Role)
    setEditUnit(u.unit_id ?? ''); setEditRegion(u.region_scope ?? 'global')
    setEditUnitScope(u.unit_scope ?? 'general')
    setEditPass(''); setEditEmoji(u.emoji ?? u.avatar_emoji ?? ''); setErr('')
    setAddMode(false)
  }

  const handleSaveUser = async () => {
    if (!editTarget) return
    setErr(''); setSaving(true)
    const error = await updateUser(
      editTarget.id, editRole, editUnit,
      editPass || undefined, editEmoji,
      editRegion, editUnitScope,
    )
    setSaving(false)
    if (error) { setErr(error); return }
    toast('User diperbarui.', 'success'); setEditTarget(null); loadUsers()
  }

  const handleAddUser = async () => {
    setErr(''); setSaving(true)
    const error = await addUser(newUser.trim(), newUPass, newRole, newUnitId, newRegion, newUnitScope)
    setSaving(false)
    if (error) { setErr(error); return }
    toast(`"${newUser}" ditambahkan.`, 'success')
    setNewUser(''); setNewUPass(''); setNewRole('user'); setNewRegion('global'); setNewUnitScope('general'); setNewUnitId('')
    setAddMode(false); loadUsers()
  }

  const handleSaveSettings = async () => {
    // Simpan settings ke dashboard_config di Supabase
    const { supabase } = await import('../../utils/supabaseClient')
    const CONFIG_ID = '00000000-0000-0000-0000-000000000001'
    const { data } = await supabase.from('dashboard_config').select('config').eq('id', CONFIG_ID).single()
    const cfg = (data?.config ?? {}) as Record<string, unknown>
    cfg.title    = siteTitle
    cfg.subtitle = siteSubtitle
    cfg.coffeeUrl= coffeeUrl
    cfg.logoUrl  = logoUrl
    await supabase.from('dashboard_config').update({ config: cfg }).eq('id', CONFIG_ID)
    toast('Settings disimpan.', 'success')
  }

  const TABS = [
    { id: 'profile', label: '👤 Profil Saya' },
    ...(canManage ? [{ id: 'users', label: `👥 User Management (${users.length})` }] : []),
    ...(isSuperAdmin ? [{ id: 'settings', label: '⚙️ Settings' }] : []),
  ] as const

  const [tabState, setTabState] = useState<'profile' | 'users' | 'settings'>('profile')

  // Edit nama lengkap
  const [editingName, setEditingName] = useState(false)
  const [nameValue,   setNameValue]   = useState(profile?.full_name || '')
  const [nameSaving,  setNameSaving]  = useState(false)

  const handleSaveName = async () => {
    if (!profile || !nameValue.trim()) return
    setNameSaving(true)
    // Update initials otomatis
    const parts = nameValue.trim().split(' ').filter(Boolean)
    const initials = parts.length >= 2
      ? (parts[0][0] + parts[1][0]).toUpperCase()
      : nameValue.slice(0, 2).toUpperCase()
    await updateProfile(profile.id, { full_name: nameValue.trim(), initials } as any)
    setNameSaving(false)
    setEditingName(false)
    toast('Nama berhasil diperbarui.', 'success')
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
      position: 'fixed', inset: 0, zIndex: 9000,
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
              background: tabState === t.id ? 'var(--mint-bg)' : 'none',
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
              {/* Avatar + nama + ganti foto */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-4)', marginBottom: 'var(--sp-2)' }}>
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <div style={{
                    width: 64, height: 64, borderRadius: '50%',
                    background: 'var(--mint-bg)', border: '2px solid var(--accent)',
                    overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 22, color: 'var(--accent)',
                  }}>
                    {profile?.avatar_url
                      ? <img src={profile.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : ((profile?.full_name?.split(' ').map((n: string) => n[0]).slice(0,2).join('') ?? profile?.username?.slice(0,2) ?? '?').toUpperCase())
                    }
                  </div>
                  {/* Pencil ganti foto */}
                  <label htmlFor="profile-tab-avatar" title="Ganti foto profil" style={{
                    position: 'absolute', bottom: 0, right: 0,
                    width: 22, height: 22, borderRadius: '50%',
                    background: 'var(--accent)', color: 'white',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', fontSize: 11, boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
                  }}>✏️
                    <input id="profile-tab-avatar" type="file" accept="image/*" style={{ display: 'none' }}
                      onChange={e => {
                        const file = e.target.files?.[0]
                        if (!file) return
                        e.target.value = ''
                        const reader = new FileReader()
                        reader.onload = ev => {
                          const dataUrl = ev.target?.result as string
                          if (dataUrl) {
                            window.dispatchEvent(new CustomEvent('avatar-upload', { detail: dataUrl }))
                            onClose()
                          }
                        }
                        reader.readAsDataURL(file)
                      }} />
                  </label>
                </div>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--silver)' }}>
                    {profile?.full_name || profile?.username}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--silver3)', marginTop: 2 }}>@{profile?.username}</div>
                </div>
              </div>

              {/* Nama Lengkap — editable */}
              <div style={{
                padding: 'var(--sp-3) var(--sp-4)', background: 'var(--bg2)',
                border: '1px solid var(--border)', borderRadius: 'var(--radius)',
              }}>
                <div style={{ fontSize: 10, color: 'var(--silver3)', fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 6 }}>
                  Nama Lengkap
                </div>
                {editingName ? (
                  <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
                    <input
                      value={nameValue}
                      onChange={e => setNameValue(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') setEditingName(false) }}
                      autoFocus
                      style={{ ...inputStyle, flex: 1 }}
                    />
                    <button onClick={handleSaveName} disabled={nameSaving} style={{
                      height: 36, padding: '0 var(--sp-3)', background: 'var(--accent)',
                      border: 'none', borderRadius: 'var(--radius-sm)', color: 'white',
                      fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font)',
                    }}>{nameSaving ? '...' : 'Simpan'}</button>
                    <button onClick={() => setEditingName(false)} style={{
                      height: 36, padding: '0 var(--sp-2)', background: 'none',
                      border: '1px solid var(--border2)', borderRadius: 'var(--radius-sm)',
                      color: 'var(--silver3)', cursor: 'pointer', fontFamily: 'var(--font)',
                    }}>✕</button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 14, color: 'var(--silver)', fontWeight: 500 }}>
                      {profile?.full_name || '—'}
                    </span>
                    <button onClick={() => { setNameValue(profile?.full_name || ''); setEditingName(true) }} style={{
                      background: 'none', border: 'none', color: 'var(--accent)',
                      fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font)', fontWeight: 600,
                    }}>✏️ Edit</button>
                  </div>
                )}
              </div>

              {/* Username + badge role */}
              <div style={{
                padding: 'var(--sp-3) var(--sp-4)', background: 'var(--bg2)',
                border: '1px solid var(--border)', borderRadius: 'var(--radius)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--silver3)', fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 4 }}>Username</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
                    <span style={{ fontSize: 14, color: 'var(--silver)', fontWeight: 500 }}>@{profile?.username}</span>
                    {badge && (
                      <span style={{
                        fontSize: 9, fontWeight: 800, padding: '2px 8px', borderRadius: 99,
                        background: badge.color, color: '#0A0A0A',
                        fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: '0.5px',
                      }}>{badge.label}</span>
                    )}
                  </div>
                </div>
                <span style={{ fontSize: 11, color: 'var(--silver3)' }}>🔒</span>
              </div>

              {/* Wilayah */}
              <div style={{
                padding: 'var(--sp-3) var(--sp-4)', background: 'var(--bg2)',
                border: '1px solid var(--border)', borderRadius: 'var(--radius)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--silver3)', fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 4 }}>Wilayah</div>
                  <span style={{ fontSize: 14, color: 'var(--silver)', fontWeight: 500 }}>
                    {REGION_LABELS[(profile as any)?.region_scope] ?? (profile as any)?.region_scope ?? '—'}
                  </span>
                </div>
                <span style={{ fontSize: 11, color: 'var(--silver3)' }}>🔒</span>
              </div>

              {/* Unit */}
              <div style={{
                padding: 'var(--sp-3) var(--sp-4)', background: 'var(--bg2)',
                border: '1px solid var(--border)', borderRadius: 'var(--radius)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--silver3)', fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 4 }}>Unit</div>
                  <span style={{ fontSize: 14, color: 'var(--silver)', fontWeight: 500 }}>
                    {UNIT_LABELS[(profile as any)?.unit_scope] ?? (profile as any)?.unit_scope ?? '—'}
                  </span>
                </div>
                <span style={{ fontSize: 11, color: 'var(--silver3)' }}>🔒</span>
              </div>

              <div style={{
                padding: 'var(--sp-3) var(--sp-4)',
                background: 'var(--mint-bg)', border: '1px solid var(--border2)',
                borderRadius: 'var(--radius)', fontSize: 12, color: 'var(--silver3)', lineHeight: 1.6,
              }}>
                🔒 Wilayah, unit, dan username tidak dapat diubah. Hubungi Admin untuk perubahan.
              </div>
            </div>
          )}

          {/* ── USERS TAB ── */}
          {tabState === 'users' && canManage && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* Filters */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                <input value={search} onChange={e => { setSearch(e.target.value); setPage(0) }} placeholder="🔍 Cari username / nama..."
                  style={{ ...inputStyle, flex: 1, minWidth: 140 }} />
                <select value={filterRegion} onChange={e => { setFilterRegion(e.target.value); setPage(0) }} style={{ ...selectStyle, flex: 'none', width: 'auto' }}>
                  <option value="">Semua Wilayah</option>
                  {allowedRegions.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
                <select value={filterUnit} onChange={e => { setFilterUnit(e.target.value); setPage(0) }} style={{ ...selectStyle, flex: 'none', width: 'auto' }}>
                  <option value="">Semua Unit</option>
                  {(UNITS as readonly {label: string; value: string}[]).map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
                </select>
                <select value={filterRole} onChange={e => { setFilterRole(e.target.value); setPage(0) }} style={{ ...selectStyle, flex: 'none', width: 'auto' }}>
                  <option value="">Semua Role</option>
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                  {isSuperAdmin && <option value="superadmin">Superadmin</option>}
                </select>
                <button onClick={() => { setAddMode(true); setEditTarget(null); setErr('') }} style={{
                  padding: '7px 14px', background: 'var(--mint-bg)', border: '1px solid var(--accent-glow)',
                  borderRadius: 6, color: 'var(--accent)', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font)', whiteSpace: 'nowrap',
                }}>＋ Tambah</button>
              </div>

              <div style={{ fontSize: 11, color: 'var(--silver3)' }}>
                {filteredUsers.length} dari {users.length} user
                {totalPages > 1 && ` · Hal. ${page + 1}/${totalPages}`}
              </div>

              {/* Add / Edit form */}
              {(addMode || editTarget) && (
                <div style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, padding: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)', marginBottom: 14 }}>
                    {addMode ? '＋ Tambah User Baru' : `✏️ Edit: ${editTarget?.username}${editEmoji ? ' ' + editEmoji : ''}`}
                  </div>

                  {addMode && (
                    <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                      <div style={{ flex: 1 }}>
                        <label style={labelStyle}>Username</label>
                        <input value={newUser} onChange={e => setNewUser(e.target.value)} placeholder="username" style={inputStyle} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={labelStyle}>Password</label>
                        <input type="password" value={newUPass} onChange={e => setNewUPass(e.target.value)} placeholder="min. 6 karakter" style={inputStyle} />
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 100 }}>
                      <label style={labelStyle}>Role</label>
                      <select value={addMode ? newRole : editRole}
                        onChange={e => addMode ? setNewRole(e.target.value as Role) : setEditRole(e.target.value as Role)}
                        disabled={!addMode && (editTarget?.role === 'superadmin' || editTarget?.id === profile?.id)}
                        style={selectStyle}>
                        {allowedRoles.map(r => <option key={r} value={r}>{r}</option>)}
                        {!addMode && editTarget?.role === 'superadmin' && <option value="superadmin">superadmin</option>}
                      </select>
                    </div>
                    <div style={{ flex: 1, minWidth: 100 }}>
                      <label style={labelStyle}>Wilayah</label>
                      <select value={addMode ? newRegion : editRegion}
                        onChange={e => addMode ? setNewRegion(e.target.value) : setEditRegion(e.target.value)}
                        style={selectStyle}>
                        {allowedRegions.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                      </select>
                    </div>
                    <div style={{ flex: 1, minWidth: 100 }}>
                      <label style={labelStyle}>Unit</label>
                      <select value={addMode ? newUnitScope : editUnitScope}
                        onChange={e => { if (addMode) { setNewUnitScope(e.target.value); setNewUnitId(e.target.value) } else { setEditUnitScope(e.target.value); setEditUnit(e.target.value) } }}
                        style={selectStyle}>
                        {allowedUnits.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* Reset password — hanya saat edit */}
                  {!addMode && profile?.role === 'admin' || profile?.role === 'superadmin' && (
                    <div style={{ marginBottom: 10 }}>
                      <label style={labelStyle}>Reset Password (kosong = tidak berubah)</label>
                      <input type="password" value={editPass} onChange={e => setEditPass(e.target.value)} placeholder="Password baru min. 6 karakter" style={inputStyle} />
                    </div>
                  )}

                  {/* Emoji — admin ke atas saja */}
                  {!addMode && (profile?.role === 'superadmin' || profile?.role === 'admin') && (
                    <div style={{ marginBottom: 10 }}>
                      <label style={labelStyle}>Emoji (tampil di samping nama)</label>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
                        {EMOJI_PRESETS.map(e => (
                          <div key={e} onClick={() => setEditEmoji(e)} style={{
                            width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: e ? 14 : 9, cursor: 'pointer', borderRadius: 5,
                            border: `1px solid ${editEmoji === e ? 'var(--accent)' : 'var(--border2)'}`,
                            background: editEmoji === e ? 'var(--mint-bg2)' : 'var(--bg4)',
                            transition: 'all .12s', color: e ? 'inherit' : 'var(--silver3)',
                          }}>{e || '✕'}</div>
                        ))}
                      </div>
                    </div>
                  )}

                  {err && <div style={{ color: 'var(--red)', fontSize: 12, marginBottom: 8 }}>{err}</div>}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => { setAddMode(false); setEditTarget(null); setErr('') }}
                      style={{ flex: 1, padding: '8px', background: 'var(--bg4)', border: '1px solid var(--border2)', borderRadius: 6, color: 'var(--silver3)', cursor: 'pointer', fontFamily: 'var(--font)', fontSize: 12 }}>Batal</button>
                    <button onClick={addMode ? handleAddUser : handleSaveUser} disabled={saving}
                      style={{ flex: 2, padding: '8px', background: 'var(--mint-bg)', border: '1px solid var(--accent)', borderRadius: 6, color: 'var(--accent)', cursor: 'pointer', fontFamily: 'var(--font)', fontSize: 12, fontWeight: 700 }}>
                      {saving ? 'Menyimpan...' : 'Simpan'}
                    </button>
                  </div>
                </div>
              )}

              {/* User list */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {pagedUsers.map(u => {
                  const b       = getBadge(u)
                  const isMe    = u.id === profile?.id
                  // Pastikan field scope tersedia untuk permission check
                  const currentUser = { ...profile, region_scope: (profile as any).region_scope ?? 'global', unit_scope: (profile as any).unit_scope ?? 'general' }
                  const targetUser  = { ...u,       region_scope: u.region_scope ?? 'global',                unit_scope: u.unit_scope ?? 'general'                }
                  const canEdit_ = canManageUser(currentUser as any, targetUser as any)
                  const region  = REGION_LABELS[u.region_scope ?? 'global'] ?? u.region_scope
                  const unit    = UNIT_LABELS[u.unit_scope ?? 'general'] ?? u.unit_scope
                  const emoji_  = u.emoji || u.avatar_emoji || ''

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
                          {region && region !== 'Global' && <span style={{ fontSize: 9, color: 'var(--silver3)', fontFamily: 'var(--mono)' }}>{region}</span>}
                          {unit && unit !== 'General' && <span style={{ fontSize: 9, color: 'var(--silver3)', fontFamily: 'var(--mono)' }}>· {unit}</span>}
                        </div>
                      </div>

                      {/* Actions */}
                      {canEdit_ && (
                        <button onClick={() => openEdit(u)}
                          style={{ background: 'var(--bg4)', border: '1px solid var(--border2)', borderRadius: 5, color: 'var(--silver3)', padding: '4px 9px', fontSize: 11, cursor: 'pointer' }}
                          onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
                          onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border2)')}>Edit</button>
                      )}
                      {canEdit_ && u.role !== 'superadmin' && !isMe && (
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
                <div style={{ display: 'flex', justifyContent: 'center', gap: 5, marginTop: 8 }}>
                  <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                    style={{ padding: '5px 12px', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 5, color: page === 0 ? 'var(--silver3)' : 'var(--silver)', cursor: page === 0 ? 'not-allowed' : 'pointer', fontSize: 12 }}>← Prev</button>
                  {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                    const p = totalPages <= 7 ? i : Math.max(0, Math.min(page - 3, totalPages - 7)) + i
                    return <button key={p} onClick={() => setPage(p)} style={{ padding: '5px 10px', background: p === page ? 'var(--mint-bg2)' : 'var(--bg3)', border: `1px solid ${p === page ? 'var(--accent)' : 'var(--border2)'}`, borderRadius: 5, color: p === page ? 'var(--accent)' : 'var(--silver)', cursor: 'pointer', fontSize: 12 }}>{p + 1}</button>
                  })}
                  <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
                    style={{ padding: '5px 12px', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 5, color: page >= totalPages - 1 ? 'var(--silver3)' : 'var(--silver)', cursor: page >= totalPages - 1 ? 'not-allowed' : 'pointer', fontSize: 12 }}>Next →</button>
                </div>
              )}
            </div>
          )}

          {/* ── SETTINGS TAB ── */}
          {tabState === 'settings' && isSuperAdmin && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ fontSize: 11, color: 'var(--silver3)', marginBottom: 4 }}>Pengaturan global — hanya superadmin</div>
              {[
                { label: 'Site Title',              val: siteTitle,    set: setSiteTitle,    ph: 'JateamHub' },
                { label: 'Subtitle / Greeting',     val: siteSubtitle, set: setSiteSubtitle, ph: 'Selamat datang, {username}' },
                { label: 'Logo URL',                val: logoUrl,      set: setLogoUrl,      ph: 'https://...' },
                { label: 'Coffee / Donasi URL',     val: coffeeUrl,    set: setCoffeeUrl,    ph: 'https://trakteer.id/...' },
              ].map(f => (
                <div key={f.label}>
                  <label style={{ ...labelStyle, fontWeight: 700 }}>{f.label}</label>
                  <input value={f.val} onChange={e => f.set(e.target.value)} placeholder={f.ph} style={inputStyle} />
                </div>
              ))}
              <button onClick={handleSaveSettings} style={{
                padding: '10px', background: 'var(--mint-bg)', border: '1px solid var(--accent)',
                borderRadius: 8, color: 'var(--accent)', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font)',
              }}>💾 Simpan Settings</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
