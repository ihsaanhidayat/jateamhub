import { useState, useEffect } from 'react'
import Modal from './Modal'
import { useStore } from '../../store/dashboardStore'
import { ROLE_LABELS, ROLE_BADGE_COLOR, ROLE_DESC, UNIT_LABELS, UNIT_BADGE_COLOR, UNIT_OPTIONS } from '../../utils/roles'
import type { UserAccount, Role, UnitId } from '../../types'

interface Props { open: boolean; onClose: () => void }
type View = 'list' | 'add' | 'edit'

export default function UserManagementModal({ open, onClose }: Props) {
  const { session, getUsers, register, updateUser, deleteUser, toast, config } = useStore()
  const [users,      setUsers]      = useState<UserAccount[]>([])
  const [view,       setView]       = useState<View>('list')
  const [editTarget, setEditTarget] = useState<UserAccount | null>(null)

  // Add
  const [newUser,   setNewUser]   = useState('')
  const [newPass,   setNewPass]   = useState('')
  const [newRole,   setNewRole]   = useState<Role>('user')
  const [newUnitId, setNewUnitId] = useState<UnitId>('')
  const [newKey,    setNewKey]    = useState('')

  // Edit
  const [editRole,   setEditRole]   = useState<Role>('user')
  const [editUnitId, setEditUnitId] = useState<UnitId>('')
  const [editPass,   setEditPass]   = useState('')

  const [err, setErr] = useState('')

  const isSuperAdmin = session?.role === 'superadmin'
  const adminKey     = config.meta.adminKey || 'jateamhub2024'

  useEffect(() => {
    if (open) { setUsers(getUsers()); setView('list'); setErr('') }
  }, [open])

  const refresh = () => setUsers(getUsers())

  const openEdit = (u: UserAccount) => {
    setEditTarget(u); setEditRole(u.role); setEditUnitId(u.unitId ?? ''); setEditPass(''); setErr(''); setView('edit')
  }

  const handleAdd = () => {
    setErr('')
    const error = register(newUser.trim(), newPass, newRole, newRole === 'user' ? newUnitId : '', newRole === 'admin' ? newKey : '')
    if (error) { setErr(error); return }
    toast(`User "${newUser}" ditambahkan.`, 'success')
    setNewUser(''); setNewPass(''); setNewKey(''); setNewRole('user'); setNewUnitId('')
    refresh(); setView('list')
  }

  const handleSaveEdit = () => {
    if (!editTarget) return
    setErr('')
    const error = updateUser(editTarget.username, editRole, editRole === 'user' ? editUnitId : '', editPass.trim() || undefined)
    if (error) { setErr(error); return }
    toast(`User "${editTarget.username}" diperbarui.`, 'success')
    refresh(); setView('list')
  }

  const handleDelete = (username: string) => {
    if (!confirm(`Hapus user "${username}"?`)) return
    const err = deleteUser(username)
    if (err) { toast(err, 'error'); return }
    toast(`User "${username}" dihapus.`, 'success'); refresh()
  }

  const goList = () => { setView('list'); setErr(''); setEditTarget(null) }

  const getRoleBadge = (u: UserAccount) => {
    if (u.role !== 'user') return { label: ROLE_LABELS[u.role], color: ROLE_BADGE_COLOR[u.role] }
    const uid = u.unitId ?? ''
    return { label: UNIT_LABELS[uid] ?? 'User', color: UNIT_BADGE_COLOR[uid] ?? '#999' }
  }

  return (
    <Modal open={open}
      title={view === 'list' ? 'Kelola Users' : view === 'add' ? 'Tambah User' : `Edit: ${editTarget?.username}`}
      onClose={onClose}
      footer={
        view === 'list'
          ? <button className="btn-save" onClick={() => { setView('add'); setErr('') }}>＋ Tambah User</button>
          : <><button className="btn-cancel" onClick={goList}>Batal</button><button className="btn-save" onClick={view === 'add' ? handleAdd : handleSaveEdit}>Simpan</button></>
      }
    >
      {/* LIST */}
      {view === 'list' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 11, color: 'var(--silver3)', marginBottom: 4 }}>{users.length} user terdaftar</div>
          {users.map(u => {
            const badge     = getRoleBadge(u)
            const isMe      = u.username === session?.username
            const isSA      = u.role === 'superadmin'
            const adminCant = session?.role === 'admin' && (u.role === 'admin' || u.role === 'superadmin')
            const cantEdit  = isMe || adminCant
            return (
              <div key={u.username} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px',
                background: 'var(--bg3)', border: `1px solid ${isMe ? 'var(--mint)' : 'var(--border)'}`, borderRadius: 'var(--radius-sm)',
              }}>
                <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 2, background: badge.color + '22', border: `1px solid ${badge.color}55`, color: badge.color, textTransform: 'uppercase', fontFamily: 'var(--mono)', minWidth: 52, textAlign: 'center' }}>
                  {badge.label}
                </span>
                <span style={{ flex: 1, fontSize: 13, color: isMe ? 'var(--mint)' : 'var(--silver)' }}>
                  {u.username}{isMe && <span style={{ fontSize: 10, color: 'var(--silver3)', marginLeft: 6 }}>(kamu)</span>}
                </span>
                {!isSA && (
                  <button onClick={() => openEdit(u)} disabled={cantEdit}
                    style={{ background: 'var(--bg4)', border: '1px solid var(--border2)', borderRadius: 'var(--radius-sm)', color: 'var(--silver3)', padding: '4px 10px', fontSize: 11, cursor: cantEdit ? 'not-allowed' : 'pointer', opacity: cantEdit ? .4 : 1 }}
                    onMouseEnter={e => { if (!cantEdit) (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--mint)' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border2)' }}>Edit</button>
                )}
                {!isSA && !isMe && !adminCant && (
                  <button onClick={() => handleDelete(u.username)}
                    style={{ background: 'none', border: 'none', color: 'var(--silver3)', cursor: 'pointer', fontSize: 15, padding: '2px 4px', lineHeight: 1 }}
                    onMouseEnter={e => (e.currentTarget.style.color = 'var(--red)')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'var(--silver3)')}>🗑</button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ADD */}
      {view === 'add' && (
        <div>
          <div className="field"><label>Username</label><input value={newUser} onChange={e => setNewUser(e.target.value)} placeholder="username baru" autoFocus /></div>
          <div className="field"><label>Password</label><input type="password" value={newPass} onChange={e => setNewPass(e.target.value)} placeholder="min. 6 karakter" /></div>
          <div className="field">
            <label>Role</label>
            <select value={newRole} onChange={e => setNewRole(e.target.value as Role)}>
              <option value="user">User — {ROLE_DESC.user}</option>
              {isSuperAdmin && <option value="admin">Admin — {ROLE_DESC.admin}</option>}
            </select>
          </div>
          {newRole === 'user' && (
            <div className="field">
              <label>Unit (opsional)</label>
              <select value={newUnitId} onChange={e => setNewUnitId(e.target.value as UnitId)}>
                {UNIT_OPTIONS.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
              </select>
            </div>
          )}
          {newRole === 'admin' && isSuperAdmin && (
            <div className="field"><label>Admin Key</label><input type="password" value={newKey} onChange={e => setNewKey(e.target.value)} /></div>
          )}
          {err && <div style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{err}</div>}
        </div>
      )}

      {/* EDIT */}
      {view === 'edit' && editTarget && (
        <div>
          <div style={{ padding: '10px 12px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', marginBottom: 16, fontSize: 13, color: 'var(--silver2)' }}>
            Editing: <strong style={{ color: 'var(--mint)' }}>{editTarget.username}</strong>
          </div>
          <div className="field">
            <label>Role</label>
            <select value={editRole} onChange={e => setEditRole(e.target.value as Role)} disabled={editTarget.username === session?.username}>
              <option value="user">User</option>
              {isSuperAdmin && <option value="admin">Admin</option>}
            </select>
          </div>
          {editRole === 'user' && (
            <div className="field">
              <label>Unit</label>
              <select value={editUnitId} onChange={e => setEditUnitId(e.target.value as UnitId)}>
                {UNIT_OPTIONS.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
              </select>
            </div>
          )}
          <div className="field">
            <label>Password Baru (kosong = tidak berubah)</label>
            <input type="password" value={editPass} onChange={e => setEditPass(e.target.value)} placeholder="min. 6 karakter" />
          </div>
          {err && <div style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{err}</div>}
        </div>
      )}
    </Modal>
  )
}
