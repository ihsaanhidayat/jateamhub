// ─────────────────────────────────────────────────────────────
// SUPERADMIN DASHBOARD — Clean, Elegant, Minimalist
// ─────────────────────────────────────────────────────────────
import { useState, useEffect } from 'react'
import { useAuthStore } from '../../store/authStore'
import { useStore } from '../../store/dashboardStore'
import {
  getPendingRegistrations, approveRegistration, rejectRegistration,
  supabase, updateProfile,
} from '../../utils/supabaseClient'
import type { PendingRegistration } from '../../utils/supabaseClient'
import { REGION_LABELS, UNIT_LABELS, canManageUser, getAllowedRoles, getAllowedRegions, getAllowedUnits, getDisplayBadge } from '../../utils/roles'
import type { Role } from '../../types'
import type { Profile } from '../../utils/supabaseClient'
import { REGIONS, UNITS } from '../../types'

const EMOJI_PRESETS = ['','🌸','🔥','⭐','🎯','💎','🚀','🌊','🦁','🐯','🌺','🎨','💡','🍀','🏆','🦋','🌙','☀️','🍉']

const inputSt: React.CSSProperties = {
  width: '100%', height: 38, background: 'var(--bg4)',
  border: '1px solid var(--border2)', borderRadius: 8,
  padding: '0 12px', color: 'var(--silver)', fontSize: 13,
  fontFamily: 'var(--font)', outline: 'none',
}
const labelSt: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, color: 'var(--silver3)',
  textTransform: 'uppercase', letterSpacing: '0.8px',
  display: 'block', marginBottom: 5, fontFamily: 'var(--mono)',
}

export default function SuperadminDashboard() {
  const { profile, logout, users, loadUsers, addUser, updateUser, removeUser } = useAuthStore()
  const toast = useStore.getState().toast

  const [tab, setTab] = useState<'pending' | 'users'>('pending')
  const [pending,     setPending]     = useState<PendingRegistration[]>([])
  const [pendingLoad, setPendingLoad] = useState(false)
  const [rejectId,    setRejectId]    = useState<string | null>(null)
  const [rejectNote,  setRejectNote]  = useState('')

  const [search,       setSearch]       = useState('')
  const [filterRegion, setFilterRegion] = useState('')
  const [filterUnit,   setFilterUnit]   = useState('')
  const [page,         setPage]         = useState(0)
  const [editTarget,   setEditTarget]   = useState<Profile | null>(null)
  const [editRole,     setEditRole]     = useState<Role>('user')
  const [editRegion,   setEditRegion]   = useState('global')
  const [editUnit,     setEditUnit]     = useState('general')
  const [editPass,     setEditPass]     = useState('')
  const [editEmoji,    setEditEmoji]    = useState('')
  const [editFullName, setEditFullName] = useState('')
  const [editEmail,    setEditEmail]    = useState('')
  const [addMode,      setAddMode]      = useState(false)
  const [newUser,      setNewUser]      = useState('')
  const [newPass,      setNewPass]      = useState('')
  const [newRole,      setNewRole]      = useState<Role>('user')
  const [newRegion,    setNewRegion]    = useState('sby')
  const [newUnit,      setNewUnit]      = useState('general')
  const [newFullName,  setNewFullName]  = useState('')
  const [newEmail,     setNewEmail]     = useState('')
  const [err,          setErr]          = useState('')
  const [saving,          setSaving]          = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const PAGE_SIZE = 10

  useEffect(() => { loadUsers() }, [])
  useEffect(() => {
    setPendingLoad(true)
    getPendingRegistrations().then(d => { setPending(d); setPendingLoad(false) })
  }, [])

  const pendingCount = pending.filter(r => r.status === 'pending').length

  const filteredUsers = users.filter(u => {
    const matchSearch = !search || u.username.toLowerCase().includes(search.toLowerCase()) || (u.full_name?.toLowerCase() ?? '').includes(search.toLowerCase())
    const matchRegion = !filterRegion || (u.region_scope ?? 'global') === filterRegion
    const matchUnit   = !filterUnit   || (u.unit_scope ?? 'general') === filterUnit
    return matchSearch && matchRegion && matchUnit
  })
  const pagedUsers = filteredUsers.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const totalPages = Math.ceil(filteredUsers.length / PAGE_SIZE)

  const openEdit = (u: Profile) => {
    setEditTarget(u); setEditRole(u.role as Role)
    setEditRegion(u.region_scope ?? 'global'); setEditUnit(u.unit_scope ?? 'general')
    setEditPass(''); setEditEmoji(u.emoji ?? u.avatar_emoji ?? '')
    setEditFullName(u.full_name ?? ''); setEditEmail((u as any).email ?? '')
    setErr(''); setAddMode(false)
  }

  const handleSaveUser = async () => {
    if (!editTarget) return
    setErr(''); setSaving(true)
    const nameParts = editFullName.trim().split(' ').filter(Boolean)
    const initials = nameParts.length >= 2
      ? (nameParts[0][0] + nameParts[1][0]).toUpperCase()
      : editFullName.slice(0, 2).toUpperCase()
    const error = await updateUser(editTarget.id, editRole, editTarget.unit_id ?? '', editPass || undefined, editEmoji, editRegion, editUnit)
    if (!error) {
      await updateProfile(editTarget.id, { full_name: editFullName, initials } as any)
      if (editEmail !== ((editTarget as any).email ?? ''))
        await supabase.from('profiles').update({ email: editEmail }).eq('id', editTarget.id)
    }
    setSaving(false)
    if (error) { setErr(error); return }
    toast('User diperbarui.', 'success'); setEditTarget(null); loadUsers()
  }

  const handleAddUser = async () => {
    setErr(''); setSaving(true)
    const error = await addUser(newUser.trim(), newPass, newRole, newUnit, newRegion, newUnit)
    setSaving(false)
    if (error) { setErr(error); return }
    if (newEmail) {
      const { data: np } = await supabase.from('profiles').select('id').eq('username', newUser.trim().toLowerCase()).single()
      if (np?.id) await supabase.from('profiles').update({ email: newEmail }).eq('id', np.id)
    }
    toast(`"${newUser}" ditambahkan.`, 'success')
    setNewUser(''); setNewPass(''); setNewRole('user'); setNewRegion('sby')
    setNewUnit('general'); setNewFullName(''); setNewEmail(''); setAddMode(false)
    loadUsers()
  }

  const handleApprove = async (reg: PendingRegistration) => {
    const result = await approveRegistration(reg.id, reg, profile!.id)
    if ((result as any).error) { toast('Gagal approve: ' + (result as any).error.message, 'error'); return }
    toast(`${reg.full_name} disetujui.`, 'success')
    setPending(p => p.map(r => r.id === reg.id ? { ...r, status: 'approved' } : r))
  }
  const handleReject = async () => {
    if (!rejectId) return
    await rejectRegistration(rejectId, rejectNote, profile!.id)
    toast('Pendaftaran ditolak.', 'warn')
    setPending(p => p.map(r => r.id === rejectId ? { ...r, status: 'rejected' } : r))
    setRejectId(null); setRejectNote('')
  }

  const badge = getDisplayBadge(profile as any)

  return (
    <div className="admin-page">
      {/* Header */}
      <header className="admin-header">
        <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--silver)', letterSpacing: -0.5 }}>JateamHub</span>
        <span style={{ fontSize: 12, color: 'var(--silver3)', background: 'var(--bg4)', padding: '2px 8px', borderRadius: 99, border: '1px solid var(--border2)' }}>Admin Panel</span>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 13, color: 'var(--silver3)' }}>{profile?.username}</span>
          <button onClick={logout} style={{ height: 32, padding: '0 14px', background: 'var(--red-bg)', border: '1px solid var(--red)', borderRadius: 8, color: 'var(--red)', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            ⏻ Logout
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div className="admin-tabs">
        <button className={`admin-tab${tab === 'pending' ? ' active' : ''}`} onClick={() => setTab('pending')}>
          📋 Pending {pendingCount > 0 && <span style={{ background: 'var(--accent)', color: 'white', borderRadius: 99, padding: '1px 6px', fontSize: 10, marginLeft: 4 }}>{pendingCount}</span>}
        </button>
        <button className={`admin-tab${tab === 'users' ? ' active' : ''}`} onClick={() => setTab('users')}>
          👥 Users ({users.length})
        </button>
      </div>

      {/* Content */}
      <div className="admin-content">

        {/* ── PENDING TAB ── */}
        {tab === 'pending' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <p style={{ fontSize: 13, color: 'var(--silver3)', marginBottom: 4 }}>
              Pendaftaran baru yang menunggu persetujuan.
            </p>
            {pendingLoad ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--silver3)', fontSize: 13 }}>Memuat...</div>
            ) : pending.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--silver3)', fontSize: 13 }}>Tidak ada pendaftaran.</div>
            ) : pending.map(reg => (
              <div key={reg.id} className="pending-card">
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span className="pending-name">{reg.full_name}</span>
                    <span className={`user-badge ${reg.status === 'pending' ? 'badge-pending' : reg.status === 'approved' ? 'badge-approved' : 'badge-rejected'}`}>
                      {reg.status}
                    </span>
                  </div>
                  <div className="pending-meta">
                    <span>👤 {reg.username}</span>
                    <span>📱 {reg.phone}</span>
                    <span>🌏 {REGION_LABELS[reg.region_scope ?? ''] ?? reg.region_scope}</span>
                    <span>🏢 {reg.unit_scope?.toUpperCase()}</span>
                    <span>🗓 {new Date(reg.created_at).toLocaleDateString('id-ID')}</span>
                  </div>
                </div>
                {reg.status === 'pending' && (
                  <div className="pending-actions">
                    <button className="btn btn-primary" style={{ height: 32, fontSize: 12 }} onClick={() => handleApprove(reg)}>✓ Setujui</button>
                    <button className="btn btn-danger" style={{ height: 32, fontSize: 12 }} onClick={() => setRejectId(reg.id)}>✕ Tolak</button>
                  </div>
                )}
              </div>
            ))}

            {/* Reject modal */}
            {rejectId && (
              <div className="modal-overlay" onClick={() => setRejectId(null)}>
                <div className="modal-box" onClick={e => e.stopPropagation()}>
                  <div className="modal-header">
                    <span className="modal-title">Tolak Pendaftaran</span>
                    <button className="modal-close" onClick={() => setRejectId(null)}>✕</button>
                  </div>
                  <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <label style={labelSt}>Alasan penolakan (opsional)</label>
                    <textarea value={rejectNote} onChange={e => setRejectNote(e.target.value)} rows={3}
                      placeholder="Masukkan alasan..." style={{ ...inputSt, height: 'auto', padding: '10px 12px', resize: 'vertical' }} />
                  </div>
                  <div className="modal-footer">
                    <button className="btn btn-secondary" onClick={() => setRejectId(null)}>Batal</button>
                    <button className="btn btn-danger" onClick={handleReject}>Tolak Pendaftaran</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── USERS TAB ── */}
        {tab === 'users' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Filter bar */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <input value={search} onChange={e => { setSearch(e.target.value); setPage(0) }}
                placeholder="Cari username / nama..." style={{ ...inputSt, width: 220 }} />
              <select value={filterRegion} onChange={e => { setFilterRegion(e.target.value); setPage(0) }}
                style={{ ...inputSt, width: 140, appearance: 'auto' }}>
                <option value="">Semua Wilayah</option>
                {REGIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
              <select value={filterUnit} onChange={e => { setFilterUnit(e.target.value); setPage(0) }}
                style={{ ...inputSt, width: 130, appearance: 'auto' }}>
                <option value="">Semua Unit</option>
                {UNITS.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
              </select>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                <span style={{ fontSize: 12, color: 'var(--silver3)', alignSelf: 'center' }}>{filteredUsers.length} user</span>
                <button className="btn btn-primary" style={{ height: 36, fontSize: 12 }}
                  onClick={() => { setAddMode(true); setEditTarget(null); setNewUser(''); setNewPass(''); setNewRole('user'); setNewRegion('sby'); setNewUnit('general'); setNewFullName(''); setNewEmail(''); setErr('') }}>
                  + Tambah User
                </button>
              </div>
            </div>

            {/* Add form */}
            {addMode && (
              <div className="edit-form">
                <div className="edit-form-title">＋ Tambah User Baru</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div><label style={labelSt}>Nama Lengkap</label><input value={newFullName} onChange={e => setNewFullName(e.target.value)} placeholder="Nama lengkap" style={inputSt} /></div>
                  <div><label style={labelSt}>Username *</label><input value={newUser} onChange={e => setNewUser(e.target.value)} placeholder="username" style={inputSt} /></div>
                  <div><label style={labelSt}>Password *</label><input type="password" value={newPass} onChange={e => setNewPass(e.target.value)} placeholder="min. 6 karakter" style={inputSt} /></div>
                  <div><label style={labelSt}>Email</label><input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="user@email.com" style={inputSt} /></div>
                  <div><label style={labelSt}>Role</label>
                    <select value={newRole} onChange={e => setNewRole(e.target.value as Role)} style={{ ...inputSt, appearance: 'auto' }}>
                      {getAllowedRoles(profile as any).map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                  <div><label style={labelSt}>Wilayah</label>
                    <select value={newRegion} onChange={e => setNewRegion(e.target.value)} style={{ ...inputSt, appearance: 'auto' }}>
                      {getAllowedRegions(profile as any).map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                  </div>
                  <div><label style={labelSt}>Unit</label>
                    <select value={newUnit} onChange={e => setNewUnit(e.target.value)} style={{ ...inputSt, appearance: 'auto' }}>
                      {getAllowedUnits(profile as any).map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
                    </select>
                  </div>
                </div>
                {err && <div style={{ color: 'var(--red)', fontSize: 12, padding: '8px 12px', background: 'var(--red-bg)', borderRadius: 8 }}>{err}</div>}
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button className="btn btn-secondary" onClick={() => { setAddMode(false); setErr('') }}>Batal</button>
                  <button className="btn btn-primary" disabled={saving} onClick={handleAddUser}>{saving ? 'Menyimpan...' : 'Tambah User'}</button>
                </div>
              </div>
            )}

            {/* User list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {pagedUsers.map(u => {
                const isEditing = editTarget?.id === u.id
                const ubadge = getDisplayBadge(u as any)
                return (
                  <div key={u.id}>
                    <div className="user-card">
                      <div className="user-avatar">
                        {u.avatar_url ? <img src={u.avatar_url} alt="" /> : ((u as any).emoji || (u as any).avatar_emoji || ((u as any).initials ?? u.username?.slice(0,2).toUpperCase() ?? '?'))}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <span className="user-name">{u.full_name || u.username}</span>
                          {u.id === profile?.id && <span style={{ fontSize: 10, color: 'var(--silver4)' }}>(kamu)</span>}
                          {ubadge && <span className="user-badge" style={{ background: ubadge.color, color: '#0a0a0a' }}>{ubadge.label}</span>}
                        </div>
                        <div className="user-meta">
                          <span>@{u.username}</span>
                          {(u as any).phone && <span>📱 {(u as any).phone}</span>}
                          {u.region_scope && u.region_scope !== 'global' && <span>🌏 {REGION_LABELS[u.region_scope] ?? u.region_scope}</span>}
                          {u.unit_scope && u.unit_scope !== 'general' && <span>🏢 {UNIT_LABELS[u.unit_scope] ?? u.unit_scope}</span>}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                        {canManageUser(profile as any, u as any) && (
                          <>
                            <button className="btn btn-secondary" style={{ height: 30, fontSize: 11, padding: '0 10px' }}
                              onClick={() => isEditing ? setEditTarget(null) : openEdit(u)}>
                              {isEditing ? 'Tutup' : 'Edit'}
                            </button>
                            {u.id !== profile?.id && u.role !== 'superadmin' && (
                              confirmDeleteId === u.id ? (
                                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                                  <span style={{ fontSize: 10, color: 'var(--red)', fontWeight: 600 }}>Yakin hapus?</span>
                                  <button className="btn btn-danger" style={{ height: 28, fontSize: 10, padding: '0 8px' }}
                                    onClick={async () => { await removeUser(u.id); loadUsers(); setConfirmDeleteId(null) }}>Ya</button>
                                  <button className="btn btn-secondary" style={{ height: 28, fontSize: 10, padding: '0 8px' }}
                                    onClick={() => setConfirmDeleteId(null)}>Batal</button>
                                </div>
                              ) : (
                                <button className="btn btn-danger" style={{ height: 30, fontSize: 11, padding: '0 10px' }}
                                  onClick={() => setConfirmDeleteId(u.id)}>
                                  Hapus
                                </button>
                              )
                            )}
                          </>
                        )}
                      </div>
                    </div>

                    {/* Edit form inline */}
                    {isEditing && (
                      <div className="edit-form" style={{ marginTop: 8, marginLeft: 16 }}>
                        <div className="edit-form-title">✏️ Edit: {u.username}</div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                          <div><label style={labelSt}>Nama Lengkap</label><input value={editFullName} onChange={e => setEditFullName(e.target.value)} style={inputSt} /></div>
                          <div><label style={labelSt}>Email</label><input type="email" value={editEmail} onChange={e => setEditEmail(e.target.value)} placeholder="user@email.com" style={inputSt} /></div>
                          <div><label style={labelSt}>Role</label>
                            <select value={editRole} onChange={e => setEditRole(e.target.value as Role)} style={{ ...inputSt, appearance: 'auto' }}>
                              {getAllowedRoles(profile as any).map(r => <option key={r} value={r}>{r}</option>)}
                            </select>
                          </div>
                          <div><label style={labelSt}>Wilayah</label>
                            <select value={editRegion} onChange={e => setEditRegion(e.target.value)} style={{ ...inputSt, appearance: 'auto' }}>
                              {getAllowedRegions(profile as any).map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                            </select>
                          </div>
                          <div><label style={labelSt}>Unit</label>
                            <select value={editUnit} onChange={e => setEditUnit(e.target.value)} style={{ ...inputSt, appearance: 'auto' }}>
                              {getAllowedUnits(profile as any).map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
                            </select>
                          </div>
                          <div><label style={labelSt}>Reset Password (kosong = tidak berubah)</label>
                            <input type="password" value={editPass} onChange={e => setEditPass(e.target.value)} placeholder="Password baru min. 6 karakter" style={inputSt} />
                          </div>
                        </div>
                        {/* Emoji */}
                        <div>
                          <label style={labelSt}>Emoji</label>
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            {EMOJI_PRESETS.map(e => (
                              <button key={e} onClick={() => setEditEmoji(e)} style={{
                                width: 32, height: 32, borderRadius: 6, fontSize: 16,
                                border: `1px solid ${editEmoji === e ? 'var(--accent)' : 'var(--border2)'}`,
                                background: editEmoji === e ? 'var(--accent-light)' : 'var(--bg4)',
                                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                              }}>{e || '✕'}</button>
                            ))}
                          </div>
                        </div>
                        {err && <div style={{ color: 'var(--red)', fontSize: 12, padding: '8px 12px', background: 'var(--red-bg)', borderRadius: 8 }}>{err}</div>}
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                          <button className="btn btn-secondary" onClick={() => { setEditTarget(null); setErr('') }}>Batal</button>
                          <button className="btn btn-primary" disabled={saving} onClick={handleSaveUser}>{saving ? 'Menyimpan...' : 'Simpan'}</button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginTop: 8 }}>
                {Array.from({ length: totalPages }, (_, i) => (
                  <button key={i} onClick={() => setPage(i)} style={{
                    width: 32, height: 32, borderRadius: 8, border: '1px solid var(--border2)',
                    background: page === i ? 'var(--accent)' : 'var(--bg4)',
                    color: page === i ? 'white' : 'var(--silver2)',
                    fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  }}>{i + 1}</button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
