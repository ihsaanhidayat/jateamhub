// ─────────────────────────────────────────────────────────────
// SUPERADMIN DASHBOARD — User Management + Pending Registrations
// ─────────────────────────────────────────────────────────────
import { useState, useEffect } from 'react'
import { useAuthStore } from '../../store/authStore'
import { useStore } from '../../store/dashboardStore'
import {
  getPendingRegistrations, approveRegistration, rejectRegistration,
} from '../../utils/supabaseClient'
import type { PendingRegistration } from '../../utils/supabaseClient'
import { REGION_LABELS, UNIT_LABELS, canManageUser, getAllowedRoles, getAllowedRegions, getAllowedUnits, getDisplayBadge } from '../../utils/roles'
import type { Role } from '../../types'
import type { Profile } from '../../utils/supabaseClient'
import { REGIONS, UNITS } from '../../types'
import { updateProfile } from '../../utils/supabaseClient'

const EMOJI_PRESETS = ['','🌸','🔥','⭐','🎯','💎','🚀','🌊','🦁','🐯','🌺','🎨','💡','🍀','🎭','🏆','🦋','🌙','☀️','🍉']

export default function SuperadminDashboard() {
  const { profile, logout, users, loadUsers, addUser, updateUser, removeUser } = useAuthStore()
  const { toast } = useStore()

  const [tab, setTab] = useState<'pending' | 'users'>('pending')
  const [pending,     setPending]     = useState<PendingRegistration[]>([])
  const [pendingLoad, setPendingLoad] = useState(false)
  const [rejectId,    setRejectId]    = useState<string | null>(null)
  const [rejectNote,  setRejectNote]  = useState('')

  // Users management state
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
  const [addMode,      setAddMode]      = useState(false)
  const [newUser,      setNewUser]      = useState('')
  const [newPass,      setNewPass]      = useState('')
  const [newRole,      setNewRole]      = useState<Role>('user')
  const [newRegion,    setNewRegion]    = useState('sby')
  const [newUnit,      setNewUnit]      = useState('general')
  const [newFullName,  setNewFullName]  = useState('')
  const [err,          setErr]          = useState('')
  const [saving,       setSaving]       = useState(false)

  const PER_PAGE = 50
  const pendingCount = pending.filter(p => p.status === 'pending').length

  useEffect(() => {
    loadPending()
    loadUsers()
  }, [])

  const loadPending = async () => {
    setPendingLoad(true)
    const data = await getPendingRegistrations()
    setPending(data)
    setPendingLoad(false)
  }

  const handleApprove = async (reg: PendingRegistration) => {
    if (!profile) return
    const result = await approveRegistration(reg.id, reg, profile.id)
    if ((result as any).error) { toast('Gagal approve: ' + (result as any).error.message, 'error'); return }
    toast(`✅ Akun "${reg.username}" berhasil dibuat.`, 'success')
    loadPending(); loadUsers()
  }

  const handleReject = async () => {
    if (!rejectId || !profile) return
    await rejectRegistration(rejectId, profile.id, rejectNote || undefined)
    toast('Pendaftaran ditolak.', 'warn')
    setRejectId(null); setRejectNote('')
    loadPending()
  }

  const filteredUsers = users.filter(u => {
    const matchSearch = !search ||
      u.username.toLowerCase().includes(search.toLowerCase()) ||
      (u.full_name ?? '').toLowerCase().includes(search.toLowerCase())
    const matchRegion = !filterRegion || (u.region_scope ?? 'global') === filterRegion
    const matchUnit   = !filterUnit   || (u.unit_scope   ?? 'general') === filterUnit
    return matchSearch && matchRegion && matchUnit
  })
  const pagedUsers = filteredUsers.slice(page * PER_PAGE, (page + 1) * PER_PAGE)
  const totalPages = Math.ceil(filteredUsers.length / PER_PAGE)

  const openEdit = (u: Profile) => {
    setEditTarget(u); setEditRole(u.role as Role)
    setEditRegion(u.region_scope ?? 'global'); setEditUnit(u.unit_scope ?? 'general')
    setEditPass(''); setEditEmoji(u.emoji ?? u.avatar_emoji ?? '')
    setEditFullName(u.full_name ?? ''); setErr(''); setAddMode(false)
  }

  const handleSaveUser = async () => {
    if (!editTarget) return
    setErr(''); setSaving(true)
    // Update initials otomatis dari full_name
    const nameParts = editFullName.trim().split(' ').filter(Boolean)
    const initials = nameParts.length >= 2
      ? (nameParts[0][0] + nameParts[1][0]).toUpperCase()
      : editFullName.slice(0, 2).toUpperCase()

    const error = await updateUser(editTarget.id, editRole, editUnit, editPass || undefined, editEmoji, editRegion, editUnit)
    if (!error) {
      await updateProfile(editTarget.id, { full_name: editFullName, initials } as any)
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
    toast(`"${newUser}" ditambahkan.`, 'success')
    setNewUser(''); setNewPass(''); setNewRole('user'); setNewRegion('sby'); setNewUnit('general')
    setNewFullName(''); setAddMode(false); loadUsers()
  }

  const inputSt: React.CSSProperties = {
    width: '100%', background: 'var(--bg2)', border: '1px solid var(--border2)',
    borderRadius: 6, padding: '8px 10px', color: 'var(--silver)', fontSize: 12,
    fontFamily: 'var(--font)', boxSizing: 'border-box',
  }
  const labelSt: React.CSSProperties = {
    fontSize: 9, color: 'var(--silver3)', display: 'block', marginBottom: 4,
    textTransform: 'uppercase', letterSpacing: '1px', fontFamily: 'var(--mono)',
  }

  return (
    <div style={{
      minHeight: '100dvh', background: 'var(--bg)',
      display: 'flex', flexDirection: 'column', fontFamily: 'var(--font)',
    }}>
      {/* Header */}
      <div style={{
        padding: '0 24px', height: 60,
        background: 'var(--header-bg)', backdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--border2)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0, zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--accent)' }}>JateamHub</span>
          <span style={{ fontSize: 11, color: 'var(--silver3)', fontFamily: 'var(--mono)' }}>Admin Panel</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 12, color: 'var(--silver3)' }}>{profile?.username}</span>
          <button onClick={() => logout()} style={{
            padding: '6px 14px', background: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.25)', borderRadius: 6,
            color: 'var(--red)', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font)',
          }}>⏻ Logout</button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: 'var(--bg2)', flexShrink: 0 }}>
        {[
          { id: 'pending', label: `📋 Pending${pendingCount > 0 ? ` (${pendingCount})` : ''}` },
          { id: 'users',   label: `👥 Users (${users.length})` },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id as any)} style={{
            padding: '12px 24px', fontSize: 12, fontWeight: 700,
            background: tab === t.id ? 'var(--mint-bg)' : 'none',
            border: 'none', borderBottom: `2px solid ${tab === t.id ? 'var(--accent)' : 'transparent'}`,
            color: tab === t.id ? 'var(--accent)' : 'var(--silver3)',
            cursor: 'pointer', fontFamily: 'var(--font)', letterSpacing: '.5px',
          }}>{t.label}</button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>

        {/* ── PENDING TAB ── */}
        {tab === 'pending' && (
          <div style={{ maxWidth: 720, margin: '0 auto' }}>
            <div style={{ fontSize: 13, color: 'var(--silver3)', marginBottom: 16 }}>
              Pendaftaran baru yang menunggu persetujuan.
            </div>

            {pendingLoad ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--silver3)' }}>Memuat...</div>
            ) : pending.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 60, color: 'var(--silver3)' }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>📋</div>
                <div>Tidak ada pendaftaran.</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {pending.map(reg => (
                  <div key={reg.id} style={{
                    background: 'var(--card-bg)', backdropFilter: 'blur(12px)',
                    border: `1px solid ${reg.status === 'pending' ? 'var(--border2)' : 'var(--border)'}`,
                    borderRadius: 10, padding: '16px 18px',
                    opacity: reg.status !== 'pending' ? 0.5 : 1,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap' }}>
                      <div style={{ flex: 1, minWidth: 200 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--silver)' }}>{reg.full_name}</span>
                          <span style={{
                            fontSize: 9, fontWeight: 800, padding: '2px 7px', borderRadius: 8,
                            background: reg.status === 'pending' ? 'var(--accent)' : reg.status === 'approved' ? '#22C55E' : '#EF4444',
                            color: '#0A0A0A', fontFamily: 'var(--mono)', textTransform: 'uppercase',
                          }}>{reg.status}</span>
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--silver3)', display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                          <span>👤 {reg.username}</span>
                          <span>📱 {reg.phone}</span>
                          <span>🌍 {REGION_LABELS[reg.region_scope] ?? reg.region_scope}</span>
                          <span>🏢 {UNIT_LABELS[reg.unit_scope] ?? reg.unit_scope}</span>
                          <span>🕐 {new Date(reg.created_at).toLocaleDateString('id-ID')}</span>
                        </div>
                        {reg.notes && <div style={{ fontSize: 11, color: 'var(--red)', marginTop: 4 }}>Catatan: {reg.notes}</div>}
                      </div>
                      {reg.status === 'pending' && (
                        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                          <button onClick={() => handleApprove(reg)} style={{
                            padding: '7px 16px', background: 'rgba(34,197,94,0.1)',
                            border: '1px solid rgba(34,197,94,0.3)', borderRadius: 6,
                            color: '#22C55E', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font)',
                          }}>✓ Setujui</button>
                          <button onClick={() => setRejectId(reg.id)} style={{
                            padding: '7px 16px', background: 'rgba(239,68,68,0.08)',
                            border: '1px solid rgba(239,68,68,0.25)', borderRadius: 6,
                            color: 'var(--red)', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font)',
                          }}>✕ Tolak</button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Reject modal */}
            {rejectId && (
              <div style={{
                position: 'fixed', inset: 0, zIndex: 9000,
                background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
              }}>
                <div style={{
                  background: 'var(--bg3)', border: '1px solid var(--border2)',
                  borderRadius: 12, padding: 24, maxWidth: 400, width: '100%',
                  boxShadow: 'var(--shadow-lg)',
                }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--silver)', marginBottom: 14 }}>
                    Tolak Pendaftaran
                  </div>
                  <textarea
                    value={rejectNote} onChange={e => setRejectNote(e.target.value)}
                    placeholder="Alasan penolakan (opsional)..."
                    style={{ ...inputSt, height: 80, resize: 'vertical', marginBottom: 14 }}
                  />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => setRejectId(null)} style={{ flex: 1, padding: '9px', background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 6, color: 'var(--silver3)', cursor: 'pointer', fontFamily: 'var(--font)', fontSize: 12 }}>Batal</button>
                    <button onClick={handleReject} style={{ flex: 2, padding: '9px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6, color: 'var(--red)', cursor: 'pointer', fontFamily: 'var(--font)', fontSize: 12, fontWeight: 700 }}>Tolak Pendaftaran</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── USERS TAB ── */}
        {tab === 'users' && (
          <div style={{ maxWidth: 900, margin: '0 auto' }}>
            {/* Filters */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14, alignItems: 'center' }}>
              <input value={search} onChange={e => { setSearch(e.target.value); setPage(0) }}
                placeholder="🔍 Cari username / nama..." style={{ ...inputSt, flex: 1, minWidth: 160 }} />
              <select value={filterRegion} onChange={e => { setFilterRegion(e.target.value); setPage(0) }}
                style={{ ...inputSt, width: 'auto' }}>
                <option value="">Semua Wilayah</option>
                {REGIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
              <select value={filterUnit} onChange={e => { setFilterUnit(e.target.value); setPage(0) }}
                style={{ ...inputSt, width: 'auto' }}>
                <option value="">Semua Unit</option>
                {UNITS.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
              </select>
              <button onClick={() => { setAddMode(true); setEditTarget(null); setErr('') }} style={{
                padding: '8px 16px', background: 'var(--mint-bg)', border: '1px solid rgba(110,231,183,0.3)',
                borderRadius: 6, color: 'var(--accent)', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                fontFamily: 'var(--font)', whiteSpace: 'nowrap',
              }}>＋ Tambah</button>
            </div>

            <div style={{ fontSize: 11, color: 'var(--silver3)', marginBottom: 10 }}>
              {filteredUsers.length} dari {users.length} user
              {totalPages > 1 && ` · Hal. ${page + 1}/${totalPages}`}
            </div>

            {/* Add / Edit form */}
            {(addMode || editTarget) && (
              <div style={{
                background: 'var(--card-bg)', backdropFilter: 'blur(12px)',
                border: '1px solid var(--border2)', borderRadius: 10, padding: 18, marginBottom: 14,
              }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)', marginBottom: 14 }}>
                  {addMode ? '＋ Tambah User Baru' : `✏️ Edit: ${editTarget?.username}${editEmoji ? ' ' + editEmoji : ''}`}
                </div>

                {addMode && (
                  <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                    <div style={{ flex: 1 }}>
                      <label style={labelSt}>Nama Lengkap</label>
                      <input value={newFullName} onChange={e => setNewFullName(e.target.value)} placeholder="Nama lengkap" style={inputSt} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={labelSt}>Username</label>
                      <input value={newUser} onChange={e => setNewUser(e.target.value)} placeholder="username" style={inputSt} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={labelSt}>Password</label>
                      <input type="password" value={newPass} onChange={e => setNewPass(e.target.value)} placeholder="min. 6 karakter" style={inputSt} />
                    </div>
                  </div>
                )}

                {!addMode && (
                  <div style={{ marginBottom: 10 }}>
                    <label style={labelSt}>Nama Lengkap</label>
                    <input value={editFullName} onChange={e => setEditFullName(e.target.value)} placeholder="Nama lengkap" style={inputSt} />
                  </div>
                )}

                <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 100 }}>
                    <label style={labelSt}>Role</label>
                    <select value={addMode ? newRole : editRole}
                      onChange={e => addMode ? setNewRole(e.target.value as Role) : setEditRole(e.target.value as Role)}
                      disabled={!addMode && editTarget?.id === profile?.id}
                      style={inputSt}>
                      {getAllowedRoles(profile as any).map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                  <div style={{ flex: 1, minWidth: 100 }}>
                    <label style={labelSt}>Wilayah</label>
                    <select value={addMode ? newRegion : editRegion}
                      onChange={e => addMode ? setNewRegion(e.target.value) : setEditRegion(e.target.value)}
                      style={inputSt}>
                      {getAllowedRegions(profile as any).map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                  </div>
                  <div style={{ flex: 1, minWidth: 100 }}>
                    <label style={labelSt}>Unit</label>
                    <select value={addMode ? newUnit : editUnit}
                      onChange={e => addMode ? setNewUnit(e.target.value) : setEditUnit(e.target.value)}
                      style={inputSt}>
                      {getAllowedUnits(profile as any).map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
                    </select>
                  </div>
                </div>

                {!addMode && (
                  <div style={{ marginBottom: 10 }}>
                    <label style={labelSt}>Reset Password (kosong = tidak berubah)</label>
                    <input type="password" value={editPass} onChange={e => setEditPass(e.target.value)} placeholder="Password baru min. 6 karakter" style={inputSt} />
                  </div>
                )}

                {!addMode && (
                  <div style={{ marginBottom: 10 }}>
                    <label style={labelSt}>Emoji (tampil di samping nama)</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {EMOJI_PRESETS.map(e => (
                        <div key={e} onClick={() => setEditEmoji(e)} style={{
                          width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: e ? 14 : 9, cursor: 'pointer', borderRadius: 5,
                          border: `1px solid ${editEmoji === e ? 'var(--accent)' : 'var(--border2)'}`,
                          background: editEmoji === e ? 'var(--mint-bg2)' : 'var(--bg4)',
                          color: e ? 'inherit' : 'var(--silver3)',
                        }}>{e || '✕'}</div>
                      ))}
                    </div>
                  </div>
                )}

                {err && <div style={{ color: 'var(--red)', fontSize: 12, marginBottom: 8 }}>{err}</div>}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => { setAddMode(false); setEditTarget(null); setErr('') }}
                    style={{ flex: 1, padding: '8px', background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 6, color: 'var(--silver3)', cursor: 'pointer', fontFamily: 'var(--font)', fontSize: 12 }}>Batal</button>
                  <button onClick={addMode ? handleAddUser : handleSaveUser} disabled={saving}
                    style={{ flex: 2, padding: '8px', background: 'var(--mint-bg)', border: '1px solid var(--accent)', borderRadius: 6, color: 'var(--accent)', cursor: 'pointer', fontFamily: 'var(--font)', fontSize: 12, fontWeight: 700 }}>
                    {saving ? 'Menyimpan...' : 'Simpan'}
                  </button>
                </div>
              </div>
            )}

            {/* User list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {pagedUsers.map(u => {
                const b      = getDisplayBadge(u as any)
                const isMe   = u.id === profile?.id
                const canEd  = canManageUser(profile as any, u as any)
                const inits  = (u as any).initials || (u.full_name?.slice(0, 2) || u.username.slice(0, 2)).toUpperCase()
                return (
                  <div key={u.id} style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                    background: 'var(--card-bg)', backdropFilter: 'blur(8px)',
                    border: `1px solid ${isMe ? 'rgba(110,231,183,0.2)' : 'var(--border)'}`,
                    borderRadius: 8, transition: 'border-color .15s',
                  }}>
                    {/* Inisial avatar */}
                    <div style={{
                      width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                      background: u.avatar_url ? 'transparent' : 'var(--mint-bg2)',
                      border: '1.5px solid var(--border2)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      overflow: 'hidden', fontSize: 12, fontWeight: 800, color: 'var(--accent)',
                    }}>
                      {u.avatar_url
                        ? <img src={u.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : inits}
                    </div>
                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: isMe ? 'var(--accent)' : 'var(--silver)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {u.username}{(u as any).emoji ? ` ${(u as any).emoji}` : ''}{isMe && <span style={{ fontSize: 10, color: 'var(--silver3)', marginLeft: 5 }}>(kamu)</span>}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--silver3)', marginTop: 2 }}>
                        {u.full_name && <span style={{ marginRight: 8 }}>{u.full_name}</span>}
                        <span style={{ fontSize: 8, fontWeight: 800, padding: '1px 6px', borderRadius: 8, background: b.color, color: '#0A0A0A', textTransform: 'uppercase', fontFamily: 'var(--mono)', marginRight: 4 }}>{b.label}</span>
                        {(u.region_scope && u.region_scope !== 'global') && <span style={{ fontSize: 9, color: 'var(--silver3)', fontFamily: 'var(--mono)' }}>{REGION_LABELS[u.region_scope] ?? u.region_scope}</span>}
                      </div>
                    </div>
                    {/* Actions */}
                    {canEd && (
                      <button onClick={() => openEdit(u)}
                        style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 5, color: 'var(--silver3)', padding: '5px 10px', fontSize: 11, cursor: 'pointer', fontFamily: 'var(--font)' }}
                        onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
                        onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border2)')}>Edit</button>
                    )}
                    {canEd && !isMe && (
                      <button onClick={async () => {
                        if (!confirm(`Hapus user "${u.username}"?`)) return
                        const err = await removeUser(u.id)
                        if (err) toast(err, 'error')
                        else { toast(`"${u.username}" dihapus.`, 'success'); loadUsers() }
                      }} style={{ background: 'none', border: 'none', color: 'var(--silver3)', cursor: 'pointer', fontSize: 15, padding: '2px 4px' }}
                        onMouseEnter={e => (e.currentTarget.style.color = 'var(--red)')}
                        onMouseLeave={e => (e.currentTarget.style.color = 'var(--silver3)')}>🗑</button>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: 5, marginTop: 14 }}>
                <button onClick={() => setPage(p => Math.max(0, p-1))} disabled={page===0}
                  style={{ padding: '5px 12px', background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 5, color: page===0 ? 'var(--silver3)' : 'var(--silver)', cursor: page===0 ? 'not-allowed' : 'pointer', fontSize: 12 }}>← Prev</button>
                {Array.from({length: Math.min(totalPages, 7)}, (_,i) => {
                  const p = totalPages <= 7 ? i : Math.max(0, Math.min(page-3, totalPages-7))+i
                  return <button key={p} onClick={() => setPage(p)} style={{ padding: '5px 10px', background: p===page ? 'var(--mint-bg2)' : 'var(--bg2)', border: `1px solid ${p===page ? 'var(--accent)' : 'var(--border2)'}`, borderRadius: 5, color: p===page ? 'var(--accent)' : 'var(--silver)', cursor: 'pointer', fontSize: 12 }}>{p+1}</button>
                })}
                <button onClick={() => setPage(p => Math.min(totalPages-1, p+1))} disabled={page>=totalPages-1}
                  style={{ padding: '5px 12px', background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 5, color: page>=totalPages-1 ? 'var(--silver3)' : 'var(--silver)', cursor: page>=totalPages-1 ? 'not-allowed' : 'pointer', fontSize: 12 }}>Next →</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
