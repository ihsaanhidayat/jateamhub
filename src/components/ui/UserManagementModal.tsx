import { useState, useEffect } from 'react'
import Modal from './Modal'
import { useAuthStore } from '../../store/authStore'
import { useStore } from '../../store/dashboardStore'
import { ROLE_LABELS, ROLE_BADGE_COLOR, ROLE_DESC, UNIT_LABELS, UNIT_BADGE_COLOR, UNIT_OPTIONS } from '../../utils/roles'
import type { Role, UnitId } from '../../types'
import type { Profile } from '../../utils/supabaseClient'

interface Props { open: boolean; onClose: () => void }
type View = 'list' | 'add' | 'edit'

export default function UserManagementModal({ open, onClose }: Props) {
  const { profile: myProfile, users, loadUsers, addUser, updateUser, removeUser } = useAuthStore()
  const { toast, config } = useStore()

  const [view, setView] = useState<View>('list')
  const [editTarget, setEditTarget] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(false)

  // Add
  const [newUser, setNewUser] = useState('')
  const [newPass, setNewPass] = useState('')
  const [newRole, setNewRole] = useState<Role>('user')
  const [newUnitId, setNewUnitId] = useState<UnitId>('')
  const [newKey, setNewKey] = useState('')

  // Edit
  const [editRole, setEditRole] = useState<Role>('user')
  const [editUnitId, setEditUnitId] = useState<UnitId>('')
  const [editPass, setEditPass] = useState('')

  const [err, setErr] = useState('')

  const isSuperAdmin = myProfile?.role === 'superadmin'

  useEffect(() => {
    if (open) { loadUsers(); setView('list'); setErr('') }
  }, [open])

  const openEdit = (u: Profile) => {
    setEditTarget(u)
    setEditRole(u.role)
    setEditUnitId(u.unit_id)
    setEditPass('')
    setErr('')
    setView('edit')
  }

  const handleAdd = async () => {
    setErr(''); setLoading(true)
    const error = await addUser(newUser.trim(), newPass, newRole, newRole === 'user' ? newUnitId : '', newRole === 'admin' ? newKey : config.meta.adminKey)
    setLoading(false)
    if (error) { setErr(error); return }
    toast(`User "${newUser}" ditambahkan.`, 'success')
    setNewUser(''); setNewPass(''); setNewKey(''); setNewRole('user'); setNewUnitId('')
    setView('list')
  }

  const handleSaveEdit = async () => {
    if (!editTarget) return
    setErr(''); setLoading(true)
    const error = await updateUser(editTarget.id, editRole, editRole === 'user' ? editUnitId : '', editPass.trim() || undefined)
    setLoading(false)
    if (error) { setErr(error); return }
    toast(`User "${editTarget.username}" diperbarui.`, 'success')
    setView('list')
  }

  const handleDelete = async (u: Profile) => {
    if (!confirm(`Hapus user "${u.username}"?`)) return
    setLoading(true)
    const error = await removeUser(u.id)
    setLoading(false)
    if (error) { toast(error, 'error'); return }
    toast(`User "${u.username}" dihapus.`, 'success')
  }

  const goList = () => { setView('list'); setErr(''); setEditTarget(null) }

  const getBadge = (u: Profile) => {
    if (u.role !== 'user') return { label: ROLE_LABELS[u.role], color: ROLE_BADGE_COLOR[u.role] }
    return { label: UNIT_LABELS[u.unit_id] ?? 'User', color: UNIT_BADGE_COLOR[u.unit_id] ?? '#999' }
  }

  return (
    <Modal open={open}
      title={view === 'list' ? `Kelola Users (${users.length})` : view === 'add' ? 'Tambah User' : `Edit: ${editTarget?.username}`}
      onClose={onClose}
      footer={
        view === 'list'
          ? <button className="btn-save" onClick={() => { setView('add'); setErr('') }}>＋ Tambah User</button>
          : <>
            <button className="btn-cancel" onClick={goList} disabled={loading}>Batal</button>
            <button className="btn-save" onClick={view === 'add' ? handleAdd : handleSaveEdit} disabled={loading}>
              {loading ? 'Menyimpan...' : 'Simpan'}
            </button>
          </>
      }
    >
      {/* LIST */}
      {view === 'list' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {users.length === 0 && (
            <div style={{ textAlign: 'center', padding: '20px', color: 'var(--silver3)', fontSize: 13 }}>
              Memuat users...
            </div>
          )}
          {users.map(u => {
            const badge = getBadge(u)
            const isMe = u.id === myProfile?.id
            const isSA = u.role === 'superadmin'
            const adminCant = myProfile?.role === 'admin' && (u.role === 'admin' || u.role === 'superadmin')
            const cantEdit = adminCant

            return (
              <div key={u.id} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px',
                background: 'var(--bg3)', border: `1px solid ${isMe ? 'var(--mint)' : 'var(--border)'}`,
                borderRadius: 'var(--radius-sm)',
              }}>
                <span style={{
                  fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 2,
                  background: badge.color + '22', border: `1px solid ${badge.color}55`,
                  color: badge.color, textTransform: 'uppercase', fontFamily: 'var(--mono)',
                  minWidth: 52, textAlign: 'center',
                }}>{badge.label}</span>

                <span style={{ flex: 1, fontSize: 13, color: isMe ? 'var(--mint)' : 'var(--silver)' }}>
                  {u.username}
                  {isMe && <span style={{ fontSize: 10, color: 'var(--silver3)', marginLeft: 6 }}>(kamu)</span>}
                </span>

                <button onClick={() => openEdit(u)} disabled={cantEdit || loading}
                  style={{
                    background: 'var(--bg4)', border: '1px solid var(--border2)',
                    borderRadius: 'var(--radius-sm)', color: 'var(--silver3)',
                    padding: '4px 10px', fontSize: 11,
                    cursor: cantEdit ? 'not-allowed' : 'pointer',
                    opacity: cantEdit ? .4 : 1,
                  }}
                  onMouseEnter={e => { if (!cantEdit) (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--mint)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border2)' }}
                >Edit</button>

                {!isSA && !isMe && !adminCant && (
                  <button onClick={() => handleDelete(u)} disabled={loading}
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
          <div className="field"><label>Username</label>
            <input value={newUser} onChange={e => setNewUser(e.target.value)} placeholder="username baru" autoFocus disabled={loading} />
          </div>
          <div className="field"><label>Password</label>
            <input type="password" value={newPass} onChange={e => setNewPass(e.target.value)} placeholder="min. 6 karakter" disabled={loading} />
          </div>
          <div className="field">
            <label>Role</label>
            <select value={newRole} onChange={e => setNewRole(e.target.value as Role)} disabled={loading}>
              <option value="user">User — {ROLE_DESC.user}</option>
              {isSuperAdmin && <option value="admin">Admin — {ROLE_DESC.admin}</option>}
            </select>
          </div>
          {newRole === 'user' && (
            <div className="field">
              <label>Unit</label>
              <select value={newUnitId} onChange={e => setNewUnitId(e.target.value as UnitId)} disabled={loading}>
                {UNIT_OPTIONS.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
              </select>
            </div>
          )}
          {newRole === 'admin' && isSuperAdmin && (
            <div className="field"><label>Admin Key</label>
              <input type="password" value={newKey} onChange={e => setNewKey(e.target.value)} disabled={loading} />
            </div>
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
            <select value={editRole} onChange={e => setEditRole(e.target.value as Role)}
              disabled={loading || editTarget.id === myProfile?.id}>
              <option value="user">User</option>
              {isSuperAdmin && <option value="admin">Admin</option>}
            </select>
          </div>
          {editRole === 'user' && (
            <div className="field">
              <label>Unit</label>
              <select value={editUnitId} onChange={e => setEditUnitId(e.target.value as UnitId)} disabled={loading}>
                {UNIT_OPTIONS.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
              </select>
            </div>
          )}
          <div className="field">
            <label>Password Baru (kosong = tidak berubah)</label>
            <input type="password" value={editPass} onChange={e => setEditPass(e.target.value)}
              placeholder="min. 6 karakter" disabled={loading} />
          </div>
          {err && <div style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{err}</div>}
        </div>
      )}
    </Modal>
  )
}
