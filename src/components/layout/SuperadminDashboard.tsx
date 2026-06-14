// ─────────────────────────────────────────────────────────────
// SUPERADMIN DASHBOARD — Clean, Elegant, Minimalist
// ─────────────────────────────────────────────────────────────
import { useState, useEffect } from 'react'
import { useAuthStore } from '../../store/authStore'
import { useStore } from '../../store/dashboardStore'
import { useChatStore } from '../../store/chatStore'
import {
  getPendingRegistrations, approveRegistration, rejectRegistration,
  supabase, updateProfile, logAudit, getAuditLogs,
  getAllAnnouncements, createAnnouncement, deactivateAnnouncement, triggerAnnouncePush,
} from '../../utils/supabaseClient'
import type { PendingRegistration, AuditLog, Announcement } from '../../utils/supabaseClient'
import { REGION_LABELS, UNIT_LABELS, canManageUser, getAllowedRoles, getAllowedRegions, getAllowedUnits, getDisplayBadge } from '../../utils/roles'
import type { Role } from '../../types'
import type { Profile } from '../../utils/supabaseClient'
import { REGIONS, UNITS } from '../../types'
import { useT } from '../../utils/i18n'

const EMOJI_PRESETS = ['','🌸','🔥','⭐','🎯','💎','🚀','🌊','🦁','🐯','🌺','🎨','💡','🍀','🏆','🦋','🌙','☀️','🍉']

const AUDIT_LABELS: Record<string, { label: string; color: string }> = {
  'auth.login':          { label: 'LOGIN',       color: '#64748b' },
  'user.create':         { label: 'BUAT USER',   color: '#22c55e' },
  'user.update':         { label: 'UBAH USER',   color: '#D97706' },
  'user.delete':         { label: 'HAPUS USER',  color: '#ef4444' },
  'chat.toggle_global':  { label: 'CHAT GLOBAL', color: '#0ea5e9' },
  'chat.toggle_user':    { label: 'CHAT USER',   color: '#0ea5e9' },
  'announcement.send':   { label: 'PENGUMUMAN',  color: '#8b5cf6' },
}

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
  const t = useT()
  const { profile, logout, users, loadUsers, addUser, updateUser, removeUser } = useAuthStore()
  const toast = useStore.getState().toast

  const [tab, setTab] = useState<'pending' | 'users' | 'audit' | 'settings'>('pending')
  const { enabled: chatEnabled, setEnabled: setChatEnabled, loadEnabled } = useChatStore()

  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  const [auditLoad, setAuditLoad] = useState(false)
  const loadAudit = async () => {
    setAuditLoad(true)
    setAuditLogs(await getAuditLogs(300))
    setAuditLoad(false)
  }

  // Announcements
  const [annList,   setAnnList]   = useState<Announcement[]>([])
  const [annTitle,  setAnnTitle]  = useState('')
  const [annBody,   setAnnBody]   = useState('')
  const [annRole,   setAnnRole]   = useState('')
  const [annRegion, setAnnRegion] = useState('')
  const [annUnit,   setAnnUnit]   = useState('')
  const [annSending, setAnnSending] = useState(false)
  const loadAnnouncements = async () => setAnnList(await getAllAnnouncements())

  const sendAnnouncement = async () => {
    if (!annTitle.trim() || !annBody.trim() || !profile) return
    setAnnSending(true)
    const { data, error } = await createAnnouncement({
      title: annTitle.trim(), body: annBody.trim(),
      target_role: annRole || null, target_region: annRegion || null, target_unit: annUnit || null,
    }, profile.id)
    setAnnSending(false)
    if (error || !data) { toast(t('adm.annfail'), 'error'); return }
    void logAudit('announcement.send', { target_type: 'announcement', target_id: data.id, target_label: annTitle.trim(), metadata: { role: annRole || 'semua', region: annRegion || 'semua', unit: annUnit || 'semua' } })
    void triggerAnnouncePush(data.id)
    setAnnTitle(''); setAnnBody(''); setAnnRole(''); setAnnRegion(''); setAnnUnit('')
    toast(t('adm.annsent'), 'success')
    loadAnnouncements()
  }

  const removeAnnouncement = async (id: string) => {
    await deactivateAnnouncement(id)
    loadAnnouncements()
  }

  useEffect(() => { loadEnabled() }, [])
  useEffect(() => { if (tab === 'audit') loadAudit() }, [tab])
  useEffect(() => { if (tab === 'settings') loadAnnouncements() }, [tab])
  const [pending,     setPending]     = useState<PendingRegistration[]>([])
  const [pendingLoad, setPendingLoad] = useState(false)
  const [rejectId,    setRejectId]    = useState<string | null>(null)
  const [rejectNote,  setRejectNote]  = useState('')

  const [search,       setSearch]       = useState('')
  const [filterRegion, setFilterRegion] = useState('')
  const [filterUnit,   setFilterUnit]   = useState('')
  const [page,         setPage]         = useState(0)
  const [editTarget,    setEditTarget]    = useState<Profile | null>(null)
  const [editRole,      setEditRole]      = useState<Role>('user')
  const [editRegion,    setEditRegion]    = useState('global')
  const [editUnit,      setEditUnit]      = useState('general')
  const [editPass,      setEditPass]      = useState('')
  const [editEmoji,     setEditEmoji]     = useState('')
  const [editFullName,  setEditFullName]  = useState('')
  const [editEmail,     setEditEmail]     = useState('')
  const [editChatEnabled, setEditChatEnabled] = useState(false)
  const [togglingChat, setTogglingChat]   = useState<string | null>(null)
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
    setEditChatEnabled(u.chat_enabled ?? false)
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
      await updateProfile(editTarget.id, { full_name: editFullName, initials, chat_enabled: editChatEnabled } as any)
      if (editEmail !== ((editTarget as any).email ?? ''))
        await supabase.from('profiles').update({ email: editEmail }).eq('id', editTarget.id)
    }
    setSaving(false)
    if (error) { setErr(error); return }
    toast(t('adm.userupdated'), 'success'); setEditTarget(null); loadUsers()
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
    toast(t('adm.useradded', { name: newUser }), 'success')
    setNewUser(''); setNewPass(''); setNewRole('user'); setNewRegion('sby')
    setNewUnit('general'); setNewFullName(''); setNewEmail(''); setAddMode(false)
    loadUsers()
  }

  const handleApprove = async (reg: PendingRegistration) => {
    const result = await approveRegistration(reg.id, reg, profile!.id)
    if ((result as any).error) { toast(t('adm.approvefail', { err: (result as any).error.message }), 'error'); return }
    toast(t('adm.regapproved', { name: reg.full_name }), 'success')
    setPending(p => p.map(r => r.id === reg.id ? { ...r, status: 'approved' } : r))
  }
  const handleReject = async () => {
    if (!rejectId) return
    await rejectRegistration(rejectId, rejectNote, profile!.id)
    toast(t('adm.regrejected'), 'warn')
    setPending(p => p.map(r => r.id === rejectId ? { ...r, status: 'rejected' } : r))
    setRejectId(null); setRejectNote('')
  }

  const badge = getDisplayBadge(profile as any)

  return (
    <div className="admin-page">
      {/* Header */}
      <header className="admin-header">
        <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--silver)', letterSpacing: -0.5 }}>JateamHub</span>
        <span style={{ fontSize: 12, color: 'var(--silver3)', background: 'var(--bg4)', padding: '2px 8px', borderRadius: 99, border: '1px solid var(--border2)' }}>{t('adm.panel')}</span>
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
        <button className={`admin-tab${tab === 'audit' ? ' active' : ''}`} onClick={() => setTab('audit')}>
          🛡️ {t('adm.tab.audit')}
        </button>
        <button className={`admin-tab${tab === 'settings' ? ' active' : ''}`} onClick={() => setTab('settings')}>
          ⚙️ {t('adm.tab.settings')}
        </button>
      </div>

      {/* Content */}
      <div className="admin-content">

        {/* ── PENDING TAB ── */}
        {tab === 'pending' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <p style={{ fontSize: 13, color: 'var(--silver3)', marginBottom: 4 }}>
              {t('adm.pendingdesc')}
            </p>
            {pendingLoad ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--silver3)', fontSize: 13 }}>{t('adm.loading')}</div>
            ) : pending.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--silver3)', fontSize: 13 }}>{t('adm.noreg')}</div>
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
                    <span className="modal-title">{t('adm.reject')}</span>
                    <button className="modal-close" onClick={() => setRejectId(null)}>✕</button>
                  </div>
                  <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <label style={labelSt}>{t('adm.rejectreason')}</label>
                    <textarea value={rejectNote} onChange={e => setRejectNote(e.target.value)} rows={3}
                      placeholder={t('adm.reasonph')} style={{ ...inputSt, height: 'auto', padding: '10px 12px', resize: 'vertical' }} />
                  </div>
                  <div className="modal-footer">
                    <button className="btn btn-secondary" onClick={() => setRejectId(null)}>{t('cancel')}</button>
                    <button className="btn btn-danger" onClick={handleReject}>{t('adm.reject')}</button>
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
                placeholder={t('adm.searchuser')} style={{ ...inputSt, width: 220 }} />
              <select value={filterRegion} onChange={e => { setFilterRegion(e.target.value); setPage(0) }}
                style={{ ...inputSt, width: 140, appearance: 'auto' }}>
                <option value="">{t('adm.allregions')}</option>
                {REGIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
              <select value={filterUnit} onChange={e => { setFilterUnit(e.target.value); setPage(0) }}
                style={{ ...inputSt, width: 130, appearance: 'auto' }}>
                <option value="">{t('adm.allunits')}</option>
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
                  <div><label style={labelSt}>{t('fullname')}</label><input value={newFullName} onChange={e => setNewFullName(e.target.value)} placeholder={t('adm.fullnameph')} style={inputSt} /></div>
                  <div><label style={labelSt}>{t('adm.usernamereq')}</label><input value={newUser} onChange={e => setNewUser(e.target.value)} placeholder="username" style={inputSt} /></div>
                  <div><label style={labelSt}>{t('adm.passwordreq')}</label><input type="password" value={newPass} onChange={e => setNewPass(e.target.value)} placeholder="min. 6 karakter" style={inputSt} /></div>
                  <div><label style={labelSt}>{t('adm.email')}</label><input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="user@email.com" style={inputSt} /></div>
                  <div><label style={labelSt}>{t('p.role')}</label>
                    <select value={newRole} onChange={e => setNewRole(e.target.value as Role)} style={{ ...inputSt, appearance: 'auto' }}>
                      {getAllowedRoles(profile as any).map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                  <div><label style={labelSt}>{t('p.region')}</label>
                    <select value={newRegion} onChange={e => setNewRegion(e.target.value)} style={{ ...inputSt, appearance: 'auto' }}>
                      {getAllowedRegions(profile as any).map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                  </div>
                  <div><label style={labelSt}>{t('p.unit')}</label>
                    <select value={newUnit} onChange={e => setNewUnit(e.target.value)} style={{ ...inputSt, appearance: 'auto' }}>
                      {getAllowedUnits(profile as any).map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
                    </select>
                  </div>
                </div>
                {err && <div style={{ color: 'var(--red)', fontSize: 12, padding: '8px 12px', background: 'var(--red-bg)', borderRadius: 8 }}>{err}</div>}
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button className="btn btn-secondary" onClick={() => { setAddMode(false); setErr('') }}>{t('cancel')}</button>
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
                      <div style={{ display: 'flex', gap: 6, flexShrink: 0, alignItems: 'center' }}>
                        {/* Quick chat toggle */}
                        {u.role !== 'superadmin' && (
                          <button
                            title={u.chat_enabled ? 'Chat aktif — klik untuk nonaktifkan' : 'Chat nonaktif — klik untuk aktifkan'}
                            disabled={togglingChat === u.id}
                            onClick={async () => {
                              setTogglingChat(u.id)
                              const newVal = !u.chat_enabled
                              await updateProfile(u.id, { chat_enabled: newVal })
                              void logAudit('chat.toggle_user', { target_type: 'user', target_id: u.id, target_label: u.username, metadata: { enabled: newVal } })
                              await loadUsers(true)
                              setTogglingChat(null)
                              toast(t('adm.chattoggleuser', { state: newVal ? t('adm.chaton') : t('adm.chatoff'), name: u.full_name || u.username }), 'success')
                            }}
                            style={{
                              height: 30, padding: '0 8px',
                              background: u.chat_enabled ? 'color-mix(in srgb, var(--accent) 15%, transparent)' : 'var(--bg4)',
                              border: `1px solid ${u.chat_enabled ? 'var(--accent)' : 'var(--border2)'}`,
                              borderRadius: 8, cursor: 'pointer', fontSize: 13,
                              color: u.chat_enabled ? 'var(--accent)' : 'var(--silver4)',
                              transition: 'all 150ms', display: 'flex', alignItems: 'center', gap: 4,
                            }}
                          >
                            {togglingChat === u.id
                              ? <span style={{ width: 12, height: 12, border: '2px solid var(--border2)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} />
                              : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                            }
                            <span style={{ fontSize: 10, fontWeight: 600, fontFamily: 'var(--mono)' }}>
                              {u.chat_enabled ? 'ON' : 'OFF'}
                            </span>
                          </button>
                        )}
                        {canManageUser(profile as any, u as any) && (
                          <>
                            <button className="btn btn-secondary" style={{ height: 30, fontSize: 11, padding: '0 10px' }}
                              onClick={() => isEditing ? setEditTarget(null) : openEdit(u)}>
                              {isEditing ? 'Tutup' : 'Edit'}
                            </button>
                            {u.id !== profile?.id && u.role !== 'superadmin' && (
                              confirmDeleteId === u.id ? (
                                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                                  <span style={{ fontSize: 10, color: 'var(--red)', fontWeight: 600 }}>{t('adm.confirmdel')}</span>
                                  <button className="btn btn-danger" style={{ height: 28, fontSize: 10, padding: '0 8px' }}
                                    onClick={async () => { await removeUser(u.id); loadUsers(); setConfirmDeleteId(null) }}>Ya</button>
                                  <button className="btn btn-secondary" style={{ height: 28, fontSize: 10, padding: '0 8px' }}
                                    onClick={() => setConfirmDeleteId(null)}>{t('cancel')}</button>
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
                          <div><label style={labelSt}>{t('fullname')}</label><input value={editFullName} onChange={e => setEditFullName(e.target.value)} style={inputSt} /></div>
                          <div><label style={labelSt}>{t('adm.email')}</label><input type="email" value={editEmail} onChange={e => setEditEmail(e.target.value)} placeholder="user@email.com" style={inputSt} /></div>
                          <div><label style={labelSt}>{t('p.role')}</label>
                            <select value={editRole} onChange={e => setEditRole(e.target.value as Role)} style={{ ...inputSt, appearance: 'auto' }}>
                              {getAllowedRoles(profile as any).map(r => <option key={r} value={r}>{r}</option>)}
                            </select>
                          </div>
                          <div><label style={labelSt}>{t('p.region')}</label>
                            <select value={editRegion} onChange={e => setEditRegion(e.target.value)} style={{ ...inputSt, appearance: 'auto' }}>
                              {getAllowedRegions(profile as any).map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                            </select>
                          </div>
                          <div><label style={labelSt}>{t('p.unit')}</label>
                            <select value={editUnit} onChange={e => setEditUnit(e.target.value)} style={{ ...inputSt, appearance: 'auto' }}>
                              {getAllowedUnits(profile as any).map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
                            </select>
                          </div>
                          <div><label style={labelSt}>{t('adm.resetpw')}</label>
                            <input type="password" value={editPass} onChange={e => setEditPass(e.target.value)} placeholder={t('adm.newpwph')} style={inputSt} />
                          </div>
                        </div>
                        {/* Chat toggle (only for non-superadmin) */}
                        {editTarget?.role !== 'superadmin' && (
                          <div style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '12px 14px', background: 'var(--bg4)',
                            border: '1px solid var(--border2)', borderRadius: 10,
                          }}>
                            <div>
                              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--silver)' }}>{t('adm.chataccess')}</div>
                              <div style={{ fontSize: 11, color: 'var(--silver4)', marginTop: 2 }}>
                                User ini {editChatEnabled ? 'dapat' : 'tidak dapat'} menggunakan chat internal.
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => setEditChatEnabled(v => !v)}
                              style={{
                                flexShrink: 0, width: 48, height: 26, borderRadius: 13,
                                background: editChatEnabled ? 'var(--accent)' : 'var(--border2)',
                                border: 'none', cursor: 'pointer', position: 'relative',
                                transition: 'background 200ms',
                              }}
                            >
                              <span style={{
                                position: 'absolute', top: 3, left: editChatEnabled ? 25 : 3,
                                width: 20, height: 20, borderRadius: '50%', background: 'white',
                                boxShadow: '0 1px 3px rgba(0,0,0,.3)',
                                transition: 'left 200ms',
                              }} />
                            </button>
                          </div>
                        )}
                        {/* Emoji */}
                        <div>
                          <label style={labelSt}>{t('adm.emoji')}</label>
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
                          <button className="btn btn-secondary" onClick={() => { setEditTarget(null); setErr('') }}>{t('cancel')}</button>
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

        {/* ── AUDIT TAB ── */}
        {tab === 'audit' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ fontSize: 13, color: 'var(--silver3)' }}>
                {auditLoad ? 'Memuat…' : `${auditLogs.length} aktivitas terbaru`}
              </span>
              <button onClick={loadAudit} disabled={auditLoad} style={{ height: 30, padding: '0 12px', background: 'var(--bg4)', border: '1px solid var(--border2)', borderRadius: 8, cursor: 'pointer', fontSize: 12, color: 'var(--silver)', fontFamily: 'var(--font)' }}>
                ↻ Muat ulang
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {!auditLoad && auditLogs.length === 0 && (
                <div style={{ padding: 28, textAlign: 'center', color: 'var(--silver4)', fontSize: 13 }}>{t('adm.noaudit')}</div>
              )}
              {auditLogs.map(log => {
                const meta = AUDIT_LABELS[log.action] ?? { label: log.action, color: 'var(--silver3)' }
                const extra = Object.entries(log.metadata ?? {}).filter(([, v]) => v !== '' && v != null && v !== false)
                return (
                  <div key={log.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 12px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10 }}>
                    <span style={{ flexShrink: 0, marginTop: 1, fontSize: 10, fontWeight: 800, color: 'white', background: meta.color, borderRadius: 6, padding: '3px 7px', whiteSpace: 'nowrap', fontFamily: 'var(--mono)' }}>{meta.label}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, color: 'var(--silver)' }}>
                        <strong>{log.actor_name ?? 'Sistem'}</strong>
                        {log.target_label && <span style={{ color: 'var(--silver3)' }}> → {log.target_label}</span>}
                      </div>
                      {extra.length > 0 && (
                        <div style={{ fontSize: 11, color: 'var(--silver4)', marginTop: 2, fontFamily: 'var(--mono)' }}>
                          {extra.map(([k, v]) => `${k}: ${String(v)}`).join(' · ')}
                        </div>
                      )}
                    </div>
                    <div style={{ flexShrink: 0, textAlign: 'right' }}>
                      <div style={{ fontSize: 11, color: 'var(--silver4)', whiteSpace: 'nowrap' }}>
                        {new Date(log.created_at).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </div>
                      {log.ip && <div style={{ fontSize: 10, color: 'var(--silver4)', fontFamily: 'var(--mono)' }}>{log.ip}</div>}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── SETTINGS TAB ── */}
        {tab === 'settings' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 520 }}>
            <p style={{ fontSize: 13, color: 'var(--silver3)', marginBottom: 4 }}>
              Konfigurasi fitur global aplikasi.
            </p>

            {/* Announcements */}
            <div style={{ padding: '16px 20px', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--silver)' }}>📢 {t('adm.announce')}</div>
              <div style={{ fontSize: 12, color: 'var(--silver3)', marginTop: -4 }}>Kirim pengumuman ke pengguna (banner + notifikasi). Bisa ditargetkan.</div>
              <input value={annTitle} onChange={e => setAnnTitle(e.target.value)} placeholder={t('adm.anntitle')} maxLength={80} style={inputSt} />
              <textarea value={annBody} onChange={e => setAnnBody(e.target.value)} placeholder={t('adm.annbody')} rows={3} maxLength={500} style={{ ...inputSt, height: 'auto', padding: '8px 12px', resize: 'vertical', lineHeight: 1.5 }} />
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <select value={annRole} onChange={e => setAnnRole(e.target.value)} style={{ ...inputSt, width: 'auto', flex: 1, minWidth: 110 }}>
                  <option value="">{t('adm.allroles')}</option>
                  <option value="admin">{t('adm.role.admin')}</option>
                  <option value="user">{t('adm.role.user')}</option>
                  <option value="guest">{t('adm.role.guest')}</option>
                </select>
                <select value={annRegion} onChange={e => setAnnRegion(e.target.value)} style={{ ...inputSt, width: 'auto', flex: 1, minWidth: 110 }}>
                  <option value="">{t('adm.allregions2')}</option>
                  {REGIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
                <select value={annUnit} onChange={e => setAnnUnit(e.target.value)} style={{ ...inputSt, width: 'auto', flex: 1, minWidth: 110 }}>
                  <option value="">{t('adm.allunits2')}</option>
                  {UNITS.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
                </select>
              </div>
              <button
                onClick={sendAnnouncement}
                disabled={annSending || !annTitle.trim() || !annBody.trim()}
                style={{ height: 40, background: annSending || !annTitle.trim() || !annBody.trim() ? 'var(--border2)' : 'var(--accent)', border: 'none', borderRadius: 10, color: 'white', fontSize: 13, fontWeight: 700, cursor: annSending ? 'wait' : 'pointer', fontFamily: 'var(--font)' }}
              >
                {annSending ? 'Mengirim…' : 'Kirim pengumuman'}
              </button>

              {annList.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
                  {annList.map(a => (
                    <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, opacity: a.is_active ? 1 : 0.55 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--silver)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {a.title}{!a.is_active && ' · nonaktif'}
                        </div>
                        <div style={{ fontSize: 10.5, color: 'var(--silver4)', fontFamily: 'var(--mono)' }}>
                          {(a.target_role ?? 'semua role')} · {(a.target_region ?? 'semua wilayah')} · {(a.target_unit ?? 'semua unit')}
                        </div>
                      </div>
                      {a.is_active && (
                        <button onClick={() => removeAnnouncement(a.id)} style={{ flexShrink: 0, height: 28, padding: '0 10px', background: 'var(--bg4)', border: '1px solid var(--border2)', borderRadius: 7, cursor: 'pointer', fontSize: 11, color: 'var(--red)', fontFamily: 'var(--font)' }}>
                          Nonaktifkan
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Chat Toggle */}
            <div style={{
              padding: '16px 20px', background: 'var(--bg3)',
              border: '1px solid var(--border2)', borderRadius: 14,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
            }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--silver)', marginBottom: 3 }}>
                  💬 Fitur Chat Internal
                </div>
                <div style={{ fontSize: 12, color: 'var(--silver3)' }}>
                  Aktifkan/nonaktifkan chat untuk semua pengguna. Saat dinonaktifkan, ikon chat akan disembunyikan.
                </div>
              </div>
              <button
                onClick={async () => {
                  const newVal = !chatEnabled
                  await setChatEnabled(newVal)
                  toast(t('adm.chattoggle', { state: newVal ? t('adm.chaton') : t('adm.chatoff') }), 'success')
                }}
                style={{
                  flexShrink: 0, width: 52, height: 28, borderRadius: 14,
                  background: chatEnabled ? 'var(--accent)' : 'var(--border2)',
                  border: 'none', cursor: 'pointer', position: 'relative',
                  transition: 'background 200ms',
                }}
                title={chatEnabled ? 'Nonaktifkan Chat' : 'Aktifkan Chat'}
              >
                <span style={{
                  position: 'absolute', top: 4, left: chatEnabled ? 28 : 4,
                  width: 20, height: 20, borderRadius: '50%', background: 'white',
                  boxShadow: '0 1px 4px rgba(0,0,0,.3)',
                  transition: 'left 200ms',
                }} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
