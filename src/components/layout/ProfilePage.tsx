import { useState, useEffect } from 'react'
import { useAuthStore } from '../../store/authStore'
import { useStore } from '../../store/dashboardStore'
import { canManageUser, canAssignRole, canResetPwd, getAllowedRegions, getAllowedUnits, getAllowedRoles, getDisplayBadge, REGION_LABELS, UNIT_LABELS } from '../../utils/roles'
import { REGIONS, UNITS } from '../../types'
import { updateProfile } from '../../utils/supabaseClient'
import type { Role } from '../../types'
import type { Profile } from '../../utils/supabaseClient'

interface Props { onClose: () => void }

const EMOJI_PRESETS = ['', '🌸', '🔥', '⭐', '🎯', '💎', '🚀', '🌊', '🦁', '🐯', '🌺', '🎨', '💡', '🍀', '🎭', '🏆', '🦋', '🌙', '☀️', '🍉']

export default function ProfilePage({ onClose }: Props) {
  const { profile, users, loadUsers, addUser, updateUser, removeUser } = useAuthStore()
  const { toast } = useStore()

  const isSuperAdmin = profile?.role === 'superadmin'
  const isAdminLevel = profile?.role === 'admin' || isSuperAdmin
  const canManage = isAdminLevel

  const [tab, setTab] = useState<'users' | 'settings'>(canManage ? 'users' : 'settings')

  // Users state
  const [search, setSearch] = useState('')
  const [filterRegion, setFilterRegion] = useState('')
  const [filterUnit, setFilterUnit] = useState('')
  const [filterRole, setFilterRole] = useState('')
  const [page, setPage] = useState(0)
  const [editTarget, setEditTarget] = useState<Profile | null>(null)
  const [editRole, setEditRole] = useState<Role>('user')
  const [editUnit, setEditUnit] = useState('')
  const [editRegion, setEditRegion] = useState('global')
  const [editUnitScope, setEditUnitScope] = useState('general')
  const [editPass, setEditPass] = useState('')
  const [editEmoji, setEditEmoji] = useState('')
  const [addMode, setAddMode] = useState(false)
  const [newUser, setNewUser] = useState('')
  const [newUPass, setNewUPass] = useState('')
  const [newRole, setNewRole] = useState<Role>('user')
  const [newRegion, setNewRegion] = useState('global')
  const [newUnitScope, setNewUnitScope] = useState('general')
  const [newUnitId, setNewUnitId] = useState('')
  const [err, setErr] = useState('')
  const [saving, setSaving] = useState(false)

  // Settings state
  const [siteTitle, setSiteTitle] = useState('')
  const [siteSubtitle, setSiteSubtitle] = useState('')
  const [coffeeUrl, setCoffeeUrl] = useState('')
  const [logoUrl, setLogoUrl] = useState('')

  const PER_PAGE = 50

  useEffect(() => { if (canManage) loadUsers() }, [])

  const allowedRegions = getAllowedRegions(profile as any)
  const allowedUnits = getAllowedUnits(profile as any)
  const allowedRoles = getAllowedRoles(profile as any)

  const filteredUsers = users.filter(u => {
    const matchSearch = !search || u.username.toLowerCase().includes(search.toLowerCase()) ||
      (u.full_name ?? '').toLowerCase().includes(search.toLowerCase())
    const matchRegion = !filterRegion || (u.region_scope ?? 'global') === filterRegion
    const matchUnit = !filterUnit || (u.unit_scope ?? 'general') === filterUnit
    const matchRole = !filterRole || u.role === filterRole
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
    cfg.title = siteTitle
    cfg.subtitle = siteSubtitle
    cfg.coffeeUrl = coffeeUrl
    cfg.logoUrl = logoUrl
    await supabase.from('dashboard_config').update({ config: cfg }).eq('id', CONFIG_ID)
    toast('Settings disimpan.', 'success')
  }

  const TABS = [
    ...(canManage ? [{ id: 'users', label: `👥 User Management (${users.length})` }] : []),
    ...(isSuperAdmin ? [{ id: 'settings', label: '⚙️ Settings' }] : []),
  ] as const

  const inputStyle: React.CSSProperties = {
    width: '100%', background: 'var(--bg3)', border: '1px solid var(--border2)',
    borderRadius: 6, padding: '8px 10px', color: 'var(--silver)', fontSize: 12,
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
      background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'rgba(12,12,12,0.99)', border: '1px solid rgba(0,255,194,0.15)',
        borderRadius: 12, width: '100%', maxWidth: 680, maxHeight: '92vh',
        overflow: 'hidden', display: 'flex', flexDirection: 'column',
        boxShadow: '0 32px 80px rgba(0,0,0,0.7), 0 0 40px rgba(0,255,194,0.05)',
        animation: 'scaleIn 0.2s ease',
      }}>
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(0,255,194,0.02)', flexShrink: 0 }}>
          <div style={{ flex: 1, fontSize: 14, fontWeight: 700, color: 'var(--mint)' }}>
            ⚡ Advanced — {profile?.username}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={() => useAuthStore.getState().logout()}
              style={{
                padding: '6px 14px', background: 'rgba(224,85,85,0.08)',
                border: '1px solid rgba(224,85,85,0.3)', borderRadius: 6,
                color: 'var(--red)', fontSize: 12, fontWeight: 700,
                cursor: 'pointer', fontFamily: 'var(--font)',
              }}>⏻ Logout</button>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--silver3)', fontSize: 22, cursor: 'pointer', padding: 4 }}>×</button>
          </div>
        </div>

        {/* Tabs */}
        {TABS.length > 0 && (
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
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>

          {/* ── USERS TAB ── */}
          {tab === 'users' && canManage && (
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
                  {(UNITS as readonly { label: string; value: string }[]).map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
                </select>
                <select value={filterRole} onChange={e => { setFilterRole(e.target.value); setPage(0) }} style={{ ...selectStyle, flex: 'none', width: 'auto' }}>
                  <option value="">Semua Role</option>
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                  {isSuperAdmin && <option value="superadmin">Superadmin</option>}
                </select>
                <button onClick={() => { setAddMode(true); setEditTarget(null); setErr('') }} style={{
                  padding: '7px 14px', background: 'var(--mint-bg)', border: '1px solid rgba(0,255,194,0.3)',
                  borderRadius: 6, color: 'var(--mint)', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font)', whiteSpace: 'nowrap',
                }}>＋ Tambah</button>
              </div>

              <div style={{ fontSize: 11, color: 'var(--silver3)' }}>
                {filteredUsers.length} dari {users.length} user
                {totalPages > 1 && ` · Hal. ${page + 1}/${totalPages}`}
              </div>

              {/* Add / Edit form */}
              {(addMode || editTarget) && (
                <div style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, padding: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--mint)', marginBottom: 14 }}>
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
                  {!addMode && canResetPwd(profile as any) && (
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
                    <button onClick={() => { setAddMode(false); setEditTarget(null); setErr('') }}
                      style={{ flex: 1, padding: '8px', background: 'var(--bg4)', border: '1px solid var(--border2)', borderRadius: 6, color: 'var(--silver3)', cursor: 'pointer', fontFamily: 'var(--font)', fontSize: 12 }}>Batal</button>
                    <button onClick={addMode ? handleAddUser : handleSaveUser} disabled={saving}
                      style={{ flex: 2, padding: '8px', background: 'var(--mint-bg)', border: '1px solid var(--mint)', borderRadius: 6, color: 'var(--mint)', cursor: 'pointer', fontFamily: 'var(--font)', fontSize: 12, fontWeight: 700 }}>
                      {saving ? 'Menyimpan...' : 'Simpan'}
                    </button>
                  </div>
                </div>
              )}

              {/* User list */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {pagedUsers.map(u => {
                  const b = getBadge(u)
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
                      background: 'var(--bg3)', border: `1px solid ${isMe ? 'rgba(0,255,194,0.2)' : 'var(--border)'}`,
                      borderRadius: 8,
                    }}>
                      {/* Avatar */}
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--bg4)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                        {u.avatar_url ? <img src={u.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: 16 }}>👤</span>}
                      </div>

                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: isMe ? 'var(--mint)' : 'var(--silver)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
                          onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--mint)')}
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
                    return <button key={p} onClick={() => setPage(p)} style={{ padding: '5px 10px', background: p === page ? 'var(--mint-bg2)' : 'var(--bg3)', border: `1px solid ${p === page ? 'var(--mint)' : 'var(--border2)'}`, borderRadius: 5, color: p === page ? 'var(--mint)' : 'var(--silver)', cursor: 'pointer', fontSize: 12 }}>{p + 1}</button>
                  })}
                  <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
                    style={{ padding: '5px 12px', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 5, color: page >= totalPages - 1 ? 'var(--silver3)' : 'var(--silver)', cursor: page >= totalPages - 1 ? 'not-allowed' : 'pointer', fontSize: 12 }}>Next →</button>
                </div>
              )}
            </div>
          )}

          {/* ── SETTINGS TAB ── */}
          {tab === 'settings' && isSuperAdmin && (
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
